package com.negresco.finance.security

import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.PrintWriter
import java.nio.charset.StandardCharsets
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.Base64
import java.util.UUID

/**
 * SEC-05K: ISOLATED CHILD JVM, volatile signed monotonic-floor fixture.
 *
 * The child has NO JDBC connection and no persistence. It is not a real
 * independent service, deployed authority, HSM, or tamper-resistant counter.
 * The parent receives the public key from the child: this is NOT authenticated
 * key pinning. A hostile child can lie; restarting loses the floor and key.
 *
 * Only disposable opaque account/kit identifiers, counters and ciphertext
 * hashes travel through stdin/stdout. No backup keys or financial data.
 */
internal object SyntheticIndependentGenerationFloorFixtureLab {
  private val crypto = SyntheticSignedRekeyAuthorityChallengeLab
  private val b64 = Base64.getEncoder()
  private val b64d = Base64.getDecoder()

  private fun parseClaim(fields: List<String>, offset: Int): SyntheticRekeyGenerationClaimLab {
    require(fields.size >= offset + 5)
    val c = SyntheticRekeyGenerationClaimLab(
      fields[offset], fields[offset + 1],
      fields[offset + 2].toLong(), fields[offset + 3].toLong(),
      b64d.decode(fields[offset + 4])
    )
    require(crypto.validClaimFixtureOnly(c))
    return c
  }

  fun runFixtureOnly() {
    val keyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
    val input = BufferedReader(InputStreamReader(System.`in`, StandardCharsets.UTF_8))
    val output = PrintWriter(System.out, true)
    var current: SyntheticRekeyGenerationClaimLab? = null
    output.println("READY|" + b64.encodeToString(keyPair.public.encoded))
    while (true) {
      val command = input.readLine() ?: break
      val response = try {
        val fields = command.split('|')
        when (fields.firstOrNull()) {
          "ENROLL" -> {
            require(fields.size == 6)
            val next = parseClaim(fields, 1)
            if (current != null) "DENY_ALREADY_ENROLLED"
            else { current = next; "OK_ENROLLED" }
          }
          "ADVANCE" -> {
            require(fields.size == 11)
            val expected = parseClaim(fields, 1)
            val next = parseClaim(fields, 6)
            val previous = current
            if (previous == null) "DENY_NO_STATE"
            else if (!crypto.equivalentFixtureOnly(previous, expected)) "DENY_PREDECESSOR"
            else if (expected.accountId != next.accountId ||
              expected.kitId == next.kitId ||
              expected.version >= Long.MAX_VALUE - 1 ||
              expected.generation >= Long.MAX_VALUE - 1 ||
              next.version != expected.version + 1 ||
              next.generation != expected.generation + 1) "DENY_INVALID_TRANSITION"
            else { current = next; "OK_ADVANCED" }
          }
          "QUOTE" -> {
            require(fields.size == 2)
            val nonce = b64d.decode(fields[1])
            require(nonce.size == crypto.CHALLENGE_SIZE)
            val snapshot = current
            if (snapshot == null) "DENY_NO_STATE"
            else {
              val signer = Signature.getInstance("Ed25519")
              signer.initSign(keyPair.private)
              signer.update(crypto.payloadFixtureOnly(snapshot, nonce))
              listOf("QUOTE", snapshot.accountId, snapshot.kitId,
                snapshot.version.toString(), snapshot.generation.toString(),
                b64.encodeToString(snapshot.ciphertextHash),
                b64.encodeToString(signer.sign())).joinToString("|")
            }
          }
          "EXIT" -> "BYE"
          else -> "DENY_COMMAND"
        }
      } catch (_: Exception) { "DENY_MALFORMED" }
      output.println(response)
      if (command == "EXIT") break
    }
  }
}

/** Child entrypoint uses neither JDBC nor production Android code. */
fun main(args: Array<String>) {
  require(args.size == 1 && args[0] == "--sec05k-independent-floor-fixture-only")
  SyntheticIndependentGenerationFloorFixtureLab.runFixtureOnly()
}

internal class SyntheticIndependentFloorClientFixtureLab : AutoCloseable {
  private val b64 = Base64.getEncoder()
  private val d = Base64.getDecoder()
  private val javaBin = java.nio.file.Paths.get(
    System.getProperty("java.home"), "bin",
    if (System.getProperty("os.name").lowercase().contains("win")) "java.exe" else "java"
  )
  private val child = ProcessBuilder(javaBin.toString(), "-cp",
    System.getProperty("java.class.path"),
    "com.negresco.finance.security.SyntheticIndependentGenerationFloorFixtureLabKt",
    "--sec05k-independent-floor-fixture-only"
  ).redirectErrorStream(true).start()
  private val stdout = child.inputStream.bufferedReader(StandardCharsets.UTF_8)
  private val stdin = PrintWriter(child.outputStream.writer(StandardCharsets.UTF_8), true)

  /** Trust-on-creation ONLY for fixture. Never trusted production key pinning. */
  val childPublicKey: java.security.PublicKey = run {
    val hello = stdout.readLine() ?: error("SEC05K missing child announcement")
    require(hello.startsWith("READY|"))
    KeyFactory.getInstance("Ed25519").generatePublic(
      X509EncodedKeySpec(d.decode(hello.substringAfter('|')))
    )
  }

  private fun fields(c: SyntheticRekeyGenerationClaimLab): String =
    listOf(c.accountId,c.kitId,c.version.toString(),c.generation.toString(),
      b64.encodeToString(c.ciphertextHash)).joinToString("|")

  fun call(command: String): String {
    check(child.isAlive) { "Fixture floor child is offline" }
    stdin.println(command)
    return stdout.readLine() ?: error("Fixture floor child produced no response")
  }
  fun enroll(c: SyntheticRekeyGenerationClaimLab) = call("ENROLL|" + fields(c))
  fun advance(
    before: SyntheticRekeyGenerationClaimLab,
    after: SyntheticRekeyGenerationClaimLab
  ) = call("ADVANCE|" + fields(before) + "|" + fields(after))

  fun signedCurrent(
    nonce: ByteArray
  ): Pair<SyntheticRekeyGenerationClaimLab, ByteArray>? {
    val line = call("QUOTE|" + b64.encodeToString(nonce))
    if (line == "DENY_NO_STATE") return null
    val values = line.split('|')
    require(values.size == 7 && values[0] == "QUOTE")
    return Pair(
      SyntheticRekeyGenerationClaimLab(
        values[1],values[2],values[3].toLong(),values[4].toLong(),d.decode(values[5])
      ),d.decode(values[6])
    )
  }

  override fun close() {
    if (child.isAlive) {
      runCatching { call("EXIT") }
      if (!child.waitFor(5L, java.util.concurrent.TimeUnit.SECONDS)) {
        child.destroyForcibly()
        child.waitFor(5L, java.util.concurrent.TimeUnit.SECONDS)
      }
    }
    runCatching { stdin.close() }
    runCatching { stdout.close() }
  }
}

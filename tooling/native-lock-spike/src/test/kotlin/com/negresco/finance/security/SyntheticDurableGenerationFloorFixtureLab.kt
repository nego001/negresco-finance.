package com.negresco.finance.security

import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.PrintWriter
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.Paths
import java.nio.file.StandardCopyOption
import java.nio.file.StandardOpenOption
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.PublicKey
import java.security.Signature
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec
import java.util.Base64
import java.util.UUID

/**
 * SEC-05K disposable authority process, persistent OUTSIDE the PostgreSQL DB.
 * The key is stored UNENCRYPTED in a synthetic file, not a production KMS.
 * Its state resists a DB-only restore, but replaying this authority's OWN
 * older state file defeats monotonicity. Checksum detects accidental damage,
 * not malicious rollback. No real money, APK, or identity verification.
 */
internal object SyntheticDurableGenerationFloorFixtureLab {
  private val crypto = SyntheticSignedRekeyAuthorityChallengeLab
  private val b64 = Base64.getEncoder()
  private val dec = Base64.getDecoder()
  private val utf8 = StandardCharsets.UTF_8
  private const val magic = "SEC05K-DURABLE-FLOOR-FIXTURE-V1"
  private val noFollow = LinkOption.NOFOLLOW_LINKS

  private fun digest(bytes: ByteArray): String =
    MessageDigest.getInstance("SHA-256").digest(bytes)
      .joinToString("") { "%02x".format(it.toInt() and 255) }

  private fun checkPaths(dir: Path) {
    require(dir.isAbsolute && Files.isDirectory(dir, noFollow))
    require(!Files.isSymbolicLink(dir))
    for (name in listOf("authority.state", "authority.lock")) {
      require(!Files.isSymbolicLink(dir.resolve(name))) { "DENY_SYMLINK" }
    }
  }

  private fun <T> locked(dir: Path, operation: () -> T): T {
    checkPaths(dir)
    FileChannel.open(dir.resolve("authority.lock"), StandardOpenOption.CREATE,
      StandardOpenOption.WRITE, noFollow).use { channel ->
      channel.lock().use {
        checkPaths(dir)
        return operation()
      }
    }
  }

  private fun readBounded(path: Path): ByteArray =
    FileChannel.open(path, StandardOpenOption.READ, noFollow).use { channel ->
      val size = channel.size()
      require(size in 1..16384) { "DENY_CORRUPT" }
      val buffer = ByteBuffer.allocate(size.toInt())
      while (buffer.hasRemaining()) require(channel.read(buffer) > 0) { "DENY_CORRUPT" }
      require(channel.size() == size) { "DENY_CORRUPT" }
      buffer.array()
    }

  private data class State(val pair: KeyPair,
                           val claim: SyntheticRekeyGenerationClaimLab?)

  private fun encode(state: State): ByteArray {
    val claim = state.claim?.let {
      listOf(it.accountId, it.kitId, it.version.toString(),
        it.generation.toString(), b64.encodeToString(it.ciphertextHash)).joinToString("|")
    } ?: "UNENROLLED"
    val body = listOf(magic, b64.encodeToString(state.pair.public.encoded),
      b64.encodeToString(state.pair.private.encoded), claim).joinToString("\n")
    return (body + "\n" + digest(body.toByteArray(utf8)) + "\n").toByteArray(utf8)
  }

  private fun decode(bytes: ByteArray): State {
    val lines = String(bytes, utf8).removeSuffix("\n").split('\n')
    require(lines.size == 5 && lines[0] == magic) { "DENY_CORRUPT" }
    val body = lines.take(4).joinToString("\n")
    require(MessageDigest.isEqual(
      digest(body.toByteArray(utf8)).toByteArray(utf8),
      lines[4].toByteArray(utf8))) { "DENY_CORRUPT" }
    val factory = KeyFactory.getInstance("Ed25519")
    val public = factory.generatePublic(X509EncodedKeySpec(dec.decode(lines[1])))
    val private = factory.generatePrivate(PKCS8EncodedKeySpec(dec.decode(lines[2])))
    val pairCheck = Signature.getInstance("Ed25519")
    pairCheck.initSign(private)
    pairCheck.update(magic.toByteArray(utf8))
    val signed = pairCheck.sign()
    val verify = Signature.getInstance("Ed25519")
    verify.initVerify(public)
    verify.update(magic.toByteArray(utf8))
    require(verify.verify(signed)) { "DENY_CORRUPT" }
    val claim = if (lines[3] == "UNENROLLED") null else {
      val f = lines[3].split('|')
      require(f.size == 5) { "DENY_CORRUPT" }
      SyntheticRekeyGenerationClaimLab(f[0], f[1], f[2].toLong(),
        f[3].toLong(), dec.decode(f[4])).also {
        require(crypto.validClaimFixtureOnly(it)) { "DENY_CORRUPT" }
      }
    }
    return State(KeyPair(public, private), claim)
  }

  private fun persist(dir: Path, state: State) {
    val temp = dir.resolve("temporary-" + UUID.randomUUID().toString() + ".state")
    try {
      FileChannel.open(temp, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE,
        noFollow).use { channel ->
        val buffer = ByteBuffer.wrap(encode(state))
        while (buffer.hasRemaining()) require(channel.write(buffer) > 0)
        channel.force(true)
      }
      Files.move(temp, dir.resolve("authority.state"),
        StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
      FileChannel.open(dir, StandardOpenOption.READ).use { it.force(true) }
    } finally {
      Files.deleteIfExists(temp)
    }
  }

  private fun load(dir: Path): State =
    decode(readBounded(dir.resolve("authority.state")))

  private fun initialize(dir: Path): State = locked(dir) {
    if (!Files.exists(dir.resolve("authority.state"), noFollow)) {
      persist(dir, State(KeyPairGenerator.getInstance("Ed25519").generateKeyPair(), null))
    }
    load(dir)
  }

  private fun parseClaim(fields: List<String>, start: Int): SyntheticRekeyGenerationClaimLab {
    require(fields.size >= start + 5)
    return SyntheticRekeyGenerationClaimLab(fields[start], fields[start + 1],
      fields[start + 2].toLong(), fields[start + 3].toLong(),
      dec.decode(fields[start + 4])).also {
        require(crypto.validClaimFixtureOnly(it))
      }
  }

  fun runFixtureOnly(dir: Path) {
    val originalKey = initialize(dir).pair.public.encoded
    val stdin = BufferedReader(InputStreamReader(System.`in`, utf8))
    val stdout = PrintWriter(System.out, true)
    stdout.println("READY|" + b64.encodeToString(originalKey))
    while (true) {
      val command = stdin.readLine() ?: break
      val result = try {
        val p = command.split('|')
        when (p.firstOrNull()) {
          "ENROLL" -> {
            require(p.size == 6)
            val next = parseClaim(p, 1)
            locked(dir) {
              val state = load(dir)
              if (!MessageDigest.isEqual(originalKey, state.pair.public.encoded))
                "DENY_KEY_CHANGED"
              else if (state.claim != null) "DENY_ALREADY_ENROLLED"
              else { persist(dir, state.copy(claim = next)); "OK_ENROLLED" }
            }
          }
          "ADVANCE" -> {
            require(p.size == 11)
            val before = parseClaim(p, 1)
            val next = parseClaim(p, 6)
            locked(dir) {
              val state = load(dir)
              val current = state.claim
              when {
                !MessageDigest.isEqual(originalKey, state.pair.public.encoded) -> "DENY_KEY_CHANGED"
                current == null -> "DENY_NO_STATE"
                !crypto.equivalentFixtureOnly(current, before) -> "DENY_PREDECESSOR"
                before.accountId != next.accountId || before.kitId == next.kitId ||
                  before.version >= Long.MAX_VALUE - 1 ||
                  before.generation >= Long.MAX_VALUE - 1 ||
                  next.version != before.version + 1 ||
                  next.generation != before.generation + 1 -> "DENY_INVALID_TRANSITION"
                else -> { persist(dir, state.copy(claim = next)); "OK_ADVANCED" }
              }
            }
          }
          "QUOTE" -> {
            require(p.size == 2)
            val nonce = dec.decode(p[1])
            require(nonce.size == crypto.CHALLENGE_SIZE)
            locked(dir) {
              val state = load(dir)
              val claim = state.claim
              if (!MessageDigest.isEqual(originalKey, state.pair.public.encoded))
                "DENY_KEY_CHANGED"
              else if (claim == null) "DENY_NO_STATE"
              else {
                val signer = Signature.getInstance("Ed25519")
                signer.initSign(state.pair.private)
                signer.update(crypto.payloadFixtureOnly(claim, nonce))
                listOf("QUOTE", claim.accountId, claim.kitId, claim.version.toString(),
                  claim.generation.toString(), b64.encodeToString(claim.ciphertextHash),
                  b64.encodeToString(signer.sign())).joinToString("|")
              }
            }
          }
          "EXIT" -> "BYE"
          else -> "DENY_COMMAND"
        }
      } catch (_: Exception) { "DENY_MALFORMED_OR_CORRUPT" }
      stdout.println(result)
      if (command == "EXIT") break
    }
  }
}

fun main(args: Array<String>) {
  require(args.size == 2 && args[0] == "--sec05k-durable-floor-fixture-only")
  SyntheticDurableGenerationFloorFixtureLab.runFixtureOnly(Paths.get(args[1]))
}

/** Separate child process; trust-on-first-use is fixture-only, not a real pin. */
internal class SyntheticDurableFloorClientFixtureLab(dir: Path) : AutoCloseable {
  private val b64 = Base64.getEncoder()
  private val dec = Base64.getDecoder()
  private val java = Paths.get(System.getProperty("java.home"), "bin",
    if (System.getProperty("os.name").lowercase().contains("win")) "java.exe" else "java")
  private val child = ProcessBuilder(java.toString(), "-cp",
    System.getProperty("java.class.path"),
    "com.negresco.finance.security.SyntheticDurableGenerationFloorFixtureLabKt",
    "--sec05k-durable-floor-fixture-only", dir.toAbsolutePath().toString())
    .redirectErrorStream(true).start()
  private val stdout = child.inputStream.bufferedReader(StandardCharsets.UTF_8)
  private val stdin = PrintWriter(child.outputStream.writer(StandardCharsets.UTF_8), true)
  val childPublicKey: PublicKey = run {
    val hello = stdout.readLine() ?: error("Durable child exited before READY")
    require(hello.startsWith("READY|")) { "SEC05K durable child failed: " + hello.take(120) }
    KeyFactory.getInstance("Ed25519").generatePublic(
      X509EncodedKeySpec(dec.decode(hello.substringAfter('|'))))
  }
  private fun fields(c: SyntheticRekeyGenerationClaimLab): String =
    listOf(c.accountId, c.kitId, c.version.toString(), c.generation.toString(),
      b64.encodeToString(c.ciphertextHash)).joinToString("|")
  fun call(command: String): String {
    check(child.isAlive) { "Durable child offline" }
    stdin.println(command)
    return stdout.readLine() ?: error("Durable child gave no response")
  }
  fun enroll(c: SyntheticRekeyGenerationClaimLab) = call("ENROLL|" + fields(c))
  fun advance(before: SyntheticRekeyGenerationClaimLab,
              next: SyntheticRekeyGenerationClaimLab) =
    call("ADVANCE|" + fields(before) + "|" + fields(next))
  fun signedCurrent(nonce: ByteArray): Pair<SyntheticRekeyGenerationClaimLab, ByteArray>? {
    val text = call("QUOTE|" + b64.encodeToString(nonce))
    if (text == "DENY_NO_STATE") return null
    val f = text.split('|')
    require(f.size == 7 && f[0] == "QUOTE") { text }
    return Pair(SyntheticRekeyGenerationClaimLab(f[1], f[2], f[3].toLong(),
      f[4].toLong(), dec.decode(f[5])), dec.decode(f[6]))
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

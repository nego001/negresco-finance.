package com.negresco.finance.security

import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.nio.charset.StandardCharsets
import java.nio.file.*
import java.security.*
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec
import java.util.Base64
import java.util.concurrent.TimeUnit
import java.io.PrintWriter

/**
 * SEC-05K DISPOSABLE JVM floor, independent of PostgreSQL.
 * Private signing key is stored in CLEAR PKCS8 in a throwaway directory.
 * This proves restart persistence, NOT tamper-resistant or irreversible monotonicity.
 * Restoring an older copy of ALL authority files can replay signed old state.
 * Never package in Android or use with financial accounts, secrets or real data.
 */
internal object SyntheticPersistentIndependentFloorFixtureLab {
  private val crypto = SyntheticSignedRekeyAuthorityChallengeLab
  private val enc = Base64.getEncoder()
  private val dec = Base64.getDecoder()
  private val utf8 = StandardCharsets.UTF_8
  private val nofollow = LinkOption.NOFOLLOW_LINKS
  private val identityMagic = "SEC05K-IDENTITY-V1\n".toByteArray(utf8)
  private val enrolledMagic = "SEC05K-ENROLLED-V1\n".toByteArray(utf8)
  private val domain = "SEC05K-PERSISTENT-FLOOR-V1\n".toByteArray(utf8)
  private fun exists(p: Path) = Files.exists(p, nofollow)
  private fun checkFile(p: Path) {
    require(!Files.isSymbolicLink(p))
    if (exists(p)) require(Files.isRegularFile(p, nofollow))
  }
  private fun read(p: Path, max: Int): ByteArray {
    checkFile(p)
    return FileChannel.open(p, StandardOpenOption.READ, nofollow).use { ch ->
      val n = ch.size()
      require(n in 1..max.toLong())
      val b = ByteBuffer.allocate(n.toInt())
      while (b.hasRemaining()) require(ch.read(b) > 0)
      require(ch.size() == n)
      b.array()
    }
  }
  private fun write(p: Path, bytes: ByteArray) {
    val tmp = Files.createTempFile(p.parent, ".sec05k-persistent-", ".tmp")
    try {
      FileChannel.open(tmp, StandardOpenOption.WRITE, nofollow).use { ch ->
        val b = ByteBuffer.wrap(bytes)
        while (b.hasRemaining()) require(ch.write(b) > 0)
        ch.force(true)
      }
      Files.move(tmp, p, StandardCopyOption.ATOMIC_MOVE,
        StandardCopyOption.REPLACE_EXISTING)
      FileChannel.open(p.parent, StandardOpenOption.READ).use { it.force(true) }
    } finally { Files.deleteIfExists(tmp) }
  }
  private fun fields(c: SyntheticRekeyGenerationClaimLab): String =
    listOf(c.accountId, c.kitId, c.version, c.generation,
      enc.encodeToString(c.ciphertextHash)).joinToString("|")
  private fun parse(parts: List<String>, start: Int): SyntheticRekeyGenerationClaimLab {
    require(parts.size >= start + 5)
    val c = SyntheticRekeyGenerationClaimLab(parts[start], parts[start + 1],
      parts[start + 2].toLong(), parts[start + 3].toLong(), dec.decode(parts[start + 4]))
    require(crypto.validClaimFixtureOnly(c))
    return c
  }
  private fun signState(c: SyntheticRekeyGenerationClaimLab, key: PrivateKey): ByteArray {
    val data = fields(c).toByteArray(utf8)
    val signature = Signature.getInstance("Ed25519")
    signature.initSign(key)
    signature.update(domain)
    signature.update(data)
    return (enc.encodeToString(data) + "|" +
      enc.encodeToString(signature.sign()) + "\n").toByteArray(utf8)
  }
  private fun verifyState(path: Path, key: PublicKey): SyntheticRekeyGenerationClaimLab {
    val parts = String(read(path, 2048), utf8).trimEnd('\n').split('|')
    require(parts.size == 2)
    val data = dec.decode(parts[0])
    val sig = dec.decode(parts[1])
    require(data.size in 1..512 && sig.size == 64)
    val verify = Signature.getInstance("Ed25519")
    verify.initVerify(key)
    verify.update(domain)
    verify.update(data)
    require(verify.verify(sig))
    val decoded = String(data, utf8).split('|')
    require(decoded.size == 5)
    return parse(decoded, 0)
  }

  fun serveFixtureOnly(root: Path) {
    require(root.fileName.toString().startsWith("negresco-sec05k-floor-"))
    require(!Files.isSymbolicLink(root) && Files.isDirectory(root, nofollow))
    val identity = root.resolve("identity.guard")
    val enrolled = root.resolve("enrolled.guard")
    val privateFile = root.resolve("authority.private")
    val publicFile = root.resolve("authority.public")
    val stateFile = root.resolve("floor.state")
    val lock = root.resolve("floor.lock")
    listOf(identity, enrolled, privateFile, publicFile, stateFile, lock).forEach(::checkFile)
    FileChannel.open(lock, StandardOpenOption.CREATE, StandardOpenOption.WRITE,
      nofollow).use { channel ->
      (channel.tryLock() ?: error("Floor already running")).use {
        val pair: KeyPair = if (!exists(identity)) {
          require(!exists(enrolled) && !exists(privateFile) &&
            !exists(publicFile) && !exists(stateFile))
          val generated = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
          // Latch BEFORE credentials; incomplete provisioning fails closed.
          write(identity, identityMagic)
          write(privateFile, generated.private.encoded)
          write(publicFile, generated.public.encoded)
          generated
        } else {
          require(MessageDigest.isEqual(read(identity, 128), identityMagic))
          val factory = KeyFactory.getInstance("Ed25519")
          KeyPair(
            factory.generatePublic(X509EncodedKeySpec(read(publicFile, 256))),
            factory.generatePrivate(PKCS8EncodedKeySpec(read(privateFile, 256)))
          )
        }
        var current: SyntheticRekeyGenerationClaimLab? = if (exists(enrolled)) {
          require(MessageDigest.isEqual(read(enrolled, 128), enrolledMagic))
          verifyState(stateFile, pair.public)
        } else {
          require(!exists(stateFile))
          null
        }
        val input = System.`in`.bufferedReader(utf8)
        val output = PrintWriter(System.out, true)
        output.println("READY|" + enc.encodeToString(pair.public.encoded))
        while (true) {
          val line = input.readLine() ?: break
          val answer = try {
            val p = line.split('|')
            when (p.firstOrNull()) {
              "ENROLL" -> {
                require(p.size == 6)
                val next = parse(p, 1)
                if (current != null) "DENY_ALREADY_ENROLLED"
                else {
                  write(enrolled, enrolledMagic)
                  write(stateFile, signState(next, pair.private))
                  current = next
                  "OK_ENROLLED"
                }
              }
              "ADVANCE" -> {
                require(p.size == 11)
                val before = parse(p, 1)
                val after = parse(p, 6)
                val saved = current
                if (saved == null) "DENY_NO_STATE"
                else if (!crypto.equivalentFixtureOnly(saved, before)) "DENY_PREDECESSOR"
                else if (before.accountId != after.accountId ||
                  before.kitId == after.kitId ||
                  before.version >= Long.MAX_VALUE - 1 ||
                  before.generation >= Long.MAX_VALUE - 1 ||
                  after.version != before.version + 1 ||
                  after.generation != before.generation + 1) "DENY_INVALID_TRANSITION"
                else {
                  write(stateFile, signState(after, pair.private))
                  current = after
                  "OK_ADVANCED"
                }
              }
              "QUOTE" -> {
                require(p.size == 2)
                val nonce = dec.decode(p[1])
                require(nonce.size == crypto.CHALLENGE_SIZE)
                val c = current
                if (c == null) "DENY_NO_STATE"
                else {
                  val signature = Signature.getInstance("Ed25519")
                  signature.initSign(pair.private)
                  signature.update(crypto.payloadFixtureOnly(c, nonce))
                  "QUOTE|" + fields(c) + "|" + enc.encodeToString(signature.sign())
                }
              }
              "EXIT" -> "BYE"
              else -> "DENY_COMMAND"
            }
          } catch (_: Exception) { "DENY_MALFORMED" }
          output.println(answer)
          if (line == "EXIT") break
        }
      }
    }
  }
}

/** Child JVM has no JDBC connection and receives no key material in argv. */
fun main(args: Array<String>) {
  require(args.size == 2 && args[0] == "--sec05k-persistent-floor-fixture-only")
  try {
    SyntheticPersistentIndependentFloorFixtureLab.serveFixtureOnly(Paths.get(args[1]))
  } catch (_: Exception) { println("DENY_STORAGE") }
}

internal class SyntheticPersistentFloorClientFixtureLab(directory: Path) : AutoCloseable {
  private val enc = Base64.getEncoder()
  private val dec = Base64.getDecoder()
  private val java = Paths.get(System.getProperty("java.home"), "bin",
    if (System.getProperty("os.name").lowercase().contains("win")) "java.exe" else "java")
  private val child = ProcessBuilder(java.toString(), "-cp",
    System.getProperty("java.class.path"),
    "com.negresco.finance.security.SyntheticPersistentIndependentFloorFixtureLabKt",
    "--sec05k-persistent-floor-fixture-only", directory.toAbsolutePath().toString())
    .redirectErrorStream(true).start()
  private val stdout = child.inputStream.bufferedReader(StandardCharsets.UTF_8)
  private val stdin = PrintWriter(child.outputStream.writer(StandardCharsets.UTF_8), true)
  val publicKey: PublicKey = run {
    val hello = stdout.readLine() ?: error("No witness announcement")
    require(hello.startsWith("READY|")) { "Witness rejected startup: $hello" }
    KeyFactory.getInstance("Ed25519").generatePublic(
      X509EncodedKeySpec(dec.decode(hello.substringAfter('|'))))
  }
  private fun fields(c: SyntheticRekeyGenerationClaimLab): String =
    listOf(c.accountId, c.kitId, c.version, c.generation,
      enc.encodeToString(c.ciphertextHash)).joinToString("|")
  fun call(command: String): String {
    check(child.isAlive)
    stdin.println(command)
    return stdout.readLine() ?: error("No witness answer")
  }
  fun enroll(c: SyntheticRekeyGenerationClaimLab) = call("ENROLL|" + fields(c))
  fun advance(before: SyntheticRekeyGenerationClaimLab, after: SyntheticRekeyGenerationClaimLab) =
    call("ADVANCE|" + fields(before) + "|" + fields(after))
  fun quote(nonce: ByteArray): Pair<SyntheticRekeyGenerationClaimLab, ByteArray>? {
    val line = call("QUOTE|" + enc.encodeToString(nonce))
    if (line == "DENY_NO_STATE") return null
    val p = line.split('|')
    require(p.size == 7 && p[0] == "QUOTE")
    return SyntheticRekeyGenerationClaimLab(p[1], p[2], p[3].toLong(),
      p[4].toLong(), dec.decode(p[5])) to dec.decode(p[6])
  }
  override fun close() {
    if (child.isAlive) {
      runCatching { call("EXIT") }
      if (!child.waitFor(5, TimeUnit.SECONDS)) {
        child.destroyForcibly()
        child.waitFor(5, TimeUnit.SECONDS)
      }
    }
    runCatching { stdin.close() }
    runCatching { stdout.close() }
  }
}

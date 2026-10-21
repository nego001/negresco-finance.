package com.negresco.finance.security

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.StandardOpenOption
import java.security.MessageDigest
import java.util.UUID
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * SEC-05K: detached, HMAC-authenticated GENERATION WITNESS for disposable files.
 *
 * A fixture test supplies the witness directory and a 256-bit MAC key OUTSIDE
 * the snapshot/journal directory. Neither is a real authority service, HSM,
 * durable off-device backup, owner grant, or irreversible monotonic counter.
 * A signed witness copied to the same host can itself be replayed or erased.
 * Do NOT wire this rehearsal to production or the Android application.
 */
internal enum class SyntheticWitnessCheckLab {
  BOOTSTRAPPED_FIXTURE_ONLY, ADVANCED_FIXTURE_ONLY, VERIFIED_FIXTURE_ONLY,
  DENY_MISSING_WITNESS, DENY_STALE_OR_DIFFERENT, DENY_AUTHENTICATION,
  FAIL_CLOSED
}

/** Only encrypted snapshot bytes, never a recovery secret or plaintext. */
internal class SyntheticWitnessStateLab(
  val accountId: String, val kitId: String,
  val version: Long, val generation: Long, snapshotFile: ByteArray
) {
  val ciphertextFile: ByteArray = snapshotFile.copyOf()
}

/** The witness file lives outside local journal; the key is NEVER persisted. */
internal class SyntheticDetachedGenerationWitnessLab(
  private val localJournalDir: Path, private val witnessDir: Path
) {
  private val record = witnessDir.resolve("generation.witness")
  private val magic = 0x4e475746 // NGWF
  private val format = 1
  private val bodyLength = 88
  private val fileLength = bodyLength + 32
  private val macDomain = "negresco.finance.sec05k.detached-witness.hmacsha256.v1"
    .toByteArray(Charsets.US_ASCII)

  private data class Entry(
    val account: String, val kit: String,
    val version: Long, val generation: Long, val digest: ByteArray
  )

  private fun safeLocations() {
    val local = localJournalDir.toAbsolutePath().normalize()
    val detached = witnessDir.toAbsolutePath().normalize()
    require(local != detached && !detached.startsWith(local) && !local.startsWith(detached))
    require(Files.isDirectory(local, LinkOption.NOFOLLOW_LINKS))
    require(!Files.isSymbolicLink(local) && !Files.isSymbolicLink(detached))
    Files.createDirectories(detached)
    require(Files.isDirectory(detached, LinkOption.NOFOLLOW_LINKS))
    require(!Files.isSymbolicLink(record))
  }

  private fun valid(state: SyntheticWitnessStateLab): Boolean =
    Regex("[0-9a-f]{32}").matches(state.accountId) &&
      runCatching { UUID.fromString(state.kitId).toString() == state.kitId }
        .getOrDefault(false) &&
      state.version > 0 && state.generation > 0 &&
      state.ciphertextFile.size in 37..131072

  private fun hexToBytes(value: String): ByteArray =
    value.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
  private fun bytesToHex(bytes: ByteArray): String =
    bytes.joinToString("") { "%02x".format(it.toInt() and 255) }

  private fun digest(value: ByteArray): ByteArray =
    MessageDigest.getInstance("SHA-256").digest(value)

  private fun entry(value: SyntheticWitnessStateLab) = Entry(
    value.accountId, value.kitId, value.version,
    value.generation, digest(value.ciphertextFile)
  )

  private fun bytes(value: Entry): ByteArray = ByteArrayOutputStream().also { sink ->
    DataOutputStream(sink).use { output ->
      val uuid = UUID.fromString(value.kit)
      output.writeInt(magic)
      output.writeInt(format)
      output.write(hexToBytes(value.account))
      output.writeLong(uuid.mostSignificantBits)
      output.writeLong(uuid.leastSignificantBits)
      output.writeLong(value.version)
      output.writeLong(value.generation)
      output.write(value.digest)
    }
  }.toByteArray().also { require(it.size == bodyLength) }

  private fun tag(body: ByteArray, key: ByteArray): ByteArray {
    require(key.size == 32)
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(key, "HmacSHA256"))
    mac.update(macDomain)
    return mac.doFinal(body)
  }

  private fun read(key: ByteArray): Entry? {
    if (!Files.exists(record, LinkOption.NOFOLLOW_LINKS)) return null
    require(Files.isRegularFile(record, LinkOption.NOFOLLOW_LINKS))
    val raw = FileChannel.open(record, StandardOpenOption.READ,
      LinkOption.NOFOLLOW_LINKS).use { channel ->
      require(channel.size() == fileLength.toLong())
      val buffer = ByteBuffer.allocate(fileLength)
      while (buffer.hasRemaining()) require(channel.read(buffer) > 0)
      require(channel.size() == fileLength.toLong())
      buffer.array()
    }
    val body = raw.copyOfRange(0, bodyLength)
    require(MessageDigest.isEqual(
      tag(body, key), raw.copyOfRange(bodyLength, fileLength))) {
      "Detached witness authentication failure"
    }
    return DataInputStream(ByteArrayInputStream(body)).use { input ->
      require(input.readInt() == magic && input.readInt() == format)
      val account = ByteArray(16).also { input.readFully(it) }
      val kit = UUID(input.readLong(), input.readLong()).toString()
      val version = input.readLong()
      val generation = input.readLong()
      val hash = ByteArray(32).also { input.readFully(it) }
      require(version > 0 && generation > 0 && input.available() == 0)
      Entry(bytesToHex(account), kit, version, generation, hash)
    }
  }

  private fun store(value: Entry, key: ByteArray) {
    val body = bytes(value)
    val file = body + tag(body, key)
    val tmp = Files.createTempFile(witnessDir, ".sec05k-witness-", ".tmp")
    try {
      FileChannel.open(tmp, StandardOpenOption.WRITE).use { channel ->
        val buffer = ByteBuffer.wrap(file)
        while (buffer.hasRemaining()) require(channel.write(buffer) > 0)
        channel.force(true)
      }
      Files.move(tmp, record,
        StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
      FileChannel.open(witnessDir, StandardOpenOption.READ).use { it.force(true) }
    } finally { Files.deleteIfExists(tmp) }
  }

  private fun same(a: Entry, b: Entry): Boolean =
    a.account == b.account && a.kit == b.kit &&
      a.version == b.version && a.generation == b.generation &&
      MessageDigest.isEqual(a.digest, b.digest)

  private fun <T> safe(default: T, action: () -> T): T =
    try { safeLocations(); action() } catch (_: Exception) { default }

  /** Explicit fixture-only initial enrollment: NEVER implicit in verification. */
  fun bootstrapFixtureOnly(
    current: SyntheticWitnessStateLab, detachedMacKey: ByteArray
  ): SyntheticWitnessCheckLab =
    safe(SyntheticWitnessCheckLab.FAIL_CLOSED) {
      if (!valid(current) || detachedMacKey.size != 32)
        return@safe SyntheticWitnessCheckLab.DENY_AUTHENTICATION
      if (Files.exists(record, LinkOption.NOFOLLOW_LINKS))
        return@safe SyntheticWitnessCheckLab.DENY_STALE_OR_DIFFERENT
      store(entry(current), detachedMacKey)
      SyntheticWitnessCheckLab.BOOTSTRAPPED_FIXTURE_ONLY
    }

  /**
   * Honest caller must provide both encrypted generations. The witness
   * authenticates one-step transitions but does NOT itself verify journal
   * decisions. No concurrent writers or trusted time service is modeled.
   */
  fun advanceFixtureOnly(
    expectedBefore: SyntheticWitnessStateLab, after: SyntheticWitnessStateLab,
    detachedMacKey: ByteArray
  ): SyntheticWitnessCheckLab =
    safe(SyntheticWitnessCheckLab.FAIL_CLOSED) {
      if (!valid(expectedBefore) || !valid(after) || detachedMacKey.size != 32)
        return@safe SyntheticWitnessCheckLab.DENY_AUTHENTICATION
      val saved = read(detachedMacKey)
        ?: return@safe SyntheticWitnessCheckLab.DENY_MISSING_WITNESS
      if (!same(saved, entry(expectedBefore)) ||
          after.accountId != expectedBefore.accountId ||
          after.kitId == expectedBefore.kitId ||
          expectedBefore.version == Long.MAX_VALUE ||
          expectedBefore.generation == Long.MAX_VALUE ||
          after.version != expectedBefore.version + 1 ||
          after.generation != expectedBefore.generation + 1)
        return@safe SyntheticWitnessCheckLab.DENY_STALE_OR_DIFFERENT
      store(entry(after), detachedMacKey)
      SyntheticWitnessCheckLab.ADVANCED_FIXTURE_ONLY
    }

  /** Read-only proof fails when local snapshot is replaced, lost or stale. */
  fun verifyFixtureOnly(
    current: SyntheticWitnessStateLab, detachedMacKey: ByteArray
  ): SyntheticWitnessCheckLab =
    safe(SyntheticWitnessCheckLab.FAIL_CLOSED) {
      if (!valid(current) || detachedMacKey.size != 32)
        return@safe SyntheticWitnessCheckLab.DENY_AUTHENTICATION
      val saved = read(detachedMacKey)
        ?: return@safe SyntheticWitnessCheckLab.DENY_MISSING_WITNESS
      if (same(saved, entry(current)))
        SyntheticWitnessCheckLab.VERIFIED_FIXTURE_ONLY
      else SyntheticWitnessCheckLab.DENY_STALE_OR_DIFFERENT
    }
}

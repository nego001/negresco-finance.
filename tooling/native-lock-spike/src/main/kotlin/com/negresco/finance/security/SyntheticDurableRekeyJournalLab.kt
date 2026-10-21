package com.negresco.finance.security

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.nio.channels.OverlappingFileLockException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.StandardOpenOption
import java.security.MessageDigest
import java.util.UUID

/**
 * SEC-05K: isolated filesystem crash/restart rehearsal of SEC-05J ciphertext.
 *
 * This is NOT an encrypted database, account authority, OS key store, production
 * migration manager, backup delivery mechanism or permission grant.
 * Only synthetic AES-GCM ciphertext and opaque portable envelopes are persisted.
 * Plaintext, DEKs and detached kit recovery secrets are NEVER journaled.
 *
 * Atomic rename + file and directory sync are REQUIRED. If the host filesystem
 * cannot provide them, operations fail closed rather than claiming durability.
 * SHA-256 detects accidental corruption, NOT adversarial modification. There is
 * NO independently authenticated monotonic generation floor in this fixture.
 */
internal enum class SyntheticJournalPhaseLab { PREPARED, COMMITTED }
internal enum class SyntheticJournalCrashLab {
  NONE, AFTER_PENDING_SYNC, AFTER_PREPARE_SYNC, AFTER_COMMIT_SYNC, AFTER_ACTIVE_REPLACE
}
internal enum class SyntheticJournalCheckLab {
  SEEDED_FIXTURE_ONLY,
  PREPARED_FIXTURE_ONLY,
  COMMITTED_FIXTURE_ONLY_NOT_AUTHORIZATION,
  RECOVERED_PREPARE_ROLLBACK,
  RECOVERED_COMMIT_FINALIZED,
  CONSISTENT_FIXTURE_ONLY,
  DENY_INVALID_OR_STALE,
  DENY_RECOVERY_PROOF,
  DENY_BUSY,
  SIMULATED_CRASH,
  FAIL_CLOSED
}
internal class SyntheticJournalResultLab(
  val check: SyntheticJournalCheckLab,
  val snapshotFixtureOnly: SyntheticRekeySnapshotLab? = null
) {
  override fun toString(): String = "SyntheticJournalResultLab($check,[synthetic records redacted])"
}

internal class SyntheticDurableRekeyJournalLab(private val directory: Path) {
  private val active = directory.resolve("active.snapshot")
  private val pending = directory.resolve("pending.snapshot")
  private val journal = directory.resolve("migration.journal")
  private val lockPath = directory.resolve("migration.lock")
  private val stateMagic = 0x4e47534b // NGSK
  private val journalMagic = 0x4e474a4b // NGJK
  private val format = 1
  private val maxFileSize = 128 * 1024

  private class Stored(
    val snapshot: SyntheticRekeySnapshotLab, val envelope: ByteArray
  )
  private class Journal(
    val phase: SyntheticJournalPhaseLab, val account: String,
    val oldKit: String, val newKit: String, val oldHash: ByteArray,
    val newHash: ByteArray
  )

  private fun sha256(bytes: ByteArray): ByteArray =
    MessageDigest.getInstance("SHA-256").digest(bytes)

  /** Checksum for torn/accidental corruption; NEVER a MAC or trusted signature. */
  private fun frame(body: ByteArray): ByteArray = body + sha256(body)
  private fun unframe(file: ByteArray): DataInputStream {
    require(file.size in 37..maxFileSize)
    val body = file.copyOfRange(0, file.size - 32)
    require(MessageDigest.isEqual(sha256(body), file.copyOfRange(file.size - 32, file.size)))
    return DataInputStream(ByteArrayInputStream(body))
  }
  private fun DataInputStream.exact(length: Int, max: Int): ByteArray {
    require(length in 0..max)
    return ByteArray(length).also { readFully(it) }
  }
  private fun DataInputStream.done() { require(available() == 0) }
  private fun readBytes(path: Path): ByteArray? {
    if (!Files.exists(path)) return null
    require(Files.isRegularFile(path) && Files.size(path) in 37L..maxFileSize.toLong())
    return Files.readAllBytes(path)
  }
  private fun syncDirectory() {
    FileChannel.open(directory, StandardOpenOption.READ).use { it.force(true) }
  }
  private fun atomicWrite(path: Path, bytes: ByteArray) {
    require(bytes.size in 37..maxFileSize)
    val tmp = Files.createTempFile(directory, ".ng-journal-", ".tmp")
    try {
      FileChannel.open(tmp, StandardOpenOption.WRITE).use { channel ->
        val buffer = ByteBuffer.wrap(bytes)
        while (buffer.hasRemaining()) channel.write(buffer)
        channel.force(true)
      }
      Files.move(tmp, path,
        StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
      syncDirectory()
    } finally {
      if (Files.deleteIfExists(tmp)) syncDirectory()
    }
  }
  private fun remove(path: Path) {
    if (Files.deleteIfExists(path)) syncDirectory()
  }
  private fun <T> exclusive(onBusy: T, onError: T, body: () -> T): T {
    return try {
      Files.createDirectories(directory)
      FileChannel.open(lockPath,
        StandardOpenOption.CREATE, StandardOpenOption.WRITE).use { channel ->
        val held = try { channel.tryLock() }
          catch (_: OverlappingFileLockException) { null }
        if (held == null) onBusy
        else held.use { body() }
      }
    } catch (_: Exception) { onError }
  }
  private fun encodeState(state: Stored): ByteArray {
    val s = state.snapshot
    val bytes = ByteArrayOutputStream()
    DataOutputStream(bytes).use { out ->
      out.writeInt(stateMagic)
      out.writeInt(format)
      out.writeUTF(s.accountId)
      out.writeUTF(s.kitId)
      out.writeLong(s.version)
      out.writeLong(s.generation)
      out.writeInt(state.envelope.size)
      out.write(state.envelope)
      out.writeInt(s.retiredKitIds.size)
      for (id in s.retiredKitIds.sorted()) out.writeUTF(id)
      out.writeInt(s.records.size)
      for ((id, rec) in s.records.toSortedMap()) {
        out.writeUTF(id)
        out.writeUTF(rec.id)
        out.writeLong(rec.version)
        out.writeLong(rec.generation)
        val nonce = rec.nonceCopy()
        val ciphertext = rec.ciphertextCopy()
        out.writeInt(nonce.size)
        out.write(nonce)
        out.writeInt(ciphertext.size)
        out.write(ciphertext)
      }
    }
    return frame(bytes.toByteArray())
  }
  private fun validate(state: Stored) {
    val s = state.snapshot
    require(Regex("[0-9a-f]{32}").matches(s.accountId))
    require(UUID.fromString(s.kitId).toString() == s.kitId)
    require(s.version > 0 && s.generation > 0)
    require(s.records.size in 1..32 && s.retiredKitIds.size <= 64)
    require(s.kitId !in s.retiredKitIds)
    require(s.retiredKitIds.all { UUID.fromString(it).toString() == it })
    require(s.records.all { (id, rec) ->
      Regex("[a-z0-9_-]{1,40}").matches(id) &&
      rec.id == id && rec.version == s.version &&
      rec.generation == s.generation &&
      rec.nonceCopy().size == 12 && rec.ciphertextCopy().size in 17..1040
    })
    val parsed = SyntheticPortableRecoveryEnvelopeLab.importEnvelopeBytesFixtureOnly(
      state.envelope, s.accountId
    )
    require(parsed.check == SyntheticPortableEnvelopeCheck.PARSED_ONLY_NOT_AUTHENTICATED)
    val e = parsed.envelope ?: error("Missing envelope")
    require(e.kitId == s.kitId && e.keyVersion == s.version &&
      e.ownerGeneration == s.generation)
  }
  private fun decodeState(raw: ByteArray): Stored {
    val input = unframe(raw)
    require(input.readInt() == stateMagic && input.readInt() == format)
    val account = input.readUTF()
    val kit = input.readUTF()
    val version = input.readLong()
    val generation = input.readLong()
    val envelope = input.exact(input.readInt(), 184)
    val retiredCount = input.readInt()
    require(retiredCount in 0..64)
    val retired = (0 until retiredCount).map { input.readUTF() }
    require(retired.toSet().size == retired.size)
    val count = input.readInt()
    require(count in 1..32)
    val records = linkedMapOf<String, SyntheticEncryptedRecordLab>()
    repeat(count) {
      val id = input.readUTF()
      val itemId = input.readUTF()
      val rVersion = input.readLong()
      val rGeneration = input.readLong()
      val nonce = input.exact(input.readInt(), 12)
      val cipher = input.exact(input.readInt(), 1040)
      require(id !in records)
      records[id] = SyntheticEncryptedRecordLab(itemId, rVersion, rGeneration, nonce, cipher)
    }
    input.done()
    return Stored(
      SyntheticRekeySnapshotLab(account, kit, version, generation, records, retired.toSet()),
      envelope
    ).also { validate(it) }
  }
  private fun encodeJournal(state: Journal): ByteArray {
    val bytes = ByteArrayOutputStream()
    DataOutputStream(bytes).use { out ->
      out.writeInt(journalMagic)
      out.writeInt(format)
      out.writeInt(if (state.phase == SyntheticJournalPhaseLab.PREPARED) 1 else 2)
      out.writeUTF(state.account)
      out.writeUTF(state.oldKit)
      out.writeUTF(state.newKit)
      out.write(state.oldHash)
      out.write(state.newHash)
    }
    return frame(bytes.toByteArray())
  }
  private fun decodeJournal(bytes: ByteArray): Journal {
    val input = unframe(bytes)
    require(input.readInt() == journalMagic && input.readInt() == format)
    val phase = when (input.readInt()) {
      1 -> SyntheticJournalPhaseLab.PREPARED
      2 -> SyntheticJournalPhaseLab.COMMITTED
      else -> error("Invalid journal phase")
    }
    val account = input.readUTF()
    val oldKit = input.readUTF()
    val newKit = input.readUTF()
    val oldHash = input.exact(32, 32)
    val newHash = input.exact(32, 32)
    input.done()
    require(Regex("[0-9a-f]{32}").matches(account))
    require(UUID.fromString(oldKit).toString() == oldKit)
    require(UUID.fromString(newKit).toString() == newKit && newKit != oldKit)
    return Journal(phase, account, oldKit, newKit, oldHash, newHash)
  }
  private fun same(a: ByteArray?, b: ByteArray): Boolean =
    a != null && MessageDigest.isEqual(sha256(a), b)
  private fun result(check: SyntheticJournalCheckLab, s: Stored? = null) =
    SyntheticJournalResultLab(check, s?.snapshot)

  /** First fixture only: exclusive process lock and durable initial ciphertext. */
  fun seedFixtureOnly(snapshot: SyntheticRekeySnapshotLab, envelope: ByteArray) =
    exclusive(result(SyntheticJournalCheckLab.DENY_BUSY), result(SyntheticJournalCheckLab.FAIL_CLOSED)) {
      if (Files.exists(active) || Files.exists(journal) || Files.exists(pending))
        return@exclusive result(SyntheticJournalCheckLab.DENY_INVALID_OR_STALE)
      val state = Stored(snapshot, envelope.copyOf())
      validate(state)
      atomicWrite(active, encodeState(state))
      result(SyntheticJournalCheckLab.SEEDED_FIXTURE_ONLY, state)
    }

  /**
   * Prepare verified SEC-05J ciphertext without publishing it.
   * The independent detached secrets are used only in transient JVM memory.
   */
  fun prepareFixtureOnly(
    expectedAccount: String, expectedOldKit: String,
    oldSecret: ByteArray, next: SyntheticRekeySnapshotLab,
    nextEnvelope: ByteArray, newSecret: ByteArray,
    crash: SyntheticJournalCrashLab = SyntheticJournalCrashLab.NONE
  ): SyntheticJournalResultLab =
    exclusive(result(SyntheticJournalCheckLab.DENY_BUSY), result(SyntheticJournalCheckLab.FAIL_CLOSED)) {
      if (Files.exists(journal) || Files.exists(pending))
        return@exclusive result(SyntheticJournalCheckLab.DENY_INVALID_OR_STALE)
      val activeBytes = readBytes(active)
        ?: return@exclusive result(SyntheticJournalCheckLab.FAIL_CLOSED)
      val before = decodeState(activeBytes)
      val after = Stored(next, nextEnvelope.copyOf()).also { validate(it) }
      val a = before.snapshot
      val b = after.snapshot
      if (a.accountId != expectedAccount || a.kitId != expectedOldKit ||
          b.accountId != a.accountId || b.kitId == a.kitId ||
          a.version == Long.MAX_VALUE || a.generation == Long.MAX_VALUE ||
          b.version != a.version + 1 || b.generation != a.generation + 1 ||
          b.records.keys != a.records.keys ||
          b.retiredKitIds != a.retiredKitIds + a.kitId)
        return@exclusive result(SyntheticJournalCheckLab.DENY_INVALID_OR_STALE)
      if (!equivalentCiphertexts(before, oldSecret, after, newSecret))
        return@exclusive result(SyntheticJournalCheckLab.DENY_RECOVERY_PROOF)
      val pendingBytes = encodeState(after)
      val marker = Journal(
        SyntheticJournalPhaseLab.PREPARED, a.accountId, a.kitId, b.kitId,
        sha256(activeBytes), sha256(pendingBytes)
      )
      atomicWrite(pending, pendingBytes)
      if (crash == SyntheticJournalCrashLab.AFTER_PENDING_SYNC)
        return@exclusive result(SyntheticJournalCheckLab.SIMULATED_CRASH)
      atomicWrite(journal, encodeJournal(marker))
      if (crash == SyntheticJournalCrashLab.AFTER_PREPARE_SYNC)
        return@exclusive result(SyntheticJournalCheckLab.SIMULATED_CRASH)
      result(SyntheticJournalCheckLab.PREPARED_FIXTURE_ONLY, before)
    }

  private fun equivalentCiphertexts(
    before: Stored, oldSecret: ByteArray,
    after: Stored, newSecret: ByteArray
  ): Boolean {
    val oldEnvelope = SyntheticPortableRecoveryEnvelopeLab.importEnvelopeBytesFixtureOnly(
      before.envelope, before.snapshot.accountId
    ).envelope ?: return false
    val nextEnvelope = SyntheticPortableRecoveryEnvelopeLab.importEnvelopeBytesFixtureOnly(
      after.envelope, after.snapshot.accountId
    ).envelope ?: return false
    val oldKey = SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
      oldEnvelope, oldSecret
    )?.copyForFixtureOnly() ?: return false
    val newKey = SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
      nextEnvelope, newSecret
    )?.copyForFixtureOnly() ?: run { oldKey.fill(0); return false }
    return try {
      if (MessageDigest.isEqual(oldKey, newKey)) return false
      before.snapshot.records.keys.all { id ->
        val p = SyntheticRecordCipherLab.decryptFixtureOnly(
          before.snapshot.accountId, before.snapshot.records.getValue(id), oldKey
        ) ?: return@all false
        val q = SyntheticRecordCipherLab.decryptFixtureOnly(
          after.snapshot.accountId, after.snapshot.records.getValue(id), newKey
        )
        try { q != null && MessageDigest.isEqual(p, q) }
        finally { p.fill(0); q?.fill(0) }
      }
    } finally { oldKey.fill(0); newKey.fill(0) }
  }

  /**
   * COMMITTED journal is the durable decision point, BEFORE active replacement.
   * Separately supplied envelope+secret prove decryption, NOT that a human has
   * saved a durable external backup. Never wire this to production as-is.
   */
  fun commitFixtureOnly(
    expectedAccount: String, expectedOldKit: String,
    separatelyExportedEnvelope: ByteArray, detachedNewSecret: ByteArray,
    crash: SyntheticJournalCrashLab = SyntheticJournalCrashLab.NONE
  ): SyntheticJournalResultLab =
    exclusive(result(SyntheticJournalCheckLab.DENY_BUSY), result(SyntheticJournalCheckLab.FAIL_CLOSED)) {
      val j = decodeJournal(readBytes(journal)
        ?: return@exclusive result(SyntheticJournalCheckLab.DENY_INVALID_OR_STALE))
      if (j.phase != SyntheticJournalPhaseLab.PREPARED ||
          j.account != expectedAccount || j.oldKit != expectedOldKit)
        return@exclusive result(SyntheticJournalCheckLab.DENY_INVALID_OR_STALE)
      val a = readBytes(active)
      val b = readBytes(pending)
      if (!same(a, j.oldHash) || !same(b, j.newHash))
        return@exclusive result(SyntheticJournalCheckLab.FAIL_CLOSED)
      val before = decodeState(a!!)
      val next = decodeState(b!!)
      if (before.snapshot.accountId != j.account ||
          before.snapshot.kitId != j.oldKit ||
          next.snapshot.accountId != j.account || next.snapshot.kitId != j.newKit ||
          !MessageDigest.isEqual(separatelyExportedEnvelope, next.envelope))
        return@exclusive result(SyntheticJournalCheckLab.DENY_RECOVERY_PROOF)
      val parsed = SyntheticPortableRecoveryEnvelopeLab.importEnvelopeBytesFixtureOnly(
        separatelyExportedEnvelope, j.account
      )
      val recovered = parsed.envelope?.let {
        SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(it, detachedNewSecret)
          ?.copyForFixtureOnly()
      } ?: return@exclusive result(SyntheticJournalCheckLab.DENY_RECOVERY_PROOF)
      val valid = try {
        next.snapshot.records.values.all { record ->
          val p = SyntheticRecordCipherLab.decryptFixtureOnly(j.account, record, recovered)
          try { p != null } finally { p?.fill(0) }
        }
      } finally { recovered.fill(0) }
      if (!valid) return@exclusive result(SyntheticJournalCheckLab.DENY_RECOVERY_PROOF)
      atomicWrite(journal, encodeJournal(Journal(
        SyntheticJournalPhaseLab.COMMITTED, j.account, j.oldKit, j.newKit,
        j.oldHash, j.newHash
      )))
      if (crash == SyntheticJournalCrashLab.AFTER_COMMIT_SYNC)
        return@exclusive result(SyntheticJournalCheckLab.SIMULATED_CRASH)
      Files.move(pending, active,
        StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
      syncDirectory()
      if (crash == SyntheticJournalCrashLab.AFTER_ACTIVE_REPLACE)
        return@exclusive result(SyntheticJournalCheckLab.SIMULATED_CRASH)
      remove(journal)
      result(SyntheticJournalCheckLab.COMMITTED_FIXTURE_ONLY_NOT_AUTHORIZATION, next)
    }

  /**
   * Startup recovery does NOT request a secret, authenticate a person or
   * decrypt financial data. PREPARED rolls back; COMMITTED always rolls forward.
   * Never silently use old ciphertext if COMMITTED new state is unavailable.
   */
  fun recoverFixtureOnly(): SyntheticJournalResultLab =
    exclusive(result(SyntheticJournalCheckLab.DENY_BUSY), result(SyntheticJournalCheckLab.FAIL_CLOSED)) {
      val markerBytes = readBytes(journal)
      val activeBytes = readBytes(active)
        ?: return@exclusive result(SyntheticJournalCheckLab.FAIL_CLOSED)
      if (markerBytes == null) {
        val current = decodeState(activeBytes)
        remove(pending) // Orphan before PREPARED was durable.
        return@exclusive result(SyntheticJournalCheckLab.CONSISTENT_FIXTURE_ONLY, current)
      }
      val j = decodeJournal(markerBytes)
      val pendingBytes = readBytes(pending)
      if (j.phase == SyntheticJournalPhaseLab.PREPARED) {
        if (!same(activeBytes, j.oldHash))
          return@exclusive result(SyntheticJournalCheckLab.FAIL_CLOSED)
        val current = decodeState(activeBytes)
        if (current.snapshot.accountId != j.account || current.snapshot.kitId != j.oldKit)
          return@exclusive result(SyntheticJournalCheckLab.FAIL_CLOSED)
        remove(pending)
        remove(journal)
        return@exclusive result(SyntheticJournalCheckLab.RECOVERED_PREPARE_ROLLBACK, current)
      }
      // COMMITTED: no silent rollback, even if pending is missing/corrupt.
      if (same(activeBytes, j.newHash)) {
        val current = decodeState(activeBytes)
        if (current.snapshot.accountId != j.account || current.snapshot.kitId != j.newKit)
          return@exclusive result(SyntheticJournalCheckLab.FAIL_CLOSED)
        remove(pending)
        remove(journal)
        return@exclusive result(SyntheticJournalCheckLab.RECOVERED_COMMIT_FINALIZED, current)
      }
      if (!same(activeBytes, j.oldHash) || !same(pendingBytes, j.newHash))
        return@exclusive result(SyntheticJournalCheckLab.FAIL_CLOSED)
      val current = decodeState(activeBytes)
      val next = decodeState(pendingBytes!!)
      if (current.snapshot.accountId != j.account || current.snapshot.kitId != j.oldKit ||
          next.snapshot.accountId != j.account || next.snapshot.kitId != j.newKit)
        return@exclusive result(SyntheticJournalCheckLab.FAIL_CLOSED)
      Files.move(pending, active,
        StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
      syncDirectory()
      remove(journal)
      result(SyntheticJournalCheckLab.RECOVERED_COMMIT_FINALIZED, next)
    }
}

package com.negresco.finance.security

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.security.GeneralSecurityException
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * SEC-05J: single-process, synthetic DATA rekey rehearsal, NOT a server.
 *
 * Rotating a kit wrapping the SAME data key is insufficient after DEK exposure.
 * This fixture decrypts each disposable record under old DEK, encrypts under
 * a fresh random DEK, creates a fresh recovery kit, and atomically replaces
 * the fixture snapshot only AFTER all records have been staged.
 *
 * No owner authentication, durable journal, cross-process lock, backend,
 * hardware key protection, Android integration or financial authorization.
 * Historical ciphertext + compromised old DEK remain decryptable OFFLINE.
 */
internal enum class SyntheticRekeyCheck {
  REKEYED_FIXTURE_ONLY_NOT_AUTHORIZATION,
  DENY_UNKNOWN_ACCOUNT,
  DENY_EXPECTED_KIT_MISMATCH,
  DENY_INVALID_BACKUP_OR_SECRET,
  DENY_OLD_DATA_KEY_MISMATCH,
  DENY_STALE_OR_OVERFLOW,
  DENY_CORRUPT_OLD_CIPHERTEXT,
  DENY_INJECTED_ABORT_NO_MUTATION
}

internal class SyntheticRekeyResultLab(
  val check: SyntheticRekeyCheck,
  val freshKitFixtureOnly: SyntheticRecoveryKitExportLab? = null
) {
  override fun toString(): String = "SyntheticRekeyResultLab($check,[kit secret redacted])"
}

internal class SyntheticEncryptedRecordLab(
  val id: String, val version: Long, val generation: Long,
  nonce: ByteArray, ciphertext: ByteArray
) {
  private val nonceValue = nonce.copyOf()
  private val ciphertextValue = ciphertext.copyOf()
  fun nonceCopy(): ByteArray = nonceValue.copyOf()
  fun ciphertextCopy(): ByteArray = ciphertextValue.copyOf()
  override fun toString(): String = "SyntheticEncryptedRecordLab([ciphertext redacted])"
}

internal class SyntheticRekeySnapshotLab(
  val accountId: String,
  val kitId: String,
  val version: Long,
  val generation: Long,
  records: Map<String, SyntheticEncryptedRecordLab>,
  retiredKitIds: Set<String>
) {
  val records = records.mapValues { (_, r) ->
    SyntheticEncryptedRecordLab(r.id, r.version, r.generation, r.nonceCopy(), r.ciphertextCopy())
  }.toMap()
  val retiredKitIds = retiredKitIds.toSet()
  override fun toString(): String = "SyntheticRekeySnapshotLab([account/records redacted],version=$version,generation=$generation)"
}

internal object SyntheticRecordCipherLab {
  private val rng = SecureRandom()
  private val recordFormat = Regex("[a-z0-9_-]{1,40}")
  private val accountFormat = Regex("[0-9a-f]{32}")
  private val domain = "negresco.finance.synthetic-record.aes256gcm.v1".toByteArray(Charsets.US_ASCII)
  private fun fromHex(value: String): ByteArray =
    value.chunked(2).map { it.toInt(16).toByte() }.toByteArray()

  private fun aad(account: String, id: String, version: Long, generation: Long): ByteArray {
    require(accountFormat.matches(account) && recordFormat.matches(id))
    require(version > 0L && generation > 0L)
    return ByteArrayOutputStream().also { buffer ->
      DataOutputStream(buffer).use { out ->
        out.writeInt(domain.size)
        out.write(domain)
        out.write(fromHex(account))
        val name = id.toByteArray(Charsets.US_ASCII)
        out.writeInt(name.size)
        out.write(name)
        out.writeLong(version)
        out.writeLong(generation)
      }
    }.toByteArray()
  }

  fun encryptFixtureOnly(
    account: String, id: String, version: Long, generation: Long,
    dek: ByteArray, plaintext: ByteArray
  ): SyntheticEncryptedRecordLab {
    require(dek.size == 32 && plaintext.size in 1..1024)
    val nonce = ByteArray(12).also { rng.nextBytes(it) }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(dek, "AES"), GCMParameterSpec(128, nonce))
    cipher.updateAAD(aad(account, id, version, generation))
    return SyntheticEncryptedRecordLab(
      id, version, generation, nonce, cipher.doFinal(plaintext)
    )
  }

  /** A successful offline read has NO login or grant semantics. */
  fun decryptFixtureOnly(
    account: String, item: SyntheticEncryptedRecordLab, dek: ByteArray
  ): ByteArray? {
    if (dek.size != 32 || item.ciphertextCopy().size !in 17..1040 ||
        item.nonceCopy().size != 12) return null
    return try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(
        Cipher.DECRYPT_MODE, SecretKeySpec(dek, "AES"),
        GCMParameterSpec(128, item.nonceCopy())
      )
      cipher.updateAAD(aad(account, item.id, item.version, item.generation))
      cipher.doFinal(item.ciphertextCopy())
    } catch (_: GeneralSecurityException) {
      null
    } catch (_: IllegalArgumentException) {
      null
    }
  }
}

internal class SyntheticCompromisedKitRotationLab private constructor(
  private val accountId: String,
  private var kitId: String,
  private var version: Long,
  private var generation: Long,
  private var activeFile: ByteArray,
  private var records: Map<String, SyntheticEncryptedRecordLab>
) {
  private val mutex = Any()
  private val retired = mutableSetOf<String>()
  private val rng = SecureRandom()

  companion object {
    /**
     * Initial fixture provisioning only. The source DEK is never retained.
     * No disk persistence, session, login or real records.
     */
    fun seedFixtureOnly(
      accountId: String, dataKeyFixture: ByteArray,
      initialKit: SyntheticRecoveryKitExportLab,
      records: Map<String, ByteArray>
    ): SyntheticCompromisedKitRotationLab {
      require(dataKeyFixture.size == 32 && records.isNotEmpty() && records.size <= 32)
      val envelope = initialKit.envelope
      require(envelope.opaqueAccountId == accountId)
      require(records.keys.all { Regex("[a-z0-9_-]{1,40}").matches(it) })
      require(records.values.all { it.size in 1..1024 })
      val derived = SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
        envelope, initialKit.recoverySecretCopyForFixtureOnly()
      )?.copyForFixtureOnly() ?: error("Fixture old kit does not recover DEK")
      try {
        require(MessageDigest.isEqual(derived, dataKeyFixture))
      } finally {
        derived.fill(0)
      }
      val encrypted = records.mapValues { (id, plain) ->
        SyntheticRecordCipherLab.encryptFixtureOnly(
          accountId, id, envelope.keyVersion, envelope.ownerGeneration,
          dataKeyFixture, plain
        )
      }
      return SyntheticCompromisedKitRotationLab(
        accountId, envelope.kitId, envelope.keyVersion, envelope.ownerGeneration,
        SyntheticPortableRecoveryEnvelopeLab.exportEnvelopeBytesFixtureOnly(envelope), encrypted
      )
    }
  }

  fun snapshotFixtureOnly(): SyntheticRekeySnapshotLab = synchronized(mutex) {
    SyntheticRekeySnapshotLab(accountId, kitId, version, generation, records, retired)
  }

  fun encryptedBackupFixtureOnly(): ByteArray = synchronized(mutex) { activeFile.copyOf() }

  /** Fault injection ONLY: corrupts a disposable encrypted record. */
  fun corruptRecordFixtureOnly(id: String): Boolean = synchronized(mutex) {
    val item = records[id] ?: return@synchronized false
    val ciphertext = item.ciphertextCopy()
    ciphertext[0] = (ciphertext[0].toInt() xor 1).toByte()
    records = records + (id to SyntheticEncryptedRecordLab(
      id, item.version, item.generation, item.nonceCopy(), ciphertext
    ))
    true
  }

  /**
   * All-or-nothing IN-MEMORY staging. The old file/secret and historical
   * ciphertext remain decryptable by anyone already possessing their copy.
   */
  fun rotateCompromisedKitFixtureOnly(
    expectedAccountId: String,
    expectedKitId: String,
    suppliedOldFile: ByteArray?,
    suppliedOldSecret: ByteArray?,
    injectAbortAfterStagedRecords: Int? = null
  ): SyntheticRekeyResultLab = synchronized(mutex) {
    fun deny(check: SyntheticRekeyCheck) = SyntheticRekeyResultLab(check)
    if (expectedAccountId != accountId)
      return@synchronized deny(SyntheticRekeyCheck.DENY_UNKNOWN_ACCOUNT)
    if (expectedKitId != kitId)
      return@synchronized deny(SyntheticRekeyCheck.DENY_EXPECTED_KIT_MISMATCH)
    if (version >= Long.MAX_VALUE - 1L || generation >= Long.MAX_VALUE - 1L)
      return@synchronized deny(SyntheticRekeyCheck.DENY_STALE_OR_OVERFLOW)
    val parsed = SyntheticPortableRecoveryEnvelopeLab.importEnvelopeBytesFixtureOnly(
      suppliedOldFile, accountId
    )
    val oldEnvelope = parsed.envelope
    if (parsed.check != SyntheticPortableEnvelopeCheck.PARSED_ONLY_NOT_AUTHENTICATED ||
        oldEnvelope == null || suppliedOldFile == null || suppliedOldSecret == null ||
        suppliedOldSecret.size != 32 ||
        !MessageDigest.isEqual(activeFile, suppliedOldFile) ||
        oldEnvelope.kitId != kitId || oldEnvelope.keyVersion != version ||
        oldEnvelope.ownerGeneration != generation)
      return@synchronized deny(SyntheticRekeyCheck.DENY_INVALID_BACKUP_OR_SECRET)

    val oldKey = SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
      oldEnvelope, suppliedOldSecret
    )?.copyForFixtureOnly()
      ?: return@synchronized deny(SyntheticRekeyCheck.DENY_INVALID_BACKUP_OR_SECRET)
    val freshKey = ByteArray(32).also { rng.nextBytes(it) }
    try {
      // No shared state is modified before every record is staged.
      val staged = linkedMapOf<String, SyntheticEncryptedRecordLab>()
      for ((id, record) in records) {
        if (record.id != id || record.version != version ||
            record.generation != generation)
          return@synchronized deny(SyntheticRekeyCheck.DENY_CORRUPT_OLD_CIPHERTEXT)
        val plaintext = SyntheticRecordCipherLab.decryptFixtureOnly(
          accountId, record, oldKey
        ) ?: return@synchronized deny(SyntheticRekeyCheck.DENY_CORRUPT_OLD_CIPHERTEXT)
        try {
          staged[id] = SyntheticRecordCipherLab.encryptFixtureOnly(
            accountId, id, version + 1L, generation + 1L, freshKey, plaintext
          )
        } finally {
          plaintext.fill(0)
        }
        if (injectAbortAfterStagedRecords == staged.size)
          return@synchronized deny(SyntheticRekeyCheck.DENY_INJECTED_ABORT_NO_MUTATION)
      }

      val newKit = SyntheticOfflineRecoveryKitCryptoLab.sealFixtureOnly(
        accountId, freshKey, version + 1L, generation + 1L
      )
      // Verify newly protected DEK and portable file BEFORE publishing state.
      val verified = SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
        newKit.envelope, newKit.recoverySecretCopyForFixtureOnly()
      )?.copyForFixtureOnly()
      try {
        if (verified == null || !MessageDigest.isEqual(verified, freshKey))
          return@synchronized deny(SyntheticRekeyCheck.DENY_OLD_DATA_KEY_MISMATCH)
      } finally {
        verified?.fill(0)
      }
      val nextFile = SyntheticPortableRecoveryEnvelopeLab.exportEnvelopeBytesFixtureOnly(
        newKit.envelope
      )
      // Single-JVM atomic publication ONLY. No durability/rollback defense.
      val oldId = kitId
      records = staged.toMap()
      kitId = newKit.envelope.kitId
      version = newKit.envelope.keyVersion
      generation = newKit.envelope.ownerGeneration
      activeFile = nextFile
      retired.add(oldId)
      SyntheticRekeyResultLab(
        SyntheticRekeyCheck.REKEYED_FIXTURE_ONLY_NOT_AUTHORIZATION, newKit
      )
    } finally {
      oldKey.fill(0)
      freshKey.fill(0)
    }
  }
}

package com.negresco.finance.security

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.nio.charset.StandardCharsets
import java.security.GeneralSecurityException
import java.security.SecureRandom
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * SEC-05G: an OFFLINE data-key backup/recovery lab, NEVER a login protocol.
 *
 * Holding a valid high-entropy recovery secret + envelope inherently enables
 * OFFLINE decryption of that envelope. Server revocation or a fake "identity
 * verified" boolean CANNOT reverse knowledge of old keys or ciphertext.
 *
 * These classes are NOT wired to Expo, Android, SQLCipher, network or accounts.
 * All test DEKs, kit secrets and fixture account IDs are disposable only.
 */
internal class SyntheticRecoveryKitEnvelopeLab(
  val opaqueAccountId: String,
  val kitId: String,
  val keyVersion: Long,
  val ownerGeneration: Long,
  salt: ByteArray,
  nonce: ByteArray,
  ciphertext: ByteArray
) {
  private val saltValue = salt.copyOf()
  private val nonceValue = nonce.copyOf()
  private val ciphertextValue = ciphertext.copyOf()

  fun saltCopy(): ByteArray = saltValue.copyOf()
  fun nonceCopy(): ByteArray = nonceValue.copyOf()
  fun ciphertextCopy(): ByteArray = ciphertextValue.copyOf()

  override fun toString(): String =
    "SyntheticRecoveryKitEnvelopeLab(opaqueAccountId=[redacted],kitId=[redacted]," +
      "keyVersion=$keyVersion,ownerGeneration=$ownerGeneration,ciphertext=[redacted])"
}

internal class SyntheticRecoveryKitExportLab(
  val envelope: SyntheticRecoveryKitEnvelopeLab,
  secret: ByteArray
) {
  private val secretValue = secret.copyOf()
  fun recoverySecretCopyForFixtureOnly(): ByteArray = secretValue.copyOf()
  override fun toString(): String = "SyntheticRecoveryKitExportLab([secret redacted])"
}

internal class SyntheticRecoveredDataKeyFixtureOnly(key: ByteArray) {
  private val material = key.copyOf()
  fun copyForFixtureOnly(): ByteArray = material.copyOf()
  override fun toString(): String = "SyntheticRecoveredDataKeyFixtureOnly([key redacted])"
}

/**
 * 256-bit CSPRNG recovery secret, salt-separated HKDF-HMAC-SHA256, AES-256-GCM.
 * A human PIN/password is NOT an acceptable input. No PBKDF2 password path.
 *
 * AAD binds account, kit ID, key version, owner generation, purpose, salt and
 * nonce; all metadata is authenticated and role-separated from other protocols.
 */
internal object SyntheticOfflineRecoveryKitCryptoLab {
  private const val SECRET_BYTES = 32
  private const val SALT_BYTES = 32
  private const val NONCE_BYTES = 12
  private const val KEY_BYTES = 32
  private const val CIPHERTEXT_BYTES = KEY_BYTES + 16
  private const val GCM_TAG_BITS = 128
  private val accountFormat = Regex("[0-9a-f]{32}")
  private val uuidFormat = Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
  private val aadDomain = "negresco.finance.offline-data-key-backup.aes256gcm.v1"
    .toByteArray(StandardCharsets.US_ASCII)
  private val hkdfContext = "negresco.finance.offline-data-key-backup.hkdf-sha256.v1"
    .toByteArray(StandardCharsets.US_ASCII)
  private val rng = SecureRandom()

  private fun valid(account: String, kit: String, version: Long, generation: Long) =
    accountFormat.matches(account) &&
      uuidFormat.matches(kit) &&
      UUID.fromString(kit).toString() == kit &&
      version > 0L && generation > 0L

  private fun hexBytes(hex: String): ByteArray =
    hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()

  private fun associatedData(
    account: String, kit: String, version: Long, generation: Long,
    salt: ByteArray, nonce: ByteArray
  ): ByteArray = ByteArrayOutputStream().also { buffer ->
    val uuid = UUID.fromString(kit)
    DataOutputStream(buffer).use { out ->
      out.writeInt(aadDomain.size)
      out.write(aadDomain)
      out.writeInt(1)
      out.writeInt(16)
      out.write(hexBytes(account))
      out.writeLong(uuid.mostSignificantBits)
      out.writeLong(uuid.leastSignificantBits)
      out.writeLong(version)
      out.writeLong(generation)
      out.writeInt(salt.size)
      out.write(salt)
      out.writeInt(nonce.size)
      out.write(nonce)
    }
  }.toByteArray()

  /** RFC 5869 HKDF extract/expand for exactly 32 bytes. */
  private fun deriveAesKey(secret: ByteArray, salt: ByteArray): ByteArray {
    val hmac = Mac.getInstance("HmacSHA256")
    hmac.init(SecretKeySpec(salt, "HmacSHA256"))
    val prk = hmac.doFinal(secret)
    try {
      hmac.init(SecretKeySpec(prk, "HmacSHA256"))
      hmac.update(hkdfContext)
      hmac.update(1.toByte())
      return hmac.doFinal()
    } finally {
      prk.fill(0)
    }
  }

  fun sealFixtureOnly(
    opaqueAccountId: String,
    dataKeyFixture: ByteArray,
    keyVersion: Long,
    ownerGeneration: Long
  ): SyntheticRecoveryKitExportLab {
    require(accountFormat.matches(opaqueAccountId)) { "Malformed opaque account identifier" }
    require(keyVersion > 0L && ownerGeneration > 0L) { "Invalid key/generation" }
    require(dataKeyFixture.size == KEY_BYTES) { "Expected 32-byte disposable data key" }
    val kitId = UUID.randomUUID().toString()
    val secret = ByteArray(SECRET_BYTES).also { rng.nextBytes(it) }
    val salt = ByteArray(SALT_BYTES).also { rng.nextBytes(it) }
    val nonce = ByteArray(NONCE_BYTES).also { rng.nextBytes(it) }
    val key = deriveAesKey(secret, salt)
    try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(GCM_TAG_BITS, nonce))
      cipher.updateAAD(associatedData(opaqueAccountId, kitId, keyVersion, ownerGeneration, salt, nonce))
      val ciphertext = cipher.doFinal(dataKeyFixture.copyOf())
      return SyntheticRecoveryKitExportLab(
        SyntheticRecoveryKitEnvelopeLab(
          opaqueAccountId, kitId, keyVersion, ownerGeneration,
          salt, nonce, ciphertext
        ), secret
      )
    } finally {
      key.fill(0)
      secret.fill(0)
    }
  }

  /**
   * OFFLINE cryptographic decryption, no authenticated account or device gate.
   * Never use its successful return value as owner identity or device trust.
   */
  fun recoverDataKeyFixtureOnly(
    envelope: SyntheticRecoveryKitEnvelopeLab,
    secret: ByteArray?
  ): SyntheticRecoveredDataKeyFixtureOnly? {
    if (secret == null || secret.size != SECRET_BYTES) return null
    if (!valid(envelope.opaqueAccountId, envelope.kitId,
        envelope.keyVersion, envelope.ownerGeneration)) return null
    val salt = envelope.saltCopy()
    val nonce = envelope.nonceCopy()
    val encrypted = envelope.ciphertextCopy()
    if (salt.size != SALT_BYTES || nonce.size != NONCE_BYTES ||
      encrypted.size != CIPHERTEXT_BYTES) return null
    val key = deriveAesKey(secret.copyOf(), salt)
    try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(GCM_TAG_BITS, nonce))
      cipher.updateAAD(associatedData(
        envelope.opaqueAccountId, envelope.kitId,
        envelope.keyVersion, envelope.ownerGeneration, salt, nonce
      ))
      val recovered = cipher.doFinal(encrypted)
      try {
        return if (recovered.size == KEY_BYTES)
          SyntheticRecoveredDataKeyFixtureOnly(recovered) else null
      } finally {
        recovered.fill(0)
      }
    } catch (_: GeneralSecurityException) {
      return null
    } finally {
      key.fill(0)
    }
  }
}

internal enum class SyntheticKitRegistryCheck {
  ACTIVE_METADATA_MATCH_NOT_AUTHORIZATION,
  DENY_UNKNOWN_ACCOUNT,
  DENY_NO_KIT,
  DENY_REVOKED_KIT,
  DENY_STALE_GENERATION_OR_KIT,
  DENY_INVALID_FIXTURE_STATE
}

/**
 * In-memory registry policy fixture, NOT an online authority or anti-rollback.
 * Old envelope + old secret remain decryptable OFFLINE even after revocation.
 */
internal class SyntheticRecoveryKitRegistryLab(
  accountGenerations: Map<String, Long>
) {
  private data class Account(var generation: Long, var activeKit: String? = null,
    var version: Long = 0L, val revoked: MutableSet<String> = mutableSetOf())
  private val lock = Any()
  private val format = Regex("[0-9a-f]{32}")
  private val accounts: Map<String, Account>

  init {
    require(accountGenerations.all { (id, generation) ->
      format.matches(id) && generation > 0L
    })
    accounts = accountGenerations.mapValues { (_, generation) -> Account(generation) }
  }

  fun registerFixtureOnly(envelope: SyntheticRecoveryKitEnvelopeLab): SyntheticKitRegistryCheck =
    synchronized(lock) {
      val a = accounts[envelope.opaqueAccountId]
        ?: return@synchronized SyntheticKitRegistryCheck.DENY_UNKNOWN_ACCOUNT
      if (envelope.ownerGeneration != a.generation ||
        envelope.keyVersion <= a.version || envelope.kitId in a.revoked)
        return@synchronized SyntheticKitRegistryCheck.DENY_STALE_GENERATION_OR_KIT
      a.activeKit?.let { a.revoked.add(it) }
      a.activeKit = envelope.kitId
      a.version = envelope.keyVersion
      SyntheticKitRegistryCheck.ACTIVE_METADATA_MATCH_NOT_AUTHORIZATION
    }

  fun inspectFixtureOnly(envelope: SyntheticRecoveryKitEnvelopeLab): SyntheticKitRegistryCheck =
    synchronized(lock) {
      val a = accounts[envelope.opaqueAccountId]
        ?: return@synchronized SyntheticKitRegistryCheck.DENY_UNKNOWN_ACCOUNT
      if (envelope.kitId in a.revoked)
        return@synchronized SyntheticKitRegistryCheck.DENY_REVOKED_KIT
      if (a.activeKit == null) return@synchronized SyntheticKitRegistryCheck.DENY_NO_KIT
      if (a.activeKit != envelope.kitId || a.generation != envelope.ownerGeneration ||
          a.version != envelope.keyVersion)
        return@synchronized SyntheticKitRegistryCheck.DENY_STALE_GENERATION_OR_KIT
      SyntheticKitRegistryCheck.ACTIVE_METADATA_MATCH_NOT_AUTHORIZATION
    }

  fun revokeAndAdvanceGenerationFixtureOnly(accountId: String): SyntheticKitRegistryCheck =
    synchronized(lock) {
      val a = accounts[accountId] ?: return@synchronized SyntheticKitRegistryCheck.DENY_UNKNOWN_ACCOUNT
      if (a.generation == Long.MAX_VALUE)
        return@synchronized SyntheticKitRegistryCheck.DENY_INVALID_FIXTURE_STATE
      a.activeKit?.let { a.revoked.add(it) }
      a.activeKit = null
      a.generation++
      SyntheticKitRegistryCheck.DENY_NO_KIT
    }
}

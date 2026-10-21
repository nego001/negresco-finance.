package com.negresco.finance.security

import java.security.MessageDigest
import java.util.UUID

/**
 * SEC-05I: disposable JVM ceremony for a portable, encrypted recovery kit.
 *
 * It NEVER stores the recovery secret, writes to a filesystem, authenticates
 * a user, grants account access, unlocks data stores or enrolls a new device.
 * Successful verification means only: separately supplied FILE + SECRET
 * decrypt the expected synthetic 32-byte data key in a clean rehearsal.
 * It CANNOT prove the user stored a durable/offline copy of either item.
 */
internal enum class SyntheticKitCeremonyState {
  PENDING_REENTRY, VERIFIED_OFFLINE_ONLY, EXPIRED, CANCELLED
}

internal enum class SyntheticKitCeremonyCheck {
  PREPARED_NOT_STORED,
  VERIFIED_OFFLINE_NOT_STORED_OR_AUTHORIZED,
  DENY_BAD_SOURCE,
  DENY_BAD_CLOCK,
  DENY_EXPIRED,
  DENY_TERMINAL,
  DENY_ACCOUNT_SCOPE,
  DENY_BACKUP_CHANGED,
  DENY_BAD_BACKUP,
  DENY_MISSING_OR_INVALID_SECRET,
  DENY_DATA_KEY_MISMATCH
}

internal data class SyntheticKitCeremonyView(
  val sessionId: String,
  val kitId: String,
  val state: SyntheticKitCeremonyState,
  val openedMillis: Long,
  val expiresMillis: Long
)

/**
 * Deliberately independent verifier. It knows only an expected account and
 * synthetic key commitment; no prior device state, authentication or source
 * recovery secret. It always returns a status, NEVER recovered key bytes.
 *
 * A SHA-256 fingerprint of a random 256-bit DEK is a TEST commitment only,
 * not an authenticated trust anchor or account identity.
 */
internal object SyntheticCleanRoomRecoveryLab {
  fun verifyOfflineFixtureOnly(
    expectedAccountId: String,
    expectedDataKeySha256: ByteArray?,
    portableEnvelope: ByteArray?,
    separateRecoverySecret: ByteArray?
  ): SyntheticKitCeremonyCheck {
    if (expectedDataKeySha256 == null || expectedDataKeySha256.size != 32)
      return SyntheticKitCeremonyCheck.DENY_BAD_SOURCE
    if (separateRecoverySecret == null || separateRecoverySecret.size != 32)
      return SyntheticKitCeremonyCheck.DENY_MISSING_OR_INVALID_SECRET
    val imported = SyntheticPortableRecoveryEnvelopeLab.importEnvelopeBytesFixtureOnly(
      portableEnvelope, expectedAccountId
    )
    if (imported.check == SyntheticPortableEnvelopeCheck.DENY_ACCOUNT)
      return SyntheticKitCeremonyCheck.DENY_ACCOUNT_SCOPE
    if (imported.check != SyntheticPortableEnvelopeCheck.PARSED_ONLY_NOT_AUTHENTICATED)
      return SyntheticKitCeremonyCheck.DENY_BAD_BACKUP
    val envelope = imported.envelope ?: return SyntheticKitCeremonyCheck.DENY_BAD_BACKUP
    val recovered = SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
      envelope, separateRecoverySecret
    ) ?: return SyntheticKitCeremonyCheck.DENY_MISSING_OR_INVALID_SECRET
    val copy = recovered.copyForFixtureOnly()
    return try {
      if (MessageDigest.isEqual(
          MessageDigest.getInstance("SHA-256").digest(copy), expectedDataKeySha256
        )
      ) SyntheticKitCeremonyCheck.VERIFIED_OFFLINE_NOT_STORED_OR_AUTHORIZED
      else SyntheticKitCeremonyCheck.DENY_DATA_KEY_MISMATCH
    } finally {
      copy.fill(0)
    }
  }
}

/**
 * In-process single-session simulator. Not a durable database, not an API,
 * not proof of a real offline backup. The 15-minute clock is a test fixture.
 */
internal class SyntheticRecoveryKitCeremonyLab private constructor(
  private val accountId: String,
  private val kitId: String,
  expectedEnvelopeSha256: ByteArray,
  expectedDataKeySha256: ByteArray,
  private val clockMillis: () -> Long,
  private val openedMillis: Long
) {
  companion object {
    const val WINDOW_MILLIS = 15L * 60L * 1000L
    private val idFormat = Regex("[0-9a-f]{32}")

    fun prepareFixtureOnly(
      expectedAccountId: String,
      envelopeBytes: ByteArray?,
      sourceDataKeyFixture: ByteArray?,
      labClockMillis: () -> Long
    ): Pair<SyntheticKitCeremonyCheck, SyntheticRecoveryKitCeremonyLab?> {
      if (!idFormat.matches(expectedAccountId) ||
          sourceDataKeyFixture == null || sourceDataKeyFixture.size != 32)
        return SyntheticKitCeremonyCheck.DENY_BAD_SOURCE to null
      val timestamp = labClockMillis()
      if (timestamp <= 0L || timestamp > Long.MAX_VALUE - WINDOW_MILLIS)
        return SyntheticKitCeremonyCheck.DENY_BAD_CLOCK to null
      val parsed = SyntheticPortableRecoveryEnvelopeLab.importEnvelopeBytesFixtureOnly(
        envelopeBytes, expectedAccountId
      )
      if (parsed.check == SyntheticPortableEnvelopeCheck.DENY_ACCOUNT)
        return SyntheticKitCeremonyCheck.DENY_ACCOUNT_SCOPE to null
      if (parsed.check != SyntheticPortableEnvelopeCheck.PARSED_ONLY_NOT_AUTHENTICATED ||
          envelopeBytes == null || parsed.envelope == null)
        return SyntheticKitCeremonyCheck.DENY_BAD_BACKUP to null
      val hash = MessageDigest.getInstance("SHA-256")
      return SyntheticKitCeremonyCheck.PREPARED_NOT_STORED to
        SyntheticRecoveryKitCeremonyLab(
          expectedAccountId, parsed.envelope.kitId, hash.digest(envelopeBytes.copyOf()),
          hash.digest(sourceDataKeyFixture.copyOf()), labClockMillis, timestamp
        )
    }
  }

  private val guard = Any()
  private val sessionId = UUID.randomUUID().toString()
  private val fileDigest = expectedEnvelopeSha256.copyOf()
  private val dataKeyDigest = expectedDataKeySha256.copyOf()
  private var state = SyntheticKitCeremonyState.PENDING_REENTRY

  // Never expose source key material, secret or the SHA-256 commitments.
  override fun toString(): String =
    "SyntheticRecoveryKitCeremonyLab(sessionId=[redacted],kitId=[redacted],state=$state)"

  private fun advance(): SyntheticKitCeremonyCheck? {
    if (state != SyntheticKitCeremonyState.PENDING_REENTRY)
      return SyntheticKitCeremonyCheck.DENY_TERMINAL
    val now = clockMillis()
    if (now < openedMillis || now <= 0L)
      return SyntheticKitCeremonyCheck.DENY_BAD_CLOCK
    if (now >= openedMillis + WINDOW_MILLIS) {
      state = SyntheticKitCeremonyState.EXPIRED
      return SyntheticKitCeremonyCheck.DENY_EXPIRED
    }
    return null
  }

  fun viewFixtureOnly(): SyntheticKitCeremonyView = synchronized(guard) {
    // Viewing state cannot grant access and never exposes a secret.
    if (state == SyntheticKitCeremonyState.PENDING_REENTRY) advance()
    SyntheticKitCeremonyView(sessionId, kitId, state, openedMillis,
      openedMillis + WINDOW_MILLIS)
  }

  fun verifySeparateBackupAndSecretFixtureOnly(
    presentedFile: ByteArray?,
    independentlyPresentedSecret: ByteArray?
  ): SyntheticKitCeremonyCheck = synchronized(guard) {
    advance()?.let { return@synchronized it }
    if (presentedFile == null || presentedFile.size != SyntheticPortableRecoveryEnvelopeLab.FILE_LENGTH)
      return@synchronized SyntheticKitCeremonyCheck.DENY_BAD_BACKUP
    val incomingDigest = MessageDigest.getInstance("SHA-256").digest(presentedFile.copyOf())
    if (!MessageDigest.isEqual(fileDigest, incomingDigest))
      return@synchronized SyntheticKitCeremonyCheck.DENY_BACKUP_CHANGED
    val result = SyntheticCleanRoomRecoveryLab.verifyOfflineFixtureOnly(
      accountId, dataKeyDigest.copyOf(), presentedFile.copyOf(),
      independentlyPresentedSecret
    )
    if (result == SyntheticKitCeremonyCheck.VERIFIED_OFFLINE_NOT_STORED_OR_AUTHORIZED)
      state = SyntheticKitCeremonyState.VERIFIED_OFFLINE_ONLY
    result
  }

  fun cancelFixtureOnly(): SyntheticKitCeremonyCheck = synchronized(guard) {
    advance()?.let { return@synchronized it }
    state = SyntheticKitCeremonyState.CANCELLED
    SyntheticKitCeremonyCheck.DENY_TERMINAL
  }
}

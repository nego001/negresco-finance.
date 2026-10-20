package com.negresco.finance.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.first
import java.security.MessageDigest
import java.security.PublicKey
import java.security.SecureRandom

/**
 * SEC-05. SINGLE-INVITE, DISPOSABLE DataStore experiment, NOT an enrollment service.
 *
 * A nonce can be issued once and later marked CONSUMED or CANCELLED by a
 * serialized DataStore transaction. The terminal tombstone is retained.
 * Neither state grants new-device trust or changes the registered device set.
 *
 * WARNING: labRegistry, labFloor and labApprovedKey are externally supplied
 * UNAUTHENTICATED TEST FIXTURES. DataStore is NOT anti-rollback storage.
 * Restoring an older DataStore file, replacing the fixture or restarting with
 * stale registry data breaks real anti-replay. No account-bound server ledger,
 * owner strong auth, trustworthy issuer, expiry or Android Keystore exists.
 */
internal object SyntheticInviteKeys {
  val version = intPreferencesKey("negresco.lab.invite.version")
  val status = stringPreferencesKey("negresco.lab.invite.status")
  val approving = stringPreferencesKey("negresco.lab.invite.approving")
  val candidate = stringPreferencesKey("negresco.lab.invite.candidate")
  val revision = longPreferencesKey("negresco.lab.invite.revision")
  val epoch = longPreferencesKey("negresco.lab.invite.epoch")
  val sequence = longPreferencesKey("negresco.lab.invite.sequence")
  val pendingNonce = stringPreferencesKey("negresco.lab.invite.pending_nonce")
}

internal enum class SyntheticInviteStatus { PENDING, CONSUMED, CANCELLED }

internal class InvalidSyntheticInvite : IllegalStateException("Enrollment invite state invalid")
internal class StaleSyntheticInvite : IllegalStateException("Invite already finished or stale")
internal class UnverifiedSyntheticInvite : IllegalStateException("Enrollment signatures denied")

internal class SyntheticInviteView(
  val intent: SyntheticDeviceEnrollmentIntent,
  val status: SyntheticInviteStatus,
  nonce: ByteArray?
) {
  private val savedNonce = nonce?.copyOf()
  fun pendingNonceCopy(): ByteArray? = savedNonce?.copyOf()
}

internal class SyntheticEnrollmentInviteDataStoreLab(
  private val store: DataStore<Preferences>,
  labRegistry: DeviceTrustSnapshot?,
  private val labFloor: DeviceTrustFloor?,
  private val labApprovedKey: PublicKey?
) {
  private val rng = SecureRandom()

  // Defense against mutation of input collections during a transaction.
  private val labRegistry = labRegistry?.copy(
    active = labRegistry.active.toSet(),
    revoked = labRegistry.revoked.toSet(),
    lastSequence = labRegistry.lastSequence.toMap()
  )

  private val knownKeys: Set<Preferences.Key<*>> = setOf(
    SyntheticInviteKeys.version, SyntheticInviteKeys.status,
    SyntheticInviteKeys.approving, SyntheticInviteKeys.candidate,
    SyntheticInviteKeys.revision, SyntheticInviteKeys.epoch,
    SyntheticInviteKeys.sequence, SyntheticInviteKeys.pendingNonce
  )

  private fun encodeHex(bytes: ByteArray): String =
    bytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }

  private fun decode(prefs: Preferences): SyntheticInviteView? {
    val k = SyntheticInviteKeys
    if (prefs.asMap().isEmpty()) return null
    if (prefs.asMap().keys.any { it !in knownKeys }) throw InvalidSyntheticInvite()
    if (prefs[k.version] != 1) throw InvalidSyntheticInvite()
    val status = SyntheticInviteStatus.entries.find { it.name == prefs[k.status] }
      ?: throw InvalidSyntheticInvite()
    val old = prefs[k.approving] ?: throw InvalidSyntheticInvite()
    val fresh = prefs[k.candidate] ?: throw InvalidSyntheticInvite()
    val revision = prefs[k.revision] ?: throw InvalidSyntheticInvite()
    val epoch = prefs[k.epoch] ?: throw InvalidSyntheticInvite()
    val sequence = prefs[k.sequence] ?: throw InvalidSyntheticInvite()
    val oldId = try { DeviceKeyFingerprint.parse(old) }
      catch (_: IllegalArgumentException) { throw InvalidSyntheticInvite() }
    val newId = try { DeviceKeyFingerprint.parse(fresh) }
      catch (_: IllegalArgumentException) { throw InvalidSyntheticInvite() }
    if (oldId == newId || revision < 1L || epoch < 1L || epoch > revision ||
        sequence <= 0L || sequence == Long.MAX_VALUE) throw InvalidSyntheticInvite()
    val nonceHex = prefs[k.pendingNonce]
    val bytes = if (status == SyntheticInviteStatus.PENDING) {
      if (nonceHex == null || !Regex("[0-9a-f]{64}").matches(nonceHex)) {
        throw InvalidSyntheticInvite()
      }
      nonceHex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    } else {
      if (nonceHex != null) throw InvalidSyntheticInvite()
      null
    }
    return SyntheticInviteView(
      SyntheticDeviceEnrollmentIntent(oldId, newId, revision, epoch, sequence),
      status, bytes
    )
  }

  suspend fun read(): SyntheticInviteView? = decode(store.data.first())

  /**
   * ISSUE ONLY if supplied synthetic registry and both public-key bindings
   * pass every PRE-SIGNATURE gate. Does not approve/enroll any device.
   * One invite per disposable file; terminal records are never overwritten.
   */
  suspend fun issue(
    intent: SyntheticDeviceEnrollmentIntent,
    candidateKey: PublicKey?
  ): SyntheticInviteView {
    val generated = ByteArray(32).also { rng.nextBytes(it) }
    try {
      val preflight = SyntheticDeviceEnrollmentProofLab.inspect(
        labRegistry, labFloor, intent, labApprovedKey, candidateKey,
        generated, generated, null, null
      )
      if (preflight != SyntheticEnrollmentGate.DENY_APPROVAL_SIGNATURE) {
        throw UnverifiedSyntheticInvite()
      }
      val updated = store.updateData { before ->
        if (before.asMap().isNotEmpty()) {
          decode(before) // corrupt bytes must fail, too
          throw StaleSyntheticInvite()
        }
        before.toMutablePreferences().apply {
          this[SyntheticInviteKeys.version] = 1
          this[SyntheticInviteKeys.status] = SyntheticInviteStatus.PENDING.name
          this[SyntheticInviteKeys.approving] = intent.approvingDevice.hex
          this[SyntheticInviteKeys.candidate] = intent.candidateDevice.hex
          this[SyntheticInviteKeys.revision] = intent.revision
          this[SyntheticInviteKeys.epoch] = intent.epoch
          this[SyntheticInviteKeys.sequence] = intent.approvingSequence
          this[SyntheticInviteKeys.pendingNonce] = encodeHex(generated)
        }
      }
      return decode(updated) ?: throw InvalidSyntheticInvite()
    } finally { generated.fill(0) }
  }

  /**
   * One-transaction proof verification and nonce consumption, in a THROWAWAY
   * file. No registry mutation: CONSUMED is only a terminal invitation marker.
   * An independent authenticated server MUST atomically commit account-wide
   * enrollment/approval sequence and consume the challenge in production.
   */
  suspend fun consume(
    intent: SyntheticDeviceEnrollmentIntent,
    candidateKey: PublicKey?,
    receivedNonce: ByteArray?,
    approvingSignature: ByteArray?,
    candidateSignature: ByteArray?
  ): SyntheticInviteView {
    val updated = store.updateData { before ->
      val view = decode(before) ?: throw InvalidSyntheticInvite()
      if (view.status != SyntheticInviteStatus.PENDING ||
          view.intent != intent) throw StaleSyntheticInvite()
      val issuedNonce = view.pendingNonceCopy() ?: throw InvalidSyntheticInvite()
      if (receivedNonce == null || receivedNonce.size != 32 ||
          !MessageDigest.isEqual(issuedNonce, receivedNonce)) {
        throw UnverifiedSyntheticInvite()
      }
      val gate = SyntheticDeviceEnrollmentProofLab.inspect(
        labRegistry, labFloor, intent, labApprovedKey, candidateKey,
        issuedNonce, receivedNonce, approvingSignature, candidateSignature
      )
      if (gate != SyntheticEnrollmentGate.PROCEED_TO_INDEPENDENT_PERSISTENT_ENROLLMENT_PROTOCOL) {
        throw UnverifiedSyntheticInvite()
      }
      before.toMutablePreferences().apply {
        this[SyntheticInviteKeys.status] = SyntheticInviteStatus.CONSUMED.name
        remove(SyntheticInviteKeys.pendingNonce)
      }
    }
    return decode(updated) ?: throw InvalidSyntheticInvite()
  }

  /**
   * Synthetic cancellation intentionally DENIES future consumption. This is
   * not an authenticated user-facing cancel API. It cannot reset enrollment.
   */
  suspend fun cancel(intent: SyntheticDeviceEnrollmentIntent): SyntheticInviteView {
    val updated = store.updateData { before ->
      val view = decode(before) ?: throw InvalidSyntheticInvite()
      if (view.status != SyntheticInviteStatus.PENDING ||
          view.intent != intent) throw StaleSyntheticInvite()
      before.toMutablePreferences().apply {
        this[SyntheticInviteKeys.status] = SyntheticInviteStatus.CANCELLED.name
        remove(SyntheticInviteKeys.pendingNonce)
      }
    }
    return decode(updated) ?: throw InvalidSyntheticInvite()
  }
}

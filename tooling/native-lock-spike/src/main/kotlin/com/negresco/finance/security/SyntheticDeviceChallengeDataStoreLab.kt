package com.negresco.finance.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.toMutablePreferences
import kotlinx.coroutines.flow.first
import java.security.PublicKey
import java.security.SecureRandom

/**
 * SEC-05, disposable single-device DataStore challenge/counter prototype.
 *
 * This is NOT production device enrollment. The explicit synthetic seed
 * accepts an unauthenticated fingerprint; it MUST NOT be exported via Expo,
 * used with financial records, or treated as trusted device registration.
 *
 * DataStore transactions survive process restart and serialize writers.
 * They DO NOT provide rollback resistance if the file can be restored, a
 * trusted public-key enrollment, per-account binding, trusted time/expiry,
 * hardware attestation or server-side replay detection.
 */
internal object SyntheticDeviceLedgerKeys {
  val version = intPreferencesKey("negresco.lab.device.version")
  val fingerprint = stringPreferencesKey("negresco.lab.device.fingerprint")
  val revision = longPreferencesKey("negresco.lab.device.revision")
  val epoch = longPreferencesKey("negresco.lab.device.epoch")
  val lastSequence = longPreferencesKey("negresco.lab.device.last_sequence")
  val challengeHex = stringPreferencesKey("negresco.lab.device.pending_nonce")
  val challengeAction = stringPreferencesKey("negresco.lab.device.pending_action")
  val challengeSequence = longPreferencesKey("negresco.lab.device.pending_sequence")
}

internal class InvalidSyntheticDeviceLedger : IllegalStateException("Synthetic device ledger unavailable")
internal class StaleSyntheticDeviceLedger : IllegalStateException("Synthetic operation expired or replayed")
internal class PendingSyntheticDeviceChallenge : IllegalStateException("Challenge already outstanding")
internal class UnverifiedSyntheticDeviceProof : IllegalStateException("Signed device claim rejected")

internal data class SyntheticLedgerView(
  val fingerprint: DeviceKeyFingerprint,
  val revision: Long,
  val epoch: Long,
  val lastSequence: Long,
  val pending: PendingSyntheticChallenge?
)

internal class PendingSyntheticChallenge(
  val claim: PresentedDeviceOperation,
  nonce: ByteArray
) {
  private val bytes = nonce.copyOf()
  fun nonceCopy(): ByteArray = bytes.copyOf()
}

internal class SyntheticDeviceChallengeDataStoreLab(
  private val store: DataStore<Preferences>
) {
  private val rng = SecureRandom()
  private val hexPattern = Regex("[0-9a-f]{64}")

  private fun hex(bytes: ByteArray): String =
    bytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }

  private fun decode(p: Preferences): SyntheticLedgerView? {
    val k = SyntheticDeviceLedgerKeys
    val v = p[k.version]
    val fingerprint = p[k.fingerprint]
    val revision = p[k.revision]
    val epoch = p[k.epoch]
    val last = p[k.lastSequence]
    val nonce = p[k.challengeHex]
    val action = p[k.challengeAction]
    val sequence = p[k.challengeSequence]
    if (listOf(v, fingerprint, revision, epoch, last, nonce, action, sequence)
        .all { it == null }) return null
    if (v != 1 || fingerprint == null || revision == null || epoch == null ||
        last == null || revision < 1L || epoch < 1L || epoch > revision ||
        last < 0L || last == Long.MAX_VALUE) throw InvalidSyntheticDeviceLedger()
    val id = try { DeviceKeyFingerprint.parse(fingerprint) }
      catch (_: IllegalArgumentException) { throw InvalidSyntheticDeviceLedger() }
    val pendingCount = listOf(nonce, action, sequence).count { it != null }
    if (pendingCount != 0 && pendingCount != 3) throw InvalidSyntheticDeviceLedger()
    val pending = if (pendingCount == 3) {
      if (!hexPattern.matches(nonce!!) || sequence!! <= last ||
          sequence == Long.MAX_VALUE) throw InvalidSyntheticDeviceLedger()
      val operation = ProtectedOperation.entries.find { it.name == action }
        ?: throw InvalidSyntheticDeviceLedger()
      val claim = PresentedDeviceOperation(id, revision, epoch, sequence, operation)
      PendingSyntheticChallenge(claim, nonce.chunked(2).map { it.toInt(16).toByte() }.toByteArray())
    } else null
    return SyntheticLedgerView(id, revision, epoch, last, pending)
  }

  private fun validFloor(view: SyntheticLedgerView, floor: DeviceTrustFloor?): Boolean =
    floor != null && floor.minRevision >= 1L && floor.minEpoch >= 1L &&
      view.revision >= floor.minRevision && view.epoch >= floor.minEpoch

  suspend fun read(): SyntheticLedgerView? = decode(store.data.first())

  /** Explicit creation is ONLY used in tests with throwaway files. */
  suspend fun seedForDisposableLab(fingerprint: DeviceKeyFingerprint): SyntheticLedgerView {
    val committed = store.updateData { before ->
      if (before.asMap().isNotEmpty() || decode(before) != null)
        throw InvalidSyntheticDeviceLedger()
      before.toMutablePreferences().apply {
        this[SyntheticDeviceLedgerKeys.version] = 1
        this[SyntheticDeviceLedgerKeys.fingerprint] = fingerprint.hex
        this[SyntheticDeviceLedgerKeys.revision] = 1L
        this[SyntheticDeviceLedgerKeys.epoch] = 1L
        this[SyntheticDeviceLedgerKeys.lastSequence] = 0L
      }
    }
    return decode(committed) ?: throw InvalidSyntheticDeviceLedger()
  }

  /**
   * Generates a CSPRNG nonce and persists it together with intended operation.
   * The returned nonce is not an unlock token; only a signature request.
   */
  suspend fun issue(
    claim: PresentedDeviceOperation, floor: DeviceTrustFloor?
  ): PendingSyntheticChallenge {
    val generated = ByteArray(32).also { rng.nextBytes(it) }
    try {
      val encoded = hex(generated)
      val committed = store.updateData { before ->
        val view = decode(before) ?: throw InvalidSyntheticDeviceLedger()
        if (!validFloor(view, floor) || claim.fingerprint != view.fingerprint ||
            claim.registryRevision != view.revision || claim.epoch != view.epoch ||
            claim.sequence <= view.lastSequence || claim.sequence == Long.MAX_VALUE ||
            claim.sequence <= 0L) throw StaleSyntheticDeviceLedger()
        if (view.pending != null) throw PendingSyntheticDeviceChallenge()
        before.toMutablePreferences().apply {
          this[SyntheticDeviceLedgerKeys.challengeHex] = encoded
          this[SyntheticDeviceLedgerKeys.challengeAction] = claim.operation.name
          this[SyntheticDeviceLedgerKeys.challengeSequence] = claim.sequence
        }
      }
      return decode(committed)?.pending ?: throw InvalidSyntheticDeviceLedger()
    } finally { generated.fill(0) }
  }

  /**
   * Verification and consumption happen inside the SAME DataStore transaction:
   * a race can only commit one use of the nonce+counter. No Boolean proof
   * parameter exists. Signature must match a separately enrolled public key.
   */
  suspend fun consume(
    claim: PresentedDeviceOperation,
    floor: DeviceTrustFloor?,
    enrolledPublicKey: PublicKey?,
    presentedNonce: ByteArray?,
    signature: ByteArray?
  ): SyntheticLedgerView {
    val committed = store.updateData { before ->
      val view = decode(before) ?: throw InvalidSyntheticDeviceLedger()
      if (!validFloor(view, floor) || claim.fingerprint != view.fingerprint ||
          claim.registryRevision != view.revision || claim.epoch != view.epoch ||
          claim.sequence <= view.lastSequence) throw StaleSyntheticDeviceLedger()
      val pending = view.pending ?: throw StaleSyntheticDeviceLedger()
      if (pending.claim != claim) throw StaleSyntheticDeviceLedger()
      if (!SyntheticSignedDeviceProofLab.verify(claim, enrolledPublicKey,
          pending.nonceCopy(), presentedNonce, signature)) {
        throw UnverifiedSyntheticDeviceProof()
      }
      before.toMutablePreferences().apply {
        this[SyntheticDeviceLedgerKeys.lastSequence] = claim.sequence
        remove(SyntheticDeviceLedgerKeys.challengeHex)
        remove(SyntheticDeviceLedgerKeys.challengeAction)
        remove(SyntheticDeviceLedgerKeys.challengeSequence)
      }
    }
    return decode(committed) ?: throw InvalidSyntheticDeviceLedger()
  }
}

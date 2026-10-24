package com.negresco.finance.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.mutablePreferencesOf
import java.io.File
import java.nio.file.Files
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.SecureRandom
import java.security.Signature
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.coroutineScope

/** Real DataStore files, fake registry and software test keys only. */
private class InviteFileHarness(
  file: File,
  registry: DeviceTrustSnapshot?,
  floor: DeviceTrustFloor?,
  approver: java.security.PublicKey?,
  labClock: () -> Long = { System.currentTimeMillis() }
) {
  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  val raw: DataStore<Preferences> = PreferenceDataStoreFactory.create(scope = scope) { file }
  val invites = SyntheticEnrollmentInviteDataStoreLab(raw, registry, floor, approver,
    labClockMillis = labClock)
  suspend fun close() { scope.coroutineContext[Job]!!.cancelAndJoin() }
}

internal suspend fun runPersistentEnrollmentInviteScenarios() {
  val approver = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val candidate = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val stranger = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val approverId = SyntheticSignedDeviceProofLab.fingerprint(approver.public)!!
  val candidateId = SyntheticSignedDeviceProofLab.fingerprint(candidate.public)!!
  val strangerId = SyntheticSignedDeviceProofLab.fingerprint(stranger.public)!!
  val registry = SyntheticDeviceTrustPolicy.createSyntheticFirstDevice(approverId)
  val floor = DeviceTrustFloor(1L, 1L)
  val intent = SyntheticDeviceEnrollmentIntent(approverId, candidateId, 1L, 1L, 1L)
  fun sign(key: KeyPair, nonce: ByteArray, candidateRole: Boolean,
    request: SyntheticDeviceEnrollmentIntent = intent): ByteArray {
    val signer = Signature.getInstance("Ed25519")
    signer.initSign(key.private)
    signer.update(SyntheticDeviceEnrollmentProofLab.payload(request, nonce, candidateRole))
    return signer.sign()
  }
  suspend fun fixture(
    state: DeviceTrustSnapshot? = registry,
    baseFloor: DeviceTrustFloor? = floor,
    approverKey: java.security.PublicKey? = approver.public,
    labClock: () -> Long = { System.currentTimeMillis() },
    body: suspend (InviteFileHarness) -> Unit
  ) {
    val dir = Files.createTempDirectory("negresco-enrollment-invite-").toFile()
    val h = InviteFileHarness(File(dir, "invite.preferences_pb"),
      state, baseFloor, approverKey, labClock)
    try { body(h) } finally { h.close(); check(dir.deleteRecursively()) }
  }
  suspend fun consume(
    h: InviteFileHarness, nonce: ByteArray,
    approvingKey: KeyPair = approver,
    candidateKey: KeyPair = candidate,
    request: SyntheticDeviceEnrollmentIntent = intent
  ) = h.invites.consume(request, candidateKey.public, nonce,
    sign(approvingKey, nonce, false, request),
    sign(candidateKey, nonce, true, request))

  // 1. Empty store never silently creates or registers a device.
  fixture { h ->
    check(h.invites.read() == null)
    check(runCatching { consume(h, ByteArray(32)) }.exceptionOrNull()
      is InvalidSyntheticInvite)
  }

  // 2. A challenge must be generated and persisted before two signatures.
  fixture { h ->
    val issued = h.invites.issue(intent, candidate.public)
    check(issued.status == SyntheticInviteStatus.PENDING)
    check(issued.intent == intent)
    check(issued.pendingNonceCopy()!!.size == 32)
    check(candidateId !in registry.active)
  }

  // 3. Both valid signatures mark invite consumed, but never enroll candidate.
  fixture { h ->
    val nonce = h.invites.issue(intent, candidate.public).pendingNonceCopy()!!
    val consumed = consume(h, nonce)
    check(consumed.status == SyntheticInviteStatus.CONSUMED)
    check(consumed.pendingNonceCopy() == null)
    check(h.invites.read()!!.status == SyntheticInviteStatus.CONSUMED)
    check(candidateId !in registry.active)
  }

  // 4. Same signed invite cannot be consumed or issued a second time.
  fixture { h ->
    val nonce = h.invites.issue(intent, candidate.public).pendingNonceCopy()!!
    consume(h, nonce)
    check(runCatching { consume(h, nonce) }.exceptionOrNull() is StaleSyntheticInvite)
    check(runCatching { h.invites.issue(intent, candidate.public) }
      .exceptionOrNull() is StaleSyntheticInvite)
  }

  // 5. Cancellation erases pending nonce and is terminal, never enrollment.
  fixture { h ->
    val nonce = h.invites.issue(intent, candidate.public).pendingNonceCopy()!!
    val cancelled = h.invites.cancel(intent)
    check(cancelled.status == SyntheticInviteStatus.CANCELLED)
    check(cancelled.pendingNonceCopy() == null)
    check(runCatching { consume(h, nonce) }.exceptionOrNull() is StaleSyntheticInvite)
    check(runCatching { h.invites.cancel(intent) }.exceptionOrNull() is StaleSyntheticInvite)
    check(runCatching { h.invites.issue(intent, candidate.public) }
      .exceptionOrNull() is StaleSyntheticInvite)
  }

  // 6. Valid old approver signature + forged candidate signature fails closed.
  fixture { h ->
    val nonce = h.invites.issue(intent, candidate.public).pendingNonceCopy()!!
    check(runCatching { consume(h, nonce, candidateKey = stranger) }
      .exceptionOrNull() is UnverifiedSyntheticInvite)
    check(h.invites.read()!!.pendingNonceCopy()!!.contentEquals(nonce))
  }

  // 7. Candidate approval alone cannot replace signature from registered key.
  fixture { h ->
    val nonce = h.invites.issue(intent, candidate.public).pendingNonceCopy()!!
    check(runCatching { consume(h, nonce, approvingKey = stranger) }
      .exceptionOrNull() is UnverifiedSyntheticInvite)
    check(h.invites.read()!!.status == SyntheticInviteStatus.PENDING)
  }

  // 8. A changed nonce, even with both valid signatures on wrong nonce,
  // cannot replace the persisted one.
  fixture { h ->
    val nonce = h.invites.issue(intent, candidate.public).pendingNonceCopy()!!
    val changed = nonce.copyOf().also { it[0] = (it[0].toInt() xor 1).toByte() }
    check(runCatching { consume(h, changed) }.exceptionOrNull()
      is UnverifiedSyntheticInvite)
    check(h.invites.read()!!.pendingNonceCopy()!!.contentEquals(nonce))
  }

  // 9. Altering the candidate/revision while invite is pending fails.
  fixture { h ->
    val nonce = h.invites.issue(intent, candidate.public).pendingNonceCopy()!!
    check(runCatching { consume(h, nonce, request = intent.copy(candidateDevice = strangerId)) }
      .exceptionOrNull() is StaleSyntheticInvite)
    check(runCatching { consume(h, nonce, request = intent.copy(revision = 2L)) }
      .exceptionOrNull() is StaleSyntheticInvite)
  }

  // 10. Unknown fixture approver cannot mint an invitation.
  fixture(approverKey = stranger.public) { h ->
    check(runCatching { h.invites.issue(intent, candidate.public) }
      .exceptionOrNull() is UnverifiedSyntheticInvite)
    check(h.invites.read() == null)
  }

  // 11. Revoked candidate or missing external floor cannot get an invite.
  fixture(state = registry.copy(revoked = setOf(candidateId))) { h ->
    check(runCatching { h.invites.issue(intent, candidate.public) }
      .exceptionOrNull() is UnverifiedSyntheticInvite)
  }
  fixture(baseFloor = null) { h ->
    check(runCatching { h.invites.issue(intent, candidate.public) }
      .exceptionOrNull() is UnverifiedSyntheticInvite)
  }

  // 12. Only one out of 16 concurrent valid consumers can commit.
  fixture { h ->
    val nonce = h.invites.issue(intent, candidate.public).pendingNonceCopy()!!
    val oldSig = sign(approver, nonce, false)
    val newSig = sign(candidate, nonce, true)
    val results = coroutineScope {
      (1..16).map { async(Dispatchers.IO) {
        runCatching { h.invites.consume(intent, candidate.public, nonce, oldSig, newSig) }
      } }.map { it.await() }
    }
    check(results.count { it.isSuccess } == 1)
    check(results.count { it.exceptionOrNull() is StaleSyntheticInvite } == 15)
    check(h.invites.read()!!.status == SyntheticInviteStatus.CONSUMED)
  }

  // 13. Concurrent cancel and consume can produce ONE terminal state only.
  fixture { h ->
    val nonce = h.invites.issue(intent, candidate.public).pendingNonceCopy()!!
    val oldSig = sign(approver, nonce, false)
    val newSig = sign(candidate, nonce, true)
    val results = coroutineScope {
      listOf(
        async(Dispatchers.IO) {
          runCatching { h.invites.consume(intent, candidate.public, nonce, oldSig, newSig) }
        },
        async(Dispatchers.IO) { runCatching { h.invites.cancel(intent) } }
      ).map { it.await() }
    }
    check(results.count { it.isSuccess } == 1)
    check(results.count { it.exceptionOrNull() is StaleSyntheticInvite } == 1)
    check(h.invites.read()!!.status != SyntheticInviteStatus.PENDING)
  }

  // 14. Cancelled tombstone survives file close/reopening, no nonce revived.
  run {
    val dir = Files.createTempDirectory("negresco-invite-reopen-").toFile()
    val file = File(dir, "invite.preferences_pb")
    val first = InviteFileHarness(file, registry, floor, approver.public)
    try {
      first.invites.issue(intent, candidate.public)
      first.invites.cancel(intent)
    } finally { first.close() }
    val reopened = InviteFileHarness(file, registry, floor, approver.public)
    try {
      check(reopened.invites.read()!!.status == SyntheticInviteStatus.CANCELLED)
      check(reopened.invites.read()!!.pendingNonceCopy() == null)
      check(runCatching { reopened.invites.issue(intent, candidate.public) }
        .exceptionOrNull() is StaleSyntheticInvite)
    } finally { reopened.close(); check(dir.deleteRecursively()) }
  }

  // 15. Consumed tombstone survives close/reopen and denies replay.
  run {
    val dir = Files.createTempDirectory("negresco-consumed-reopen-").toFile()
    val file = File(dir, "invite.preferences_pb")
    val first = InviteFileHarness(file, registry, floor, approver.public)
    val nonce = try {
      val pending = first.invites.issue(intent, candidate.public).pendingNonceCopy()!!
      consume(first, pending)
      pending
    } finally { first.close() }
    val reopened = InviteFileHarness(file, registry, floor, approver.public)
    try {
      check(reopened.invites.read()!!.status == SyntheticInviteStatus.CONSUMED)
      check(runCatching { consume(reopened, nonce) }
        .exceptionOrNull() is StaleSyntheticInvite)
    } finally { reopened.close(); check(dir.deleteRecursively()) }
  }

  // 16. Partial/corrupt ledger never becomes a blank reusable invite.
  fixture { h ->
    h.raw.updateData { mutablePreferencesOf(SyntheticInviteKeys.version to 1) }
    check(runCatching { h.invites.read() }.exceptionOrNull() is InvalidSyntheticInvite)
    check(runCatching { h.invites.issue(intent, candidate.public) }
      .exceptionOrNull() is InvalidSyntheticInvite)
  }

  // 17. Public challenge cannot be corrupted through returned ByteArray.
  fixture { h ->
    val issued = h.invites.issue(intent, candidate.public)
    val mutated = issued.pendingNonceCopy()!!
    mutated[0] = (mutated[0].toInt() xor 1).toByte()
    check(!issued.pendingNonceCopy()!!.contentEquals(mutated))
    check(h.invites.read()!!.status == SyntheticInviteStatus.PENDING)
  }

  // 18. The INVITE record is not an authorized active-device registry.
  check(candidateId !in registry.active)
  check(SyntheticInviteStatus.entries.none { it.name == "ACTIVE" || it.name == "APPROVED" })
  // 19. EXACT five-minute deadline makes invitation terminal even with
  // BOTH legitimately signed proofs. Expiry is persisted, never approved.
  run {
    var now = 1_000_000L
    fixture(labClock = { now }) { h ->
      val issued = h.invites.issue(intent, candidate.public)
      val nonce = issued.pendingNonceCopy()!!
      check(issued.expiresAtMillis - issued.issuedAtMillis ==
        SyntheticEnrollmentInviteDataStoreLab.MAX_INVITE_LIFETIME_MS)
      now = issued.expiresAtMillis
      check(runCatching { consume(h, nonce) }.exceptionOrNull() is StaleSyntheticInvite)
      val after = h.invites.read()!!
      check(after.status == SyntheticInviteStatus.EXPIRED)
      check(after.pendingNonceCopy() == null)
      check(runCatching { h.invites.issue(intent, candidate.public) }
        .exceptionOrNull() is StaleSyntheticInvite)
    }
  }

  // 20. One millisecond BEFORE expiry permits both valid signatures.
  run {
    var now = 2_000_000L
    fixture(labClock = { now }) { h ->
      val invite = h.invites.issue(intent, candidate.public)
      now = invite.expiresAtMillis - 1L
      check(consume(h, invite.pendingNonceCopy()!!).status == SyntheticInviteStatus.CONSUMED)
    }
  }

  // 21. Backward lab clock fails closed, without silently accepting a proof.
  run {
    var now = 3_000_000L
    fixture(labClock = { now }) { h ->
      val invite = h.invites.issue(intent, candidate.public)
      now = invite.issuedAtMillis - 1L
      check(runCatching { consume(h, invite.pendingNonceCopy()!!) }
        .exceptionOrNull() is InvalidSyntheticInviteClock)
      check(runCatching { h.invites.read() }.exceptionOrNull()
        is InvalidSyntheticInviteClock)
      // Reading with a reversed test clock must not alter persistent bytes.
      check(h.raw.data.first()[SyntheticInviteKeys.status] == SyntheticInviteStatus.PENDING.name)
    }
  }

  // 22. Expired tombstone persists when a disposable DataStore is closed
  // and reopened, even if the test clock later moves backwards.
  run {
    val dir = Files.createTempDirectory("negresco-expired-reopen-").toFile()
    val file = File(dir, "invite.preferences_pb")
    var now = 4_000_000L
    val first = InviteFileHarness(file, registry, floor, approver.public) { now }
    val nonce = try {
      val issued = first.invites.issue(intent, candidate.public)
      now = issued.expiresAtMillis + 1L
      check(runCatching { consume(first, issued.pendingNonceCopy()!!) }
        .exceptionOrNull() is StaleSyntheticInvite)
      issued.pendingNonceCopy()!!
    } finally { first.close() }
    now = 4_000_001L
    val reopened = InviteFileHarness(file, registry, floor, approver.public) { now }
    try {
      check(reopened.invites.read()!!.status == SyntheticInviteStatus.EXPIRED)
      check(reopened.invites.read()!!.pendingNonceCopy() == null)
      check(runCatching { consume(reopened, nonce) }
        .exceptionOrNull() is StaleSyntheticInvite)
    } finally { reopened.close(); check(dir.deleteRecursively()) }
  }

  // 23. Corrupted issuance/expiry metadata never becomes a usable invite.
  fixture { h ->
    h.raw.updateData { mutablePreferencesOf(
      SyntheticInviteKeys.version to 1,
      SyntheticInviteKeys.status to SyntheticInviteStatus.EXPIRED.name,
      SyntheticInviteKeys.approving to approverId.hex,
      SyntheticInviteKeys.candidate to candidateId.hex,
      SyntheticInviteKeys.revision to 1L,
      SyntheticInviteKeys.epoch to 1L,
      SyntheticInviteKeys.sequence to 1L,
      SyntheticInviteKeys.issuedAt to 1_000L,
      SyntheticInviteKeys.expiresAt to 2_000L
    ) }
    check(runCatching { h.invites.read() }.exceptionOrNull() is InvalidSyntheticInvite)
    check(runCatching { h.invites.issue(intent, candidate.public) }
      .exceptionOrNull() is InvalidSyntheticInvite)
  }

  // 24. Zero/overflow clock cannot create an invitation with invalid expiry.
  for (badTime in listOf(0L, -1L, Long.MAX_VALUE, Long.MAX_VALUE - 1L)) {
    fixture(labClock = { badTime }) { h ->
      check(runCatching { h.invites.issue(intent, candidate.public) }
        .exceptionOrNull() is InvalidSyntheticInviteClock)
      check(h.invites.read() == null)
    }
  }

  // 25. Expiry cannot be defeated by an incorrect signature presented
  // at the deadline; expires before cryptographic proof checking.
  run {
    var now = 5_000_000L
    fixture(labClock = { now }) { h ->
      val invite = h.invites.issue(intent, candidate.public)
      now = invite.expiresAtMillis
      check(runCatching { consume(h, invite.pendingNonceCopy()!!,
        approvingKey = stranger, candidateKey = stranger) }
        .exceptionOrNull() is StaleSyntheticInvite)
      check(h.invites.read()!!.status == SyntheticInviteStatus.EXPIRED)
    }
  }

  // 26. Just displaying an expired pending invitation must erase its nonce
  // and preserve the EXPIRED marker. No signed consume attempt is required.
  run {
    var now = 6_000_000L
    fixture(labClock = { now }) { h ->
      val issued = h.invites.issue(intent, candidate.public)
      val nonce = issued.pendingNonceCopy()!!
      now = issued.expiresAtMillis
      val expired = h.invites.read()!!
      check(expired.status == SyntheticInviteStatus.EXPIRED)
      check(expired.pendingNonceCopy() == null)
      check(h.raw.data.first()[SyntheticInviteKeys.status] == SyntheticInviteStatus.EXPIRED.name)
      check(runCatching { consume(h, nonce) }.exceptionOrNull() is StaleSyntheticInvite)
      check(candidateId !in registry.active)
    }
  }

  // 27. Late cancellation cannot falsely label an already-expired challenge
  // as CANCELLED, and the original nonce is removed in the same transaction.
  run {
    var now = 7_000_000L
    fixture(labClock = { now }) { h ->
      val issued = h.invites.issue(intent, candidate.public)
      val nonce = issued.pendingNonceCopy()!!
      now = issued.expiresAtMillis + 1L
      check(runCatching { h.invites.cancel(intent) }.exceptionOrNull()
        is StaleSyntheticInvite)
      check(h.invites.read()!!.status == SyntheticInviteStatus.EXPIRED)
      check(h.invites.read()!!.pendingNonceCopy() == null)
      check(runCatching { consume(h, nonce) }.exceptionOrNull() is StaleSyntheticInvite)
    }
  }

  // 28. A backwards wall clock rejects BOTH inspection and cancellation.
  // No transaction is permitted to reset, renew or consume a pending nonce.
  run {
    var now = 8_000_000L
    fixture(labClock = { now }) { h ->
      val issued = h.invites.issue(intent, candidate.public)
      now = issued.issuedAtMillis - 1L
      check(runCatching { h.invites.read() }.exceptionOrNull()
        is InvalidSyntheticInviteClock)
      check(runCatching { h.invites.cancel(intent) }.exceptionOrNull()
        is InvalidSyntheticInviteClock)
      check(h.raw.data.first()[SyntheticInviteKeys.status] == SyntheticInviteStatus.PENDING.name)
      check(h.raw.data.first()[SyntheticInviteKeys.pendingNonce] != null)
    }
  }

  println("PASS: 28 durable invite, expiry and tombstone scenarios (JVM lab, no trusted clock)")
}

package com.negresco.finance.security

import java.security.MessageDigest
import java.security.PublicKey
import java.security.SecureRandom
import java.util.UUID

/**
 * SEC-05B: isolated, IN-MEMORY account-scoped authority PROTOCOL SIMULATOR.
 *
 * NOT a server. Seeded identities/public keys are unauthenticated fixtures;
 * no network, account login, durable commit, HSM, owner strong authentication,
 * hardware attestation, authenticated wall clock or rollback-resistant storage.
 * NEVER wire this object into Expo, API handlers or real financial operations.
 *
 * It models a SINGLE atomic server-side decision point. A PROOF_ONLY result
 * records signature validation, NOT trusted enrollment or financial permission.
 */
internal data class SyntheticAccountAuthoritySeed(
  val opaqueAccountId: String,
  val registry: DeviceTrustSnapshot,
  val approverPublicKey: PublicKey
)

internal enum class SyntheticAuthorityInviteStatus {
  PENDING, CONSUMED_PROOF_ONLY, CANCELLED, EXPIRED, INVALIDATED
}

internal enum class SyntheticAuthorityDeny {
  UNKNOWN_ACCOUNT,
  UNKNOWN_INVITATION,
  INVALID_ACCOUNT_STATE,
  INVALID_CLOCK,
  OUTSTANDING_INVITATION,
  UNVERIFIED_ISSUE,
  NOT_PENDING,
  STALE_REGISTRY,
  INVALID_PROOF
}

internal class SyntheticAuthorityRejected(val reason: SyntheticAuthorityDeny) :
  IllegalStateException("Synthetic account invitation rejected: " + reason.name)

internal enum class SyntheticAuthoritySnapshotCheck {
  UNKNOWN_ACCOUNT, INVALID_SNAPSHOT, REVOKED_OR_UNKNOWN, STALE_OR_MISMATCHED,
  EXACT_FIXTURE_MATCH_NOT_AUTHORIZATION
}

internal class SyntheticAccountInviteView(
  val accountId: String,
  val invitationId: String,
  val intent: SyntheticDeviceEnrollmentIntent,
  val status: SyntheticAuthorityInviteStatus,
  val issuedAtMillis: Long,
  val expiresAtMillis: Long,
  nonce: ByteArray?
) {
  private val copiedNonce = nonce?.copyOf()
  fun pendingNonceCopy(): ByteArray? = copiedNonce?.copyOf()
}

/**
 * All transitions happen under one JVM mutex. Only a disposable experiment:
 * process termination loses the ledger, so actual anti-rollback is NOT solved.
 */
internal class SyntheticAccountInviteAuthorityLab(
  seeds: List<SyntheticAccountAuthoritySeed>,
  private val labClockMillis: () -> Long
) {
  companion object { const val MAX_AGE_MS = 5L * 60L * 1000L }

  private class Account(val approverPublicKey: PublicKey, var registry: DeviceTrustSnapshot)
  private class Invitation(
    val accountId: String,
    val id: String,
    val intent: SyntheticDeviceEnrollmentIntent,
    val candidate: DeviceKeyFingerprint,
    val issued: Long,
    val expires: Long,
    var nonce: ByteArray?,
    var status: SyntheticAuthorityInviteStatus = SyntheticAuthorityInviteStatus.PENDING
  )

  private val mutex = Any()
  private val rng = SecureRandom()
  private val accounts: Map<String, Account>
  private val invitations = mutableMapOf<Pair<String, String>, Invitation>()

  private fun copied(s: DeviceTrustSnapshot): DeviceTrustSnapshot = s.copy(
    active = s.active.toSet(),
    revoked = s.revoked.toSet(),
    lastSequence = s.lastSequence.toMap()
  )

  init {
    require(seeds.map { it.opaqueAccountId }.toSet().size == seeds.size)
    require(seeds.all {
      Regex("[0-9a-f]{32}").matches(it.opaqueAccountId) &&
        SyntheticDeviceTrustPolicy.wellFormed(it.registry) &&
        SyntheticSignedDeviceProofLab.fingerprint(it.approverPublicKey) in it.registry.active
    })
    accounts = seeds.associate { it.opaqueAccountId to
      Account(it.approverPublicKey, copied(it.registry)) }
  }

  private fun account(id: String) = accounts[id] ?:
    throw SyntheticAuthorityRejected(SyntheticAuthorityDeny.UNKNOWN_ACCOUNT)

  private fun invite(accountId: String, invitationId: String): Invitation {
    account(accountId)
    return invitations[accountId to invitationId] ?:
      throw SyntheticAuthorityRejected(SyntheticAuthorityDeny.UNKNOWN_INVITATION)
  }

  private fun now(): Long {
    val value = labClockMillis()
    if (value <= 0L || value > Long.MAX_VALUE - MAX_AGE_MS)
      throw SyntheticAuthorityRejected(SyntheticAuthorityDeny.INVALID_CLOCK)
    return value
  }

  private fun finish(invitation: Invitation, state: SyntheticAuthorityInviteStatus) {
    check(invitation.status == SyntheticAuthorityInviteStatus.PENDING)
    invitation.nonce?.fill(0)
    invitation.nonce = null
    invitation.status = state
  }

  /** Deliberately uses a REPLACEABLE fixture clock, never client time. */
  private fun applyExpiry(invitation: Invitation) {
    if (invitation.status != SyntheticAuthorityInviteStatus.PENDING) return
    val timestamp = now()
    if (timestamp < invitation.issued)
      throw SyntheticAuthorityRejected(SyntheticAuthorityDeny.INVALID_CLOCK)
    if (timestamp >= invitation.expires)
      finish(invitation, SyntheticAuthorityInviteStatus.EXPIRED)
  }

  private fun view(i: Invitation) = SyntheticAccountInviteView(
    i.accountId, i.id, i.intent, i.status, i.issued, i.expires, i.nonce
  )

  fun issue(
    accountId: String,
    intent: SyntheticDeviceEnrollmentIntent,
    candidatePublicKey: PublicKey
  ): SyntheticAccountInviteView = synchronized(mutex) {
    val scope = account(accountId)
    // Only one live invitation per synthetic account; terminal receipts remain.
    invitations.values.filter { it.accountId == accountId }.forEach(::applyExpiry)
    if (invitations.values.any {
        it.accountId == accountId && it.status == SyntheticAuthorityInviteStatus.PENDING
      }) throw SyntheticAuthorityRejected(SyntheticAuthorityDeny.OUTSTANDING_INVITATION)
    val timestamp = now()
    val challenge = ByteArray(32).also { rng.nextBytes(it) }
    try {
      val gate = SyntheticDeviceEnrollmentProofLab.inspect(
        scope.registry, DeviceTrustFloor(scope.registry.revision, scope.registry.epoch),
        intent, scope.approverPublicKey, candidatePublicKey,
        challenge, challenge, null, null
      )
      if (gate != SyntheticEnrollmentGate.DENY_APPROVAL_SIGNATURE)
        throw SyntheticAuthorityRejected(SyntheticAuthorityDeny.UNVERIFIED_ISSUE)
      val generatedId = UUID.randomUUID().toString()
      val i = Invitation(
        accountId, generatedId, intent, intent.candidateDevice,
        timestamp, timestamp + MAX_AGE_MS, challenge.copyOf()
      )
      invitations[accountId to generatedId] = i
      view(i)
    } finally {
      challenge.fill(0)
    }
  }

  fun inspect(accountId: String, invitationId: String): SyntheticAccountInviteView =
    synchronized(mutex) {
      val i = invite(accountId, invitationId)
      applyExpiry(i)
      view(i)
    }

  /**
   * Test-only explicit cancellation; NOT a user-facing authenticated API.
   * Late cancellation never overrides an EXPIRED terminal marker.
   */
  fun cancelFixtureOnly(accountId: String, invitationId: String): SyntheticAccountInviteView =
    synchronized(mutex) {
      val i = invite(accountId, invitationId)
      applyExpiry(i)
      if (i.status != SyntheticAuthorityInviteStatus.PENDING)
        throw SyntheticAuthorityRejected(SyntheticAuthorityDeny.NOT_PENDING)
      finish(i, SyntheticAuthorityInviteStatus.CANCELLED)
      view(i)
    }

  /**
   * Verify both REAL Ed25519 signatures while holding the account-wide lock.
   * No device is enrolled. A future server must durably commit nonce
   * consumption, sequence, account-bound registry and owner authorization in
   * one ACID transaction; this code deliberately cannot do any of that.
   */
  fun consumeProofOnly(
    accountId: String,
    invitationId: String,
    expectedIntent: SyntheticDeviceEnrollmentIntent,
    candidatePublicKey: PublicKey,
    receivedNonce: ByteArray?,
    approverSignature: ByteArray?,
    candidateSignature: ByteArray?
  ): SyntheticAccountInviteView = synchronized(mutex) {
    val scope = account(accountId)
    val i = invite(accountId, invitationId)
    applyExpiry(i)
    if (i.status != SyntheticAuthorityInviteStatus.PENDING)
      throw SyntheticAuthorityRejected(SyntheticAuthorityDeny.NOT_PENDING)
    val state = scope.registry
    if (i.intent != expectedIntent || i.intent.revision != state.revision ||
        i.intent.epoch != state.epoch ||
        i.intent.approvingDevice !in state.active ||
        i.intent.approvingDevice in state.revoked ||
        i.intent.approvingSequence <= (state.lastSequence[i.intent.approvingDevice] ?: 0L)) {
      finish(i, SyntheticAuthorityInviteStatus.INVALIDATED)
      throw SyntheticAuthorityRejected(SyntheticAuthorityDeny.STALE_REGISTRY)
    }
    val storedNonce = i.nonce ?: throw SyntheticAuthorityRejected(SyntheticAuthorityDeny.INVALID_ACCOUNT_STATE)
    if (receivedNonce == null || receivedNonce.size != 32 ||
        !MessageDigest.isEqual(storedNonce, receivedNonce))
      throw SyntheticAuthorityRejected(SyntheticAuthorityDeny.INVALID_PROOF)
    val verified = SyntheticDeviceEnrollmentProofLab.inspect(
      state, DeviceTrustFloor(state.revision, state.epoch), i.intent,
      scope.approverPublicKey, candidatePublicKey, storedNonce, receivedNonce,
      approverSignature, candidateSignature
    )
    if (verified != SyntheticEnrollmentGate.PROCEED_TO_INDEPENDENT_PERSISTENT_ENROLLMENT_PROTOCOL)
      throw SyntheticAuthorityRejected(SyntheticAuthorityDeny.INVALID_PROOF)
    // The test fixture remembers the approver sequence only. Never add
    // candidateDevice to active, and never return an authorization token.
    scope.registry = copied(state.copy(
      lastSequence = state.lastSequence + (i.intent.approvingDevice to i.intent.approvingSequence)
    ))
    finish(i, SyntheticAuthorityInviteStatus.CONSUMED_PROOF_ONLY)
    view(i)
  }

  /**
   * Simulates a REMOTE revocation arriving from an independent authorizer.
   * This method itself has NO AUTHENTICATION and must remain test-only.
   */
  fun revokeApproverFixtureOnly(accountId: String) = synchronized(mutex) {
    val scope = account(accountId)
    val current = scope.registry
    val id = SyntheticSignedDeviceProofLab.fingerprint(scope.approverPublicKey)
      ?: throw SyntheticAuthorityRejected(SyntheticAuthorityDeny.INVALID_ACCOUNT_STATE)
    if (id !in current.active || current.revision == Long.MAX_VALUE ||
        current.epoch == Long.MAX_VALUE)
      throw SyntheticAuthorityRejected(SyntheticAuthorityDeny.INVALID_ACCOUNT_STATE)
    scope.registry = copied(current.copy(
      revision = current.revision + 1L,
      epoch = current.epoch + 1L,
      active = current.active - id,
      revoked = current.revoked + id,
      lastSequence = current.lastSequence - id
    ))
    invitations.values.filter {
      it.accountId == accountId && it.status == SyntheticAuthorityInviteStatus.PENDING
    }.forEach { finish(it, SyntheticAuthorityInviteStatus.INVALIDATED) }
  }

  /** Exact-match check is not an authenticated anti-rollback witness. */
  fun compareFixtureSnapshot(
    accountId: String,
    presented: DeviceTrustSnapshot
  ): SyntheticAuthoritySnapshotCheck = synchronized(mutex) {
    val scope = accounts[accountId] ?: return@synchronized SyntheticAuthoritySnapshotCheck.UNKNOWN_ACCOUNT
    if (!SyntheticDeviceTrustPolicy.wellFormed(presented))
      return@synchronized SyntheticAuthoritySnapshotCheck.INVALID_SNAPSHOT
    val id = SyntheticSignedDeviceProofLab.fingerprint(scope.approverPublicKey)
    if (id == null || id in scope.registry.revoked || id !in scope.registry.active)
      return@synchronized SyntheticAuthoritySnapshotCheck.REVOKED_OR_UNKNOWN
    if (copied(presented) != scope.registry)
      return@synchronized SyntheticAuthoritySnapshotCheck.STALE_OR_MISMATCHED
    SyntheticAuthoritySnapshotCheck.EXACT_FIXTURE_MATCH_NOT_AUTHORIZATION
  }

  fun snapshotForTest(accountId: String): DeviceTrustSnapshot =
    synchronized(mutex) { copied(account(accountId).registry) }
}

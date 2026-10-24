package com.negresco.finance.security

import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.Signature
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** SEC-05B. Disposable signatures and time fixtures, never user accounts. */
internal fun runSyntheticAccountInviteAuthorityScenarios() {
  val approver = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val candidate = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val stranger = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val approverB = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val oldId = SyntheticSignedDeviceProofLab.fingerprint(approver.public)!!
  val newId = SyntheticSignedDeviceProofLab.fingerprint(candidate.public)!!
  val otherId = SyntheticSignedDeviceProofLab.fingerprint(stranger.public)!!
  val idB = SyntheticSignedDeviceProofLab.fingerprint(approverB.public)!!
  val accountA = "a".repeat(32)
  val accountB = "b".repeat(32)
  val baseline = SyntheticDeviceTrustPolicy.createSyntheticFirstDevice(oldId)
  val baselineB = SyntheticDeviceTrustPolicy.createSyntheticFirstDevice(idB)
  val intent = SyntheticDeviceEnrollmentIntent(oldId, newId, 1L, 1L, 1L)
  val intentB = SyntheticDeviceEnrollmentIntent(idB, newId, 1L, 1L, 1L)
  var clock = 1_000_000L

  fun make(
    seeds: List<SyntheticAccountAuthoritySeed> = listOf(
      SyntheticAccountAuthoritySeed(accountA, baseline, approver.public),
      SyntheticAccountAuthoritySeed(accountB, baselineB, approverB.public)
    )
  ) = SyntheticAccountInviteAuthorityLab(seeds) { clock }

  fun signature(key: KeyPair, account: String, invite: String,
    request: SyntheticDeviceEnrollmentIntent, nonce: ByteArray,
    candidateRole: Boolean): ByteArray =
    Signature.getInstance("Ed25519").run {
      initSign(key.private)
      update(SyntheticAccountBoundInviteProofLab.payload(
        account, invite, request, nonce, candidateRole))
      sign()
    }

  fun attempt(
    authority: SyntheticAccountInviteAuthorityLab,
    invitation: SyntheticAccountInviteView,
    account: String = accountA,
    request: SyntheticDeviceEnrollmentIntent = invitation.intent,
    proofFrom: KeyPair = approver,
    candidateFrom: KeyPair = candidate,
    nonce: ByteArray = invitation.pendingNonceCopy()!!
  ): SyntheticAccountInviteView = authority.consumeProofOnly(
    account, invitation.invitationId, request, candidateFrom.public, nonce,
    signature(proofFrom, account, invitation.invitationId, request, nonce, false),
    signature(candidateFrom, account, invitation.invitationId, request, nonce, true)
  )

  fun denied(expected: SyntheticAuthorityDeny, block: () -> Any?) {
    val thrown = runCatching(block).exceptionOrNull()
    check(thrown is SyntheticAuthorityRejected && thrown.reason == expected) {
      "Expected $expected, got $thrown"
    }
  }

  // 1. Unknown account cannot obtain a challenge.
  run {
    val lab = make()
    denied(SyntheticAuthorityDeny.UNKNOWN_ACCOUNT) {
      lab.issue("f".repeat(32), intent, candidate.public)
    }
  }

  // 2. The authority issues a 32-byte one-time challenge for an exact account.
  run {
    val invite = make().issue(accountA, intent, candidate.public)
    check(invite.status == SyntheticAuthorityInviteStatus.PENDING)
    check(invite.accountId == accountA)
    check(invite.pendingNonceCopy()!!.size == 32)
    check(invite.expiresAtMillis - invite.issuedAtMillis == 300_000L)
  }

  // 3. An unregistered approver cannot use the account seed.
  run {
    val lab = make()
    denied(SyntheticAuthorityDeny.UNVERIFIED_ISSUE) {
      lab.issue(accountA, intent.copy(approvingDevice = otherId), candidate.public)
    }
  }

  // 4. A candidate key not matching the invitation is rejected at issue.
  run {
    val lab = make()
    denied(SyntheticAuthorityDeny.UNVERIFIED_ISSUE) {
      lab.issue(accountA, intent, stranger.public)
    }
  }

  // 5. Do not overwrite an outstanding invitation.
  run {
    val lab = make()
    lab.issue(accountA, intent, candidate.public)
    denied(SyntheticAuthorityDeny.OUTSTANDING_INVITATION) {
      lab.issue(accountA, intent, candidate.public)
    }
  }

  // 6. Two real Ed25519 proofs can consume a challenge exactly once.
  run {
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    val oldNonce = issued.pendingNonceCopy()!!
    val done = attempt(lab, issued)
    check(done.status == SyntheticAuthorityInviteStatus.CONSUMED_PROOF_ONLY)
    check(done.pendingNonceCopy() == null)
    check(lab.snapshotForTest(accountA).lastSequence[oldId] == 1L)
    check(newId !in lab.snapshotForTest(accountA).active)
    denied(SyntheticAuthorityDeny.NOT_PENDING) {
      attempt(lab, issued, nonce = oldNonce)
    }
  }

  // 7. A later invitation needs a strictly newer approver sequence.
  run {
    val lab = make()
    val first = lab.issue(accountA, intent, candidate.public)
    attempt(lab, first)
    denied(SyntheticAuthorityDeny.UNVERIFIED_ISSUE) {
      lab.issue(accountA, intent, candidate.public)
    }
    val second = lab.issue(accountA, intent.copy(approvingSequence = 2L), candidate.public)
    check(attempt(lab, second).status == SyntheticAuthorityInviteStatus.CONSUMED_PROOF_ONLY)
    check(lab.snapshotForTest(accountA).lastSequence[oldId] == 2L)
  }

  // 8. A modified challenge, even signed by BOTH real keys, is denied.
  run {
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    val changed = issued.pendingNonceCopy()!!.also { it[0] = (it[0].toInt() xor 1).toByte() }
    denied(SyntheticAuthorityDeny.INVALID_PROOF) { attempt(lab, issued, nonce = changed) }
    check(lab.inspect(accountA, issued.invitationId).status == SyntheticAuthorityInviteStatus.PENDING)
  }

  // 9. A forged approving signature does not finish a valid invitation.
  run {
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    denied(SyntheticAuthorityDeny.INVALID_PROOF) {
      attempt(lab, issued, proofFrom = stranger)
    }
    check(lab.inspect(accountA, issued.invitationId).status == SyntheticAuthorityInviteStatus.PENDING)
  }

  // 10. A forged candidate key/signature does not authenticate a new device.
  run {
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    denied(SyntheticAuthorityDeny.INVALID_PROOF) {
      attempt(lab, issued, candidateFrom = stranger)
    }
  }

  // 11. Account A's invitation ID cannot be consumed from account B.
  run {
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    denied(SyntheticAuthorityDeny.UNKNOWN_INVITATION) {
      attempt(lab, issued, account = accountB)
    }
    check(lab.snapshotForTest(accountB) == baselineB)
  }

  // 12. A separate account can independently issue its own challenge.
  run {
    val lab = make()
    lab.issue(accountA, intent, candidate.public)
    val issuedB = lab.issue(accountB, intentB, candidate.public)
    check(attempt(lab, issuedB, account = accountB, proofFrom = approverB).status ==
      SyntheticAuthorityInviteStatus.CONSUMED_PROOF_ONLY)
    check(lab.snapshotForTest(accountA) == baseline)
  }

  // 13. At EXACT deadline, mere inspection commits EXPIRED and removes nonce.
  run {
    clock = 2_000_000L
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    clock = issued.expiresAtMillis
    val expired = lab.inspect(accountA, issued.invitationId)
    check(expired.status == SyntheticAuthorityInviteStatus.EXPIRED)
    check(expired.pendingNonceCopy() == null)
    denied(SyntheticAuthorityDeny.NOT_PENDING) { attempt(lab, issued) }
    clock = issued.issuedAtMillis + 1L
    check(lab.inspect(accountA, issued.invitationId).status == SyntheticAuthorityInviteStatus.EXPIRED)
  }

  // 14. A millisecond before expiry is still valid with both signatures.
  run {
    clock = 3_000_000L
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    clock = issued.expiresAtMillis - 1L
    check(attempt(lab, issued).status == SyntheticAuthorityInviteStatus.CONSUMED_PROOF_ONLY)
  }

  // 15. Reversing the clock must not resurrect or consume an invitation.
  run {
    clock = 4_000_000L
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    clock = issued.issuedAtMillis - 1L
    denied(SyntheticAuthorityDeny.INVALID_CLOCK) {
      lab.inspect(accountA, issued.invitationId)
    }
    denied(SyntheticAuthorityDeny.INVALID_CLOCK) { attempt(lab, issued) }
    clock = issued.issuedAtMillis
    check(lab.inspect(accountA, issued.invitationId).status == SyntheticAuthorityInviteStatus.PENDING)
  }

  // 16. Cancelled invitations are terminal and cannot be consumed.
  run {
    clock = 5_000_000L
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    val cancelled = lab.cancelFixtureOnly(accountA, issued.invitationId)
    check(cancelled.status == SyntheticAuthorityInviteStatus.CANCELLED)
    check(cancelled.pendingNonceCopy() == null)
    denied(SyntheticAuthorityDeny.NOT_PENDING) { attempt(lab, issued) }
  }

  // 17. A late cancellation cannot change EXPIRED into CANCELLED.
  run {
    clock = 6_000_000L
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    clock = issued.expiresAtMillis + 1L
    denied(SyntheticAuthorityDeny.NOT_PENDING) {
      lab.cancelFixtureOnly(accountA, issued.invitationId)
    }
    check(lab.inspect(accountA, issued.invitationId).status == SyntheticAuthorityInviteStatus.EXPIRED)
  }

  // 18. Synthetic revocation invalidates the outstanding nonce atomically.
  run {
    clock = 7_000_000L
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    val older = lab.snapshotForTest(accountA)
    lab.revokeApproverFixtureOnly(accountA)
    val current = lab.snapshotForTest(accountA)
    check(current.revision == 2L && current.epoch == 2L)
    check(oldId in current.revoked && oldId !in current.active)
    check(lab.inspect(accountA, issued.invitationId).status == SyntheticAuthorityInviteStatus.INVALIDATED)
    denied(SyntheticAuthorityDeny.NOT_PENDING) { attempt(lab, issued) }
    denied(SyntheticAuthorityDeny.UNVERIFIED_ISSUE) {
      lab.issue(accountA, intent.copy(revision = 2L, epoch = 2L), candidate.public)
    }
    check(lab.compareFixtureSnapshot(accountA, older) ==
      SyntheticAuthoritySnapshotCheck.REVOKED_OR_UNKNOWN)
  }

  // 19. Replay of an old account snapshot is denied after sequence change.
  run {
    clock = 8_000_000L
    val lab = make()
    val before = lab.snapshotForTest(accountA)
    check(lab.compareFixtureSnapshot(accountA, before) ==
      SyntheticAuthoritySnapshotCheck.EXACT_FIXTURE_MATCH_NOT_AUTHORIZATION)
    attempt(lab, lab.issue(accountA, intent, candidate.public))
    check(lab.compareFixtureSnapshot(accountA, before) ==
      SyntheticAuthoritySnapshotCheck.STALE_OR_MISMATCHED)
    check(lab.compareFixtureSnapshot(accountA, lab.snapshotForTest(accountA)) ==
      SyntheticAuthoritySnapshotCheck.EXACT_FIXTURE_MATCH_NOT_AUTHORIZATION)
  }

  // 20. A forged registry with equal epoch but changed membership is rejected.
  run {
    clock = 9_000_000L
    val lab = make()
    check(lab.compareFixtureSnapshot(accountA, baseline.copy(active = setOf(oldId, newId))) ==
      SyntheticAuthoritySnapshotCheck.STALE_OR_MISMATCHED)
    check(lab.compareFixtureSnapshot(accountA, baseline.copy(active = emptySet(), revoked = emptySet())) ==
      SyntheticAuthoritySnapshotCheck.INVALID_SNAPSHOT)
  }

  // 21. Unknown accounts cannot observe other accounts' invitation records.
  run {
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    denied(SyntheticAuthorityDeny.UNKNOWN_ACCOUNT) {
      lab.inspect("f".repeat(32), issued.invitationId)
    }
    denied(SyntheticAuthorityDeny.UNKNOWN_INVITATION) {
      lab.inspect(accountB, issued.invitationId)
    }
  }

  // 22. Defensive copies prevent callers from mutating pending challenges.
  run {
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    val firstCopy = issued.pendingNonceCopy()!!
    firstCopy.fill(0)
    check(!firstCopy.contentEquals(lab.inspect(accountA, issued.invitationId).pendingNonceCopy()!!))
    check(attempt(lab, issued).status == SyntheticAuthorityInviteStatus.CONSUMED_PROOF_ONLY)
  }

  // 23. Independent concurrent consumption has exactly one winner.
  run {
    clock = 10_000_000L
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    val gate = CountDownLatch(1)
    val pool = Executors.newFixedThreadPool(8)
    try {
      val tasks = (1..8).map {
        pool.submit<Boolean> {
          gate.await()
          runCatching { attempt(lab, issued) }.isSuccess
        }
      }
      gate.countDown()
      check(tasks.count { it.get(15L, TimeUnit.SECONDS) } == 1)
      check(lab.snapshotForTest(accountA).lastSequence[oldId] == 1L)
    } finally {
      pool.shutdownNow()
    }
  }

  // 24. A new process/authority instance cannot pretend to retain tombstones.
  // This is a documented LIMIT of this in-memory simulator, not a pass for G06.
  run {
    clock = 11_000_000L
    val first = make()
    val issued = first.issue(accountA, intent, candidate.public)
    val second = make()
    denied(SyntheticAuthorityDeny.UNKNOWN_INVITATION) {
      second.inspect(accountA, issued.invitationId)
    }
    check(newId !in second.snapshotForTest(accountA).active)
  }

  // 25. Synthetic fixture seeds must reject duplicate or malformed account IDs.
  run {
    check(runCatching {
      make(listOf(SyntheticAccountAuthoritySeed("bad", baseline, approver.public)))
    }.isFailure)
    check(runCatching {
      make(listOf(
        SyntheticAccountAuthoritySeed(accountA, baseline, approver.public),
        SyntheticAccountAuthoritySeed(accountA, baselineB, approverB.public)
      ))
    }.isFailure)
  }

  // 26. Malformed untrusted caller intent must not destroy an honest invite.
  run {
    clock = 12_000_000L
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    denied(SyntheticAuthorityDeny.INVALID_PROOF) {
      attempt(lab, issued, request = intent.copy(approvingSequence = 2L))
    }
    check(lab.inspect(accountA, issued.invitationId).status == SyntheticAuthorityInviteStatus.PENDING)
    check(attempt(lab, issued).status == SyntheticAuthorityInviteStatus.CONSUMED_PROOF_ONLY)
  }

  // 27. A signature for another account cannot consume this account's
  // invitation, even when a valid key and identical stored nonce are used.
  run {
    clock = 13_000_000L
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    val nonce = issued.pendingNonceCopy()!!
    denied(SyntheticAuthorityDeny.INVALID_PROOF) {
      lab.consumeProofOnly(accountA, issued.invitationId, intent, candidate.public,
        nonce,
        signature(approver, accountB, issued.invitationId, intent, nonce, false),
        signature(candidate, accountB, issued.invitationId, intent, nonce, true))
    }
    check(lab.inspect(accountA, issued.invitationId).status == SyntheticAuthorityInviteStatus.PENDING)
    check(attempt(lab, issued).status == SyntheticAuthorityInviteStatus.CONSUMED_PROOF_ONLY)
  }

  // 28. An otherwise-valid signature for a different invitation UUID fails.
  run {
    clock = 14_000_000L
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    val nonce = issued.pendingNonceCopy()!!
    val otherInvite = "123e4567-e89b-42d3-a456-426614174000"
    check(otherInvite != issued.invitationId)
    denied(SyntheticAuthorityDeny.INVALID_PROOF) {
      lab.consumeProofOnly(accountA, issued.invitationId, intent, candidate.public,
        nonce,
        signature(approver, accountA, otherInvite, intent, nonce, false),
        signature(candidate, accountA, otherInvite, intent, nonce, true))
    }
    check(attempt(lab, issued).status == SyntheticAuthorityInviteStatus.CONSUMED_PROOF_ONLY)
  }

  // 29. Reusing the approver signature as candidate proof cannot work.
  run {
    clock = 15_000_000L
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    val nonce = issued.pendingNonceCopy()!!
    val approverProof = signature(approver, accountA, issued.invitationId, intent, nonce, false)
    denied(SyntheticAuthorityDeny.INVALID_PROOF) {
      lab.consumeProofOnly(accountA, issued.invitationId, intent, candidate.public,
        nonce, approverProof, approverProof)
    }
    check(lab.inspect(accountA, issued.invitationId).status == SyntheticAuthorityInviteStatus.PENDING)
  }

  // 30. A signed proof cannot be moved to another registry epoch/sequence.
  run {
    clock = 16_000_000L
    val lab = make()
    val issued = lab.issue(accountA, intent, candidate.public)
    val nonce = issued.pendingNonceCopy()!!
    denied(SyntheticAuthorityDeny.INVALID_PROOF) {
      attempt(lab, issued, request = intent.copy(epoch = 2L, revision = 2L))
    }
    check(attempt(lab, issued).status == SyntheticAuthorityInviteStatus.CONSUMED_PROOF_ONLY)
  }

  println("PASS: 30 account-scoped invitation authority scenarios (in-memory lab, no real backend)")
}

package com.negresco.finance.security

import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.PublicKey
import java.security.Signature
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** SEC-05F. Every private key and account ID below is a DISPOSABLE fixture. */
internal fun runAllDevicesLostRecoveryScenarios() {
  val generator = KeyPairGenerator.getInstance("Ed25519")
  val previous = generator.generateKeyPair()
  val previousB = generator.generateKeyPair()
  val candidate = generator.generateKeyPair()
  val attacker = generator.generateKeyPair()
  val authority = generator.generateKeyPair()
  val imposterAuthority = generator.generateKeyPair()
  val previousId = SyntheticSignedDeviceProofLab.fingerprint(previous.public)!!
  val previousBId = SyntheticSignedDeviceProofLab.fingerprint(previousB.public)!!
  val candidateId = SyntheticSignedDeviceProofLab.fingerprint(candidate.public)!!
  val accountA = "a".repeat(32)
  val accountB = "b".repeat(32)
  val lost = DeviceTrustSnapshot(
    revision = 2L, epoch = 2L, active = emptySet(),
    revoked = setOf(previousId), lastSequence = emptyMap()
  )
  val lostB = lost.copy(revoked = setOf(previousBId))
  val stillActive = SyntheticDeviceTrustPolicy.createSyntheticFirstDevice(previousId)
  var now = 2_000_000L

  fun lab(
    firstRegistry: DeviceTrustSnapshot = lost,
    key: PublicKey? = authority.public,
    secondRegistry: DeviceTrustSnapshot = lostB
  ) = SyntheticAllDevicesLostRecoveryLab(
    listOf(
      SyntheticRecoveryAccountSeed(accountA, firstRegistry, 1L),
      SyntheticRecoveryAccountSeed(accountB, secondRegistry, 1L)
    ), key
  ) { now }

  fun open(
    subject: SyntheticAllDevicesLostRecoveryLab,
    account: String = accountA,
    key: PublicKey = candidate.public
  ): SyntheticRecoveryTicketView {
    val (gate, view) = subject.openReviewFixtureOnly(account, key)
    check(gate == SyntheticRecoveryCheck.REVIEW_OPENED_NOT_ENROLLED)
    return view ?: error("Missing synthetic review ticket")
  }

  fun sign(
    key: KeyPair,
    view: SyntheticRecoveryTicketView,
    nonce: ByteArray = view.pendingNonceCopy()!!,
    candidateRole: Boolean
  ) = Signature.getInstance("Ed25519").run {
    initSign(key.private)
    update(SyntheticRecoverySignedReviewLab.payload(view, nonce, candidateRole))
    sign()
  }

  fun verify(
    subject: SyntheticAllDevicesLostRecoveryLab,
    view: SyntheticRecoveryTicketView,
    account: String = accountA,
    publicKey: PublicKey = candidate.public,
    nonce: ByteArray = view.pendingNonceCopy()!!,
    reviewer: KeyPair = authority,
    candidateSigner: KeyPair = candidate,
    signedView: SyntheticRecoveryTicketView = view,
    signedNonce: ByteArray = nonce
  ) = subject.confirmReviewProofOnly(
    account, view.ticketId, publicKey, nonce,
    sign(reviewer, signedView, signedNonce, false),
    sign(candidateSigner, signedView, signedNonce, true)
  )

  // 1. A remaining trusted device disallows the total-loss recovery path.
  run {
    val subject = lab(firstRegistry = stillActive)
    check(subject.openReviewFixtureOnly(accountA, candidate.public).first ==
      SyntheticRecoveryCheck.DENY_ACTIVE_DEVICE_EXISTS)
  }

  // 2. A revoked-only registry permits only opening a review, not enrollment.
  run {
    val subject = lab()
    val view = open(subject)
    check(view.status == SyntheticRecoveryStatus.PENDING_REVIEW)
    check(view.pendingNonceCopy()!!.size == 32)
    check(view.expiresMillis - view.issuedMillis ==
      SyntheticAllDevicesLostRecoveryLab.REVIEW_WINDOW_MILLIS)
    check(subject.registryForTest(accountA) == lost)
  }

  // 3. A formerly revoked replacement key is not silently reauthorized.
  run {
    val subject = lab()
    check(subject.openReviewFixtureOnly(accountA, previous.public).first ==
      SyntheticRecoveryCheck.DENY_REVOKED_OR_KNOWN_CANDIDATE)
  }

  // 4. A non-Ed25519 candidate does not qualify for a review challenge.
  run {
    val ec = java.security.KeyPairGenerator.getInstance("EC").generateKeyPair()
    check(lab().openReviewFixtureOnly(accountA, ec.public).first ==
      SyntheticRecoveryCheck.DENY_WRONG_CANDIDATE)
  }

  // 5. Unknown account cannot start a review.
  run {
    check(lab().openReviewFixtureOnly("f".repeat(32), candidate.public).first ==
      SyntheticRecoveryCheck.DENY_UNKNOWN_ACCOUNT)
  }

  // 6. Two valid, differently domained signatures record proof ONLY.
  run {
    val subject = lab()
    val view = open(subject)
    check(verify(subject, view) == SyntheticRecoveryCheck.PROOF_RECORDED_NOT_ENROLLED)
    check(subject.registryForTest(accountA) == lost)
    val (_, terminal) = subject.inspectFixtureOnly(accountA, view.ticketId)
    check(terminal!!.status == SyntheticRecoveryStatus.PROOF_ONLY_RECORDED)
    check(terminal.pendingNonceCopy() == null)
    check(candidateId !in subject.registryForTest(accountA)!!.active)
  }

  // 7. Proofs are one time, never replayable into enrollment.
  run {
    val subject = lab()
    val view = open(subject)
    check(verify(subject, view) == SyntheticRecoveryCheck.PROOF_RECORDED_NOT_ENROLLED)
    check(verify(subject, view) == SyntheticRecoveryCheck.DENY_TERMINAL_TICKET)
  }

  // 8. A different identity key cannot choose itself as trusted reviewer.
  run {
    val subject = lab()
    val view = open(subject)
    check(verify(subject, view, reviewer = imposterAuthority) ==
      SyntheticRecoveryCheck.DENY_REVIEW_SIGNATURE)
    check(subject.inspectFixtureOnly(accountA, view.ticketId).second!!.status ==
      SyntheticRecoveryStatus.PENDING_REVIEW)
  }

  // 9. Missing pinned reviewer means fail closed, not self-approval.
  run {
    val subject = lab(key = null)
    val view = open(subject)
    check(verify(subject, view) == SyntheticRecoveryCheck.DENY_MISSING_PINNED_AUTHORITY)
    check(subject.registryForTest(accountA) == lost)
  }

  // 10. Applicant cannot fake candidate key possession with a reviewer proof.
  run {
    val subject = lab()
    val view = open(subject)
    check(verify(subject, view, candidateSigner = attacker) ==
      SyntheticRecoveryCheck.DENY_CANDIDATE_SIGNATURE)
  }

  // 11. Wrong candidate public key is denied before verifying signatures.
  run {
    val subject = lab()
    val view = open(subject)
    check(verify(subject, view, publicKey = attacker.public) ==
      SyntheticRecoveryCheck.DENY_WRONG_CANDIDATE)
  }

  // 12. A changed nonce, even signed by the correct keys, is rejected.
  run {
    val subject = lab()
    val view = open(subject)
    val altered = view.pendingNonceCopy()!!.also {
      it[0] = (it[0].toInt() xor 1).toByte()
    }
    check(verify(subject, view, nonce = altered) == SyntheticRecoveryCheck.DENY_INVALID_NONCE)
    check(verify(subject, view) == SyntheticRecoveryCheck.PROOF_RECORDED_NOT_ENROLLED)
  }

  // 13. A signed review for another ACCOUNT does not authorize this account.
  run {
    val subject = lab()
    val view = open(subject)
    val forged = SyntheticRecoveryTicketView(
      accountB, view.ticketId, view.candidate, view.revision, view.epoch,
      view.ownerGeneration, view.issuedMillis, view.expiresMillis,
      view.status, view.pendingNonceCopy()
    )
    check(verify(subject, view, signedView = forged) ==
      SyntheticRecoveryCheck.DENY_REVIEW_SIGNATURE)
  }

  // 14. A signed review for another TICKET ID is rejected.
  run {
    val subject = lab()
    val view = open(subject)
    val forged = SyntheticRecoveryTicketView(
      view.accountId, "123e4567-e89b-42d3-a456-426614174000",
      view.candidate, view.revision, view.epoch, view.ownerGeneration,
      view.issuedMillis, view.expiresMillis, view.status, view.pendingNonceCopy()
    )
    check(forged.ticketId != view.ticketId)
    check(verify(subject, view, signedView = forged) ==
      SyntheticRecoveryCheck.DENY_REVIEW_SIGNATURE)
  }

  // 15. Independent role domains prevent candidate/reviewer role swapping.
  run {
    val subject = lab()
    val view = open(subject)
    val nonce = view.pendingNonceCopy()!!
    val reviewerProof = sign(authority, view, nonce, false)
    check(subject.confirmReviewProofOnly(
      accountA, view.ticketId, candidate.public, nonce,
      reviewerProof, reviewerProof
    ) == SyntheticRecoveryCheck.DENY_CANDIDATE_SIGNATURE)
  }

  // 16. Expiry at the precise deadline tombstones the challenge.
  run {
    now = 3_000_000L
    val subject = lab()
    val view = open(subject)
    now = view.expiresMillis
    val (outcome, expired) = subject.inspectFixtureOnly(accountA, view.ticketId)
    check(outcome == SyntheticRecoveryCheck.REVIEW_OPENED_NOT_ENROLLED)
    check(expired!!.status == SyntheticRecoveryStatus.EXPIRED)
    check(expired.pendingNonceCopy() == null)
    check(verify(subject, view) == SyntheticRecoveryCheck.DENY_TERMINAL_TICKET)
    now = view.issuedMillis
    check(subject.inspectFixtureOnly(accountA, view.ticketId).second!!.status ==
      SyntheticRecoveryStatus.EXPIRED)
  }

  // 17. Clock rollback causes denial without consuming or reviving.
  run {
    now = 4_000_000L
    val subject = lab()
    val view = open(subject)
    now = view.issuedMillis - 1L
    check(subject.inspectFixtureOnly(accountA, view.ticketId).first ==
      SyntheticRecoveryCheck.DENY_CLOCK)
    check(verify(subject, view) == SyntheticRecoveryCheck.DENY_CLOCK)
    now = view.issuedMillis
    check(verify(subject, view) == SyntheticRecoveryCheck.PROOF_RECORDED_NOT_ENROLLED)
  }

  // 18. Cannot open a second pending review for the same account.
  run {
    now = 5_000_000L
    val subject = lab()
    open(subject)
    check(subject.openReviewFixtureOnly(accountA, attacker.public).first ==
      SyntheticRecoveryCheck.DENY_PENDING_REVIEW)
  }

  // 19. Different account's challenge cannot be inspected across scopes.
  run {
    val subject = lab()
    val a = open(subject)
    check(subject.inspectFixtureOnly(accountB, a.ticketId).first ==
      SyntheticRecoveryCheck.DENY_UNKNOWN_TICKET)
    check(subject.confirmReviewProofOnly(
      accountB, a.ticketId, candidate.public,
      a.pendingNonceCopy(), null, null
    ) == SyntheticRecoveryCheck.DENY_UNKNOWN_TICKET)
  }

  // 20. Generation change invalidates even a perfectly signed old ticket.
  run {
    now = 6_000_000L
    val subject = lab()
    val view = open(subject)
    check(subject.invalidateGenerationFixtureOnly(accountA))
    check(verify(subject, view) == SyntheticRecoveryCheck.DENY_TERMINAL_TICKET)
    check(subject.inspectFixtureOnly(accountA, view.ticketId).second!!.status ==
      SyntheticRecoveryStatus.INVALIDATED)
    val advanced = subject.registryForTest(accountA)!!
    check(advanced.revision == 3L && advanced.epoch == 3L)
    check(advanced.active.isEmpty())
    val refreshed = open(subject)
    check(refreshed.ownerGeneration == 2L)
    check(verify(subject, refreshed, signedView = view) ==
      SyntheticRecoveryCheck.DENY_REVIEW_SIGNATURE)
  }

  // 21. Returned challenge byte arrays are defensive copies.
  run {
    val subject = lab()
    val view = open(subject)
    val altered = view.pendingNonceCopy()!!
    altered.fill(0)
    val saved = subject.inspectFixtureOnly(accountA, view.ticketId).second!!.pendingNonceCopy()!!
    check(!altered.contentEquals(saved))
    check(verify(subject, view) == SyntheticRecoveryCheck.PROOF_RECORDED_NOT_ENROLLED)
  }

  // 22. Eight simultaneous signed proofs record just ONE terminal transition.
  run {
    now = 7_000_000L
    val subject = lab()
    val view = open(subject)
    val start = CountDownLatch(1)
    val pool = Executors.newFixedThreadPool(8)
    try {
      val tasks = (1..8).map {
        pool.submit<SyntheticRecoveryCheck> {
          start.await()
          verify(subject, view)
        }
      }
      start.countDown()
      val results = tasks.map { it.get(15L, TimeUnit.SECONDS) }
      check(results.count { it == SyntheticRecoveryCheck.PROOF_RECORDED_NOT_ENROLLED } == 1)
      check(results.count { it == SyntheticRecoveryCheck.DENY_TERMINAL_TICKET } == 7)
      check(subject.registryForTest(accountA)!!.active.isEmpty())
    } finally {
      pool.shutdownNow()
    }
  }

  // 23. Account B is separate; proof signed for A cannot be consumed for B.
  run {
    now = 8_000_000L
    val subject = lab()
    val a = open(subject)
    val b = open(subject, accountB)
    val nonceB = b.pendingNonceCopy()!!
    check(subject.confirmReviewProofOnly(
      accountB, b.ticketId, candidate.public, nonceB,
      sign(authority, a, candidateRole = false),
      sign(candidate, a, candidateRole = true)
    ) == SyntheticRecoveryCheck.DENY_REVIEW_SIGNATURE)
    check(verify(subject, b, account = accountB) ==
      SyntheticRecoveryCheck.PROOF_RECORDED_NOT_ENROLLED)
    check(subject.registryForTest(accountA) == lost)
    check(subject.registryForTest(accountB) == lostB)
  }

  // 24. A consumed review cannot spawn another ticket in the same generation.
  run {
    now = 9_000_000L
    val subject = lab()
    val view = open(subject)
    check(verify(subject, view) == SyntheticRecoveryCheck.PROOF_RECORDED_NOT_ENROLLED)
    check(subject.openReviewFixtureOnly(accountA, attacker.public).first ==
      SyntheticRecoveryCheck.DENY_RECOVERY_ALREADY_REVIEWED)
  }

  // 25. No grant/unlock/enrollment status; a review never changes active keys.
  run {
    val subject = lab()
    val view = open(subject)
    check(verify(subject, view) == SyntheticRecoveryCheck.PROOF_RECORDED_NOT_ENROLLED)
    check(SyntheticRecoveryCheck.entries.none {
      it.name == "ENROLLED" || it.name == "ALLOW" || it.name == "UNLOCKED"
    })
    check(SyntheticRecoveryStatus.entries.none {
      it.name == "ENROLLED" || it.name == "ALLOW" || it.name == "UNLOCKED"
    })
    check(subject.registryForTest(accountA) == lost)
  }

  println("PASS: 25 all-devices-lost signed-review and fail-closed scenarios (JVM lab only)")
}

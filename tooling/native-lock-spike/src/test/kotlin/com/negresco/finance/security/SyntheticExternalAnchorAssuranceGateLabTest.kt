package com.negresco.finance.security

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.UUID

/**
 * SEC-05K: deployment-evidence triage in a disposable Kotlin JVM test.
 *
 * The inputs are ASSERTIONS invented by this test, not provider attestations.
 * Even when all assertions look good, the ONLY terminal result is HOLD with
 * independent human/security review required. No backend, key provisioning,
 * owner authentication, trusted clock, WORM service, HSM or production grant.
 */
internal enum class SyntheticAnchorStorageEvidenceLab {
  NONE,
  REPLAYABLE_DATABASE_OR_FILE,
  HSM_SIGNING_KEY_ONLY,
  INDEPENDENT_ANTI_ROLLBACK_CLAIM_UNREVIEWED
}

internal enum class SyntheticExternalAssuranceReasonLab {
  HOLD_ANCHOR_OFFLINE,
  DENY_MISSING_OUT_OF_BAND_PIN,
  DENY_PIN_MISMATCH,
  DENY_IDENTITY_EPOCH_MISMATCH,
  DENY_NONCE_MISMATCH,
  DENY_MISSING_CRYPTO_VERIFICATION,
  DENY_ACCOUNT_BINDING,
  DENY_GENERATION_REGRESSION,
  DENY_INVALID_GENERATION,
  HOLD_NO_REPLAY_RESISTANT_STORAGE_EVIDENCE,
  HOLD_NO_INDEPENDENT_FAILURE_DOMAIN,
  HOLD_NO_ATOMIC_CAS_AND_RECEIPT_EVIDENCE,
  HOLD_NO_RESTART_AND_FULL_RESTORE_TEST,
  HOLD_NO_EXTERNAL_AUDIT_OR_RECOVERY_REVIEW,
  HOLD_OWNER_AUTHORIZATION_UNVERIFIED,
  HOLD_INDEPENDENT_PRODUCTION_ATTESTATION_REQUIRED
}

internal data class SyntheticExternalAnchorAssuranceInputLab(
  val anchorAvailable: Boolean,
  val independentlyProvisionedPin: ByteArray?,
  val presentedPin: ByteArray?,
  val expectedEpoch: UUID?,
  val presentedEpoch: UUID?,
  val challenge: ByteArray?,
  val signedChallenge: ByteArray?,
  val signatureVerifiedFixtureOnly: Boolean,
  val expectedAccount: String,
  val signedAccount: String,
  val localGeneration: Long,
  val signedGeneration: Long,
  val lastSeenExternalFloor: Long,
  val storageEvidence: SyntheticAnchorStorageEvidenceLab,
  val separateAdministrativeDomainAsserted: Boolean,
  val atomicCasAndReceiptAsserted: Boolean,
  val testedRestartAndFullRestoreAsserted: Boolean,
  val independentAuditAndDisasterRecoveryAsserted: Boolean,
  val ownerAuthorizationAsserted: Boolean
)

/**
 * Pure risk enumerator. No result is ALLOW, VERIFIED_LIVE_CURRENT or a grant.
 * This deliberately CANNOT validate self-declared attestation or true
 * non-rewindability. A real deployment needs externally verifiable evidence.
 */
internal object SyntheticExternalAnchorAssuranceGateLab {
  fun inspect(input: SyntheticExternalAnchorAssuranceInputLab):
    Set<SyntheticExternalAssuranceReasonLab> {
    val result = linkedSetOf<SyntheticExternalAssuranceReasonLab>()
    if (!input.anchorAvailable)
      result.add(SyntheticExternalAssuranceReasonLab.HOLD_ANCHOR_OFFLINE)

    val pinned = input.independentlyProvisionedPin
    val presented = input.presentedPin
    if (pinned == null || pinned.isEmpty())
      result.add(SyntheticExternalAssuranceReasonLab.DENY_MISSING_OUT_OF_BAND_PIN)
    else if (presented == null || !MessageDigest.isEqual(pinned, presented))
      result.add(SyntheticExternalAssuranceReasonLab.DENY_PIN_MISMATCH)

    if (input.expectedEpoch == null || input.presentedEpoch != input.expectedEpoch)
      result.add(SyntheticExternalAssuranceReasonLab.DENY_IDENTITY_EPOCH_MISMATCH)

    val nonce = input.challenge
    val echoed = input.signedChallenge
    if (nonce == null || nonce.size != 32 || echoed == null ||
      !MessageDigest.isEqual(nonce, echoed))
      result.add(SyntheticExternalAssuranceReasonLab.DENY_NONCE_MISMATCH)

    if (!input.signatureVerifiedFixtureOnly)
      result.add(SyntheticExternalAssuranceReasonLab.DENY_MISSING_CRYPTO_VERIFICATION)

    if (input.expectedAccount.isBlank() ||
      input.expectedAccount != input.signedAccount)
      result.add(SyntheticExternalAssuranceReasonLab.DENY_ACCOUNT_BINDING)

    if (input.localGeneration < 1 || input.signedGeneration < 1 ||
      input.lastSeenExternalFloor < 1 || input.signedGeneration == Long.MAX_VALUE)
      result.add(SyntheticExternalAssuranceReasonLab.DENY_INVALID_GENERATION)
    else if (input.signedGeneration < input.localGeneration ||
      input.signedGeneration < input.lastSeenExternalFloor)
      result.add(SyntheticExternalAssuranceReasonLab.DENY_GENERATION_REGRESSION)

    if (input.storageEvidence !=
      SyntheticAnchorStorageEvidenceLab.INDEPENDENT_ANTI_ROLLBACK_CLAIM_UNREVIEWED)
      result.add(SyntheticExternalAssuranceReasonLab.HOLD_NO_REPLAY_RESISTANT_STORAGE_EVIDENCE)
    if (!input.separateAdministrativeDomainAsserted)
      result.add(SyntheticExternalAssuranceReasonLab.HOLD_NO_INDEPENDENT_FAILURE_DOMAIN)
    if (!input.atomicCasAndReceiptAsserted)
      result.add(SyntheticExternalAssuranceReasonLab.HOLD_NO_ATOMIC_CAS_AND_RECEIPT_EVIDENCE)
    if (!input.testedRestartAndFullRestoreAsserted)
      result.add(SyntheticExternalAssuranceReasonLab.HOLD_NO_RESTART_AND_FULL_RESTORE_TEST)
    if (!input.independentAuditAndDisasterRecoveryAsserted)
      result.add(SyntheticExternalAssuranceReasonLab.HOLD_NO_EXTERNAL_AUDIT_OR_RECOVERY_REVIEW)
    if (!input.ownerAuthorizationAsserted)
      result.add(SyntheticExternalAssuranceReasonLab.HOLD_OWNER_AUTHORIZATION_UNVERIFIED)

    // The caller can set every flag to true, use a genuine Ed25519 signature,
    // and still replay a synchronized old authority snapshot. An external
    // proof/review process MUST validate the asserted properties.
    result.add(SyntheticExternalAssuranceReasonLab.HOLD_INDEPENDENT_PRODUCTION_ATTESTATION_REQUIRED)
    return result
  }
}

internal fun runSyntheticExternalAnchorAssuranceGateScenarios() {
  val random = SecureRandom()
  val pin = ByteArray(32).also { random.nextBytes(it) }
  val challenge = ByteArray(32).also { random.nextBytes(it) }
  val account = UUID.randomUUID().toString().replace("-", "")
  val epoch = UUID.randomUUID()
  val base = SyntheticExternalAnchorAssuranceInputLab(
    anchorAvailable = true,
    independentlyProvisionedPin = pin,
    presentedPin = pin.copyOf(),
    expectedEpoch = epoch,
    presentedEpoch = epoch,
    challenge = challenge,
    signedChallenge = challenge.copyOf(),
    signatureVerifiedFixtureOnly = true,
    expectedAccount = account,
    signedAccount = account,
    localGeneration = 7,
    signedGeneration = 7,
    lastSeenExternalFloor = 7,
    storageEvidence =
      SyntheticAnchorStorageEvidenceLab.INDEPENDENT_ANTI_ROLLBACK_CLAIM_UNREVIEWED,
    separateAdministrativeDomainAsserted = true,
    atomicCasAndReceiptAsserted = true,
    testedRestartAndFullRestoreAsserted = true,
    independentAuditAndDisasterRecoveryAsserted = true,
    ownerAuthorizationAsserted = true
  )
  val gate = SyntheticExternalAnchorAssuranceGateLab
  var checks = 0
  fun verify(ok: Boolean, why: String) {
    check(ok) { "SEC05K assurance gate: $why" }
    checks++
  }
  fun denied(
    input: SyntheticExternalAnchorAssuranceInputLab,
    reason: SyntheticExternalAssuranceReasonLab,
    why: String
  ) = verify(gate.inspect(input).contains(reason), why)

  val review = SyntheticExternalAssuranceReasonLab
    .HOLD_INDEPENDENT_PRODUCTION_ATTESTATION_REQUIRED
  verify(gate.inspect(base) == setOf(review),
    "even perfect SELF-ASSERTED evidence is review-only, NEVER a production grant")
  denied(base.copy(anchorAvailable = false),
    SyntheticExternalAssuranceReasonLab.HOLD_ANCHOR_OFFLINE,
    "unavailable external authority never falls back to files")
  denied(base.copy(independentlyProvisionedPin = null),
    SyntheticExternalAssuranceReasonLab.DENY_MISSING_OUT_OF_BAND_PIN,
    "self-provided key is not out-of-band enrollment")
  denied(base.copy(independentlyProvisionedPin = byteArrayOf()),
    SyntheticExternalAssuranceReasonLab.DENY_MISSING_OUT_OF_BAND_PIN,
    "empty trust anchor cannot be accepted")
  denied(base.copy(presentedPin = null),
    SyntheticExternalAssuranceReasonLab.DENY_PIN_MISMATCH,
    "missing presented key is rejected")
  denied(base.copy(presentedPin = ByteArray(32)),
    SyntheticExternalAssuranceReasonLab.DENY_PIN_MISMATCH,
    "substituted key is rejected")
  denied(base.copy(expectedEpoch = null),
    SyntheticExternalAssuranceReasonLab.DENY_IDENTITY_EPOCH_MISMATCH,
    "missing pinned epoch is rejected")
  denied(base.copy(presentedEpoch = UUID.randomUUID()),
    SyntheticExternalAssuranceReasonLab.DENY_IDENTITY_EPOCH_MISMATCH,
    "reprovisioned same-looking service with a new epoch is rejected")
  denied(base.copy(challenge = null),
    SyntheticExternalAssuranceReasonLab.DENY_NONCE_MISMATCH,
    "missing challenge is rejected")
  denied(base.copy(challenge = ByteArray(1)),
    SyntheticExternalAssuranceReasonLab.DENY_NONCE_MISMATCH,
    "invalid challenge length is rejected")
  denied(base.copy(signedChallenge = null),
    SyntheticExternalAssuranceReasonLab.DENY_NONCE_MISMATCH,
    "missing echoed challenge is rejected")
  denied(base.copy(signedChallenge = ByteArray(32)),
    SyntheticExternalAssuranceReasonLab.DENY_NONCE_MISMATCH,
    "response for a different challenge is rejected")
  denied(base.copy(signatureVerifiedFixtureOnly = false),
    SyntheticExternalAssuranceReasonLab.DENY_MISSING_CRYPTO_VERIFICATION,
    "unverified signature is rejected")
  denied(base.copy(signedAccount = UUID.randomUUID().toString()),
    SyntheticExternalAssuranceReasonLab.DENY_ACCOUNT_BINDING,
    "cross-account assertion is rejected")
  denied(base.copy(expectedAccount = ""),
    SyntheticExternalAssuranceReasonLab.DENY_ACCOUNT_BINDING,
    "missing expected account is rejected")
  denied(base.copy(localGeneration = 0),
    SyntheticExternalAssuranceReasonLab.DENY_INVALID_GENERATION,
    "zero local generation is malformed")
  denied(base.copy(signedGeneration = 0),
    SyntheticExternalAssuranceReasonLab.DENY_INVALID_GENERATION,
    "zero remote generation is malformed")
  denied(base.copy(lastSeenExternalFloor = 0),
    SyntheticExternalAssuranceReasonLab.DENY_INVALID_GENERATION,
    "missing earlier external floor is malformed")
  denied(base.copy(signedGeneration = Long.MAX_VALUE),
    SyntheticExternalAssuranceReasonLab.DENY_INVALID_GENERATION,
    "generation overflow boundary is rejected")
  denied(base.copy(localGeneration = 8),
    SyntheticExternalAssuranceReasonLab.DENY_GENERATION_REGRESSION,
    "signed snapshot below current local generation is denied")
  denied(base.copy(lastSeenExternalFloor = 9),
    SyntheticExternalAssuranceReasonLab.DENY_GENERATION_REGRESSION,
    "signed snapshot below last known external floor is denied")
  denied(base.copy(storageEvidence = SyntheticAnchorStorageEvidenceLab.NONE),
    SyntheticExternalAssuranceReasonLab.HOLD_NO_REPLAY_RESISTANT_STORAGE_EVIDENCE,
    "no independently durable storage claim blocks")
  denied(base.copy(storageEvidence =
    SyntheticAnchorStorageEvidenceLab.REPLAYABLE_DATABASE_OR_FILE),
    SyntheticExternalAssuranceReasonLab.HOLD_NO_REPLAY_RESISTANT_STORAGE_EVIDENCE,
    "signed ordinary file or PostgreSQL does not constitute antirrollback evidence")
  denied(base.copy(storageEvidence =
    SyntheticAnchorStorageEvidenceLab.HSM_SIGNING_KEY_ONLY),
    SyntheticExternalAssuranceReasonLab.HOLD_NO_REPLAY_RESISTANT_STORAGE_EVIDENCE,
    "HSM-protected SIGNING KEY alone does not protect DB generation from rollback")
  denied(base.copy(separateAdministrativeDomainAsserted = false),
    SyntheticExternalAssuranceReasonLab.HOLD_NO_INDEPENDENT_FAILURE_DOMAIN,
    "same administrator controlling all backups violates separation")
  denied(base.copy(atomicCasAndReceiptAsserted = false),
    SyntheticExternalAssuranceReasonLab.HOLD_NO_ATOMIC_CAS_AND_RECEIPT_EVIDENCE,
    "missing linearizable CAS and receipt prevents success")
  denied(base.copy(testedRestartAndFullRestoreAsserted = false),
    SyntheticExternalAssuranceReasonLab.HOLD_NO_RESTART_AND_FULL_RESTORE_TEST,
    "restarts and malicious full restore require independent verification")
  denied(base.copy(independentAuditAndDisasterRecoveryAsserted = false),
    SyntheticExternalAssuranceReasonLab.HOLD_NO_EXTERNAL_AUDIT_OR_RECOVERY_REVIEW,
    "no externally audited disaster recovery plan prevents approval")
  denied(base.copy(ownerAuthorizationAsserted = false),
    SyntheticExternalAssuranceReasonLab.HOLD_OWNER_AUTHORIZATION_UNVERIFIED,
    "no authorized owner credential means fail closed")
  verify(gate.inspect(base.copy(anchorAvailable = false, presentedPin = ByteArray(32)))
    .containsAll(setOf(
      SyntheticExternalAssuranceReasonLab.HOLD_ANCHOR_OFFLINE,
      SyntheticExternalAssuranceReasonLab.DENY_PIN_MISMATCH,
      review)),
    "multiple independent failures remain visible without bypass")
  verify(gate.inspect(base.copy(
    storageEvidence = SyntheticAnchorStorageEvidenceLab.HSM_SIGNING_KEY_ONLY,
    ownerAuthorizationAsserted = false,
    separateAdministrativeDomainAsserted = false)).containsAll(setOf(
      SyntheticExternalAssuranceReasonLab.HOLD_NO_REPLAY_RESISTANT_STORAGE_EVIDENCE,
      SyntheticExternalAssuranceReasonLab.HOLD_NO_INDEPENDENT_FAILURE_DOMAIN,
      SyntheticExternalAssuranceReasonLab.HOLD_OWNER_AUTHORIZATION_UNVERIFIED)),
    "an HSM marketing claim cannot mask missing governance, domain, or owner")
  verify(gate.inspect(base.copy(signedGeneration = 8,
    lastSeenExternalFloor = 8, localGeneration = 7)) == setOf(review),
    "signed NEW does not prove that a stale response stayed latest before commit")
  println("PASS: SEC-05K $checks external anchor evidence-gate NEGATIVE checks (JVM only)")
  println("LIMIT: self-asserted evidence cannot produce VERIFIED_LIVE_CURRENT or permission")
}

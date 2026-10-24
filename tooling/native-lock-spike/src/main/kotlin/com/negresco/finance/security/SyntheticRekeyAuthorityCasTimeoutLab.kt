package com.negresco.finance.security

import java.security.KeyPair
import java.security.Signature
import java.util.UUID

/**
 * SEC-05K: disposable, IN-MEMORY compare-and-swap authority and lost-reply
 * simulator. No network, durable external server, trusted pin provisioning,
 * real atomic transaction, real owner consent, SQLCipher, or production path.
 *
 * Losing the reply AFTER CAS changes state but does not license a blind retry
 * or local commit. A fresh, challenge-bound signed read can describe the
 * in-memory state, NOT prove the existence of live monotonic authority.
 */
internal enum class SyntheticRekeyCasOutcomeLab {
  BOOTSTRAPPED_FIXTURE_ONLY,
  ADVANCED_FIXTURE_ONLY,
  ALREADY_APPLIED_CURRENT_FIXTURE_ONLY,
  DENY_MISSING_ACCOUNT,
  DENY_STALE_OR_CONFLICTING_GENERATION,
  DENY_CONFLICTING_OPERATION_ID,
  DENY_INVALID_TRANSITION
}

internal data class SyntheticRekeyCasReceiptLab(
  val outcome: SyntheticRekeyCasOutcomeLab,
  val current: SyntheticRekeyGenerationClaimLab?
)

/** A null result represents an intentionally LOST response, not CAS failure. */
internal data class SyntheticRekeySignedCurrentLab(
  val claim: SyntheticRekeyGenerationClaimLab,
  val returnedChallenge: ByteArray,
  val signature: ByteArray
)

internal class SyntheticRekeyAuthorityCasTimeoutLab(
  private val fixtureSigner: KeyPair
) {
  private class State(
    var current: SyntheticRekeyGenerationClaimLab,
    val operations: MutableMap<UUID, Applied> = mutableMapOf()
  )
  private class Applied(
    val before: SyntheticRekeyGenerationClaimLab,
    val after: SyntheticRekeyGenerationClaimLab
  )
  private val accounts = mutableMapOf<String, State>()
  private val verifier = SyntheticSignedRekeyAuthorityChallengeLab

  private fun same(a: SyntheticRekeyGenerationClaimLab, b: SyntheticRekeyGenerationClaimLab) =
    verifier.equivalentFixtureOnly(a, b)

  private fun validTransition(
    before: SyntheticRekeyGenerationClaimLab,
    after: SyntheticRekeyGenerationClaimLab
  ): Boolean =
    verifier.validClaimFixtureOnly(before) &&
      verifier.validClaimFixtureOnly(after) &&
      before.accountId == after.accountId &&
      before.kitId != after.kitId &&
      before.version < Long.MAX_VALUE - 1 &&
      before.generation < Long.MAX_VALUE - 1 &&
      after.version == before.version + 1 &&
      after.generation == before.generation + 1

  /** Explicit bootstrap only, no silent reseed/rollback. */
  @Synchronized
  fun bootstrapFixtureOnly(claim: SyntheticRekeyGenerationClaimLab): SyntheticRekeyCasReceiptLab {
    if (!verifier.validClaimFixtureOnly(claim))
      return SyntheticRekeyCasReceiptLab(SyntheticRekeyCasOutcomeLab.DENY_INVALID_TRANSITION, null)
    if (accounts.containsKey(claim.accountId))
      return SyntheticRekeyCasReceiptLab(
        SyntheticRekeyCasOutcomeLab.DENY_STALE_OR_CONFLICTING_GENERATION,
        accounts[claim.accountId]?.current
      )
    accounts[claim.accountId] = State(claim)
    return SyntheticRekeyCasReceiptLab(
      SyntheticRekeyCasOutcomeLab.BOOTSTRAPPED_FIXTURE_ONLY, claim
    )
  }

  /**
   * The CAS and op-id record update atomically only INSIDE this JVM monitor.
   * The loseResponseAfterCommit option drops the reply after state mutation.
   * It does NOT undo the CAS or simulate persistent network services.
   */
  @Synchronized
  fun compareAndSwapFixtureOnly(
    operationId: UUID,
    expectedBefore: SyntheticRekeyGenerationClaimLab,
    desiredAfter: SyntheticRekeyGenerationClaimLab,
    loseResponseAfterCommit: Boolean = false
  ): SyntheticRekeyCasReceiptLab? {
    if (!validTransition(expectedBefore, desiredAfter))
      return SyntheticRekeyCasReceiptLab(SyntheticRekeyCasOutcomeLab.DENY_INVALID_TRANSITION, null)
    val state = accounts[expectedBefore.accountId]
      ?: return SyntheticRekeyCasReceiptLab(
        SyntheticRekeyCasOutcomeLab.DENY_MISSING_ACCOUNT, null)
    val existing = state.operations[operationId]
    if (existing != null) {
      val sameOp = same(existing.before, expectedBefore) && same(existing.after, desiredAfter)
      if (!sameOp)
        return SyntheticRekeyCasReceiptLab(
          SyntheticRekeyCasOutcomeLab.DENY_CONFLICTING_OPERATION_ID, state.current)
      // Idempotency says this operation occurred, NOT that its generation
      // remains current if a later legitimate CAS has advanced further.
      return SyntheticRekeyCasReceiptLab(
        if (same(state.current, desiredAfter))
          SyntheticRekeyCasOutcomeLab.ALREADY_APPLIED_CURRENT_FIXTURE_ONLY
        else SyntheticRekeyCasOutcomeLab.DENY_STALE_OR_CONFLICTING_GENERATION,
        state.current
      )
    }
    if (!same(state.current, expectedBefore))
      return SyntheticRekeyCasReceiptLab(
        SyntheticRekeyCasOutcomeLab.DENY_STALE_OR_CONFLICTING_GENERATION, state.current)
    state.current = desiredAfter
    state.operations[operationId] = Applied(expectedBefore, desiredAfter)
    if (loseResponseAfterCommit) return null
    return SyntheticRekeyCasReceiptLab(
      SyntheticRekeyCasOutcomeLab.ADVANCED_FIXTURE_ONLY, desiredAfter)
  }

  /**
   * Signs the currently-held fixture state for a 32-byte caller challenge.
   * The client must verify using a PINNED public key and its own nonce.
   * This method makes no monotonic persistence or online-service guarantee.
   */
  @Synchronized
  fun signedCurrentFixtureOnly(
    accountId: String, challenge: ByteArray
  ): SyntheticRekeySignedCurrentLab? {
    if (challenge.size != verifier.CHALLENGE_SIZE) return null
    val state = accounts[accountId] ?: return null
    val claim = state.current
    val signature = Signature.getInstance("Ed25519")
    signature.initSign(fixtureSigner.private)
    signature.update(verifier.payloadFixtureOnly(claim, challenge))
    return SyntheticRekeySignedCurrentLab(claim, challenge.copyOf(), signature.sign())
  }
}

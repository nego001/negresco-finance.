package com.negresco.finance.security

import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * SEC-05K DISPOSABLE architecture boundary, NEVER A REAL ANTI-ROLLBACK AUTHORITY.
 *
 * This in-memory map deliberately stands in for a hypothetical external,
 * independently trusted, non-rewindable generation register. No such hardware
 * or deployed authority exists here. The register and its receipts disappear
 * when the test JVM exits. It has NO authentication, network endpoint,
 * durable cryptographic keys, SQLCipher, bank accounts or user secrets.
 *
 * A positive result is OBSERVATION ONLY: even a fresh-looking comparison can
 * become stale before a financial action. NEVER map it to VERIFIED_LIVE_CURRENT.
 */
internal enum class SyntheticAnchorCasResultLab {
  BOOTSTRAPPED_FIXTURE_ONLY,
  ADVANCED_FIXTURE_ONLY,
  ALREADY_APPLIED_FIXTURE_ONLY,
  DENY_RESEED,
  DENY_UNENROLLED,
  DENY_PREDECESSOR,
  DENY_COLLISION,
  DENY_TRANSITION,
  DENY_WRONG_PIN,
  HOLD_OFFLINE,
  LOST_REPLY_AFTER_ADVANCE
}

internal enum class SyntheticAnchorBoundaryObservationLab {
  OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
  DENY_RESTORED_OR_DIVERGENT_STORES,
  DENY_WRONG_ANCHOR_PIN,
  HOLD_ANCHOR_UNAVAILABLE,
  DENY_UNKNOWN_ACCOUNT
}

private data class SyntheticAnchorReceiptLab(
  val before: SyntheticRekeyGenerationClaimLab,
  val after: SyntheticRekeyGenerationClaimLab
)

/**
 * The protected register is a test-owned MEMORY object independent of the two
 * rollbackable "database" and "signed file" snapshots used by the caller.
 * Never claim this mocks crash durability or malicious compromise of the anchor.
 */
internal class SyntheticProtectedAnchorFixtureLab {
  private val crypto = SyntheticSignedRekeyAuthorityChallengeLab
  val pinnedIdentityFixtureOnly: UUID = UUID.randomUUID()
  private val floors = mutableMapOf<String, SyntheticRekeyGenerationClaimLab>()
  private val receipts =
    mutableMapOf<Pair<String, UUID>, SyntheticAnchorReceiptLab>()

  var reachableFixtureOnly = true

  @Synchronized
  fun enrollFixtureOnly(claim: SyntheticRekeyGenerationClaimLab): SyntheticAnchorCasResultLab {
    if (!reachableFixtureOnly) return SyntheticAnchorCasResultLab.HOLD_OFFLINE
    if (!crypto.validClaimFixtureOnly(claim)) return SyntheticAnchorCasResultLab.DENY_TRANSITION
    if (floors.containsKey(claim.accountId)) return SyntheticAnchorCasResultLab.DENY_RESEED
    floors[claim.accountId] = claim
    return SyntheticAnchorCasResultLab.BOOTSTRAPPED_FIXTURE_ONLY
  }

  @Synchronized
  fun advanceFixtureOnly(
    operationId: UUID,
    expected: SyntheticRekeyGenerationClaimLab,
    next: SyntheticRekeyGenerationClaimLab,
    pinned: UUID,
    dropReplyAfterCommit: Boolean = false
  ): SyntheticAnchorCasResultLab {
    if (!reachableFixtureOnly) return SyntheticAnchorCasResultLab.HOLD_OFFLINE
    if (pinned != pinnedIdentityFixtureOnly) return SyntheticAnchorCasResultLab.DENY_WRONG_PIN
    if (!crypto.validClaimFixtureOnly(expected) ||
        !crypto.validClaimFixtureOnly(next) ||
        expected.accountId != next.accountId ||
        expected.kitId == next.kitId ||
        expected.version >= Long.MAX_VALUE - 1 ||
        expected.generation >= Long.MAX_VALUE - 1 ||
        next.version != expected.version + 1L ||
        next.generation != expected.generation + 1L)
      return SyntheticAnchorCasResultLab.DENY_TRANSITION

    val key = expected.accountId to operationId
    val receipt = receipts[key]
    if (receipt != null) {
      if (!crypto.equivalentFixtureOnly(receipt.before, expected) ||
          !crypto.equivalentFixtureOnly(receipt.after, next))
        return SyntheticAnchorCasResultLab.DENY_COLLISION
      return SyntheticAnchorCasResultLab.ALREADY_APPLIED_FIXTURE_ONLY
    }

    val present = floors[expected.accountId] ?: return SyntheticAnchorCasResultLab.DENY_UNENROLLED
    if (!crypto.equivalentFixtureOnly(present, expected))
      return SyntheticAnchorCasResultLab.DENY_PREDECESSOR

    floors[expected.accountId] = next
    receipts[key] = SyntheticAnchorReceiptLab(expected, next)
    // Simulates a lost ACK, not a storage failure. Read+retry are mandatory.
    return if (dropReplyAfterCommit) SyntheticAnchorCasResultLab.LOST_REPLY_AFTER_ADVANCE
      else SyntheticAnchorCasResultLab.ADVANCED_FIXTURE_ONLY
  }

  @Synchronized
  fun observeFixtureOnly(
    rollbackableDatabase: SyntheticRekeyGenerationClaimLab,
    rollbackableSignedFile: SyntheticRekeyGenerationClaimLab,
    pinned: UUID
  ): SyntheticAnchorBoundaryObservationLab {
    if (!reachableFixtureOnly)
      return SyntheticAnchorBoundaryObservationLab.HOLD_ANCHOR_UNAVAILABLE
    if (pinned != pinnedIdentityFixtureOnly)
      return SyntheticAnchorBoundaryObservationLab.DENY_WRONG_ANCHOR_PIN
    if (!crypto.validClaimFixtureOnly(rollbackableDatabase) ||
        !crypto.validClaimFixtureOnly(rollbackableSignedFile) ||
        rollbackableDatabase.accountId != rollbackableSignedFile.accountId)
      return SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES
    val floor = floors[rollbackableDatabase.accountId]
      ?: return SyntheticAnchorBoundaryObservationLab.DENY_UNKNOWN_ACCOUNT
    return if (crypto.equivalentFixtureOnly(floor, rollbackableDatabase) &&
      crypto.equivalentFixtureOnly(floor, rollbackableSignedFile))
      SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION
    else SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES
  }
}

/** Deterministic negative matrix. ALL identifiers are randomly generated fixtures. */
internal fun runSyntheticProtectedAnchorBoundaryScenarios() {
  val crypto = SyntheticSignedRekeyAuthorityChallengeLab
  var checks = 0
  fun checkCase(ok: Boolean, reason: String) {
    check(ok) { "SEC05K protected-anchor boundary: $reason" }
    checks++
  }
  fun claim(account: String, v: Long, g: Long): SyntheticRekeyGenerationClaimLab {
    val kit = UUID.randomUUID().toString()
    return SyntheticRekeyGenerationClaimLab(account, kit, v, g,
      MessageDigest.getInstance("SHA-256").digest(
        "sec05k-protected-anchor-disposable-$account-$kit".toByteArray()))
  }
  val anchor = SyntheticProtectedAnchorFixtureLab()
  val pin = anchor.pinnedIdentityFixtureOnly
  val account = UUID.randomUUID().toString().replace("-", "")
  val old = claim(account, 7, 8)
  val newer = claim(account, 8, 9)
  val newest = claim(account, 9, 10)
  val roguePin = UUID.randomUUID()
  val operation = UUID.randomUUID()

  checkCase(anchor.observeFixtureOnly(old, old, pin) ==
    SyntheticAnchorBoundaryObservationLab.DENY_UNKNOWN_ACCOUNT,
    "observation cannot bootstrap unknown account")
  checkCase(anchor.enrollFixtureOnly(old) ==
    SyntheticAnchorCasResultLab.BOOTSTRAPPED_FIXTURE_ONLY, "explicit test enrollment")
  checkCase(anchor.enrollFixtureOnly(old) ==
    SyntheticAnchorCasResultLab.DENY_RESEED, "already enrolled floor cannot be reset")
  checkCase(anchor.observeFixtureOnly(old, old, pin) ==
    SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
    "two stores initially match the volatile independent fixture")
  checkCase(anchor.observeFixtureOnly(old, old, roguePin) ==
    SyntheticAnchorBoundaryObservationLab.DENY_WRONG_ANCHOR_PIN,
    "different anchor identity is never trusted")
  checkCase(anchor.advanceFixtureOnly(operation, old, newer, roguePin) ==
    SyntheticAnchorCasResultLab.DENY_WRONG_PIN, "wrong pinned epoch cannot advance")

  checkCase(anchor.advanceFixtureOnly(operation, old, newer, pin,
    dropReplyAfterCommit = true) ==
    SyntheticAnchorCasResultLab.LOST_REPLY_AFTER_ADVANCE,
    "counter and operation receipt advanced before simulated lost ACK")
  checkCase(anchor.advanceFixtureOnly(operation, old, newer, pin) ==
    SyntheticAnchorCasResultLab.ALREADY_APPLIED_FIXTURE_ONLY,
    "lost reply replay with identical operation is idempotent")
  checkCase(anchor.advanceFixtureOnly(operation, old, newest, pin) ==
    SyntheticAnchorCasResultLab.DENY_TRANSITION,
    "invalid two-step jump is denied")
  val otherSameStep = claim(account, 8, 9)
  checkCase(anchor.advanceFixtureOnly(operation, old, otherSameStep, pin) ==
    SyntheticAnchorCasResultLab.DENY_COLLISION,
    "same operation ID with different payload is denied")
  checkCase(anchor.advanceFixtureOnly(UUID.randomUUID(), old, newer, pin) ==
    SyntheticAnchorCasResultLab.DENY_PREDECESSOR,
    "new operation cannot replay stale predecessor")

  // Both rollbackable stores are restored together. An independent floor
  // rejects the older generations even though they now agree with each other.
  checkCase(anchor.observeFixtureOnly(old, old, pin) ==
    SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
    "simultaneous PostgreSQL and signed-file rollback is detected")
  checkCase(anchor.observeFixtureOnly(newer, old, pin) ==
    SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
    "database and file disagree")
  checkCase(anchor.observeFixtureOnly(newer, newer, pin) ==
    SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
    "matching current states still do not authorize sensitive operations")

  anchor.reachableFixtureOnly = false
  checkCase(anchor.observeFixtureOnly(newer, newer, pin) ==
    SyntheticAnchorBoundaryObservationLab.HOLD_ANCHOR_UNAVAILABLE,
    "offline anchor never falls back to signed local state")
  checkCase(anchor.advanceFixtureOnly(UUID.randomUUID(), newer, newest, pin) ==
    SyntheticAnchorCasResultLab.HOLD_OFFLINE,
    "offline authority refuses transition")
  checkCase(anchor.enrollFixtureOnly(old) ==
    SyntheticAnchorCasResultLab.HOLD_OFFLINE,
    "offline state cannot be silently re-enrolled")
  anchor.reachableFixtureOnly = true
  checkCase(anchor.observeFixtureOnly(newer, newer, pin) ==
    SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
    "fresh observation resumes after simulated partition without auto-advance")

  // Second, independent client model reconnects to the SAME test-owned anchor.
  val anotherClientPin = pin
  checkCase(anchor.observeFixtureOnly(old, old, anotherClientPin) ==
    SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
    "second client with same trusted anchor identifies paired rollback")
  // An empty replacement object resembles total anchor loss or impersonation:
  // a previously pinned identity MUST NOT silently re-enroll from OLD.
  val replacement = SyntheticProtectedAnchorFixtureLab()
  checkCase(replacement.pinnedIdentityFixtureOnly != pin,
    "replaced anchor instance has unrelated identity")
  checkCase(replacement.observeFixtureOnly(old, old, pin) ==
    SyntheticAnchorBoundaryObservationLab.DENY_WRONG_ANCHOR_PIN,
    "previous pin refuses replacement anchor despite plausible OLD snapshots")
  checkCase(replacement.advanceFixtureOnly(operation, old, newer, pin) ==
    SyntheticAnchorCasResultLab.DENY_WRONG_PIN,
    "replacement anchor cannot silently resume previous write epoch")

  // Racing CAS from two clients: a serialized register must have ONE winner.
  val racers = Executors.newFixedThreadPool(6)
  val start = CountDownLatch(1)
  try {
    val futures = (1..6).map {
      racers.submit<SyntheticAnchorCasResultLab> {
        start.await()
        anchor.advanceFixtureOnly(UUID.randomUUID(), newer, newest, pin)
      }
    }
    start.countDown()
    val outcomes = futures.map { it.get(10, TimeUnit.SECONDS) }
    checkCase(outcomes.count { it == SyntheticAnchorCasResultLab.ADVANCED_FIXTURE_ONLY } == 1,
      "six competing clients produce exactly one winning CAS")
    checkCase(outcomes.count { it == SyntheticAnchorCasResultLab.DENY_PREDECESSOR } == 5,
      "five stale writers are refused")
    checkCase(anchor.observeFixtureOnly(newest, newest, pin) ==
      SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
      "result is newest and observation is STILL not permission")
    checkCase(anchor.observeFixtureOnly(old, old, pin) ==
      SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
      "pair of old snapshots cannot be accepted after next advance")
  } finally { racers.shutdownNow() }

  val anotherAccount = UUID.randomUUID().toString().replace("-", "")
  val outside = claim(anotherAccount, 2, 3)
  checkCase(anchor.enrollFixtureOnly(outside) ==
    SyntheticAnchorCasResultLab.BOOTSTRAPPED_FIXTURE_ONLY,
    "account isolation uses a different randomly generated account")
  checkCase(anchor.observeFixtureOnly(outside, outside, pin) ==
    SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
    "one account may remain stable while another advances")
  checkCase(anchor.advanceFixtureOnly(UUID.randomUUID(), newer, outside, pin) ==
    SyntheticAnchorCasResultLab.DENY_TRANSITION,
    "cross-account generation takeover refused")
  checkCase(!crypto.equivalentFixtureOnly(newest, outside),
    "cross-account synthetic receipts are distinct")

  // This harness does NOT implement a tamper-proof register: rebooting the
  // ANCHOR JVM itself loses everything. No production monotonicity is proven.
  println("PASS: SEC-05K $checks independent protected-anchor BOUNDARY observations (volatile test-double only)")
  println("LIMIT: simulated anchor has no reboot durability, trusted provisioning or owner authentication")
}

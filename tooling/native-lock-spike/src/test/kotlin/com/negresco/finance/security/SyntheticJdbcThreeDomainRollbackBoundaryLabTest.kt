package com.negresco.finance.security

import java.nio.file.Files
import java.security.MessageDigest
import java.sql.DriverManager
import java.util.UUID

/**
 * SEC-05K disposable JDBC experiment: rollback THREE ordinary stores together
 * while an independent, NONDURABLE anchor test double stays alive in RAM.
 * No actual HSM, backend, owner authentication or journal authorization.
 */
internal fun runSyntheticJdbcThreeDomainRollbackBoundaryScenarios() {
  val crypto = SyntheticSignedRekeyAuthorityChallengeLab
  val db = SyntheticJdbcRekeyCasPersistenceLab()
  val anchor = SyntheticProtectedAnchorFixtureLab()
  val pin = anchor.pinnedIdentityFixtureOnly
  var count = 0
  fun checkCase(ok: Boolean, why: String) {
    check(ok) { "SEC05K three-domain fixture: $why" }
    count++
  }
  val account = UUID.randomUUID().toString().replace("-", "")
  fun claim(v: Long, g: Long): SyntheticRekeyGenerationClaimLab {
    val kit = UUID.randomUUID().toString()
    return SyntheticRekeyGenerationClaimLab(account, kit, v, g,
      MessageDigest.getInstance("SHA-256").digest(
        "sec05k-three-domain-disposable-$account-$kit".toByteArray()))
  }
  val old = claim(8, 11)
  val new = claim(9, 12)
  val op = UUID.randomUUID()
  val dirA = Files.createTempDirectory("sec05k-real-pg-anchored-a-")
  val dirB = Files.createTempDirectory("sec05k-real-pg-anchored-b-")
  checkCase(db.bootstrapFixtureOnly(old) == "BOOTSTRAPPED_FIXTURE_ONLY",
    "random CI PostgreSQL fixture starts OLD")
  checkCase(anchor.enrollFixtureOnly(old) == SyntheticAnchorCasResultLab.BOOTSTRAPPED_FIXTURE_ONLY,
    "separate volatile anchor test double enrolled explicitly")

  lateinit var keyA: java.security.PublicKey
  lateinit var keyB: java.security.PublicKey
  lateinit var oldA: ByteArray
  lateinit var oldB: ByteArray

  fun observed(floor: SyntheticRekeyGenerationClaimLab) =
    anchor.observeFixtureOnly(db.currentFixtureOnly(account)!!, floor, pin)

  fun signed(
    client: SyntheticDurableFloorClientFixtureLab,
    expected: SyntheticRekeyGenerationClaimLab,
    pinned: java.security.PublicKey
  ): SyntheticRekeyGenerationClaimLab {
    val verifier = SyntheticSignedRekeyChallengeSessionLab(expected, pinned)
    val nonce = verifier.issueChallengeFixtureOnly()!!
    val answer = client.signedCurrent(nonce)!!
    checkCase(verifier.verifyOnceFixtureOnly(nonce, answer.first, answer.second) ==
      SyntheticSignedRekeyChallengeCheckLab.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
      "freshly challenged signed claim is NOT a trusted live authority")
    return answer.first
  }

  SyntheticDurableFloorClientFixtureLab(dirA).use { a ->
    SyntheticDurableFloorClientFixtureLab(dirB).use { b ->
      keyA = a.childPublicKey
      keyB = b.childPublicKey
      checkCase(!MessageDigest.isEqual(keyA.encoded, keyB.encoded),
        "child keys differ")
      checkCase(a.enroll(old) == "OK_ENROLLED" && b.enroll(old) == "OK_ENROLLED",
        "two separate JVMs enroll OLD")
      oldA = Files.readAllBytes(dirA.resolve("authority.state"))
      oldB = Files.readAllBytes(dirB.resolve("authority.state"))
      checkCase(observed(signed(a, old, keyA)) ==
        SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
        "PG and file A initially agree with live RAM anchor")
      checkCase(observed(signed(b, old, keyB)) ==
        SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
        "PG and file B initially agree with live RAM anchor")
      checkCase(anchor.advanceFixtureOnly(op, old, new, pin, dropReplyAfterCommit = true) ==
        SyntheticAnchorCasResultLab.LOST_REPLY_AFTER_ADVANCE,
        "anchor advanced before response loss")
      checkCase(anchor.advanceFixtureOnly(op, old, new, pin) ==
        SyntheticAnchorCasResultLab.ALREADY_APPLIED_FIXTURE_ONLY,
        "same signed operation is idempotent in RAM anchor")
      checkCase(observed(signed(a, old, keyA)) ==
        SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
        "anchor NEW while PG and A are OLD must deny")
      checkCase(db.compareAndSwapFixtureOnly(op, old, new, loseResponseAfterCommit = true) == null,
        "real PostgreSQL CAS commits before its simulated lost reply")
      checkCase(db.compareAndSwapFixtureOnly(op, old, new) ==
        "ALREADY_APPLIED_CURRENT_FIXTURE_ONLY",
        "real PostgreSQL exact retry is idempotent")
      checkCase(observed(signed(b, old, keyB)) ==
        SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
        "PG NEW with B OLD must deny")
      checkCase(a.advance(old, new) == "OK_ADVANCED",
        "JVM A commits independently")
      checkCase(observed(signed(a, new, keyA)) ==
        SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
        "PG+A+RAM anchor agree, but B still OLD; no global permission")
      checkCase(observed(signed(b, old, keyB)) ==
        SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
        "remaining B OLD denies")
      checkCase(b.advance(old, new) == "OK_ADVANCED",
        "JVM B commits independently")
      checkCase(observed(signed(b, new, keyB)) ==
        SyntheticAnchorBoundaryObservationLab.OBSERVED_MATCH_ONLY_NOT_AUTHORIZATION,
        "all copies NEW, but comparison is diagnostic only")
    }
  }

  SyntheticDurableFloorClientFixtureLab(dirA).use { a ->
    SyntheticDurableFloorClientFixtureLab(dirB).use { b ->
      checkCase(MessageDigest.isEqual(keyA.encoded, a.childPublicKey.encoded) &&
        MessageDigest.isEqual(keyB.encoded, b.childPublicKey.encoded),
        "two restarts preserve distinct signing key identities")
      checkCase(crypto.equivalentFixtureOnly(signed(a, new, keyA), new) &&
        crypto.equivalentFixtureOnly(signed(b, new, keyB), new),
        "two JVM restarts preserve NEW generation before DB rollback")
    }
  }

  // Only a random throwaway PostgreSQL account and its receipt can be touched.
  val url = System.getenv("NEGRESCO_LAB_PG_URL")
    ?: error("SEC05K requires disposable PostgreSQL JDBC URL")
  val user = System.getenv("NEGRESCO_LAB_PG_USER") ?: System.getenv("PGUSER") ?: "postgres"
  val password = System.getenv("NEGRESCO_LAB_PG_PASSWORD") ?: System.getenv("PGPASSWORD") ?: ""
  DriverManager.getConnection(url, user, password).use { sql ->
    sql.autoCommit = false
    try {
      sql.prepareStatement(
        "DELETE FROM negresco_sec05k_cas_lab.operation_receipts WHERE account_id=?"
      ).use {
        it.setString(1, account)
        checkCase(it.executeUpdate() == 1, "restore removes only fixture CAS receipt")
      }
      sql.prepareStatement(
        "UPDATE negresco_sec05k_cas_lab.generations SET " +
          "kit_id=?,version=?,generation=?,ciphertext_sha256=? WHERE account_id=?"
      ).use {
        it.setObject(1, UUID.fromString(old.kitId))
        it.setLong(2, old.version)
        it.setLong(3, old.generation)
        it.setBytes(4, old.ciphertextHash)
        it.setString(5, account)
        checkCase(it.executeUpdate() == 1, "restore rewinds only fixture SQL generation")
      }
      sql.commit()
    } catch (error: Exception) {
      sql.rollback()
      throw error
    }
  }
  Files.write(dirA.resolve("authority.state"), oldA)
  Files.write(dirB.resolve("authority.state"), oldB)

  SyntheticDurableFloorClientFixtureLab(dirA).use { a ->
    SyntheticDurableFloorClientFixtureLab(dirB).use { b ->
      val aOld = signed(a, old, keyA)
      val bOld = signed(b, old, keyB)
      checkCase(crypto.equivalentFixtureOnly(db.currentFixtureOnly(account)!!, old) &&
        crypto.equivalentFixtureOnly(aOld, old) &&
        crypto.equivalentFixtureOnly(bOld, old),
        "CRITICAL: PostgreSQL and BOTH signing witnesses were replayed to OLD")
      checkCase(db.receiptsFixtureOnly(account) == 0,
        "local database receipt history was erased")
      checkCase(observed(aOld) ==
        SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES &&
        observed(bOld) ==
        SyntheticAnchorBoundaryObservationLab.DENY_RESTORED_OR_DIVERGENT_STORES,
        "in-memory non-rewound anchor detects THREE simultaneously restored stores")
      checkCase(anchor.advanceFixtureOnly(UUID.randomUUID(), old, new, pin) ==
        SyntheticAnchorCasResultLab.DENY_PREDECESSOR,
        "fresh stale-generation CAS rejected by retained RAM anchor")
      checkCase(anchor.advanceFixtureOnly(op, old, new, pin) ==
        SyntheticAnchorCasResultLab.ALREADY_APPLIED_FIXTURE_ONLY,
        "retained op receipt is NOT an authorization for old local stores")

      anchor.reachableFixtureOnly = false
      checkCase(observed(aOld) ==
        SyntheticAnchorBoundaryObservationLab.HOLD_ANCHOR_UNAVAILABLE,
        "offline anchor refuses any fallback to signed old files")
      anchor.reachableFixtureOnly = true
      val replacement = SyntheticProtectedAnchorFixtureLab()
      checkCase(replacement.observeFixtureOnly(old, aOld, pin) ==
        SyntheticAnchorBoundaryObservationLab.DENY_WRONG_ANCHOR_PIN,
        "restarting/replacing volatile anchor breaks trusted pin; no auto bootstrap")
      checkCase(replacement.advanceFixtureOnly(op, old, new, pin) ==
        SyntheticAnchorCasResultLab.DENY_WRONG_PIN,
        "new anchor identity cannot accept old trusted pin")

      val proposed = SyntheticRekeyReconciliationInputLab(
        SyntheticRekeyAuthorityEvidenceLab.SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY,
        SyntheticRekeyJournalObservationLab.COMMITTED,
        SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED,
        SyntheticRekeyCandidateObservationLab.NEW_AUTHENTICATED,
        SyntheticRekeyAuthorityGenerationLab.NEW_CURRENT,
        true, old.version, new.version, old.generation, new.generation
      )
      checkCase(SyntheticJournalAuthorityReconciliationPolicyLab.decide(proposed) ==
        SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
        "fixture signature cannot authorize journal finalization")
    }
  }

  println("PASS: SEC-05K $count PostgreSQL + 2 persisted JVMs + volatile anchor checks")
  println("LIMIT: in-memory anchor cannot survive own rollback or restart; NOT production")
}

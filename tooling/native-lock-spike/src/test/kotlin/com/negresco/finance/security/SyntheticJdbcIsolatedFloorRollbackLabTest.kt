package com.negresco.finance.security

import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.sql.DriverManager
import java.util.UUID

/**
 * SEC-05K test: an ephemeral independent JVM remains at NEW while a privileged
 * DB fixture is rolled back to OLD. Signatures are bound to the fixture key,
 * but that key is SELF-ATTESTED by the child and is NOT a real pinned trust root.
 */
internal fun runSyntheticJdbcIsolatedFloorRollbackScenarios() {
  val db = SyntheticJdbcRekeyCasPersistenceLab()
  val crypto = SyntheticSignedRekeyAuthorityChallengeLab
  var checks = 0
  fun verify(ok: Boolean, reason: String) {
    check(ok) { "SEC-05K separate-JVM floor: $reason" }
    checks++
  }
  fun claim(account: String, version: Long, generation: Long): SyntheticRekeyGenerationClaimLab {
    val kit = UUID.randomUUID().toString()
    return SyntheticRekeyGenerationClaimLab(
      account, kit, version, generation,
      MessageDigest.getInstance("SHA-256").digest(
        "isolated-sec05k-disposable-$account-$kit".toByteArray()
      )
    )
  }

  val account = UUID.randomUUID().toString().replace("-", "")
  val old = claim(account, 2L, 3L)
  val latest = claim(account, 3L, 4L)
  verify(db.bootstrapFixtureOnly(old) == "BOOTSTRAPPED_FIXTURE_ONLY",
    "separate-JVM fixture enrolls random database account")

  SyntheticIndependentFloorClientFixtureLab().use { floor ->
    verify(floor.signedCurrent(ByteArray(32)) == null,
      "new isolated JVM has no implicit current generation")
    verify(floor.call("QUOTE|YQ==") == "DENY_MALFORMED",
      "isolated JVM refuses short challenge and does not reveal state")
    verify(floor.enroll(old) == "OK_ENROLLED",
      "independent child enrolls disposable generation")
    verify(floor.enroll(old) == "DENY_ALREADY_ENROLLED",
      "child cannot silently reset signed generation")

    val staleSession = SyntheticSignedRekeyChallengeSessionLab(old,floor.childPublicKey)
    val staleNonce = staleSession.issueChallengeFixtureOnly()!!
    val stale = floor.signedCurrent(staleNonce)!!
    verify(crypto.equivalentFixtureOnly(stale.first,old),
      "signed quote initially matches the old generation")

    val operation = UUID.randomUUID()
    verify(db.compareAndSwapFixtureOnly(operation,old,latest) == "ADVANCED_FIXTURE_ONLY",
      "PostgreSQL generation and receipt commit atomically")
    verify(floor.advance(old,latest) == "OK_ADVANCED",
      "separate JVM independently records the expected forward transition")
    verify(floor.advance(old,latest) == "DENY_PREDECESSOR",
      "independent monotonic floor refuses replaying the predecessor")

    verify(staleSession.verifyOnceFixtureOnly(staleNonce,stale.first,stale.second) ==
      SyntheticSignedRekeyChallengeCheckLab.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
      "stale quote remains cryptographically valid after separate floor advanced")
    val session = SyntheticSignedRekeyChallengeSessionLab(latest,floor.childPublicKey)
    val nonce = session.issueChallengeFixtureOnly()!!
    val quote = floor.signedCurrent(nonce)!!
    verify(session.verifyOnceFixtureOnly(nonce,quote.first,quote.second) ==
      SyntheticSignedRekeyChallengeCheckLab.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
      "NEW quote verifies against ephemeral separately launched child key")
    verify(crypto.equivalentFixtureOnly(db.currentFixtureOnly(account)!!,latest),
      "database initially agrees with separate JVM floor")
    verify(db.receiptsFixtureOnly(account) == 1,
      "database initially contains one durable CAS receipt")

    // Privileged rollback affects ONLY the randomized fixture account in the
    // disposable PostgreSQL DB. The child JVM has no DB connection.
    val url = System.getenv("NEGRESCO_LAB_PG_URL")
      ?: error("SEC05K test requires throwaway PostgreSQL JDBC URL")
    val user = System.getenv("NEGRESCO_LAB_PG_USER")
      ?: System.getenv("PGUSER") ?: "postgres"
    val password = System.getenv("NEGRESCO_LAB_PG_PASSWORD")
      ?: System.getenv("PGPASSWORD") ?: ""
    DriverManager.getConnection(url,user,password).use { conn ->
      conn.autoCommit = false
      try {
        conn.prepareStatement(
          "DELETE FROM negresco_sec05k_cas_lab.operation_receipts WHERE account_id=?"
        ).use { ps ->
          ps.setString(1,account)
          verify(ps.executeUpdate()==1,"simulated admin deletes only random fixture receipt")
        }
        conn.prepareStatement(
          "UPDATE negresco_sec05k_cas_lab.generations SET " +
            "kit_id=?,version=?,generation=?,ciphertext_sha256=? WHERE account_id=?"
        ).use { ps ->
          ps.setObject(1,UUID.fromString(old.kitId))
          ps.setLong(2,old.version)
          ps.setLong(3,old.generation)
          ps.setBytes(4,old.ciphertextHash)
          ps.setString(5,account)
          verify(ps.executeUpdate()==1,"simulated admin rolls back only fixture generation")
        }
        conn.commit()
      } catch(e: Exception) {
        conn.rollback()
        throw e
      }
    }
    verify(crypto.equivalentFixtureOnly(db.currentFixtureOnly(account)!!,old),
      "database and receipts are now behind independently retained floor")
    verify(db.receiptsFixtureOnly(account)==0,
      "PG receipt disappeared during privileged rollback")

    val postRollback = SyntheticSignedRekeyChallengeSessionLab(latest,floor.childPublicKey)
    val freshNonce = postRollback.issueChallengeFixtureOnly()!!
    val signed = floor.signedCurrent(freshNonce)!!
    verify(postRollback.verifyOnceFixtureOnly(freshNonce,signed.first,signed.second) ==
      SyntheticSignedRekeyChallengeCheckLab.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
      "separate child STILL signs new generation after PostgreSQL rollback")
    verify(!crypto.equivalentFixtureOnly(db.currentFixtureOnly(account)!!,signed.first),
      "independent floor reveals DB rollback even when SQL receipts were erased")
    verify(floor.enroll(old) == "DENY_ALREADY_ENROLLED" &&
      floor.advance(old,latest) == "DENY_PREDECESSOR",
      "neither reenrollment nor CAS replay can lower separate JVM floor")

    val simulatedDecision = SyntheticRekeyReconciliationInputLab(
      SyntheticRekeyAuthorityEvidenceLab.SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY,
      SyntheticRekeyJournalObservationLab.CLEAN,
      SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED,
      SyntheticRekeyCandidateObservationLab.ABSENT,
      SyntheticRekeyAuthorityGenerationLab.NEW_CURRENT,
      true, old.version, latest.version, old.generation, latest.generation
    )
    verify(SyntheticJournalAuthorityReconciliationPolicyLab.decide(simulatedDecision) ==
      SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
      "ephemeral signed child evidence is never promoted to trusted live authority")
    verify(SyntheticJournalAuthorityReconciliationPolicyLab.decide(simulatedDecision.copy(
      authorityEvidence = SyntheticRekeyAuthorityEvidenceLab.VERIFIED_LIVE_CURRENT
    )) == SyntheticRekeyReconciliationDecisionLab.DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED,
      "hypothetical independently trusted NEW forbids accepting old local generation")
    val wrongPin = SyntheticSignedRekeyChallengeSessionLab(
      latest,KeyPairGenerator.getInstance("Ed25519").generateKeyPair().public
    )
    val wrongNonce = wrongPin.issueChallengeFixtureOnly()!!
    val response = floor.signedCurrent(wrongNonce)!!
    verify(wrongPin.verifyOnceFixtureOnly(wrongNonce,response.first,response.second) ==
      SyntheticSignedRekeyChallengeCheckLab.DENY_SIGNATURE,
      "stranger key does not validate independent signed quote")
  }

  // The process-level reference itself is NOT durable: restarting creates a
  // new key and loses all generations. This limitation is part of the proof.
  SyntheticIndependentFloorClientFixtureLab().use { restarted ->
    verify(restarted.signedCurrent(ByteArray(32)) == null,
      "critical limit: newly restarted oracle has LOST its previous floor")
    verify(restarted.enroll(old) == "OK_ENROLLED",
      "critical limit: a new child can enroll OLD absent persistent secure state")
  }

  println("PASS: SEC-05K $checks isolated-JVM generation floor vs PostgreSQL rollback checks (not durable authority)")
  println("LIMIT: child floor is volatile, key is self-attested, NO independent deployed authority")
}

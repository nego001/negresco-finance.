package com.negresco.finance.security

import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.Signature
import java.sql.DriverManager
import java.util.UUID

/**
 * SEC-05K disposable PostgreSQL signed-read and TOCTOU limits.
 * Emulated Ed25519 signer runs in the same test JVM with ephemeral keys.
 * This is NEVER a live, remote, protected or independently monotonic authority.
 */
internal fun runSyntheticJdbcSignedReadRaceScenarios() {
  val store = SyntheticJdbcRekeyCasPersistenceLab()
  val signer: KeyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val verifier = SyntheticSignedRekeyAuthorityChallengeLab
  var checks = 0
  fun checkCase(condition: Boolean, reason: String) {
    check(condition) { "SEC-05K signed PostgreSQL read: $reason" }
    checks++
  }
  fun claim(
    account: String,
    version: Long,
    generation: Long
  ): SyntheticRekeyGenerationClaimLab {
    val kit = UUID.randomUUID().toString()
    val digest = MessageDigest.getInstance("SHA-256").digest(
      "disposable-postgres-signed-v$version-g$generation-$kit".toByteArray()
    )
    return SyntheticRekeyGenerationClaimLab(account, kit, version, generation, digest)
  }
  fun signedReadFixtureOnly(
    account: String, challenge: ByteArray
  ): Pair<SyntheticRekeyGenerationClaimLab, ByteArray> {
    val current = store.currentFixtureOnly(account) ?: error("Missing disposable fixture account")
    val ed = Signature.getInstance("Ed25519")
    ed.initSign(signer.private)
    ed.update(verifier.payloadFixtureOnly(current, challenge))
    return Pair(current, ed.sign())
  }
  fun restrictedPolicy(): SyntheticRekeyReconciliationInputLab =
    SyntheticRekeyReconciliationInputLab(
      SyntheticRekeyAuthorityEvidenceLab.SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY,
      SyntheticRekeyJournalObservationLab.COMMITTED,
      SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED,
      SyntheticRekeyCandidateObservationLab.NEW_AUTHENTICATED,
      SyntheticRekeyAuthorityGenerationLab.NEW_CURRENT,
      true, 2L, 3L, 3L, 4L
    )

  // A response was legitimately signed for a freshly generated challenge.
  // A remote CAS subsequently advances the DB. The signature remains valid,
  // which demonstrates why cryptographic validation is not a timeless lease.
  run {
    val account = UUID.randomUUID().toString().replace("-", "")
    val before = claim(account,2L,3L)
    val after = claim(account,3L,4L)
    checkCase(store.bootstrapFixtureOnly(before) == "BOOTSTRAPPED_FIXTURE_ONLY",
      "bootstrap synthetic account prior to signed read")
    val staleSession = SyntheticSignedRekeyChallengeSessionLab(before, signer.public)
    val staleNonce = staleSession.issueChallengeFixtureOnly()!!
    val (staleClaim, staleSignature) = signedReadFixtureOnly(account,staleNonce)
    checkCase(verifier.equivalentFixtureOnly(staleClaim,before),
      "signed read accurately described old database at issuance")
    checkCase(store.compareAndSwapFixtureOnly(UUID.randomUUID(),before,after) ==
      "ADVANCED_FIXTURE_ONLY", "new generation commits after stale reply was signed")
    checkCase(verifier.equivalentFixtureOnly(store.currentFixtureOnly(account)!!,after),
      "independent database read observes generation newer than signed response")
    checkCase(staleSession.verifyOnceFixtureOnly(staleNonce,staleClaim,staleSignature) ==
      SyntheticSignedRekeyChallengeCheckLab.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
      "valid Ed25519 signature remains valid even though response is NOW STALE")
    checkCase(SyntheticJournalAuthorityReconciliationPolicyLab.decide(restrictedPolicy()) ==
      SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
      "valid but stale fixture signature does not authorize local recovery")
    checkCase(staleSession.verifyOnceFixtureOnly(staleNonce,staleClaim,staleSignature) ==
      SyntheticSignedRekeyChallengeCheckLab.DENY_REUSED_OR_EXPIRED_SESSION,
      "old signed response cannot be verified twice in the same session")
    val expectingNew = SyntheticSignedRekeyChallengeSessionLab(after,signer.public)
    val nonce = expectingNew.issueChallengeFixtureOnly()!!
    val current = signedReadFixtureOnly(account,nonce)
    checkCase(expectingNew.verifyOnceFixtureOnly(nonce,current.first,current.second) ==
      SyntheticSignedRekeyChallengeCheckLab.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
      "newly fetched signed generation verifies only as test fixture")
    val wrongKey = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
    val wrongPin = SyntheticSignedRekeyChallengeSessionLab(after,wrongKey.public)
    val wrongNonce = wrongPin.issueChallengeFixtureOnly()!!
    val wrongResponse = signedReadFixtureOnly(account,wrongNonce)
    checkCase(wrongPin.verifyOnceFixtureOnly(wrongNonce,wrongResponse.first,wrongResponse.second) ==
      SyntheticSignedRekeyChallengeCheckLab.DENY_SIGNATURE,
      "signed PostgreSQL read cannot be validated against an unrelated pinned key")
    val expectingOld = SyntheticSignedRekeyChallengeSessionLab(before,signer.public)
    val oldNonce = expectingOld.issueChallengeFixtureOnly()!!
    val oldResponse = signedReadFixtureOnly(account,oldNonce)
    checkCase(expectingOld.verifyOnceFixtureOnly(oldNonce,oldResponse.first,oldResponse.second) ==
      SyntheticSignedRekeyChallengeCheckLab.DENY_CLAIM_MISMATCH,
      "new valid signed generation cannot satisfy request expecting old exact snapshot")
  }

  // A database administrator with full write privilege can restore an older
  // generation AND erase its receipts. A new challenge can then be signed for
  // the restored OLD value. Fresh signatures do not prevent database rollback.
  // These are DIFFERENT newly randomized disposable rows, never real accounts.
  run {
    val account = UUID.randomUUID().toString().replace("-", "")
    val before = claim(account,2L,3L)
    val after = claim(account,3L,4L)
    checkCase(store.bootstrapFixtureOnly(before) == "BOOTSTRAPPED_FIXTURE_ONLY",
      "bootstrap disposable rollback demonstration")
    val op = UUID.randomUUID()
    checkCase(store.compareAndSwapFixtureOnly(op,before,after) == "ADVANCED_FIXTURE_ONLY",
      "durable CAS had already committed next generation")
    checkCase(store.receiptsFixtureOnly(account) == 1,
      "one persisted CAS receipt exists before privileged rollback simulation")

    val url = System.getenv("NEGRESCO_LAB_PG_URL")
      ?: error("Requires explicit throwaway PostgreSQL CI database")
    val user = System.getenv("NEGRESCO_LAB_PG_USER")
      ?: System.getenv("PGUSER") ?: "postgres"
    val password = System.getenv("NEGRESCO_LAB_PG_PASSWORD")
      ?: System.getenv("PGPASSWORD") ?: ""
    DriverManager.getConnection(url,user,password).use { db ->
      db.autoCommit = false
      try {
        db.prepareStatement(
          "DELETE FROM negresco_sec05k_cas_lab.operation_receipts WHERE account_id=?"
        ).use { ps ->
          ps.setString(1,account)
          checkCase(ps.executeUpdate()==1,"privileged fixture deletes only its old receipt")
        }
        db.prepareStatement(
          "UPDATE negresco_sec05k_cas_lab.generations SET " +
            "kit_id=?,version=?,generation=?,ciphertext_sha256=? WHERE account_id=?"
        ).use { ps ->
          ps.setObject(1,UUID.fromString(before.kitId))
          ps.setLong(2,before.version)
          ps.setLong(3,before.generation)
          ps.setBytes(4,before.ciphertextHash)
          ps.setString(5,account)
          checkCase(ps.executeUpdate()==1,"privileged fixture restores only its old generation")
        }
        db.commit()
      } catch (error:Exception) {
        db.rollback()
        throw error
      }
    }
    checkCase(verifier.equivalentFixtureOnly(store.currentFixtureOnly(account)!!,before),
      "PostgreSQL alone cannot detect restore of old snapshot and old ledger state")
    checkCase(store.receiptsFixtureOnly(account)==0,
      "receipt history also disappeared during privileged rollback rehearsal")
    val freshSession = SyntheticSignedRekeyChallengeSessionLab(before,signer.public)
    val nonce = freshSession.issueChallengeFixtureOnly()!!
    val restoredResponse = signedReadFixtureOnly(account,nonce)
    checkCase(freshSession.verifyOnceFixtureOnly(nonce,
      restoredResponse.first,restoredResponse.second) ==
      SyntheticSignedRekeyChallengeCheckLab.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
      "CRITICAL LIMIT: fresh signature can authenticate rolled-back SQL generation")
    checkCase(SyntheticJournalAuthorityReconciliationPolicyLab.decide(restrictedPolicy()) ==
      SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
      "replayed DB rollback is NEVER upgraded to live authority by signature")
    checkCase(store.persistedOperationFixtureOnly(account,op)==null,
      "locally restored database has no proof of previous committed operation")
  }

  println("PASS: SEC-05K $checks JDBC signed-read TOCTOU and privileged-rollback checks (lab only)")
  println("LIMIT: fresh signature does not prove remote state is monotonic or rollback resistant")
}

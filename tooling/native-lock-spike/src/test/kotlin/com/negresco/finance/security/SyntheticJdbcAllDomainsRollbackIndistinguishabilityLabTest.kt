package com.negresco.finance.security

import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.security.PublicKey
import java.sql.DriverManager
import java.util.UUID

/**
 * SEC-05K negative proof, isolated CI fixtures ONLY.
 *
 * PostgreSQL, two signed witnesses, and a THIRD signed file-backed JVM acting
 * as an "authority" can ALL be reverted together. The original public pins
 * still authenticate fresh OLD quotes. A file-backed authority on another
 * process (even with Ed25519) does not guarantee a monotonic non-rewindable
 * generation. No app, HSM, remote service or owner authentication involved.
 */
internal fun runSyntheticJdbcAllDomainsRollbackIndistinguishabilityScenarios() {
  val db = SyntheticJdbcRekeyCasPersistenceLab()
  val crypto = SyntheticSignedRekeyAuthorityChallengeLab
  var checks = 0
  fun checkCase(ok: Boolean, reason: String) {
    check(ok) { "SEC05K all-domains rollback: $reason" }
    checks++
  }
  val account = UUID.randomUUID().toString().replace("-", "")
  fun claim(version: Long, generation: Long): SyntheticRekeyGenerationClaimLab {
    val kit = UUID.randomUUID().toString()
    return SyntheticRekeyGenerationClaimLab(account, kit, version, generation,
      MessageDigest.getInstance("SHA-256").digest(
        "sec05k-disposable-total-rollback-$account-$kit".toByteArray()))
  }
  val old = claim(4L, 7L)
  val next = claim(5L, 8L)
  val roots = (1..3).map { Files.createTempDirectory("sec05k-all-domains-fixture-$it-") }
  val pins = mutableListOf<PublicKey>()
  val snapshots = mutableListOf<ByteArray>()
  val originalDb = old
  val operation = UUID.randomUUID()

  fun signed(
    process: SyntheticDurableFloorClientFixtureLab,
    expected: SyntheticRekeyGenerationClaimLab,
    publicKey: PublicKey
  ): SyntheticRekeyGenerationClaimLab {
    val verifier = SyntheticSignedRekeyChallengeSessionLab(expected, publicKey)
    val challenge = verifier.issueChallengeFixtureOnly()!!
    val (claim, signature) = process.signedCurrent(challenge)!!
    checkCase(verifier.verifyOnceFixtureOnly(challenge, claim, signature) ==
      SyntheticSignedRekeyChallengeCheckLab.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
      "fresh nonce and original public pin validate a synthetic quote, not a live authority")
    return claim
  }

  checkCase(db.bootstrapFixtureOnly(old) == "BOOTSTRAPPED_FIXTURE_ONLY",
    "random PostgreSQL account starts OLD")
  checkCase(db.receiptsFixtureOnly(account) == 0,
    "no operation receipt exists in initial SQL state")
  for (root in roots) {
    SyntheticDurableFloorClientFixtureLab(root).use { process ->
      pins.add(process.childPublicKey)
      checkCase(process.enroll(old) == "OK_ENROLLED",
        "independent signer explicitly enrolls the same old claim")
      checkCase(crypto.equivalentFixtureOnly(signed(process, old, process.childPublicKey), old),
        "originally signed OLD claim is valid before commit")
    }
    snapshots.add(Files.readAllBytes(root.resolve("authority.state")))
  }
  checkCase(pins.map { it.encoded.toList() }.distinct().size == roots.size,
    "three JVMs use three different Ed25519 public keys")
  checkCase(db.compareAndSwapFixtureOnly(operation, old, next) ==
    "ADVANCED_FIXTURE_ONLY", "real disposable PostgreSQL CAS commits NEW")
  checkCase(db.receiptsFixtureOnly(account) == 1,
    "PostgreSQL keeps a committed operation receipt")
  for (i in roots.indices) {
    SyntheticDurableFloorClientFixtureLab(roots[i]).use { process ->
      checkCase(MessageDigest.isEqual(pins[i].encoded, process.childPublicKey.encoded),
        "signed witness or authority retains its initial pin on restart")
      checkCase(process.advance(old, next) == "OK_ADVANCED",
        "signed witness or authority persists NEW before full rollback")
      checkCase(crypto.equivalentFixtureOnly(signed(process, next, pins[i]), next),
        "fresh signed NEW quote validates before rollback")
    }
  }
  checkCase(crypto.equivalentFixtureOnly(db.currentFixtureOnly(account)!!, next),
    "PostgreSQL is NEW before all-domain attack")
  // Attack restores PostgreSQL and TWO witness files, but NOT the third file.
  // A still-current third signer reveals divergence if it is genuinely trusted.
  val url = System.getenv("NEGRESCO_LAB_PG_URL")
    ?: error("SEC05K requires disposable PostgreSQL JDBC URL")
  val user = System.getenv("NEGRESCO_LAB_PG_USER")
    ?: System.getenv("PGUSER") ?: "postgres"
  val password = System.getenv("NEGRESCO_LAB_PG_PASSWORD")
    ?: System.getenv("PGPASSWORD") ?: ""
  DriverManager.getConnection(url, user, password).use { sql ->
    sql.autoCommit = false
    try {
      sql.prepareStatement(
        "DELETE FROM negresco_sec05k_cas_lab.operation_receipts WHERE account_id=?"
      ).use {
        it.setString(1, account)
        checkCase(it.executeUpdate() == 1, "restore deletes only disposable SQL receipt")
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
        checkCase(it.executeUpdate() == 1, "restore changes only disposable SQL account")
      }
      sql.commit()
    } catch (failure: Exception) {
      sql.rollback()
      throw failure
    }
  }
  for (i in 0..1) {
    Files.write(roots[i].resolve("authority.state"), snapshots[i])
  }
  SyntheticDurableFloorClientFixtureLab(roots[2]).use { stillCurrent ->
    checkCase(crypto.equivalentFixtureOnly(signed(stillCurrent, next, pins[2]), next),
      "not-rewound third signer still reports NEW")
    checkCase(!crypto.equivalentFixtureOnly(db.currentFixtureOnly(account)!!,
      signed(stillCurrent, next, pins[2])),
      "restored PostgreSQL differs from surviving NEW signer")
    checkCase(crypto.equivalentFixtureOnly(db.currentFixtureOnly(account)!!, old),
      "SQL is now OLD despite formerly committed CAS")
    checkCase(db.receiptsFixtureOnly(account) == 0,
      "original CAS receipt vanished from restored SQL")
  }

  // Critical negative step: REWIND THE THIRD AUTHORITY FILE TOO.
  // A new Java process with the SAME PIN now signs OLD for NEW challenges.
  Files.write(roots[2].resolve("authority.state"), snapshots[2])
  checkCase(crypto.equivalentFixtureOnly(db.currentFixtureOnly(account)!!, originalDb),
    "CRITICAL LIMIT: SQL contents after replay are indistinguishable from original OLD")
  checkCase(db.receiptsFixtureOnly(account) == 0,
    "CRITICAL LIMIT: SQL receipt history is again indistinguishable from initial state")
  for (i in roots.indices) {
    checkCase(MessageDigest.isEqual(
      Files.readAllBytes(roots[i].resolve("authority.state")), snapshots[i]),
      "CRITICAL LIMIT: each signer state file equals its PRE-COMMIT bytes")
    SyntheticDurableFloorClientFixtureLab(roots[i]).use { restored ->
      checkCase(MessageDigest.isEqual(pins[i].encoded, restored.childPublicKey.encoded),
        "CRITICAL LIMIT: original signer pin is retained under full rewind")
      checkCase(crypto.equivalentFixtureOnly(signed(restored, old, pins[i]), old),
        "CRITICAL LIMIT: restored signer freshly signs OLD under ORIGINAL pinned key")
      checkCase(restored.enroll(old) == "DENY_ALREADY_ENROLLED",
        "restored signer appears provisioned, even though its history was erased")
    }
  }
  // No testimony from a fully rollbackable signer can become live authority.
  val reconciliation = SyntheticRekeyReconciliationInputLab(
    SyntheticRekeyAuthorityEvidenceLab.SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY,
    SyntheticRekeyJournalObservationLab.CLEAN,
    SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED,
    SyntheticRekeyCandidateObservationLab.ABSENT,
    SyntheticRekeyAuthorityGenerationLab.OLD_CURRENT,
    true, old.version, next.version, old.generation, next.generation
  )
  checkCase(SyntheticJournalAuthorityReconciliationPolicyLab.decide(reconciliation) ==
    SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
    "three valid signatures and restored SQL still NEVER authorize journal writes")
  println("PASS: SEC-05K $checks all-domain rollback indistinguishability checks (JDBC + 3 JVMs)")
  println("LIMIT: a signed, fully rollbackable authority is NOT a monotonic independent trust root")
}

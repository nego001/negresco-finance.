package com.negresco.finance.security

import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.UUID
import com.negresco.finance.security.SyntheticRekeyReconciliationDecisionLab as D
import com.negresco.finance.security.SyntheticRekeyAuthorityGenerationLab as G
import com.negresco.finance.security.SyntheticRekeyJournalObservationLab as J
import com.negresco.finance.security.SyntheticRekeyCiphertextObservationLab as A
import com.negresco.finance.security.SyntheticRekeyCandidateObservationLab as P

/**
 * SEC-05K ONLY. Correlates DB claims with real disposable ciphertext/journal
 * bytes. Observing NEVER performs recovery, remote CAS, or user authorization.
 */
internal fun runSyntheticJdbcJournalAuthorityDivergenceScenarios() {
  val random = SecureRandom()
  val db = SyntheticJdbcRekeyCasPersistenceLab()
  val policy = SyntheticJournalAuthorityReconciliationPolicyLab
  var checks = 0
  fun verify(ok: Boolean, reason: String) {
    check(ok) { "SEC-05K PG/journal divergence: $reason" }
    checks++
  }
  fun key() = ByteArray(32).also { random.nextBytes(it) }
  fun hash(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes)

  data class Fixture(
    val account: String, val dir: Path,
    val before: SyntheticRekeySnapshotLab, val after: SyntheticRekeySnapshotLab,
    val oldEnvelope: ByteArray, val newEnvelope: ByteArray,
    val oldSecret: ByteArray, val newSecret: ByteArray,
    val oldBytes: ByteArray, val previous: SyntheticRekeyGenerationClaimLab
  ) {
    fun journal() = SyntheticDurableRekeyJournalLab(dir)
    fun candidate() = dir.resolve("pending.snapshot")
    fun marker() = dir.resolve("migration.journal")
    fun active() = dir.resolve("active.snapshot")
    fun nextClaim(): SyntheticRekeyGenerationClaimLab =
      SyntheticRekeyGenerationClaimLab(
        account, after.kitId, after.version, after.generation,
        MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(candidate()))
      )
    fun prepare() = journal().prepareFixtureOnly(
      account, before.kitId, oldSecret, after, newEnvelope, newSecret
    )
    fun commit(crash: SyntheticJournalCrashLab) =
      journal().commitFixtureOnly(account, before.kitId, newEnvelope, newSecret, crash)
    fun observe(afterClaim: SyntheticRekeyGenerationClaimLab): SyntheticJournalObserveResultLab =
      journal().observeAgainstCasFixtureOnly(previous, afterClaim, db.currentFixtureOnly(account))
  }
  fun fresh(): Fixture {
    val account = UUID.randomUUID().toString().replace("-", "")
    val dir = Files.createTempDirectory("negresco-sec05k-disposable-pg-reconcile-")
    val dek = key()
    val initial = SyntheticOfflineRecoveryKitCryptoLab.sealFixtureOnly(account, dek, 1L, 2L)
    val envelope = SyntheticPortableRecoveryEnvelopeLab
      .exportEnvelopeBytesFixtureOnly(initial.envelope)
    val rotation = SyntheticCompromisedKitRotationLab.seedFixtureOnly(
      account, dek, initial, linkedMapOf(
        "game" to "synthetic item".toByteArray(),
        "subscription" to "synthetic recurring item".toByteArray()
      )
    )
    val before = rotation.snapshotFixtureOnly()
    val rotated = rotation.rotateCompromisedKitFixtureOnly(
      account, before.kitId, envelope, initial.recoverySecretCopyForFixtureOnly()
    )
    check(rotated.check == SyntheticRekeyCheck.REKEYED_FIXTURE_ONLY_NOT_AUTHORIZATION)
    val updated = rotated.freshKitFixtureOnly!!
    val after = rotation.snapshotFixtureOnly()
    val journal = SyntheticDurableRekeyJournalLab(dir)
    check(journal.seedFixtureOnly(before, envelope).check ==
      SyntheticJournalCheckLab.SEEDED_FIXTURE_ONLY)
    val oldBytes = Files.readAllBytes(dir.resolve("active.snapshot"))
    val previous = SyntheticRekeyGenerationClaimLab(
      account,before.kitId,before.version,before.generation,hash(oldBytes)
    )
    check(db.bootstrapFixtureOnly(previous) == "BOOTSTRAPPED_FIXTURE_ONLY")
    return Fixture(account,dir,before,after,envelope,rotation.encryptedBackupFixtureOnly(),
      initial.recoverySecretCopyForFixtureOnly(),
      updated.recoverySecretCopyForFixtureOnly(),oldBytes,previous)
  }
  fun inspect(f: Fixture, after: SyntheticRekeyGenerationClaimLab,
    phase: SyntheticRekeyJournalObservationLab,
    active: SyntheticRekeyCiphertextObservationLab,
    pending: SyntheticRekeyCandidateObservationLab,
    remote: SyntheticRekeyAuthorityGenerationLab,
    hypotheticalDecision: SyntheticRekeyReconciliationDecisionLab
  ) {
    val markerBefore = if (Files.exists(f.marker())) Files.readAllBytes(f.marker()) else null
    val activeBefore = Files.readAllBytes(f.active())
    val pendingBefore = if (Files.exists(f.candidate())) Files.readAllBytes(f.candidate()) else null
    val inspected = f.observe(after)
    verify(inspected.check == SyntheticJournalObserveCheckLab.OBSERVED_FIXTURE_ONLY_NOT_AUTHORITY,
      "exact synthetic ciphertext and journal binding observed")
    val observed = inspected.observation ?: error("missing read-only observation")
    verify(observed.journal == phase && observed.active == active &&
      observed.pending == pending && observed.authorityGeneration == remote,
      "matches expected real journal phase, local bytes, and PostgreSQL generation")
    verify(observed.authorityEvidence ==
      SyntheticRekeyAuthorityEvidenceLab.SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY,
      "PostgreSQL fixture NEVER becomes authenticated live external authority")
    verify(policy.decide(observed) == D.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
      "fixture-only observation NEVER authorizes journal publication or cleanup")
    verify(policy.decide(observed.copy(
      authorityEvidence = SyntheticRekeyAuthorityEvidenceLab.VERIFIED_LIVE_CURRENT
    )) == hypotheticalDecision,
      "hypothetical live authority policy outcome is recorded but NOT executed")
    verify(Files.readAllBytes(f.active()).contentEquals(activeBefore) &&
      ((markerBefore == null && !Files.exists(f.marker())) ||
        (markerBefore != null && Files.readAllBytes(f.marker()).contentEquals(markerBefore))) &&
      ((pendingBefore == null && !Files.exists(f.candidate())) ||
        (pendingBefore != null && Files.readAllBytes(f.candidate()).contentEquals(pendingBefore))),
      "read-only observation does not publish, roll back, or delete any journal files")
  }

  run {
    val f = fresh()
    verify(f.prepare().check == SyntheticJournalCheckLab.PREPARED_FIXTURE_ONLY,
      "prepared fixture before DB CAS")
    val newer = f.nextClaim()
    inspect(f,newer,J.PREPARED,A.OLD_AUTHENTICATED,P.NEW_AUTHENTICATED,G.OLD_CURRENT,
      D.MAY_DISCARD_PREPARED_CANDIDATE_ONLY)
    verify(f.commit(SyntheticJournalCrashLab.AFTER_COMMIT_SYNC).check ==
      SyntheticJournalCheckLab.SIMULATED_CRASH,
      "local COMMITTED written durably, still old active")
    inspect(f,newer,J.COMMITTED,A.OLD_AUTHENTICATED,P.NEW_AUTHENTICATED,G.OLD_CURRENT,
      D.HOLD_EXTERNAL_AUTHORITY_REQUIRED)
    val op = UUID.randomUUID()
    verify(db.compareAndSwapFixtureOnly(op,f.previous,newer,loseResponseAfterCommit=true)==null,
      "remote CAS commits but reply is lost while local COMMITTED is still pending")
    val receipt = db.persistedOperationFixtureOnly(f.account,op)
      ?: error("durable PostgreSQL operation receipt missing")
    verify(SyntheticSignedRekeyAuthorityChallengeLab.equivalentFixtureOnly(receipt.first,f.previous)
      && SyntheticSignedRekeyAuthorityChallengeLab.equivalentFixtureOnly(receipt.second,newer),
      "persisted op-id receipt binds previous and new ciphertext exactly")
    inspect(f,newer,J.COMMITTED,A.OLD_AUTHENTICATED,P.NEW_AUTHENTICATED,G.NEW_CURRENT,
      D.MAY_FINALIZE_COMMITTED_NEW_SNAPSHOT_ONLY)
    verify(db.compareAndSwapFixtureOnly(op,f.previous,newer) ==
      "ALREADY_APPLIED_CURRENT_FIXTURE_ONLY",
      "retry after lost response is idempotent in PostgreSQL")
    // Deliberate manual fixture recovery demonstrates mechanical roll-forward,
    // NOT an authorized automatic action resulting from this observation.
    verify(f.journal().recoverFixtureOnly().check ==
      SyntheticJournalCheckLab.RECOVERED_COMMIT_FINALIZED,
      "explicit disposable journal recovery finalizes committed candidate")
    inspect(f,newer,J.CLEAN,A.NEW_AUTHENTICATED,P.ABSENT,G.NEW_CURRENT,
      D.VERIFIED_STABLE_READ_ONLY)
    val currentBytes = Files.readAllBytes(f.active())
    Files.write(f.active(),f.oldBytes)
    inspect(f,newer,J.CLEAN,A.OLD_AUTHENTICATED,P.ABSENT,G.NEW_CURRENT,
      D.DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED)
    Files.write(f.active(),currentBytes)
    inspect(f,newer,J.CLEAN,A.NEW_AUTHENTICATED,P.ABSENT,G.NEW_CURRENT,
      D.VERIFIED_STABLE_READ_ONLY)
  }

  run {
    val f = fresh()
    verify(f.prepare().check == SyntheticJournalCheckLab.PREPARED_FIXTURE_ONLY,
      "prepare only, prior to durable journal COMMITTED")
    val newer = f.nextClaim()
    verify(db.compareAndSwapFixtureOnly(UUID.randomUUID(),f.previous,newer) ==
      "ADVANCED_FIXTURE_ONLY", "simulate remote ahead of local PREPARED")
    inspect(f,newer,J.PREPARED,A.OLD_AUTHENTICATED,P.NEW_AUTHENTICATED,G.NEW_CURRENT,
      D.DENY_LOCAL_ROLLBACK_OR_UNRECOGNIZED)
    verify(Files.exists(f.marker()) && Files.exists(f.candidate()),
      "observer leaves PREPARED marker intact when DB has advanced prematurely")
  }

  run {
    val f = fresh()
    verify(f.prepare().check == SyntheticJournalCheckLab.PREPARED_FIXTURE_ONLY,
      "prepare fixture for replaced active file")
    val newer = f.nextClaim()
    verify(f.commit(SyntheticJournalCrashLab.AFTER_ACTIVE_REPLACE).check ==
      SyntheticJournalCheckLab.SIMULATED_CRASH,
      "local COMMITTED and new active published; journal cleanup interrupted")
    inspect(f,newer,J.COMMITTED,A.NEW_AUTHENTICATED,P.ABSENT,G.OLD_CURRENT,
      D.HOLD_EXTERNAL_AUTHORITY_REQUIRED)
    verify(db.compareAndSwapFixtureOnly(UUID.randomUUID(),f.previous,newer) ==
      "ADVANCED_FIXTURE_ONLY", "remote catches up after active replacement")
    inspect(f,newer,J.COMMITTED,A.NEW_AUTHENTICATED,P.ABSENT,G.NEW_CURRENT,
      D.MAY_CLEAR_COMMITTED_MARKER_ONLY)
    verify(Files.exists(f.marker()),"observer never clears COMMITTED marker")
    verify(f.journal().recoverFixtureOnly().check ==
      SyntheticJournalCheckLab.RECOVERED_COMMIT_FINALIZED,
      "explicit fixture cleanup recovers already-published COMMITTED state")
    inspect(f,newer,J.CLEAN,A.NEW_AUTHENTICATED,P.ABSENT,G.NEW_CURRENT,
      D.VERIFIED_STABLE_READ_ONLY)
  }

  run {
    val f = fresh()
    verify(f.prepare().check == SyntheticJournalCheckLab.PREPARED_FIXTURE_ONLY,
      "prepare fixture for corrupted pending candidate")
    val newer = f.nextClaim()
    verify(f.commit(SyntheticJournalCrashLab.AFTER_COMMIT_SYNC).check ==
      SyntheticJournalCheckLab.SIMULATED_CRASH,"commit marker durable")
    verify(db.compareAndSwapFixtureOnly(UUID.randomUUID(),f.previous,newer) ==
      "ADVANCED_FIXTURE_ONLY", "remote receipt updated")
    val pending = f.candidate()
    Files.write(pending,ByteArray(40))
    verify(f.observe(newer).check == SyntheticJournalObserveCheckLab.FAIL_CLOSED,
      "corrupt candidate fails closed even though PostgreSQL is NEW_CURRENT")
    verify(Files.exists(f.marker()) && db.receiptsFixtureOnly(f.account)==1,
      "failed observation retains COMMITTED evidence and durable DB receipt")
  }
  println("PASS: SEC-05K $checks PostgreSQL/journal divergence observations (fixture only)")
  println("LIMIT: PostgreSQL CI is NOT live authority; observer never authorizes recovery")
}

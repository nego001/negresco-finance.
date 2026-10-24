package com.negresco.finance.security

import java.security.MessageDigest
import java.util.UUID

/**
 * SEC-05K: disposable JDBC + caller-asserted checkpoint NEGATIVE integration.
 *
 * Checkpoints are test values, NOT receipts from a live independent monitor,
 * an append-only store or a verified Merkle proof. Neither successful SQL CAS
 * nor matching synthetic claims can grant recovery or publish a journal.
 */
internal fun runSyntheticJdbcCheckpointCommitGapScenarios() {
  val pg = SyntheticJdbcRekeyCasPersistenceLab()
  val gate = SyntheticIndependentCheckpointGateLab
  val crypto = SyntheticSignedRekeyAuthorityChallengeLab
  val epoch = UUID.randomUUID()
  val account = UUID.randomUUID().toString().replace("-", "")
  val oldOp = UUID.randomUUID()
  val newOp = UUID.randomUUID()
  val rootOld = "a".repeat(64)
  val rootNew = "b".repeat(64)
  val rootFork = "c".repeat(64)
  var checks = 0
  fun verify(ok: Boolean, why: String) {
    check(ok) { "SEC05K JDBC/checkpoint gap: $why" }
    checks++
  }
  fun claim(version: Long, generation: Long): SyntheticRekeyGenerationClaimLab {
    val kit = UUID.randomUUID().toString()
    return SyntheticRekeyGenerationClaimLab(account, kit, version, generation,
      MessageDigest.getInstance("SHA-256")
        .digest(("sec05k-checkpoint-disposable-" + account + kit).toByteArray()))
  }
  fun hex(bytes: ByteArray): String =
    bytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }
  fun checkpoint(
    source: SyntheticRekeyGenerationClaimLab, op: UUID,
    treeSize: Long, treeRoot: String
  ) = SyntheticCheckpointClaimLab(account, epoch, op, source.kitId,
    source.generation, hex(source.ciphertextHash), treeSize, treeRoot)
  fun input(
    register: SyntheticCheckpointClaimLab?,
    witness: SyntheticCheckpointClaimLab?,
    highWater: Long = 10L, size: Long = 27L, root: String = rootOld,
    online: Boolean = true, verified: Boolean = true
  ) = SyntheticCheckpointGateInputLab(
    account, epoch, register, witness, highWater, size, root,
    online, verified, true, true)
  fun reasons(
    register: SyntheticCheckpointClaimLab?,
    witness: SyntheticCheckpointClaimLab?,
    highWater: Long = 10L, size: Long = 27L, root: String = rootOld,
    online: Boolean = true, verified: Boolean = true
  ) = gate.inspect(input(register, witness, highWater, size, root, online, verified))
  val hold = SyntheticCheckpointGateReasonLab
    .HOLD_EXTERNAL_ATTESTATION_AND_IMPLEMENTATION_REQUIRED
  val mismatch = SyntheticCheckpointGateReasonLab.DENY_GENERATION_OR_PAYLOAD_DIVERGENCE
  val old = claim(9L, 10L)
  val newer = claim(10L, 11L)
  val oldCheckpoint = checkpoint(old, oldOp, 27L, rootOld)
  val newCheckpoint = checkpoint(newer, newOp, 28L, rootNew)

  verify(pg.bootstrapFixtureOnly(old) == "BOOTSTRAPPED_FIXTURE_ONLY",
    "random disposable PostgreSQL account begins OLD")
  verify(crypto.equivalentFixtureOnly(pg.currentFixtureOnly(account)!!, old),
    "SQL state OLD verified in independent JDBC session")
  verify(reasons(oldCheckpoint, oldCheckpoint) == setOf(hold),
    "same OLD claims are only observations, never live attestation")

  // FIRST: SQL commits NEW and its ACK disappears, checkpoint still OLD.
  verify(pg.compareAndSwapFixtureOnly(newOp, old, newer,
    loseResponseAfterCommit = true) == null,
    "PostgreSQL commits NEW but its response is lost")
  verify(pg.receiptsFixtureOnly(account) == 1,
    "PostgreSQL persists exactly one SQL receipt")
  val persisted = pg.persistedOperationFixtureOnly(account, newOp)
  verify(persisted != null && crypto.equivalentFixtureOnly(persisted.first, old) &&
    crypto.equivalentFixtureOnly(persisted.second, newer),
    "durable SQL operation binds exact OLD and NEW, not monitor proof")
  verify(crypto.equivalentFixtureOnly(pg.currentFixtureOnly(account)!!, newer),
    "another JDBC session sees NEW before checkpoint catches up")
  val sqlNew = checkpoint(pg.currentFixtureOnly(account)!!, newOp, 28L, rootNew)
  val sqlFirst = reasons(sqlNew, oldCheckpoint)
  verify(sqlFirst.contains(mismatch),
    "SQL NEW plus checkpoint OLD returns divergence, not permission")
  verify(sqlFirst.contains(SyntheticCheckpointGateReasonLab.DENY_OPERATION_COLLISION),
    "SQL NEW and checkpoint OLD disagree on operation UUID")
  verify(sqlFirst.contains(hold),
    "signed-looking SQL receipt cannot replace external attestation")
  verify(reasons(sqlNew, null).contains(
    SyntheticCheckpointGateReasonLab.HOLD_INCOMPLETE_TWO_DOMAIN_COMMIT),
    "missing checkpoint cannot complete SQL-first commit")
  verify(pg.compareAndSwapFixtureOnly(newOp, old, newer) ==
    "ALREADY_APPLIED_CURRENT_FIXTURE_ONLY",
    "SQL retry after lost ACK is locally idempotent only")

  // A separate checkpoint is now *asserted* NEW; no shared atomic commit.
  val bothNew = reasons(sqlNew, newCheckpoint)
  verify(bothNew == setOf(hold),
    "two matching NEW snapshots still cannot certify an atomic external commit")
  verify(reasons(sqlNew, newCheckpoint, verified = false).contains(
    SyntheticCheckpointGateReasonLab.HOLD_NO_CONSISTENCY_PROOF),
    "claimed tree growth without verified proof holds")
  verify(reasons(sqlNew, newCheckpoint, online = false).contains(
    SyntheticCheckpointGateReasonLab.HOLD_MONITOR_OFFLINE),
    "cached matching checkpoint fails closed when monitor offline")
  verify(reasons(sqlNew, newCheckpoint.copy(
    cipherHashHex = "d".repeat(64))).contains(mismatch),
    "same generation and op with different ciphertext hash is denied")
  verify(reasons(sqlNew, newCheckpoint.copy(
    operation = UUID.randomUUID())).contains(
      SyntheticCheckpointGateReasonLab.DENY_OPERATION_COLLISION),
    "same generation and hash under different operation ID denied")
  verify(reasons(sqlNew, newCheckpoint, highWater = 12L).contains(
    SyntheticCheckpointGateReasonLab.DENY_ROLLBACK_FROM_HIGH_WATER),
    "independently remembered NEWER high-water refuses replay of NEW")
  verify(reasons(oldCheckpoint, oldCheckpoint, highWater = 11L, size = 28L,
    root = rootNew).contains(
      SyntheticCheckpointGateReasonLab.DENY_TREE_TRUNCATION),
    "OLD checkpoint replay below previously witnessed tree size denied")
  verify(reasons(oldCheckpoint, oldCheckpoint, highWater = 11L, size = 28L,
    root = rootNew).contains(
      SyntheticCheckpointGateReasonLab.DENY_ROLLBACK_FROM_HIGH_WATER),
    "OLD generation replay below independently remembered floor denied")
  verify(reasons(newCheckpoint.copy(treeRootHex = rootFork),
    newCheckpoint.copy(treeRootHex = rootFork),
    highWater = 11L, size = 28L, root = rootNew).contains(
      SyntheticCheckpointGateReasonLab.DENY_EQUIVOCATION_SAME_TREE_SIZE),
    "split-view at same checkpoint size with different root denied")
  verify(reasons(sqlNew, newCheckpoint.copy(epoch = UUID.randomUUID())).contains(
    SyntheticCheckpointGateReasonLab.DENY_ACCOUNT_OR_IDENTITY),
    "self-reprovisioned checkpoint epoch does not pass pinned identity")

  // REVERSE ORDER: on a second random account a claimed checkpoint goes
  // NEW before SQL does. A standalone checkpoint cannot force SQL forward.
  val secondAccount = UUID.randomUUID().toString().replace("-", "")
  fun secondClaim(v: Long, g: Long): SyntheticRekeyGenerationClaimLab {
    val kit = UUID.randomUUID().toString()
    return SyntheticRekeyGenerationClaimLab(secondAccount, kit, v, g,
      MessageDigest.getInstance("SHA-256")
        .digest(("sec05k-second-disposable-" + secondAccount + kit).toByteArray()))
  }
  val secondOld = secondClaim(4L, 5L)
  val secondNew = secondClaim(5L, 6L)
  val secondOp = UUID.randomUUID()
  fun secondCheckpoint(c: SyntheticRekeyGenerationClaimLab, treeSize: Long,
    root: String) = SyntheticCheckpointClaimLab(secondAccount, epoch, secondOp,
      c.kitId, c.generation, hex(c.ciphertextHash), treeSize, root)
  verify(pg.bootstrapFixtureOnly(secondOld) == "BOOTSTRAPPED_FIXTURE_ONLY",
    "second throwaway account bootstrapped independently")
  val aheadWitness = secondCheckpoint(secondNew, 32L, rootNew)
  val oldRegister = secondCheckpoint(pg.currentFixtureOnly(secondAccount)!!,
    31L, rootOld)
  val reverse = gate.inspect(SyntheticCheckpointGateInputLab(
    secondAccount, epoch, oldRegister, aheadWitness, 5L, 31L,
    rootOld, true, false, true, true))
  verify(reverse.contains(mismatch),
    "checkpoint NEW preceding SQL OLD is a held mismatch, not automatic SQL repair")
  verify(reverse.contains(SyntheticCheckpointGateReasonLab.HOLD_NO_CONSISTENCY_PROOF),
    "new checkpoint without independently checked extension remains HOLD")
  verify(pg.receiptsFixtureOnly(secondAccount) == 0 &&
    crypto.equivalentFixtureOnly(pg.currentFixtureOnly(secondAccount)!!, secondOld),
    "checkpoint claim never advances PostgreSQL or writes an SQL receipt")
  verify(pg.compareAndSwapFixtureOnly(secondOp, secondOld, secondNew) ==
    "ADVANCED_FIXTURE_ONLY",
    "explicit independent SQL CAS is required to catch up; no auto-reconciliation")
  verify(gate.inspect(SyntheticCheckpointGateInputLab(
    secondAccount, epoch,
    secondCheckpoint(pg.currentFixtureOnly(secondAccount)!!, 32L, rootNew),
    aheadWitness, 5L, 31L, rootOld, true, true, true, true)) == setOf(hold),
    "eventual consistency of fixture receipts remains non-authoritative")
  val journal = SyntheticRekeyReconciliationInputLab(
    SyntheticRekeyAuthorityEvidenceLab.SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY,
    SyntheticRekeyJournalObservationLab.COMMITTED,
    SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED,
    SyntheticRekeyCandidateObservationLab.NEW_AUTHENTICATED,
    SyntheticRekeyAuthorityGenerationLab.NEW_CURRENT,
    true, old.version, newer.version, old.generation, newer.generation)
  verify(SyntheticJournalAuthorityReconciliationPolicyLab.decide(journal) ==
    SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
    "no matching checkpoint, local SQL receipt or fixture proof authorizes journal")

  println("PASS: SEC-05K $checks JDBC/checkpoint commit gap checks (disposable fixtures)")
  println("LIMIT: checkpoint claims, high-water and proof flags are caller-asserted")
}

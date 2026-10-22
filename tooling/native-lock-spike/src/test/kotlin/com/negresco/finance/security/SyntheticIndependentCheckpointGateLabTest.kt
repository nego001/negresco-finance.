package com.negresco.finance.security

import java.util.UUID

/**
 * SEC-05K: PURE JVM checkpoint-consistency NEGATIVE TEST.
 * All claims and "proof verified" flags are synthetic assertions supplied
 * by the caller: no signature, inclusion proof, retention, hardware, network
 * or external storage is verified in this test. NEVER return LIVE/ALLOW.
 */
internal data class SyntheticCheckpointClaimLab(
  val account: String,
  val epoch: UUID,
  val operation: UUID,
  val kit: String,
  val generation: Long,
  val cipherHashHex: String,
  val treeSize: Long,
  val treeRootHex: String
)

internal enum class SyntheticCheckpointGateReasonLab {
  HOLD_MONITOR_OFFLINE,
  HOLD_INCOMPLETE_TWO_DOMAIN_COMMIT,
  DENY_ACCOUNT_OR_IDENTITY,
  DENY_OPERATION_COLLISION,
  DENY_GENERATION_OR_PAYLOAD_DIVERGENCE,
  DENY_ROLLBACK_FROM_HIGH_WATER,
  DENY_TREE_TRUNCATION,
  DENY_EQUIVOCATION_SAME_TREE_SIZE,
  DENY_MALFORMED_CHECKPOINT,
  HOLD_NO_CONSISTENCY_PROOF,
  HOLD_NO_INDEPENDENT_ADMIN_OR_RETENTION,
  HOLD_OWNER_NOT_VERIFIED,
  HOLD_EXTERNAL_ATTESTATION_AND_IMPLEMENTATION_REQUIRED
}

internal data class SyntheticCheckpointGateInputLab(
  val expectedAccount: String,
  val pinnedEpoch: UUID,
  val register: SyntheticCheckpointClaimLab?,
  val checkpoint: SyntheticCheckpointClaimLab?,
  val lastSeenGeneration: Long,
  val lastSeenTreeSize: Long,
  val lastSeenRootHex: String,
  val monitorOnline: Boolean,
  val consistencyProofVerifiedFixtureOnly: Boolean,
  val externalAdminAndRetentionAsserted: Boolean,
  val ownerVerifiedFixtureOnly: Boolean
)

internal object SyntheticIndependentCheckpointGateLab {
  private val hex64 = Regex("[0-9a-f]{64}")
  fun inspect(input: SyntheticCheckpointGateInputLab): Set<SyntheticCheckpointGateReasonLab> {
    val reasons = linkedSetOf<SyntheticCheckpointGateReasonLab>()
    if (!input.monitorOnline) reasons.add(SyntheticCheckpointGateReasonLab.HOLD_MONITOR_OFFLINE)
    val a = input.register
    val b = input.checkpoint
    if (a == null || b == null)
      reasons.add(SyntheticCheckpointGateReasonLab.HOLD_INCOMPLETE_TWO_DOMAIN_COMMIT)

    if (a != null && b != null) {
      if (input.expectedAccount.isBlank() || a.account != input.expectedAccount ||
        b.account != input.expectedAccount || a.epoch != input.pinnedEpoch ||
        b.epoch != input.pinnedEpoch)
        reasons.add(SyntheticCheckpointGateReasonLab.DENY_ACCOUNT_OR_IDENTITY)

      if (a.operation != b.operation)
        reasons.add(SyntheticCheckpointGateReasonLab.DENY_OPERATION_COLLISION)
      if (a.kit != b.kit || a.generation != b.generation ||
        a.cipherHashHex != b.cipherHashHex)
        reasons.add(SyntheticCheckpointGateReasonLab.DENY_GENERATION_OR_PAYLOAD_DIVERGENCE)

      if (a.generation < input.lastSeenGeneration ||
        b.generation < input.lastSeenGeneration)
        reasons.add(SyntheticCheckpointGateReasonLab.DENY_ROLLBACK_FROM_HIGH_WATER)

      if (b.treeSize < input.lastSeenTreeSize)
        reasons.add(SyntheticCheckpointGateReasonLab.DENY_TREE_TRUNCATION)
      if (b.treeSize == input.lastSeenTreeSize &&
        b.treeRootHex != input.lastSeenRootHex)
        reasons.add(SyntheticCheckpointGateReasonLab.DENY_EQUIVOCATION_SAME_TREE_SIZE)

      if (a.generation <= 0 || b.generation <= 0 ||
        input.lastSeenGeneration <= 0 || input.lastSeenTreeSize <= 0 ||
        a.treeSize <= 0 || b.treeSize <= 0 ||
        !hex64.matches(a.cipherHashHex) || !hex64.matches(b.cipherHashHex) ||
        !hex64.matches(a.treeRootHex) || !hex64.matches(b.treeRootHex) ||
        !hex64.matches(input.lastSeenRootHex))
        reasons.add(SyntheticCheckpointGateReasonLab.DENY_MALFORMED_CHECKPOINT)

      // "proof verified" is caller-asserted and never actually checked here.
      if (b.treeSize > input.lastSeenTreeSize &&
        !input.consistencyProofVerifiedFixtureOnly)
        reasons.add(SyntheticCheckpointGateReasonLab.HOLD_NO_CONSISTENCY_PROOF)
    }
    if (!input.externalAdminAndRetentionAsserted)
      reasons.add(SyntheticCheckpointGateReasonLab.HOLD_NO_INDEPENDENT_ADMIN_OR_RETENTION)
    if (!input.ownerVerifiedFixtureOnly)
      reasons.add(SyntheticCheckpointGateReasonLab.HOLD_OWNER_NOT_VERIFIED)

    // Even perfect signed receipts and alleged consistency are insufficient:
    // the environment, root/identity, proof and linearizable CAS are not real.
    reasons.add(SyntheticCheckpointGateReasonLab
      .HOLD_EXTERNAL_ATTESTATION_AND_IMPLEMENTATION_REQUIRED)
    return reasons
  }
}

internal fun runSyntheticIndependentCheckpointGateScenarios() {
  val epoch = UUID.randomUUID()
  val operation = UUID.randomUUID()
  val account = UUID.randomUUID().toString().replace("-", "")
  val a = SyntheticCheckpointClaimLab(
    account, epoch, operation, UUID.randomUUID().toString(),
    9L, "a".repeat(64), 17L, "b".repeat(64))
  val b = a.copy()
  val gate = SyntheticIndependentCheckpointGateLab
  val base = SyntheticCheckpointGateInputLab(
    account, epoch, a, b, 9L, 17L, "b".repeat(64),
    true, true, true, true)
  val R = SyntheticCheckpointGateReasonLab
  var checks = 0
  fun verify(condition: Boolean, reason: String) {
    check(condition) { "SEC05K checkpoint gate fixture: $reason" }
    checks++
  }
  fun must(input: SyntheticCheckpointGateInputLab,
           reason: SyntheticCheckpointGateReasonLab, why: String) =
    verify(gate.inspect(input).contains(reason), why)

  verify(gate.inspect(base) == setOf(
    R.HOLD_EXTERNAL_ATTESTATION_AND_IMPLEMENTATION_REQUIRED),
    "matching snapshots are not a trusted live authority")
  must(base.copy(monitorOnline = false), R.HOLD_MONITOR_OFFLINE,
    "offline monitor cannot be replaced by cached signature")
  must(base.copy(register = null), R.HOLD_INCOMPLETE_TWO_DOMAIN_COMMIT,
    "checkpoint without CAS is unresolved")
  must(base.copy(checkpoint = null), R.HOLD_INCOMPLETE_TWO_DOMAIN_COMMIT,
    "CAS without checkpoint is unresolved")
  must(base.copy(expectedAccount = ""), R.DENY_ACCOUNT_OR_IDENTITY,
    "blank expected account denied")
  must(base.copy(checkpoint = b.copy(account = UUID.randomUUID().toString())),
    R.DENY_ACCOUNT_OR_IDENTITY, "checkpoint cross-account mixing denied")
  must(base.copy(checkpoint = b.copy(epoch = UUID.randomUUID())),
    R.DENY_ACCOUNT_OR_IDENTITY, "checkpoint epoch substitution denied")
  must(base.copy(pinnedEpoch = UUID.randomUUID()),
    R.DENY_ACCOUNT_OR_IDENTITY, "mismatched out-of-band epoch denied")
  must(base.copy(checkpoint = b.copy(operation = UUID.randomUUID())),
    R.DENY_OPERATION_COLLISION, "equal generations but different UUID denied")
  must(base.copy(checkpoint = b.copy(kit = UUID.randomUUID().toString())),
    R.DENY_GENERATION_OR_PAYLOAD_DIVERGENCE,
    "equal generation but different kit denied")
  must(base.copy(checkpoint = b.copy(cipherHashHex = "c".repeat(64))),
    R.DENY_GENERATION_OR_PAYLOAD_DIVERGENCE,
    "equal generation but different ciphertext hash denied")
  must(base.copy(checkpoint = b.copy(generation = 10L)),
    R.DENY_GENERATION_OR_PAYLOAD_DIVERGENCE,
    "different generation denied")
  must(base.copy(lastSeenGeneration = 10L),
    R.DENY_ROLLBACK_FROM_HIGH_WATER,
    "checkpoint below retained high-water denied")
  must(base.copy(lastSeenTreeSize = 18L),
    R.DENY_TREE_TRUNCATION,
    "smaller Merkle tree is not accepted")
  must(base.copy(lastSeenRootHex = "c".repeat(64)),
    R.DENY_EQUIVOCATION_SAME_TREE_SIZE,
    "same tree size with different root denied")
  must(base.copy(checkpoint = b.copy(treeSize = 18L),
    consistencyProofVerifiedFixtureOnly = false),
    R.HOLD_NO_CONSISTENCY_PROOF,
    "tree grew but no consistency proof asserted")
  verify(gate.inspect(base.copy(checkpoint = b.copy(treeSize = 18L),
    consistencyProofVerifiedFixtureOnly = true)) ==
    setOf(R.HOLD_EXTERNAL_ATTESTATION_AND_IMPLEMENTATION_REQUIRED),
    "alleged consistency proof still cannot produce permission")
  must(base.copy(checkpoint = b.copy(cipherHashHex = "Z".repeat(64))),
    R.DENY_MALFORMED_CHECKPOINT, "nonhex ciphertext hash denied")
  must(base.copy(lastSeenTreeSize = 0L),
    R.DENY_MALFORMED_CHECKPOINT, "missing trusted prior tree size denied")
  must(base.copy(register = a.copy(generation = 0L)),
    R.DENY_MALFORMED_CHECKPOINT, "zero generation denied")
  must(base.copy(checkpoint = b.copy(treeRootHex = "0")),
    R.DENY_MALFORMED_CHECKPOINT, "malformed Merkle root denied")
  must(base.copy(externalAdminAndRetentionAsserted = false),
    R.HOLD_NO_INDEPENDENT_ADMIN_OR_RETENTION,
    "same administrator or no locked retention holds")
  must(base.copy(ownerVerifiedFixtureOnly = false),
    R.HOLD_OWNER_NOT_VERIFIED,
    "missing owner authentication holds")
  verify(gate.inspect(base.copy(
    monitorOnline = false,
    checkpoint = b.copy(operation = UUID.randomUUID()),
    ownerVerifiedFixtureOnly = false)).containsAll(setOf(
    R.HOLD_MONITOR_OFFLINE, R.DENY_OPERATION_COLLISION,
    R.HOLD_OWNER_NOT_VERIFIED,
    R.HOLD_EXTERNAL_ATTESTATION_AND_IMPLEMENTATION_REQUIRED)),
    "multiple independent faults stay visible without bypass")
  println("PASS: SEC-05K $checks independent checkpoint two-domain NEGATIVE checks")
  println("LIMIT: proofs and storage are assertions; no immutable checkpoint service is deployed")
}

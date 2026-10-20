package com.negresco.finance.security

import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Device revocation/replay laboratory. Signed device proof, trusted revision
 * anchor, durable atomic writes and Android app integration are NOT present.
 */
internal fun runSyntheticDeviceTrustScenarios() {
  val a = DeviceKeyFingerprint.parse("a".repeat(64))
  val b = DeviceKeyFingerprint.parse("b".repeat(64))
  val first = SyntheticDeviceTrustPolicy.createSyntheticFirstDevice(a)
  val floor = DeviceTrustFloor(1L, 1L)
  fun claim(
    fingerprint: DeviceKeyFingerprint = a,
    revision: Long = 1L,
    epoch: Long = 1L,
    sequence: Long = 1L
  ) = PresentedDeviceOperation(
    fingerprint, revision, epoch, sequence, ProtectedOperation.EXPORT_FINANCIAL_DATA
  )
  fun inspect(
    snapshot: DeviceTrustSnapshot? = first,
    knownFloor: DeviceTrustFloor? = floor,
    presented: PresentedDeviceOperation = claim()
  ) = SyntheticDeviceTrustPolicy.inspect(snapshot, knownFloor, presented)

  // 1. Malformed key digests never act as device identity.
  for (fingerprint in listOf("", "abc", "A".repeat(64), "a".repeat(63),
    "a".repeat(65), "z".repeat(64), " ".repeat(64))) {
    check(runCatching { DeviceKeyFingerprint.parse(fingerprint) }.isFailure)
  }

  // 2. Bootstrap is explicit, no default all-trusted enrollment.
  check(first.active == setOf(a))
  check(first.revoked.isEmpty())
  check(first.lastSequence[a] == 0L)

  // 3. Missing or malformed registry never becomes an empty allow list.
  check(inspect(snapshot = null) == DeviceTrustGate.DENY_MALFORMED_STATE)
  check(inspect(snapshot = first.copy(revision = -1L)) ==
    DeviceTrustGate.DENY_MALFORMED_STATE)
  check(inspect(snapshot = first.copy(epoch = 2L)) ==
    DeviceTrustGate.DENY_MALFORMED_STATE)
  check(inspect(snapshot = first.copy(active = emptySet(), revoked = emptySet())) ==
    DeviceTrustGate.DENY_MALFORMED_STATE)

  // 4. Missing/invalid/out-of-date trusted anchors deny all use.
  check(inspect(knownFloor = null) == DeviceTrustGate.DENY_UNTRUSTED_ANCHOR)
  check(inspect(knownFloor = DeviceTrustFloor(-1L, 0L)) ==
    DeviceTrustGate.DENY_UNTRUSTED_ANCHOR)
  check(inspect(knownFloor = DeviceTrustFloor(2L, 1L)) ==
    DeviceTrustGate.DENY_UNTRUSTED_ANCHOR)
  check(inspect(knownFloor = DeviceTrustFloor(1L, 2L)) ==
    DeviceTrustGate.DENY_UNTRUSTED_ANCHOR)

  // 5. Unknown public-key fingerprint cannot impersonate registered device.
  check(inspect(presented = claim(fingerprint = b)) ==
    DeviceTrustGate.DENY_UNKNOWN_DEVICE)

  // 6. Stale epoch is denied even with fresh local UI/biometric state.
  check(inspect(presented = claim(epoch = 0L)) ==
    DeviceTrustGate.DENY_STALE_EPOCH)

  // 7. Registry revision must match exactly (prevents old op replay).
  check(inspect(presented = claim(revision = 0L)) ==
    DeviceTrustGate.DENY_STALE_REGISTRY_REVISION)

  // 8. Nonpositive sequence and MAX_VALUE are never consumed.
  for (seq in listOf(-1L, 0L, Long.MIN_VALUE, Long.MAX_VALUE)) {
    check(inspect(presented = claim(sequence = seq)) ==
      DeviceTrustGate.DENY_REPLAY_OR_INVALID_SEQUENCE)
  }

  // 9. Preflight never authorizes a financial operation.
  check(inspect() == DeviceTrustGate.PROCEED_TO_INDEPENDENT_NATIVE_VERIFICATION)

  // 10. Missing independent proof cannot consume a valid sequence.
  val coordinator = SyntheticDeviceTrustCoordinator(first)
  check(coordinator.simulateRecordingAfterExternalProof(claim(), floor, false) ==
    DeviceTrustGate.DENY_EXTERNAL_PROOF_MISSING)
  check(coordinator.snapshotForLabOnly().lastSequence[a] == 0L)

  // 11. Synthetic post-proof commit consumes exactly one sequence.
  check(coordinator.simulateRecordingAfterExternalProof(claim(), floor, true) ==
    DeviceTrustGate.SYNTHETIC_SEQUENCE_RECORDED)
  check(coordinator.snapshotForLabOnly().lastSequence[a] == 1L)

  // 12. Reuse of the exact operation counter is replay, not new authorization.
  check(coordinator.preflight(claim(), floor) ==
    DeviceTrustGate.DENY_REPLAY_OR_INVALID_SEQUENCE)
  check(coordinator.simulateRecordingAfterExternalProof(claim(), floor, true) ==
    DeviceTrustGate.DENY_REPLAY_OR_INVALID_SEQUENCE)
  check(coordinator.simulateRecordingAfterExternalProof(claim(sequence = 2L), floor, true) ==
    DeviceTrustGate.SYNTHETIC_SEQUENCE_RECORDED)

  // 13. Denied revocation does not mutate the existing sequence/epoch.
  check(coordinator.simulateRevocationAfterExternalProof(a, floor, false) ==
    DeviceTrustGate.DENY_EXTERNAL_PROOF_MISSING)
  check(coordinator.snapshotForLabOnly().epoch == 1L)
  check(coordinator.snapshotForLabOnly().lastSequence[a] == 2L)

  // 14. Verified synthetic revocation advances epoch/revision atomically.
  check(coordinator.simulateRevocationAfterExternalProof(a, floor, true) ==
    DeviceTrustGate.SYNTHETIC_DEVICE_REVOKED)
  val revoked = coordinator.snapshotForLabOnly()
  check(revoked.revision == 2L && revoked.epoch == 2L)
  check(a in revoked.revoked && a !in revoked.active)
  check(a !in revoked.lastSequence)

  // 15. Last-device removal is a locked state, never auto-reenrollment.
  check(coordinator.preflight(claim(sequence = 3L), floor) ==
    DeviceTrustGate.DENY_REVOKED)
  check(coordinator.simulateRevocationAfterExternalProof(a, floor, true) ==
    DeviceTrustGate.DENY_REVOKED)
  check(coordinator.simulateRevocationAfterExternalProof(b, floor, true) ==
    DeviceTrustGate.DENY_UNKNOWN_DEVICE)
  check(revoked == coordinator.snapshotForLabOnly())

  // 16. A previous registry snapshot cannot satisfy a newer trusted floor.
  check(inspect(snapshot = first, knownFloor = DeviceTrustFloor(2L, 2L)) ==
    DeviceTrustGate.DENY_UNTRUSTED_ANCHOR)

  // 17. Contradictory registry state and forged sequence entries fail closed.
  check(inspect(snapshot = first.copy(revoked = setOf(a))) ==
    DeviceTrustGate.DENY_MALFORMED_STATE)
  check(inspect(snapshot = first.copy(lastSequence = mapOf(b to 2L))) ==
    DeviceTrustGate.DENY_MALFORMED_STATE)
  check(inspect(snapshot = first.copy(lastSequence = mapOf(a to -2L))) ==
    DeviceTrustGate.DENY_MALFORMED_STATE)

  // 18. Counter acceptance is atomic IN THIS PROCESS. External-proof Boolean
  // is a synthetic placeholder, not a real signature or device attestation.
  val racing = SyntheticDeviceTrustCoordinator(first)
  val pool = Executors.newFixedThreadPool(8)
  val start = CountDownLatch(1)
  try {
    val outcomes = (1..16).map {
      pool.submit<DeviceTrustGate> {
        start.await()
        racing.simulateRecordingAfterExternalProof(claim(), floor, true)
      }
    }
    start.countDown()
    val results = outcomes.map { it.get(10L, TimeUnit.SECONDS) }
    check(results.count { it == DeviceTrustGate.SYNTHETIC_SEQUENCE_RECORDED } == 1)
    check(results.count { it == DeviceTrustGate.DENY_REPLAY_OR_INVALID_SEQUENCE } == 15)
    check(racing.snapshotForLabOnly().lastSequence[a] == 1L)
  } finally {
    pool.shutdownNow()
  }

  // 19. 256 combinations of revision/epoch/identity/sequence/anchor inputs.
  // No untrusted combination can reach the native proof gate.
  for (mask in 0 until 256) {
    val current = first.copy(
      revision = if (mask and 1 != 0) 1L else 0L,
      epoch = if (mask and 2 != 0) 1L else 0L,
      active = if (mask and 4 != 0) setOf(a) else emptySet(),
      revoked = if (mask and 8 != 0) setOf(a) else emptySet()
    )
    val anchor = if (mask and 16 != 0) floor else null
    val c = claim(
      fingerprint = if (mask and 32 != 0) a else b,
      revision = if (mask and 64 != 0) 1L else 0L,
      sequence = if (mask and 128 != 0) 1L else 0L
    )
    val result = inspect(current, anchor, c)
    val allValid = current.revision == 1L && current.epoch == 1L &&
      current.active == setOf(a) && current.revoked.isEmpty() &&
      anchor != null && c.fingerprint == a &&
      c.registryRevision == 1L && c.sequence == 1L
    if (allValid) check(result == DeviceTrustGate.PROCEED_TO_INDEPENDENT_NATIVE_VERIFICATION)
    else check(result != DeviceTrustGate.PROCEED_TO_INDEPENDENT_NATIVE_VERIFICATION)
  }

  // 20. A verified signature, monotonic durable anchor and replay storage
  // remain required: this preflight never returns an unlock token.
  check(DeviceTrustGate.entries.none { it.name == "ALLOW" || it.name == "UNLOCKED" })
  // 21. Caller-owned mutable collections cannot rewrite the stored registry.
  val mutableActive = mutableSetOf(a)
  val mutableSequences = mutableMapOf(a to 0L)
  val supplied = first.copy(active = mutableActive, lastSequence = mutableSequences)
  val isolated = SyntheticDeviceTrustCoordinator(supplied)
  mutableActive.clear()
  mutableSequences[a] = Long.MAX_VALUE
  check(isolated.preflight(claim(), floor) ==
    DeviceTrustGate.PROCEED_TO_INDEPENDENT_NATIVE_VERIFICATION)
  check(isolated.snapshotForLabOnly().lastSequence[a] == 0L)
  check(isolated.snapshotForLabOnly().active == setOf(a))

  println("PASS: 21 device trust/replay scenarios and 256 synthetic state combinations (JVM only)")
}

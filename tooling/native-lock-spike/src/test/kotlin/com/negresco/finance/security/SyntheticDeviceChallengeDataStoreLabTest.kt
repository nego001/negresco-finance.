package com.negresco.finance.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.mutablePreferencesOf
import androidx.datastore.preferences.core.toMutablePreferences
import java.io.File
import java.nio.file.Files
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.Signature
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.coroutineScope

/** A disposable, real Jetpack DataStore file on JVM (never a financial DB). */
private class SyntheticLedgerHarness(file: File) {
  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  val raw: DataStore<Preferences> = PreferenceDataStoreFactory.create(scope = scope) { file }
  val ledger = SyntheticDeviceChallengeDataStoreLab(raw)
  suspend fun close() { scope.coroutineContext[Job]!!.cancelAndJoin() }
}

private fun ledgerSign(pair: KeyPair, claim: PresentedDeviceOperation, nonce: ByteArray): ByteArray {
  val verifierInput = SyntheticSignedDeviceProofLab.canonicalPayload(claim, nonce)
  val signer = Signature.getInstance("Ed25519")
  signer.initSign(pair.private)
  signer.update(verifierInput)
  return signer.sign()
}

internal suspend fun runSyntheticDeviceLedgerScenarios() {
  val pair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val other = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val id = SyntheticSignedDeviceProofLab.fingerprint(pair.public)!!
  val floor = DeviceTrustFloor(1L, 1L)
  fun claim(sequence: Long = 1L, operation: ProtectedOperation =
    ProtectedOperation.EXPORT_FINANCIAL_DATA) =
    PresentedDeviceOperation(id, 1L, 1L, sequence, operation)
  suspend fun withFile(body: suspend (File) -> Unit) {
    val dir = Files.createTempDirectory("negresco-device-ledger-").toFile()
    try { body(File(dir, "ledger.preferences_pb")) }
    finally { check(dir.deleteRecursively()) }
  }

  // 1. Empty storage never enrolls a device or opens a session by default.
  withFile { file ->
    val h = SyntheticLedgerHarness(file)
    try {
      check(h.ledger.read() == null)
      check(runCatching {
        h.ledger.issue(claim(), floor)
      }.exceptionOrNull() is InvalidSyntheticDeviceLedger)
    } finally { h.close() }
  }

  // 2. Bootstrap must be explicit and cannot overwrite an enrolled key.
  withFile { file ->
    val h = SyntheticLedgerHarness(file)
    try {
      val view = h.ledger.seedForDisposableLab(id)
      check(view.fingerprint == id && view.lastSequence == 0L)
      check(runCatching { h.ledger.seedForDisposableLab(id) }.isFailure)
    } finally { h.close() }
  }

  // 3. Challenge persists after closing DataStore and reopening the same file.
  withFile { file ->
    val h = SyntheticLedgerHarness(file)
    val issued = try {
      h.ledger.seedForDisposableLab(id)
      h.ledger.issue(claim(), floor)
    } finally { h.close() }
    val reopened = SyntheticLedgerHarness(file)
    try {
      check(reopened.ledger.read()!!.pending!!.nonceCopy().contentEquals(issued.nonceCopy()))
      check(reopened.ledger.read()!!.pending!!.claim == claim())
      val sig = ledgerSign(pair, claim(), issued.nonceCopy())
      val accepted = reopened.ledger.consume(claim(), floor, pair.public,
        issued.nonceCopy(), sig)
      check(accepted.pending == null && accepted.lastSequence == 1L)
    } finally { reopened.close() }
  }

  // 4. The consumed counter survives a second restart; replay is denied.
  withFile { file ->
    val first = SyntheticLedgerHarness(file)
    val issued = try {
      first.ledger.seedForDisposableLab(id)
      val p = first.ledger.issue(claim(), floor)
      first.ledger.consume(claim(), floor, pair.public, p.nonceCopy(),
        ledgerSign(pair, claim(), p.nonceCopy()))
      p
    } finally { first.close() }
    val second = SyntheticLedgerHarness(file)
    try {
      check(second.ledger.read()!!.lastSequence == 1L)
      check(second.ledger.read()!!.pending == null)
      check(runCatching { second.ledger.consume(claim(), floor, pair.public,
        issued.nonceCopy(), ledgerSign(pair, claim(), issued.nonceCopy())) }
        .exceptionOrNull() is StaleSyntheticDeviceLedger)
    } finally { second.close() }
  }

  // 5. Wrong public key/fingerprint never consumes a challenge.
  withFile { file ->
    val h = SyntheticLedgerHarness(file)
    try {
      h.ledger.seedForDisposableLab(id)
      val p = h.ledger.issue(claim(), floor)
      check(runCatching { h.ledger.consume(claim(), floor, other.public,
        p.nonceCopy(), ledgerSign(pair, claim(), p.nonceCopy())) }
        .exceptionOrNull() is UnverifiedSyntheticDeviceProof)
      check(h.ledger.read()!!.pending != null)
      check(h.ledger.read()!!.lastSequence == 0L)
    } finally { h.close() }
  }

  // 6. Valid enrolled key with wrong signature cannot consume challenge.
  withFile { file ->
    val h = SyntheticLedgerHarness(file)
    try {
      h.ledger.seedForDisposableLab(id)
      val p = h.ledger.issue(claim(), floor)
      check(runCatching { h.ledger.consume(claim(), floor, pair.public,
        p.nonceCopy(), ledgerSign(other, claim(), p.nonceCopy())) }
        .exceptionOrNull() is UnverifiedSyntheticDeviceProof)
      check(h.ledger.read()!!.lastSequence == 0L)
    } finally { h.close() }
  }

  // 7. Different operation/sequence is not exchangeable with pending challenge.
  withFile { file ->
    val h = SyntheticLedgerHarness(file)
    try {
      h.ledger.seedForDisposableLab(id)
      val p = h.ledger.issue(claim(), floor)
      val mismatched = claim(operation = ProtectedOperation.REVOKE_DEVICE)
      check(runCatching { h.ledger.consume(mismatched, floor, pair.public,
        p.nonceCopy(), ledgerSign(pair, mismatched, p.nonceCopy())) }
        .exceptionOrNull() is StaleSyntheticDeviceLedger)
      check(runCatching { h.ledger.consume(claim(sequence = 2L), floor,
        pair.public, p.nonceCopy(), null) }
        .exceptionOrNull() is StaleSyntheticDeviceLedger)
      check(h.ledger.read()!!.pending != null)
    } finally { h.close() }
  }

  // 8. Unknown/incorrect challenge (even with a valid signature) is rejected.
  withFile { file ->
    val h = SyntheticLedgerHarness(file)
    try {
      h.ledger.seedForDisposableLab(id)
      val p = h.ledger.issue(claim(), floor)
      val wrong = p.nonceCopy().also { it[0] = (it[0].toInt() xor 1).toByte() }
      check(runCatching { h.ledger.consume(claim(), floor, pair.public, wrong,
        ledgerSign(pair, claim(), wrong)) }
        .exceptionOrNull() is UnverifiedSyntheticDeviceProof)
      check(h.ledger.read()!!.lastSequence == 0L)
    } finally { h.close() }
  }

  // 9. A second pending challenge cannot overwrite the first.
  withFile { file ->
    val h = SyntheticLedgerHarness(file)
    try {
      h.ledger.seedForDisposableLab(id)
      val first = h.ledger.issue(claim(), floor)
      check(runCatching { h.ledger.issue(claim(sequence = 2L), floor) }
        .exceptionOrNull() is PendingSyntheticDeviceChallenge)
      check(h.ledger.read()!!.pending!!.nonceCopy().contentEquals(first.nonceCopy()))
    } finally { h.close() }
  }

  // 10. Concurrent valid consumers commit exactly one transaction.
  withFile { file ->
    val h = SyntheticLedgerHarness(file)
    try {
      h.ledger.seedForDisposableLab(id)
      val p = h.ledger.issue(claim(), floor)
      val sig = ledgerSign(pair, claim(), p.nonceCopy())
      val results = coroutineScope {
        val attempts = (1..12).map {
          async(Dispatchers.IO) { runCatching {
            h.ledger.consume(claim(), floor, pair.public, p.nonceCopy(), sig)
          } }
        }
        attempts.map { it.await() }
      }
      check(results.count { it.isSuccess } == 1)
      check(results.count { it.exceptionOrNull() is StaleSyntheticDeviceLedger } == 11)
      check(h.ledger.read()!!.lastSequence == 1L)
    } finally { h.close() }
  }

  // 11. Corruption in any required policy field fails closed.
  withFile { file ->
    val h = SyntheticLedgerHarness(file)
    try {
      h.raw.updateData {
        mutablePreferencesOf(SyntheticDeviceLedgerKeys.lastSequence to 4L)
      }
      check(runCatching { h.ledger.read() }.exceptionOrNull()
        is InvalidSyntheticDeviceLedger)
      check(runCatching { h.ledger.seedForDisposableLab(id) }.exceptionOrNull()
        is InvalidSyntheticDeviceLedger)
    } finally { h.close() }
  }

  // 12. Invalid trusted revision/epoch floor denies new challenges.
  withFile { file ->
    val h = SyntheticLedgerHarness(file)
    try {
      h.ledger.seedForDisposableLab(id)
      check(runCatching { h.ledger.issue(claim(), null) }
        .exceptionOrNull() is StaleSyntheticDeviceLedger)
      check(runCatching { h.ledger.issue(claim(), DeviceTrustFloor(2L, 2L)) }
        .exceptionOrNull() is StaleSyntheticDeviceLedger)
      check(h.ledger.read()!!.pending == null)
    } finally { h.close() }
  }

  // 13. Invalid pending nonce/operation is never auto-repaired.
  withFile { file ->
    val h = SyntheticLedgerHarness(file)
    try {
      h.ledger.seedForDisposableLab(id)
      h.raw.updateData { before -> before.toMutablePreferences().apply {
        this[SyntheticDeviceLedgerKeys.challengeHex] = "bad"
        this[SyntheticDeviceLedgerKeys.challengeAction] = "EXPORT_FINANCIAL_DATA"
        this[SyntheticDeviceLedgerKeys.challengeSequence] = 1L
      } }
      check(runCatching { h.ledger.read() }.exceptionOrNull()
        is InvalidSyntheticDeviceLedger)
    } finally { h.close() }
  }

  // 14. Replayed file with lower revision can only be denied if independent
  // anchor is preserved elsewhere. Explicitly show this dependency.
  withFile { file ->
    val h = SyntheticLedgerHarness(file)
    try {
      h.ledger.seedForDisposableLab(id)
      check(runCatching { h.ledger.issue(claim(), DeviceTrustFloor(4L, 4L)) }
        .exceptionOrNull() is StaleSyntheticDeviceLedger)
    } finally { h.close() }
  }
  println("PASS: 14 durable DataStore device challenge/replay lab scenarios (JVM, rollback anchor NOT implemented)")
}

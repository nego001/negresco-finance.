package com.negresco.finance.security

import android.util.AtomicFile
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileNotFoundException
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.MessageDigest

/**
 * ANDROID INSTRUMENTATION ONLY. Disposable second local AtomicFile to detect
 * unilateral rollback of a synthetic migration checkpoint. It is NOT a secure
 * counter or an anti-rollback authority: restoring BOTH files is undetectable.
 *
 * A witness is committed BEFORE the next journal checkpoint. If the process
 * dies between those writes, pair inspection returns DENY, never ALLOW.
 * Never reads legacy preferences, real account data, passwords or financial DBs.
 */
internal class SyntheticJournalIndependentWitness(private val sandbox: File) {
  private val journal = File(sandbox, "synthetic-migration.journal")
  private val witnessFile = File(sandbox, "synthetic-migration.witness")
  private val witness = AtomicFile(witnessFile)
  private val steps = setOf(
    "INTENT_RECORDED", "SOURCE_BACKED_UP", "NATIVE_STAGED",
    "SOURCE_RETIRE_REQUESTED", "FINALIZED_UNVERIFIED"
  )

  init {
    require(sandbox.isDirectory && sandbox.name.startsWith("negresco_synthetic_atomic_")) {
      "Only a disposable synthetic AtomicFile test sandbox is permitted"
    }
  }

  private fun sha(input: ByteArray): String =
    MessageDigest.getInstance("SHA-256").digest(input)
      .joinToString("") { "%02x".format(it.toInt() and 0xff) }

  private fun canonicalJournal(sequence: Long, step: String): ByteArray {
    val payload = "v1|$sequence|$step"
    return "$payload|${sha(payload.toByteArray(Charsets.UTF_8))}"
      .toByteArray(Charsets.UTF_8)
  }

  /**
   * The test caller must then invoke SyntheticAtomicMigrationJournal.writeCheckpoint.
   * No attempt is made to repair mismatches automatically.
   */
  fun stageExpectedCheckpoint(sequence: Long, step: String): String {
    if (sequence !in 1L..1_000_000L || step !in steps)
      return "DENY_SYNTHETIC_WITNESS_INVALID"
    val journalDigest = sha(canonicalJournal(sequence, step))
    val payload = "w1|$sequence|$step|$journalDigest"
    val bytes = "$payload|${sha(payload.toByteArray(Charsets.UTF_8))}"
      .toByteArray(Charsets.UTF_8)
    var stream: java.io.FileOutputStream? = null
    return try {
      stream = witness.startWrite()
      stream.write(bytes)
      witness.finishWrite(stream)
      "HOLD_SYNTHETIC_WITNESS_STAGED_NOT_AUTHORITY"
    } catch (_: Exception) {
      if (stream != null) witness.failWrite(stream)
      "DENY_SYNTHETIC_WITNESS_WRITE"
    }
  }

  // AtomicFile.openRead handles an interrupted .new/.bak as Android specifies.
  // Bounded reads never accept a large attacker-controlled checkpoint.
  private fun readBounded(atomic: AtomicFile): ByteArray? {
    return atomic.openRead().use { input ->
      val out = ByteArrayOutputStream()
      val chunk = ByteArray(128)
      while (true) {
        val n = input.read(chunk)
        if (n < 0) break
        if (out.size() + n > 256) throw IllegalArgumentException("oversize")
        out.write(chunk, 0, n)
      }
      out.toByteArray()
    }
  }

  private fun decode(bytes: ByteArray): String =
    Charsets.UTF_8.newDecoder()
      .onMalformedInput(CodingErrorAction.REPORT)
      .onUnmappableCharacter(CodingErrorAction.REPORT)
      .decode(ByteBuffer.wrap(bytes)).toString()

  fun inspectPair(): String {
    val journalBytes = try {
      readBounded(AtomicFile(journal))
    } catch (_: FileNotFoundException) {
      null
    } catch (_: IllegalArgumentException) {
      return "DENY_SYNTHETIC_PAIR_OVERSIZE"
    } catch (_: Exception) {
      return "DENY_SYNTHETIC_PAIR_IO"
    }
    val witnessBytes = try {
      readBounded(witness)
    } catch (_: FileNotFoundException) {
      null
    } catch (_: IllegalArgumentException) {
      return "DENY_SYNTHETIC_PAIR_OVERSIZE"
    } catch (_: Exception) {
      return "DENY_SYNTHETIC_PAIR_IO"
    }
    if (journalBytes == null && witnessBytes == null)
      return "HOLD_SYNTHETIC_PAIR_ABSENT"
    if (journalBytes == null || witnessBytes == null)
      return "DENY_SYNTHETIC_PAIR_INCOMPLETE"

    val raw = try { decode(witnessBytes) }
      catch (_: Exception) { return "DENY_SYNTHETIC_WITNESS_MALFORMED" }
    val parts = raw.split("|")
    if (parts.size != 5 || parts[0] != "w1")
      return "DENY_SYNTHETIC_WITNESS_MALFORMED"
    val sequence = parts[1].toLongOrNull()
    if (sequence == null || sequence !in 1L..1_000_000L ||
      parts[2] !in steps ||
      !parts[3].matches(Regex("[a-f0-9]{64}")) ||
      !parts[4].matches(Regex("[a-f0-9]{64}")))
      return "DENY_SYNTHETIC_WITNESS_MALFORMED"

    val witnessPayload = parts.take(4).joinToString("|").toByteArray(Charsets.UTF_8)
    val computedWitness = sha(witnessPayload).toByteArray(Charsets.US_ASCII)
    if (!MessageDigest.isEqual(parts[4].toByteArray(Charsets.US_ASCII), computedWitness))
      return "DENY_SYNTHETIC_WITNESS_CORRUPT"

    val expectedJournal = canonicalJournal(sequence, parts[2])
    if (!MessageDigest.isEqual(
        parts[3].toByteArray(Charsets.US_ASCII),
        sha(expectedJournal).toByteArray(Charsets.US_ASCII)))
      return "DENY_SYNTHETIC_WITNESS_CORRUPT"

    if (!MessageDigest.isEqual(journalBytes, expectedJournal))
      return "DENY_SYNTHETIC_PAIR_MISMATCH"

    // BOTH files can be restored together. Matching never grants authority.
    return "HOLD_SYNTHETIC_PAIR_MATCH_NOT_AUTHORITY"
  }
}

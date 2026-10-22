package com.negresco.finance.security

import android.util.AtomicFile
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest

/**
 * ANDROID-TEST SOURCE SET ONLY. Not included in the release application.
 *
 * Synthetic local crash/durability harness: no actual legacy preferences,
 * migration, owner attestation, passwords or banking information. AtomicFile
 * provides a bounded, fsynced replace of one fixture checkpoint. SHA-256 is
 * UNKEYED and checks accidental corruption only, NOT authenticity/rollback.
 *
 * All public results here are HOLD_* / DENY_*. Nothing grants access.
 */
internal class SyntheticAtomicMigrationJournal(private val fixtureFile: File) {
  private val atomic = AtomicFile(fixtureFile)
  private val supportedSteps = setOf(
    "INTENT_RECORDED", "SOURCE_BACKED_UP", "NATIVE_STAGED",
    "SOURCE_RETIRE_REQUESTED", "FINALIZED_UNVERIFIED"
  )

  init {
    require(fixtureFile.name == "synthetic-migration.journal") {
      "Only disposable synthetic journal fixture names are allowed"
    }
  }

  private fun hexSha256(s: String): String =
    MessageDigest.getInstance("SHA-256")
      .digest(s.toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it.toInt() and 0xff) }

  fun writeCheckpoint(sequence: Long, step: String): String {
    if (sequence < 1 || sequence > 1_000_000 || step !in supportedSteps)
      return "DENY_SYNTHETIC_INVALID_CHECKPOINT"
    val payload = "v1|$sequence|$step"
    val bytes = "$payload|${hexSha256(payload)}".toByteArray(Charsets.UTF_8)
    var opened: java.io.FileOutputStream? = null
    return try {
      opened = atomic.startWrite()
      opened.write(bytes)
      atomic.finishWrite(opened)
      "HOLD_SYNTHETIC_CHECKPOINT_WRITTEN_NOT_AUTHORITY"
    } catch (_: Exception) {
      if (opened != null) atomic.failWrite(opened)
      "DENY_SYNTHETIC_WRITE_FAILED"
    }
  }

  /** Fault injection: creates an uncommitted .new file, NEVER a new checkpoint. */
  fun interruptWriteBeforeCommit(sequence: Long, step: String): String {
    if (sequence < 1 || sequence > 1_000_000 || step !in supportedSteps)
      return "DENY_SYNTHETIC_INVALID_CHECKPOINT"
    var opened: java.io.FileOutputStream? = null
    return try {
      opened = atomic.startWrite()
      val payload = "v1|$sequence|$step"
      opened.write("$payload|${hexSha256(payload)}".toByteArray(Charsets.UTF_8))
      // Equivalent to a failed write, NOT a real kill -9 / system reboot.
      atomic.failWrite(opened)
      "HOLD_SYNTHETIC_WRITE_ABORTED"
    } catch (_: Exception) {
      if (opened != null) atomic.failWrite(opened)
      "DENY_SYNTHETIC_WRITE_FAILED"
    }
  }

  /** Reopen from disk: uses bounded read and *never* returns ALLOW. */
  fun inspectExisting(): String {
    val bytes = try {
      atomic.openRead().use { input ->
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(128)
        while (true) {
          val n = input.read(buffer)
          if (n < 0) break
          if (output.size() + n > 256) return "DENY_SYNTHETIC_JOURNAL_OVERSIZE"
          output.write(buffer, 0, n)
        }
        output.toByteArray()
      }
    } catch (_: java.io.FileNotFoundException) {
      return "HOLD_SYNTHETIC_JOURNAL_ABSENT"
    } catch (_: Exception) {
      return "DENY_SYNTHETIC_JOURNAL_IO"
    }
    val raw = try {
      Charsets.UTF_8.newDecoder().decode(java.nio.ByteBuffer.wrap(bytes)).toString()
    } catch (_: Exception) {
      return "DENY_SYNTHETIC_JOURNAL_MALFORMED"
    }
    val parts = raw.split("|")
    val sequence = parts.getOrNull(1)?.toLongOrNull()
    if (parts.size != 4 || parts[0] != "v1" ||
      sequence == null || sequence !in 1L..1_000_000L ||
      parts[2] !in supportedSteps ||
      parts[3].length != 64 || !parts[3].matches(Regex("[a-f0-9]{64}")))
      return "DENY_SYNTHETIC_JOURNAL_MALFORMED"
    val payload = parts.take(3).joinToString("|")
    val expected = hexSha256(payload)
    if (!MessageDigest.isEqual(
        parts[3].toByteArray(Charsets.US_ASCII),
        expected.toByteArray(Charsets.US_ASCII)))
      return "DENY_SYNTHETIC_JOURNAL_CORRUPT"
    // Even a valid checksum and FINALIZED_UNVERIFIED is NOT authorization.
    return "HOLD_SYNTHETIC_JOURNAL_READ_NOT_AUTHORITY"
  }
}

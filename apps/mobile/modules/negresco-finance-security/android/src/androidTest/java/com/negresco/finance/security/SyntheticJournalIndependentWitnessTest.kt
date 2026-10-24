package com.negresco.finance.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.UUID
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * All samples live in a disposable no-backup directory. No legacy app
 * migration, finance, account, real process kill or trusted remote counter.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticJournalIndependentWitnessTest {
  private lateinit var root: File
  private lateinit var journalFile: File
  private lateinit var witnessFile: File

  @Before fun setup() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    root = File(context.noBackupFilesDir,
      "negresco_synthetic_atomic_${UUID.randomUUID()}")
    assertTrue(root.mkdir())
    journalFile = File(root, "synthetic-migration.journal")
    witnessFile = File(root, "synthetic-migration.witness")
  }

  @After fun cleanup() {
    assertTrue("delete only test fixture directory", root.deleteRecursively())
  }

  private fun journal() = SyntheticAtomicMigrationJournal(journalFile)
  private fun marker() = SyntheticJournalIndependentWitness(root)
  private fun stageAndWrite(sequence: Long, step: String) {
    assertEquals("HOLD_SYNTHETIC_WITNESS_STAGED_NOT_AUTHORITY",
      marker().stageExpectedCheckpoint(sequence, step))
    assertEquals("HOLD_SYNTHETIC_CHECKPOINT_WRITTEN_NOT_AUTHORITY",
      journal().writeCheckpoint(sequence, step))
  }

  @Test fun missingPairRemainsHoldAndWritesNothing() {
    assertEquals("HOLD_SYNTHETIC_PAIR_ABSENT", marker().inspectPair())
    assertTrue(root.listFiles().orEmpty().isEmpty())
  }

  @Test fun committedPairSurvivesReinstantiatingIndependentReaders() {
    stageAndWrite(1L, "INTENT_RECORDED")
    assertEquals("HOLD_SYNTHETIC_PAIR_MATCH_NOT_AUTHORITY",
      SyntheticJournalIndependentWitness(root).inspectPair())
    assertEquals("HOLD_SYNTHETIC_JOURNAL_READ_NOT_AUTHORITY",
      SyntheticAtomicMigrationJournal(journalFile).inspectExisting())
  }

  @Test fun crashWindowAfterWitnessBeforeJournalFailsClosed() {
    stageAndWrite(1L, "INTENT_RECORDED")
    assertEquals("HOLD_SYNTHETIC_WITNESS_STAGED_NOT_AUTHORITY",
      marker().stageExpectedCheckpoint(2L, "SOURCE_BACKED_UP"))
    assertEquals("HOLD_SYNTHETIC_WRITE_ABORTED",
      journal().interruptWriteBeforeCommit(2L, "SOURCE_BACKED_UP"))
    assertEquals("DENY_SYNTHETIC_PAIR_MISMATCH",
      SyntheticJournalIndependentWitness(root).inspectPair())
    // This injects an AtomicFile failWrite, NOT process kill/OS reboot.
  }

  @Test fun olderValidJournalRestoredAloneIsDetected() {
    stageAndWrite(1L, "INTENT_RECORDED")
    val old = journalFile.readBytes()
    stageAndWrite(3L, "NATIVE_STAGED")
    journalFile.writeBytes(old) // fixture-only unilateral rollback
    assertEquals("DENY_SYNTHETIC_PAIR_MISMATCH",
      SyntheticJournalIndependentWitness(root).inspectPair())
  }

  @Test fun olderWitnessRestoredAloneIsDetected() {
    stageAndWrite(1L, "INTENT_RECORDED")
    val old = witnessFile.readBytes()
    stageAndWrite(3L, "NATIVE_STAGED")
    witnessFile.writeBytes(old)
    assertEquals("DENY_SYNTHETIC_PAIR_MISMATCH", marker().inspectPair())
  }

  @Test fun witnessOnlyOrJournalOnlyIsDenied() {
    marker().stageExpectedCheckpoint(1L, "INTENT_RECORDED")
    assertEquals("DENY_SYNTHETIC_PAIR_INCOMPLETE", marker().inspectPair())
    witnessFile.delete()
    journal().writeCheckpoint(1L, "INTENT_RECORDED")
    assertEquals("DENY_SYNTHETIC_PAIR_INCOMPLETE", marker().inspectPair())
  }

  @Test fun tamperingTruncationAndOversizeWitnessFailClosed() {
    stageAndWrite(2L, "SOURCE_BACKED_UP")
    witnessFile.writeText("w1|2|SOURCE_BACKED_UP|bad")
    assertEquals("DENY_SYNTHETIC_WITNESS_MALFORMED", marker().inspectPair())
    stageAndWrite(2L, "SOURCE_BACKED_UP")
    witnessFile.writeText(witnessFile.readText().replace("SOURCE_BACKED_UP", "NATIVE_STAGED"))
    assertEquals("DENY_SYNTHETIC_WITNESS_CORRUPT", marker().inspectPair())
    witnessFile.writeBytes(ByteArray(300) { 65 })
    assertEquals("DENY_SYNTHETIC_PAIR_OVERSIZE", marker().inspectPair())
    witnessFile.writeBytes(byteArrayOf(0xC3.toByte(), 0x28))
    assertEquals("DENY_SYNTHETIC_WITNESS_MALFORMED", marker().inspectPair())
  }

  @Test fun matchingChecksumDoesNotMakeInvalidOrAlteredJournalTrusted() {
    stageAndWrite(3L, "NATIVE_STAGED")
    journalFile.writeText("v1|3|SOURCE_BACKED_UP|deadbeef")
    assertEquals("DENY_SYNTHETIC_PAIR_MISMATCH", marker().inspectPair())
    assertEquals("DENY_SYNTHETIC_WITNESS_INVALID",
      marker().stageExpectedCheckpoint(1L, "UNLOCKED"))
  }

  @Test fun completeRollbackOfBothLocalFilesIsStillUndetectable() {
    stageAndWrite(1L, "INTENT_RECORDED")
    val journalOld = journalFile.readBytes()
    val witnessOld = witnessFile.readBytes()
    stageAndWrite(4L, "SOURCE_RETIRE_REQUESTED")
    // Attack restores the whole local no-backup directory snapshot.
    journalFile.writeBytes(journalOld)
    witnessFile.writeBytes(witnessOld)
    assertEquals("HOLD_SYNTHETIC_PAIR_MATCH_NOT_AUTHORITY", marker().inspectPair())
    // A remote/hardware anchored generation is required to detect this.
    // Crucially, MATCH never becomes ALLOW.
  }
}

package com.negresco.finance.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.UUID
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Real Android AtomicFile writes in a random, disposable no-backup sandbox.
 * No production app preferences, financial records, real crash, or keys.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticAtomicMigrationJournalTest {
  private lateinit var sandbox: File
  private lateinit var fixture: File

  @Before fun setup() {
    val app = InstrumentationRegistry.getInstrumentation().targetContext
    sandbox = File(app.noBackupFilesDir, "negresco_synthetic_atomic_${UUID.randomUUID()}")
    assertTrue(sandbox.mkdir())
    fixture = File(sandbox, "synthetic-migration.journal")
  }

  @After fun teardown() {
    assertTrue("only disposable test sandbox may be deleted", sandbox.deleteRecursively())
  }

  @Test fun missingJournalIsHoldAndDoesNotProvisionAnything() {
    assertEquals("HOLD_SYNTHETIC_JOURNAL_ABSENT",
      SyntheticAtomicMigrationJournal(fixture).inspectExisting())
    assertFalse(fixture.exists())
  }

  @Test fun checkpointSurvivesRecreatingReaderButStillDoesNotGrantAccess() {
    val first = SyntheticAtomicMigrationJournal(fixture)
    assertEquals("HOLD_SYNTHETIC_CHECKPOINT_WRITTEN_NOT_AUTHORITY",
      first.writeCheckpoint(1L, "INTENT_RECORDED"))
    val reopened = SyntheticAtomicMigrationJournal(fixture)
    assertEquals("HOLD_SYNTHETIC_JOURNAL_READ_NOT_AUTHORITY", reopened.inspectExisting())
    assertTrue(fixture.readText().contains("INTENT_RECORDED"))
  }

  @Test fun interruptedWriteRetainsLastCommittedFixture() {
    val first = SyntheticAtomicMigrationJournal(fixture)
    assertEquals("HOLD_SYNTHETIC_CHECKPOINT_WRITTEN_NOT_AUTHORITY",
      first.writeCheckpoint(1L, "INTENT_RECORDED"))
    val original = fixture.readBytes().copyOf()
    assertEquals("HOLD_SYNTHETIC_WRITE_ABORTED",
      first.interruptWriteBeforeCommit(2L, "NATIVE_STAGED"))
    assertTrue("abort restores the last committed bytes",
      original.contentEquals(fixture.readBytes()))
    assertEquals("HOLD_SYNTHETIC_JOURNAL_READ_NOT_AUTHORITY",
      SyntheticAtomicMigrationJournal(fixture).inspectExisting())
  }

  @Test fun truncatedAndTamperedCheckpointsFailClosed() {
    val journal = SyntheticAtomicMigrationJournal(fixture)
    assertEquals("HOLD_SYNTHETIC_CHECKPOINT_WRITTEN_NOT_AUTHORITY",
      journal.writeCheckpoint(2L, "SOURCE_BACKED_UP"))
    fixture.writeText("v1|2|SOURCE_BACKED_UP|deadbeef")
    assertEquals("DENY_SYNTHETIC_JOURNAL_MALFORMED", journal.inspectExisting())
    assertEquals("HOLD_SYNTHETIC_CHECKPOINT_WRITTEN_NOT_AUTHORITY",
      journal.writeCheckpoint(2L, "SOURCE_BACKED_UP"))
    fixture.writeText(fixture.readText().replace("SOURCE_BACKED_UP", "NATIVE_STAGED"))
    assertEquals("DENY_SYNTHETIC_JOURNAL_CORRUPT", journal.inspectExisting())
  }

  @Test fun oversizedAndInvalidUtf8JournalFailClosed() {
    val journal = SyntheticAtomicMigrationJournal(fixture)
    fixture.writeBytes(ByteArray(320) { 65 })
    assertEquals("DENY_SYNTHETIC_JOURNAL_OVERSIZE", journal.inspectExisting())
    fixture.writeBytes(byteArrayOf(0xC3.toByte(), 0x28))
    assertEquals("DENY_SYNTHETIC_JOURNAL_MALFORMED", journal.inspectExisting())
  }

  @Test fun legacyVersionAndInvalidStepNeverBecomeValid() {
    val journal = SyntheticAtomicMigrationJournal(fixture)
    assertEquals("DENY_SYNTHETIC_INVALID_CHECKPOINT",
      journal.writeCheckpoint(0L, "INTENT_RECORDED"))
    assertEquals("DENY_SYNTHETIC_INVALID_CHECKPOINT",
      journal.writeCheckpoint(1L, "UNLOCKED"))
    assertFalse(fixture.exists())
    fixture.writeText("v2|1|INTENT_RECORDED|123")
    assertEquals("DENY_SYNTHETIC_JOURNAL_MALFORMED", journal.inspectExisting())
  }

  @Test fun completedMarkerIsStillOnlyAnUntrustedSyntheticObservation() {
    val journal = SyntheticAtomicMigrationJournal(fixture)
    assertEquals("HOLD_SYNTHETIC_CHECKPOINT_WRITTEN_NOT_AUTHORITY",
      journal.writeCheckpoint(5L, "FINALIZED_UNVERIFIED"))
    assertEquals("HOLD_SYNTHETIC_JOURNAL_READ_NOT_AUTHORITY",
      SyntheticAtomicMigrationJournal(fixture).inspectExisting())
  }

  @Test fun validOlderCheckpointReplayIsNotDetectableByAnUnkeyedChecksum() {
    val journal = SyntheticAtomicMigrationJournal(fixture)
    journal.writeCheckpoint(1L, "INTENT_RECORDED")
    val original = fixture.readBytes().copyOf()
    journal.writeCheckpoint(3L, "NATIVE_STAGED")
    fixture.writeBytes(original) // synthetic rollback within this isolated fixture
    assertEquals("HOLD_SYNTHETIC_JOURNAL_READ_NOT_AUTHORITY",
      SyntheticAtomicMigrationJournal(fixture).inspectExisting())
    // No grant even when replay appears to be a valid older checkpoint.
  }
}

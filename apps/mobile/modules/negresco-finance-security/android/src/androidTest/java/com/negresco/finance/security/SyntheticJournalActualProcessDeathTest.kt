package com.negresco.finance.security

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import android.os.Process
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.nio.file.Files
import java.nio.file.LinkOption
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * REAL SIGKILL of a dedicated DEBUG-ONLY Service PROCESS.
 *
 * Not a fake AtomicFile.failWrite, but not a system crash, power loss,
 * external antirollback guarantee, production migration or financial data.
 * The instrumentation process must survive to re-open the fixture.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticJournalActualProcessDeathTest {
  private lateinit var app: Context
  private lateinit var root: File
  private lateinit var token: String
  private lateinit var journalFile: File

  @Before fun setup() {
    app = InstrumentationRegistry.getInstrumentation().targetContext
    token = UUID.randomUUID().toString()
    root = File(app.noBackupFilesDir, "negresco_synthetic_atomic_$token")
    assertTrue(root.mkdir())
    File(root, ".synthetic-test-owner").writeText(token)
    journalFile = File(root, "synthetic-migration.journal")
    assertEquals("HOLD_SYNTHETIC_WITNESS_STAGED_NOT_AUTHORITY",
      SyntheticJournalIndependentWitness(root)
        .stageExpectedCheckpoint(1L, "INTENT_RECORDED"))
    assertEquals("HOLD_SYNTHETIC_CHECKPOINT_WRITTEN_NOT_AUTHORITY",
      SyntheticAtomicMigrationJournal(journalFile)
        .writeCheckpoint(1L, "INTENT_RECORDED"))
  }

  @After fun cleanup() {
    assertTrue("only disposable test fixture directory may be deleted",
      root.deleteRecursively())
  }

  private fun killRemoteWorker(mode: String, suppliedToken: String = token): String {
    val connected = CountDownLatch(1)
    val delivered = CountDownLatch(1)
    val processDied = CountDownLatch(1)
    val binder = AtomicReference<IBinder?>()
    val response = AtomicReference("NO_RESPONSE")
    val pid = AtomicReference(-1)
    val callback = Messenger(object : Handler(Looper.getMainLooper()) {
      override fun handleMessage(message: Message) {
        response.set(message.data.getString("result") ?: "EMPTY_RESPONSE")
        pid.set(message.data.getInt("workerPid", -1))
        delivered.countDown()
      }
    })
    val connection = object : ServiceConnection {
      override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
        binder.set(service)
        connected.countDown()
      }
      override fun onServiceDisconnected(name: ComponentName?) {
        processDied.countDown()
      }
      override fun onBindingDied(name: ComponentName?) {
        processDied.countDown()
      }
    }
    val intent = Intent(app, SyntheticJournalCrashWorkerService::class.java)
    assertTrue("bind only non-exported dedicated DEBUG service",
      app.bindService(intent, connection, Context.BIND_AUTO_CREATE))
    try {
      assertTrue("remote worker must bind", connected.await(20, TimeUnit.SECONDS))
      val command = Message.obtain().apply {
        replyTo = callback
        data = Bundle().apply {
          putString("token", suppliedToken)
          putString("mode", mode)
        }
      }
      Messenger(requireNotNull(binder.get())).send(command)
      assertTrue("fixture must acknowledge before its real SIGKILL",
        delivered.await(20, TimeUnit.SECONDS))
      assertNotEquals("worker must not kill instrumentation/main process",
        Process.myPid(), pid.get())
      assertTrue("dedicated process must really die",
        processDied.await(20, TimeUnit.SECONDS))
      return response.get()
    } finally {
      app.unbindService(connection)
    }
  }

  @Test fun deathAfterWitnessCommitRetainsDenyOnNewReader() {
    assertEquals("WITNESS_COMMITTED_THEN_PROCESS_KILLED",
      killRemoteWorker("AFTER_WITNESS"))
    assertEquals("DENY_SYNTHETIC_PAIR_MISMATCH",
      SyntheticJournalIndependentWitness(root).inspectPair())
    assertEquals("HOLD_SYNTHETIC_JOURNAL_READ_NOT_AUTHORITY",
      SyntheticAtomicMigrationJournal(journalFile).inspectExisting())
  }

  @Test fun deathWithPartiallyWrittenJournalDoesNotCommitNewCheckpoint() {
    assertEquals("PARTIAL_JOURNAL_THEN_PROCESS_KILLED",
      killRemoteWorker("DURING_JOURNAL"))
    assertEquals("DENY_SYNTHETIC_PAIR_MISMATCH",
      SyntheticJournalIndependentWitness(root).inspectPair())
    assertEquals("HOLD_SYNTHETIC_JOURNAL_READ_NOT_AUTHORITY",
      SyntheticAtomicMigrationJournal(journalFile).inspectExisting())
    assertTrue("partially written next checkpoint may not silently replace v1",
      journalFile.readText().contains("INTENT_RECORDED"))
  }

  @Test fun deathAfterBothCommittedAllowsOnlyDiagnosticHoldOnReopen() {
    assertEquals("BOTH_FILES_COMMITTED_THEN_PROCESS_KILLED",
      killRemoteWorker("AFTER_BOTH"))
    assertEquals("HOLD_SYNTHETIC_PAIR_MATCH_NOT_AUTHORITY",
      SyntheticJournalIndependentWitness(root).inspectPair())
    assertEquals("HOLD_SYNTHETIC_JOURNAL_READ_NOT_AUTHORITY",
      SyntheticAtomicMigrationJournal(journalFile).inspectExisting())
  }

  /**
   * Invalid requests must not rewrite either member of the synthetic pair.
   * Every command runs in the dedicated Debug-only worker and the same
   * process-death assertion still applies when the worker returns DENY.
   */
  private fun assertRejectedRequestPreservesFixture(
    denial: String,
    mode: String,
    suppliedToken: String = token
  ) {
    val witnessFile = File(root, "synthetic-migration.witness")
    val beforeJournal = journalFile.readBytes()
    val beforeWitness = witnessFile.readBytes()
    assertEquals(denial, killRemoteWorker(mode, suppliedToken))
    assertArrayEquals("denial must not modify existing journal",
      beforeJournal, journalFile.readBytes())
    assertArrayEquals("denial must not modify existing witness",
      beforeWitness, witnessFile.readBytes())
    assertEquals("HOLD_SYNTHETIC_PAIR_MATCH_NOT_AUTHORITY",
      SyntheticJournalIndependentWitness(root).inspectPair())
  }

  @Test fun malformedUuidCannotModifyExistingFixture() {
    assertRejectedRequestPreservesFixture("DENY_TOKEN", "AFTER_BOTH", "../invalid")
  }

  @Test fun unknownValidUuidCannotModifyExistingFixture() {
    assertRejectedRequestPreservesFixture(
      "DENY_SANDBOX", "AFTER_BOTH", UUID.randomUUID().toString())
  }

  @Test fun unsupportedModeCannotModifyExistingFixture() {
    assertRejectedRequestPreservesFixture("DENY_MODE", "ERASE_REAL_DATA")
  }

  @Test fun missingOwnerMarkerCannotModifyExistingFixture() {
    assertTrue(File(root, ".synthetic-test-owner").delete())
    assertRejectedRequestPreservesFixture("DENY_SANDBOX", "AFTER_BOTH")
  }

  @Test fun forgedOwnerMarkerCannotModifyExistingFixture() {
    File(root, ".synthetic-test-owner").writeText(UUID.randomUUID().toString())
    assertRejectedRequestPreservesFixture("DENY_SANDBOX", "AFTER_BOTH")
  }

  private fun withDisposableLinkTarget(content: String, block: (File) -> Unit) {
    val target = File(app.noBackupFilesDir, "negresco_synthetic_link_target_$token")
    assertTrue("unique disposable external fixture target", target.createNewFile())
    target.writeText(content)
    try {
      block(target)
    } finally {
      assertTrue("external synthetic fixture must be removed", target.delete())
    }
  }

  @Test fun symbolicOwnerMarkerCannotAuthorizeWorkerWrite() {
    val owner = File(root, ".synthetic-test-owner")
    assertTrue(owner.delete())
    withDisposableLinkTarget(token) { external ->
      Files.createSymbolicLink(owner.toPath(), external.toPath())
      try {
        assertRejectedRequestPreservesFixture("DENY_PATH_ALIAS", "AFTER_BOTH")
        assertEquals("external synthetic marker must not change", token, external.readText())
      } finally {
        assertTrue("symlink removed without following it", owner.delete())
      }
    }
  }

  @Test fun symbolicWitnessNewFileCannotRedirectWrite() {
    val link = File(root, "synthetic-migration.witness.new")
    withDisposableLinkTarget("EXTERNAL_WITNESS_UNTOUCHED") { external ->
      Files.createSymbolicLink(link.toPath(), external.toPath())
      try {
        assertRejectedRequestPreservesFixture("DENY_PATH_ALIAS", "AFTER_BOTH")
        assertEquals("EXTERNAL_WITNESS_UNTOUCHED", external.readText())
      } finally {
        // AtomicFile.openRead may already discard an orphan .new entry.
        // Remove only the link itself; never dereference the target.
        Files.deleteIfExists(link.toPath())
        assertTrue("witness alias path must be absent",
          !Files.exists(link.toPath(), LinkOption.NOFOLLOW_LINKS))
        assertEquals("EXTERNAL_WITNESS_UNTOUCHED", external.readText())
      }
    }
  }

  @Test fun symbolicJournalNewFileCannotRedirectWrite() {
    val link = File(root, "synthetic-migration.journal.new")
    withDisposableLinkTarget("EXTERNAL_JOURNAL_UNTOUCHED") { external ->
      Files.createSymbolicLink(link.toPath(), external.toPath())
      try {
        assertRejectedRequestPreservesFixture("DENY_PATH_ALIAS", "AFTER_BOTH")
        assertEquals("EXTERNAL_JOURNAL_UNTOUCHED", external.readText())
      } finally {
        // Both an already removed alias and a still-present alias are valid
        // cleanup states after AtomicFile recovery.
        Files.deleteIfExists(link.toPath())
        assertTrue("journal alias path must be absent",
          !Files.exists(link.toPath(), LinkOption.NOFOLLOW_LINKS))
        assertEquals("EXTERNAL_JOURNAL_UNTOUCHED", external.readText())
      }
    }
  }

  @Test fun oversizedOwnerMarkerCannotAuthorizeWorkerWrite() {
    File(root, ".synthetic-test-owner").writeText("X".repeat(4096))
    assertRejectedRequestPreservesFixture("DENY_SANDBOX", "AFTER_BOTH")
  }

  @Test fun hardlinkedOwnerMarkerCannotAuthorizeWorkerWrite() {
    val owner = File(root, ".synthetic-test-owner")
    assertTrue(owner.delete())
    withDisposableLinkTarget(token) { external ->
      Files.createLink(owner.toPath(), external.toPath())
      try {
        assertRejectedRequestPreservesFixture("DENY_HARDLINK", "AFTER_BOTH")
        assertEquals("external owner fixture remains unchanged", token, external.readText())
      } finally {
        Files.deleteIfExists(owner.toPath())
        assertTrue(!Files.exists(owner.toPath(), LinkOption.NOFOLLOW_LINKS))
      }
    }
  }

  @Test fun hardlinkedWitnessNewCannotRedirectWrite() {
    val alias = File(root, "synthetic-migration.witness.new")
    withDisposableLinkTarget("HARDLINK_WITNESS_UNTOUCHED") { external ->
      Files.createLink(alias.toPath(), external.toPath())
      try {
        assertRejectedRequestPreservesFixture("DENY_HARDLINK", "AFTER_BOTH")
        assertEquals("HARDLINK_WITNESS_UNTOUCHED", external.readText())
      } finally {
        Files.deleteIfExists(alias.toPath())
        assertTrue(!Files.exists(alias.toPath(), LinkOption.NOFOLLOW_LINKS))
      }
    }
  }

  @Test fun hardlinkedJournalNewCannotRedirectWrite() {
    val alias = File(root, "synthetic-migration.journal.new")
    withDisposableLinkTarget("HARDLINK_JOURNAL_UNTOUCHED") { external ->
      Files.createLink(alias.toPath(), external.toPath())
      try {
        assertRejectedRequestPreservesFixture("DENY_HARDLINK", "AFTER_BOTH")
        assertEquals("HARDLINK_JOURNAL_UNTOUCHED", external.readText())
      } finally {
        Files.deleteIfExists(alias.toPath())
        assertTrue(!Files.exists(alias.toPath(), LinkOption.NOFOLLOW_LINKS))
      }
    }
  }

  /**
   * Deliberately insert an alias AFTER the initial preflight and witness
   * commit. The mismatch is a DENY, not an automatic recovery or rollback.
   * No external pathname, account or real financial data enters the worker.
   */
  private fun assertLateAliasPreventsJournalCommit(
    mode: String, rejection: String
  ) {
    val owner = File(root, ".synthetic-test-owner")
    val originalOwner = owner.readBytes()
    val originalJournal = journalFile.readBytes()
    assertEquals(rejection, killRemoteWorker(mode))
    assertArrayEquals("late alias may not modify the owner marker",
      originalOwner, owner.readBytes())
    assertArrayEquals("late alias must leave old journal untouched",
      originalJournal, journalFile.readBytes())
    assertEquals("a committed witness alone never authorizes migration",
      "DENY_SYNTHETIC_PAIR_MISMATCH",
      SyntheticJournalIndependentWitness(root).inspectPair())
    // openRead() may remove the temporary alias while reopening. A remaining
    // alias must be unlinked without dereferencing the owner.
    val alias = File(root, "synthetic-migration.journal.new")
    Files.deleteIfExists(alias.toPath())
    assertTrue("no temporary alias may remain",
      !Files.exists(alias.toPath(), LinkOption.NOFOLLOW_LINKS))
    assertArrayEquals("owner remains intact after reader recovery",
      originalOwner, owner.readBytes())
  }

  @Test fun lateSymbolicAliasAfterWitnessCannotCommitJournal() {
    assertLateAliasPreventsJournalCommit(
      "INJECT_LATE_SYMLINK_FIXTURE_ONLY", "DENY_PATH_ALIAS")
  }

  @Test fun lateHardlinkAliasAfterWitnessCannotCommitJournal() {
    assertLateAliasPreventsJournalCommit(
      "INJECT_LATE_HARDLINK_FIXTURE_ONLY", "DENY_HARDLINK")
  }
}

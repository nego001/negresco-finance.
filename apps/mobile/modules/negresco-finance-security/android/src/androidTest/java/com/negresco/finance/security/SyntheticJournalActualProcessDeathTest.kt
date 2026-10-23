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
import android.system.Os
import android.system.OsConstants
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.nio.file.AccessDeniedException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import org.junit.After
import org.junit.Assume.assumeTrue
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

  /**
   * Hardlink creation may be forbidden by the Android filesystem/kernel.
   * Such a refusal is not evidence the worker's lstat gate ran.
   */
  private fun createHardlinkOrSkip(alias: File, external: File) {
    val originalTarget = external.readBytes()
    val originalJournal = journalFile.readBytes()
    val witnessFile = File(root, "synthetic-migration.witness")
    val originalWitness = witnessFile.readBytes()
    try {
      Files.createLink(alias.toPath(), external.toPath())
    } catch (denied: AccessDeniedException) {
      assertTrue("denied hardlink must not exist",
        !Files.exists(alias.toPath(), LinkOption.NOFOLLOW_LINKS))
      assertArrayEquals("denied hardlink must not change target",
        originalTarget, external.readBytes())
      assertArrayEquals("denied hardlink must not change journal",
        originalJournal, journalFile.readBytes())
      assertArrayEquals("denied hardlink must not change witness",
        originalWitness, witnessFile.readBytes())
      assumeTrue("Android denied synthetic hardlink creation; lstat gate not exercised", false)
    }
  }

  @Test fun hardlinkedOwnerMarkerCannotAuthorizeWorkerWrite() {
    val owner = File(root, ".synthetic-test-owner")
    assertTrue(owner.delete())
    withDisposableLinkTarget(token) { external ->
      createHardlinkOrSkip(owner, external)
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
      createHardlinkOrSkip(alias, external)
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
      createHardlinkOrSkip(alias, external)
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
    val actual = killRemoteWorker(mode)
    val kernelDenied = actual == "DENY_PLATFORM_HARDLINK"
    if (!kernelDenied) assertEquals(rejection, actual)
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
    if (kernelDenied) {
      assumeTrue("Android denied late hardlink creation: lstat branch not exercised", false)
    }
  }

  @Test fun lateSymbolicAliasAfterWitnessCannotCommitJournal() {
    assertLateAliasPreventsJournalCommit(
      "INJECT_LATE_SYMLINK_FIXTURE_ONLY", "DENY_PATH_ALIAS")
  }

  @Test fun lateHardlinkAliasAfterWitnessCannotCommitJournal() {
    assertLateAliasPreventsJournalCommit(
      "INJECT_LATE_HARDLINK_FIXTURE_ONLY", "DENY_HARDLINK")
  }

  /**
   * Don't invoke AtomicFile.openRead while .bak is an injected symlink:
   * recovery can move that backup pathname over the base. Check the
   * rejection and raw bytes first, unlink the alias, then inspectPair.
   */
  private fun assertRejectedBackupAliasWithoutRecovery() {
    val witnessFile = File(root, "synthetic-migration.witness")
    val oldJournal = journalFile.readBytes()
    val oldWitness = witnessFile.readBytes()
    assertEquals("DENY_PATH_ALIAS", killRemoteWorker("AFTER_BOTH"))
    assertArrayEquals("journal may not be rewritten", oldJournal, journalFile.readBytes())
    assertArrayEquals("witness may not be rewritten", oldWitness, witnessFile.readBytes())
  }

  @Test fun symbolicWitnessBackupCannotRedirectWrite() {
    val alias = File(root, "synthetic-migration.witness.bak")
    withDisposableLinkTarget("EXTERNAL_WITNESS_BACKUP_UNTOUCHED") { external ->
      Files.createSymbolicLink(alias.toPath(), external.toPath())
      try {
        assertRejectedBackupAliasWithoutRecovery()
        assertEquals("EXTERNAL_WITNESS_BACKUP_UNTOUCHED", external.readText())
      } finally {
        Files.deleteIfExists(alias.toPath())
        assertTrue("witness backup alias absent",
          !Files.exists(alias.toPath(), LinkOption.NOFOLLOW_LINKS))
        assertEquals("EXTERNAL_WITNESS_BACKUP_UNTOUCHED", external.readText())
      }
    }
    assertEquals("HOLD_SYNTHETIC_PAIR_MATCH_NOT_AUTHORITY",
      SyntheticJournalIndependentWitness(root).inspectPair())
  }

  @Test fun symbolicJournalBackupCannotRedirectWrite() {
    val alias = File(root, "synthetic-migration.journal.bak")
    withDisposableLinkTarget("EXTERNAL_JOURNAL_BACKUP_UNTOUCHED") { external ->
      Files.createSymbolicLink(alias.toPath(), external.toPath())
      try {
        assertRejectedBackupAliasWithoutRecovery()
        assertEquals("EXTERNAL_JOURNAL_BACKUP_UNTOUCHED", external.readText())
      } finally {
        Files.deleteIfExists(alias.toPath())
        assertTrue("journal backup alias absent",
          !Files.exists(alias.toPath(), LinkOption.NOFOLLOW_LINKS))
        assertEquals("EXTERNAL_JOURNAL_BACKUP_UNTOUCHED", external.readText())
      }
    }
    assertEquals("HOLD_SYNTHETIC_PAIR_MATCH_NOT_AUTHORITY",
      SyntheticJournalIndependentWitness(root).inspectPair())
  }

  /**
   * Swap a valid owner pathname AFTER the worker's first alias preflight.
   * The replacement points to identical UUID data, so merely checking the
   * file contents would not detect this path substitution.
   */
  @Test fun swappedOwnerSymlinkAfterPreflightCannotAuthorizeWrite() {
    val owner = File(root, ".synthetic-test-owner")
    val moved = File(root, ".synthetic-owner-moved-for-test")
    val witness = File(root, "synthetic-migration.witness")
    val oldJournal = journalFile.readBytes()
    val oldWitness = witness.readBytes()
    try {
      assertEquals("DENY_SANDBOX",
        killRemoteWorker("INJECT_OWNER_SYMLINK_BEFORE_OPEN_FIXTURE_ONLY"))
      assertTrue("owner name must be a symlink after injected swap",
        Files.isSymbolicLink(owner.toPath()))
      assertEquals("moved real marker keeps exactly the test UUID", token,
        moved.readText())
      assertArrayEquals("owner alias denial cannot write journal",
        oldJournal, journalFile.readBytes())
      assertArrayEquals("owner alias denial cannot write witness",
        oldWitness, witness.readBytes())
    } finally {
      Files.deleteIfExists(owner.toPath())
      if (Files.exists(moved.toPath(), LinkOption.NOFOLLOW_LINKS)) {
        Files.move(moved.toPath(), owner.toPath())
      }
    }
    assertEquals("restored fixture remains a diagnostic hold",
      "HOLD_SYNTHETIC_PAIR_MATCH_NOT_AUTHORITY",
      SyntheticJournalIndependentWitness(root).inspectPair())
  }

  /**
   * Replace the owner marker with a FIFO only AFTER preflight. Opening a
   * FIFO O_RDONLY without O_NONBLOCK can wait forever for a writer.
   * The worker must answer DENY instead of hanging, and never touch either
   * checkpoint. No external data or untrusted IPC paths enter this test.
   */
  @Test fun swappedOwnerFifoAfterPreflightCannotHangOrAuthorize() {
    val owner = File(root, ".synthetic-test-owner")
    val moved = File(root, ".synthetic-owner-moved-for-test")
    val witness = File(root, "synthetic-migration.witness")
    val oldJournal = journalFile.readBytes()
    val oldWitness = witness.readBytes()
    try {
      assertEquals("DENY_SANDBOX",
        killRemoteWorker("INJECT_OWNER_FIFO_BEFORE_OPEN_FIXTURE_ONLY"))
      assertTrue("injected owner must be a FIFO, not regular file",
        OsConstants.S_ISFIFO(Os.lstat(owner.absolutePath).st_mode))
      assertEquals("moved real owner must be intact", token, moved.readText())
      assertArrayEquals("FIFO must not change journal", oldJournal, journalFile.readBytes())
      assertArrayEquals("FIFO must not change witness", oldWitness, witness.readBytes())
    } finally {
      Files.deleteIfExists(owner.toPath())
      if (Files.exists(moved.toPath(), LinkOption.NOFOLLOW_LINKS)) {
        Files.move(moved.toPath(), owner.toPath())
      }
    }
    assertEquals("restored fixture remains diagnostic hold",
      "HOLD_SYNTHETIC_PAIR_MATCH_NOT_AUTHORITY",
      SyntheticJournalIndependentWitness(root).inspectPair())
  }

  /**
   * The witness is already on generation 2 when ownership changes.
   * Alias-only rechecks are insufficient: a new regular marker of the same
   * length or a missing marker must stop the journal generation advance.
   */
  private fun assertOwnerChangedAfterWitnessStopsJournal(mode: String, removed: Boolean) {
    val owner = File(root, ".synthetic-test-owner")
    val witness = File(root, "synthetic-migration.witness")
    val beforeJournal = journalFile.readBytes()
    val beforeWitness = witness.readBytes()
    try {
      assertEquals("DENY_SANDBOX", killRemoteWorker(mode))
      if (removed) {
        assertTrue("worker must remove owner only inside synthetic sandbox",
          !Files.exists(owner.toPath(), LinkOption.NOFOLLOW_LINKS))
      } else {
        assertTrue("forged owner remains a regular file",
          Files.isRegularFile(owner.toPath(), LinkOption.NOFOLLOW_LINKS))
        assertEquals("forged UUID must have the original length",
          token.length, owner.readText().length)
        assertNotEquals("same-length forged UUID must be different",
          token, owner.readText())
      }
      assertArrayEquals("journal must retain generation 1",
        beforeJournal, journalFile.readBytes())
      assertTrue("the witness must be committed before owner injection",
        !beforeWitness.contentEquals(witness.readBytes()))
    } finally {
      // Only restore the disposable marker. Never authorize a migration.
      owner.writeText(token)
    }
    assertEquals("an orphaned witness must remain a diagnostic deny",
      "DENY_SYNTHETIC_PAIR_MISMATCH",
      SyntheticJournalIndependentWitness(root).inspectPair())
    assertArrayEquals("reopening must not advance journal",
      beforeJournal, journalFile.readBytes())
  }

  @Test fun ownerTamperedAfterWitnessCannotCommitJournal() {
    assertOwnerChangedAfterWitnessStopsJournal(
      "INJECT_OWNER_TAMPER_AFTER_WITNESS_FIXTURE_ONLY", false)
  }

  @Test fun ownerRemovedAfterWitnessCannotCommitJournal() {
    assertOwnerChangedAfterWitnessStopsJournal(
      "INJECT_OWNER_REMOVAL_AFTER_WITNESS_FIXTURE_ONLY", true)
  }

  /**
   * An attacker with write access swaps the owner for a NEW regular file
   * containing the EXACT SAME UUID. Bytes and st_nlink remain plausible,
   * but device/inode identity must differ after witness commit.
   */
  @Test fun ownerReplacedWithSameUuidAfterWitnessCannotCommitJournal() {
    val owner = File(root, ".synthetic-test-owner")
    val saved = File(root, ".synthetic-owner-moved-for-test")
    val witness = File(root, "synthetic-migration.witness")
    val oldJournal = journalFile.readBytes()
    val oldWitness = witness.readBytes()
    val initialStat = Os.lstat(owner.absolutePath)
    try {
      assertEquals("DENY_SANDBOX",
        killRemoteWorker("INJECT_OWNER_REPLACEMENT_AFTER_WITNESS_FIXTURE_ONLY"))
      assertEquals("replacement has same valid UUID", token, owner.readText())
      assertEquals("original owner remains unchanged", token, saved.readText())
      val replacementStat = Os.lstat(owner.absolutePath)
      val originalStat = Os.lstat(saved.absolutePath)
      assertEquals("original file identity must survive the move",
        initialStat.st_ino, originalStat.st_ino)
      assertTrue("replacement must use a different inode",
        replacementStat.st_ino != originalStat.st_ino ||
          replacementStat.st_dev != originalStat.st_dev)
      assertArrayEquals("journal must stay on original generation",
        oldJournal, journalFile.readBytes())
      assertTrue("witness must advance before the injected swap",
        !oldWitness.contentEquals(witness.readBytes()))
    } finally {
      Files.deleteIfExists(owner.toPath())
      if (Files.exists(saved.toPath(), LinkOption.NOFOLLOW_LINKS)) {
        Files.move(saved.toPath(), owner.toPath())
      }
    }
    assertEquals("changed identity cannot approve pair recovery",
      "DENY_SYNTHETIC_PAIR_MISMATCH",
      SyntheticJournalIndependentWitness(root).inspectPair())
    assertArrayEquals("reopening must leave old journal untouched",
      oldJournal, journalFile.readBytes())
  }
}

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
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import org.junit.After
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

  private fun killRemoteWorker(mode: String): String {
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
          putString("token", token)
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
}

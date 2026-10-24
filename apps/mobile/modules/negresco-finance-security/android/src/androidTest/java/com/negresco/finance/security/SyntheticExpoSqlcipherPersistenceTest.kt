package com.negresco.finance.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import net.zetetic.database.sqlcipher.SQLiteDatabase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID

/**
 * Phase 1 NEGATIVE/SYNTHETIC SQLCipher instrumentation inside Expo module.
 *
 * This class is src/androidTest ONLY and is not exported to React Native.
 * No user financial data, no auth/biometrics, no Keystore wrapping, no claim
 * about trusted or production storage. Passwords are random disposable TEST
 * material, never printed, backed up, transmitted or passed to JavaScript.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticExpoSqlcipherPersistenceTest {
  private fun sandbox(): File {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val root = File(context.cacheDir, "sec05k_sqlcipher_${UUID.randomUUID()}")
    check(root.mkdirs()) { "Could not create disposable SQLCipher test folder" }
    return root
  }

  private fun clearSandbox(root: File, databaseFile: File) {
    // SQLCipher helper removes database, WAL, SHM and rollback journal files.
    SQLiteDatabase.deleteDatabase(databaseFile)
    assertTrue("disposable SQLCipher fixture cleanup", root.deleteRecursively())
  }

  private fun createNew(file: File, password: String): SQLiteDatabase =
    SQLiteDatabase.openOrCreateDatabase(file, password, null, null, null)

  private fun reopen(file: File, password: String): SQLiteDatabase =
    SQLiteDatabase.openDatabase(
      file.absolutePath, password, null, SQLiteDatabase.OPEN_READONLY, null, null)

  private fun getSyntheticValue(db: SQLiteDatabase): String =
    db.rawQuery("SELECT sample FROM synthetic_records WHERE id = 1", null).use { cursor ->
      assertTrue("synthetic row must exist", cursor.moveToFirst())
      cursor.getString(0)
    }

  @Test fun encryptedSyntheticRecordReopensWithCorrectKeyAndRejectsWrongKey() {
    System.loadLibrary("sqlcipher")
    val root = sandbox()
    val file = File(root, "throwaway_encrypted.db")
    val passphrase = UUID.randomUUID().toString() + UUID.randomUUID().toString()
    val incorrect = UUID.randomUUID().toString() + UUID.randomUUID().toString()
    val synthetic = "sample-no-financial-data-${UUID.randomUUID()}"
    try {
      val db = createNew(file, passphrase)
      try {
        db.execSQL("CREATE TABLE synthetic_records(id INTEGER PRIMARY KEY, sample TEXT NOT NULL)")
        db.execSQL("INSERT INTO synthetic_records(id, sample) VALUES(1, ?)", arrayOf(synthetic))
      } finally {
        db.close()
      }
      assertTrue(file.isFile && file.length() > 0L)
      val raw = file.readBytes()
      val sampleBytes = synthetic.toByteArray(Charsets.UTF_8)
      assertFalse("encrypted file cannot contain known sample in plaintext",
        raw.toList().windowed(sampleBytes.size).any {
          it == sampleBytes.toList()
        })
      val correct = reopen(file, passphrase)
      try {
        assertEquals(synthetic, getSyntheticValue(correct))
      } finally {
        correct.close()
      }
      var refused = false
      try {
        val wrong = reopen(file, incorrect)
        try {
          // Wrong key may fail at open or at first page read.
          getSyntheticValue(wrong)
        } finally {
          wrong.close()
        }
      } catch (_: Exception) {
        refused = true
      }
      assertTrue("wrong key must never read the synthetic row", refused)
      assertTrue("wrong-key read cannot delete the existing database", file.exists())
      val again = reopen(file, passphrase)
      try {
        assertEquals(synthetic, getSyntheticValue(again))
      } finally {
        again.close()
      }
    } finally {
      clearSandbox(root, file)
    }
  }

  @Test fun uncommittedSyntheticTransactionDoesNotSurviveDatabaseReopen() {
    System.loadLibrary("sqlcipher")
    val root = sandbox()
    val file = File(root, "throwaway_rollback.db")
    val passphrase = UUID.randomUUID().toString() + UUID.randomUUID().toString()
    try {
      val db = createNew(file, passphrase)
      try {
        db.execSQL("CREATE TABLE synthetic_records(id INTEGER PRIMARY KEY, sample TEXT NOT NULL)")
        db.beginTransaction()
        try {
          db.execSQL("INSERT INTO synthetic_records(id, sample) VALUES(1, 'not_committed')")
          // No setTransactionSuccessful(): explicit rollback on close/end.
        } finally {
          db.endTransaction()
        }
      } finally {
        db.close()
      }
      val reopened = reopen(file, passphrase)
      try {
        reopened.rawQuery("SELECT count(*) FROM synthetic_records", null).use { cursor ->
          assertTrue(cursor.moveToFirst())
          assertEquals(0, cursor.getInt(0))
        }
      } finally {
        reopened.close()
      }
    } finally {
      clearSandbox(root, file)
    }
  }
}

package com.negresco.finance.sqlcipher.lab

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Android/JNI tests to run in a dedicated TEST APP sandbox with fictional data.
 * Compiling them in GitHub Actions DOES NOT EXECUTE THEM.
 *
 * Requires an Android emulator or disposable test device, native .so and
 * no installed user's financial database. Never run against production app.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticSqlCipherDatabaseInstrumentedTest {
  private val context: Context
    get() = InstrumentationRegistry.getInstrumentation().targetContext

  private val syntheticFile: File
    get() = File(context.noBackupFilesDir, "negresco_sqlcipher_synthetic_v1.db")

  private val passphrase = ByteArray(32) { (it * 7 + 1).toByte() }
  private val wrongPassphrase = ByteArray(32) { (it * 7 + 2).toByte() }
  private var fixtureOwned = false

  @Before
  fun requireCleanFixture() {
    // Stop rather than silently delete an earlier run's database.
    assertFalse("Prior synthetic fixture requires explicit test-sandbox cleanup",
      syntheticFile.exists())
  }

  @After
  fun cleanOwnedFixtureOnly() {
    if (fixtureOwned) {
      syntheticFile.delete()
      File(syntheticFile.path + "-journal").delete()
      File(syntheticFile.path + "-wal").delete()
      File(syntheticFile.path + "-shm").delete()
    }
  }

  @Test
  fun createsEncryptedDatabaseAndReopensWithCorrectPassphrase() {
    fixtureOwned = true
    SyntheticSqlCipherDatabase.createFreshSynthetic(context, passphrase).use { db ->
      db.execSQL("INSERT INTO lab_probe(id, marker) VALUES (1, 'synthetic-marker')")
    }
    SyntheticSqlCipherDatabase.openExistingSynthetic(context, passphrase).use { db ->
      db.rawQuery("SELECT marker FROM lab_probe WHERE id = 1", null).use { cursor ->
        assertTrue(cursor.moveToFirst())
        assertEquals("synthetic-marker", cursor.getString(0))
      }
    }
    val header = syntheticFile.inputStream().use { input ->
      ByteArray(16).also { java.io.DataInputStream(input).readFully(it) }
    }
    assertFalse(header.contentEquals("SQLite format 3\u0000".toByteArray(Charsets.US_ASCII)))
  }

  @Test
  fun rejectsWrongPassphraseWithoutAlteringExistingDatabase() {
    fixtureOwned = true
    SyntheticSqlCipherDatabase.createFreshSynthetic(context, passphrase).close()
    val before = syntheticFile.length()
    val result = runCatching {
      SyntheticSqlCipherDatabase.openExistingSynthetic(context, wrongPassphrase).close()
    }
    assertTrue(result.exceptionOrNull() is SyntheticSqlCipherDatabase.Unavailable)
    assertTrue(syntheticFile.exists())
    assertEquals(before, syntheticFile.length())
    SyntheticSqlCipherDatabase.openExistingSynthetic(context, passphrase).close()
  }

  @Test
  fun refusesKnownPlaintextSQLiteBeforeNativeOpen() {
    fixtureOwned = true
    syntheticFile.outputStream().use { out ->
      out.write("SQLite format 3\u0000".toByteArray(Charsets.US_ASCII))
      out.write(ByteArray(128))
    }
    val result = runCatching {
      SyntheticSqlCipherDatabase.openExistingSynthetic(context, passphrase).close()
    }
    assertTrue(result.exceptionOrNull() is SyntheticSqlCipherDatabase.Unavailable)
  }

  @Test
  fun absentFileDoesNotImplicitlyCreateDatabase() {
    val result = runCatching {
      SyntheticSqlCipherDatabase.openExistingSynthetic(context, passphrase).close()
    }
    assertTrue(result.exceptionOrNull() is SyntheticSqlCipherDatabase.Unavailable)
    assertFalse(syntheticFile.exists())
  }

  @Test
  fun refusesDuplicateCreateWithoutOverwritingExistingFile() {
    fixtureOwned = true
    SyntheticSqlCipherDatabase.createFreshSynthetic(context, passphrase).close()
    val before = syntheticFile.readBytes()
    val second = runCatching {
      SyntheticSqlCipherDatabase.createFreshSynthetic(context, passphrase).close()
    }
    assertTrue(second.exceptionOrNull() is SyntheticSqlCipherDatabase.Unavailable)
    assertTrue(syntheticFile.readBytes().contentEquals(before))
  }

  @Test
  fun rejectsTruncatedPreExistingFile() {
    fixtureOwned = true
    syntheticFile.writeBytes(byteArrayOf(1, 2, 3))
    val result = runCatching {
      SyntheticSqlCipherDatabase.openExistingSynthetic(context, passphrase).close()
    }
    assertTrue(result.exceptionOrNull() is SyntheticSqlCipherDatabase.Unavailable)
  }
}

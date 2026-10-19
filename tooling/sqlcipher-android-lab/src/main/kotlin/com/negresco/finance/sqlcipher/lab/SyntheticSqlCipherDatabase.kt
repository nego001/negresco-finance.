package com.negresco.finance.sqlcipher.lab

import android.content.Context
import com.negresco.finance.security.SqlCipherLabFileVerdict
import com.negresco.finance.security.SqlCipherLabGuard
import java.io.DataInputStream
import java.io.File
import java.io.FileInputStream
import java.nio.file.Files
import net.zetetic.database.sqlcipher.SQLiteDatabase

/**
 * Native SQLCipher ONLY. No android.database.sqlite imports or fallback.
 *
 * IMPORTANT: temporary synthetic test data ONLY. Passphrase comes from the
 * caller's disposable native test fixture; NOT from JavaScript and NOT from
 * a production Keystore/authentication flow. This class is not registered
 * with Expo and NEVER reads user finance or application database paths.
 */
internal object SyntheticSqlCipherDatabase {
  private const val FILE_NAME = "negresco_sqlcipher_synthetic_v1.db"
  private const val HEADER_BYTES = 16

  internal class Unavailable : IllegalStateException(
    "Synthetic SQLCipher database unavailable or failed authentication"
  )

  private fun target(context: Context): File {
    val parent = context.applicationContext.noBackupFilesDir
    val file = File(parent, FILE_NAME)
    if (Files.isSymbolicLink(file.toPath()) ||
        file.canonicalFile.parentFile != parent.canonicalFile) {
      throw Unavailable()
    }
    return file
  }

  private fun readExistingHeader(file: File): ByteArray {
    if (!file.isFile || file.length() < HEADER_BYTES) throw Unavailable()
    return try {
      DataInputStream(FileInputStream(file)).use { input ->
        ByteArray(HEADER_BYTES).also { input.readFully(it) }
      }
    } catch (_: Exception) { throw Unavailable() }
  }

  private fun checkNativeDatabase(db: SQLiteDatabase) {
    // PRAGMA cipher_version is available only via SQLCipher. Also perform a
    // keyed read: a wrong key can sometimes open a handle but MUST fail read.
    db.rawQuery("PRAGMA cipher_version", null).use { cursor ->
      if (!cursor.moveToFirst() || cursor.getString(0).isNullOrBlank())
        throw Unavailable()
    }
    db.rawQuery("SELECT count(*) FROM sqlite_master", null).use { cursor ->
      if (!cursor.moveToFirst()) throw Unavailable()
      cursor.getLong(0)
    }
  }

  private fun nativeOpen(
    file: File,
    disposablePassphrase: ByteArray,
    flags: Int
  ): SQLiteDatabase {
    SqlCipherLabGuard.validateSyntheticPassphrase(disposablePassphrase)
    val keyCopy = disposablePassphrase.copyOf()
    var database: SQLiteDatabase? = null
    try {
      // Zetetic replacement library; no platform SQLite implementation.
      System.loadLibrary("sqlcipher")
      database = SQLiteDatabase.openDatabase(
        file.absolutePath, keyCopy, null, flags, null
      )
      checkNativeDatabase(database)
      return database
    } catch (_: Exception) {
      database?.close()
      throw Unavailable()
    } catch (_: UnsatisfiedLinkError) {
      database?.close()
      throw Unavailable()
    } finally {
      // Wipe our only additional copy. The native SQLCipher provider controls
      // its internal buffers; this is NOT a promise of full memory zeroization.
      keyCopy.fill(0)
    }
  }

  /**
   * Explicit, non-destructive open. Never CREATE_IF_NECESSARY here.
   * Reject known plaintext SQLite before attempting SQLCipher.
   */
  fun openExistingSynthetic(context: Context, disposablePassphrase: ByteArray): SQLiteDatabase {
    val file = target(context)
    val header = readExistingHeader(file)
    if (SqlCipherLabGuard.inspectExistingHeader(header) !=
        SqlCipherLabFileVerdict.REQUIRE_NATIVE_KEYED_OPEN) throw Unavailable()
    return nativeOpen(file, disposablePassphrase, SQLiteDatabase.OPEN_READWRITE)
  }

  /**
   * Only an EXPLICIT call may create the disposable test file. Refuses to
   * overwrite any prior database, encrypted, plaintext, corrupt, or empty.
   * No deletion/recovery is attempted on failure; investigate the fixture.
   */
  fun createFreshSynthetic(context: Context, disposablePassphrase: ByteArray): SQLiteDatabase {
    SqlCipherLabGuard.validateSyntheticPassphrase(disposablePassphrase)
    val file = target(context)
    if (!file.createNewFile()) throw Unavailable()
    val db = nativeOpen(file, disposablePassphrase,
      SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.CREATE_IF_NECESSARY)
    try {
      db.execSQL("CREATE TABLE lab_probe (id INTEGER PRIMARY KEY, marker TEXT NOT NULL)")
    } catch (_: Exception) {
      db.close()
      throw Unavailable()
    }
    return db
  }
}

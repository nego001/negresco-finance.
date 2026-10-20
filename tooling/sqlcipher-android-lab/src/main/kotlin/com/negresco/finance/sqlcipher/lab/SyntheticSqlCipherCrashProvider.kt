package com.negresco.finance.sqlcipher.lab

import android.app.Application
import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.os.Process
import java.io.File
import java.io.FileOutputStream

/**
 * Crash injection ONLY in the separate, private :sqlcipher_crash_test process
 * of this disconnected Android lab. Never publish a provider like this in an
 * app containing real financial data. Nothing here touches users' databases.
 */
internal class SyntheticSqlCipherCrashProvider : ContentProvider() {
  companion object {
    const val AUTHORITY = "com.negresco.finance.sqlcipher.lab.synthetic_crash"
    const val METHOD = "kill_during_uncommitted_transaction"
    const val WITNESS_FILE = "negresco_sqlcipher_crash_witness_test_only"
  }

  override fun onCreate(): Boolean = true

  override fun call(method: String, arg: String?, extras: Bundle?): Bundle? {
    if (method != METHOD) throw IllegalArgumentException("Unsupported synthetic crash operation")
    // Absolutely NEVER terminate the instrumentation/normal app process.
    val name = Application.getProcessName()
    check(name.endsWith(":sqlcipher_crash_test")) {
      "Refusing to terminate anything other than the isolated SQLCipher crash fixture"
    }
    val ctx = requireNotNull(context)
    val witness = File(ctx.noBackupFilesDir, WITNESS_FILE)
    check(!witness.exists()) { "Prior synthetic witness must be cleaned explicitly" }

    // IMPORTANT: return the Binder call first. Killing a provider WHILE a
    // client has an active ContentResolver.call can kill the calling test
    // process too. The worker remains in this private subprocess and commits
    // nothing before terminating its own PID.
    Thread({
      val key = ByteArray(32) { (it * 7 + 1).toByte() } // synthetic fixture ONLY
      val db = SyntheticSqlCipherDatabase.openExistingSynthetic(ctx, key)
      db.rawQuery("PRAGMA journal_mode=WAL", null).use { cursor ->
        check(cursor.moveToFirst() && cursor.getString(0).equals("wal", ignoreCase = true))
      }
      db.beginTransaction()
      db.execSQL("INSERT INTO lab_probe(id, marker) VALUES (2, 'crash-pending-not-committed')")
      FileOutputStream(witness).use { output ->
        output.write("pending-transaction-reached".toByteArray(Charsets.US_ASCII))
        output.fd.sync()
      }
      // Give the caller time to release its provider Binder reference. This
      // delay is NOT the durability test; transaction remains uncommitted.
      Thread.sleep(1000L)
      // No endTransaction() or db.close() in this subprocess on purpose.
      Process.killProcess(Process.myPid())
      Thread.sleep(5000L)
      error("Isolated test subprocess did not terminate")
    }, "synthetic-wal-crash-only").start()
    return Bundle.EMPTY
  }

  override fun query(
    uri: Uri, projection: Array<out String>?, selection: String?,
    selectionArgs: Array<out String>?, sortOrder: String?
  ): Cursor? = null

  override fun getType(uri: Uri): String? = null
  override fun insert(uri: Uri, values: ContentValues?): Uri? = null
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
  override fun update(
    uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?
  ): Int = 0
}

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
    val key = ByteArray(32) { (it * 7 + 1).toByte() } // synthetic fixture ONLY
    val db = SyntheticSqlCipherDatabase.openExistingSynthetic(ctx, key)
    db.rawQuery("PRAGMA journal_mode=WAL", null).use { cursor ->
      check(cursor.moveToFirst() && cursor.getString(0).equals("wal", ignoreCase = true))
    }
    db.beginTransaction()
    db.execSQL("INSERT INTO lab_probe(id, marker) VALUES (2, 'crash-pending-not-committed')")
    // Separate witness proves the remote process reached the uncommitted row.
    // It never contains a password, SQLCipher key or user financial content.
    FileOutputStream(File(ctx.noBackupFilesDir, WITNESS_FILE)).use { output ->
      output.write("pending-transaction-reached".toByteArray(Charsets.US_ASCII))
      output.fd.sync()
    }

    // Intentionally OMIT endTransaction()/close(): this is a real process kill
    // at the remote PID, not merely a simulated rollback or a clean close.
    Process.killProcess(Process.myPid())
    Thread.sleep(5000) // fail-closed if signal delivery is not immediate
    error("Remote-only crash injection did not terminate its process")
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

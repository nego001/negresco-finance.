package com.negresco.finance.security

import android.content.Context
import android.os.Build
import java.io.File
import java.nio.file.Files

/**
 * Non-mutating, non-authoritative metadata check for the DataStore file name
 * used by the isolated native-lock laboratory.
 *
 * Does NOT instantiate DataStore, deserialize records, follow files, seed an
 * absent store, migrate JS settings, grant a session, or prove authenticity.
 *
 * A result of PRESENT_UNVERIFIED is never an unlock permission. Call only as
 * a manual diagnostic; Android may race with concurrent filesystem changes.
 */
internal object NativeLockFilePresenceDiagnostic {
  private const val FILE_NAME = "negresco_native_lock.preferences_pb"
  private const val MAX_DIAGNOSTIC_SIZE = 1_048_576L

  fun inspect(context: Context?): String {
    if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O)
      return "UNAVAILABLE"
    return try {
      val folder = File(context.applicationContext.filesDir, "datastore")
      // Files.isSymbolicLink checks the path itself, not the followed target.
      // Detection is informational, and MUST NOT enable operations on either
      // a safe or an unsafe result.
      if (Files.isSymbolicLink(folder.toPath())) return "UNSAFE_ENTRY"
      val record = File(folder, FILE_NAME)
      if (Files.isSymbolicLink(record.toPath())) return "UNSAFE_ENTRY"
      if (!record.exists()) return "ABSENT"
      if (!record.isFile || !record.canRead() || record.length() > MAX_DIAGNOSTIC_SIZE)
        return "UNSAFE_ENTRY"
      // A normal-looking file might contain corrupted, stale or replayed
      // preferences. We deliberately NEVER read its bytes from this API.
      "PRESENT_UNVERIFIED"
    } catch (_: Exception) {
      "UNAVAILABLE"
    }
  }
}

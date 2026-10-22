package com.negresco.finance.security

import android.content.Context
import androidx.datastore.preferences.preferencesDataStore

/**
 * ONE process-wide DataStore delegate for the reserved existing lock file.
 * This is never a financial vault and cannot grant access or migration.
 * The property is only accessed AFTER a passive existing-file check; no
 * DataStore is opened for an absent/unavailable/unsafe file.
 *
 * An external writer, rollback, deleted file between check and read, or
 * stale/malformed schema is still possible. The returned status is therefore
 * NON-AUTHORITATIVE under all circumstances. No corruption handler, migration,
 * preference update or key API is installed.
 */
private val Context.negrescoExistingLockDiagnostic by preferencesDataStore(
  name = "negresco_native_lock"
)

internal object NativeLockExistingRecordDiagnostic {
  suspend fun classifyExisting(context: Context?, lifecycle: NativeLockLifecycleFence): String {
    val epoch = lifecycle.beginDiagnosticEpoch() ?: return "LIFECYCLE_REVOKED_LOCKED"
    val app = context?.applicationContext ?: return "STORAGE_ERROR_LOCKED"
    val presence = NativeLockFilePresenceDiagnostic.inspect(app)
    if (!lifecycle.isStillDiagnosticEpoch(epoch)) return "LIFECYCLE_REVOKED_LOCKED"
    if (presence != "PRESENT_UNVERIFIED") {
      return when (presence) {
        "ABSENT" -> "MISSING_REQUIRES_VERIFIED_MIGRATION"
        "UNSAFE_ENTRY" -> "STORAGE_ERROR_LOCKED"
        else -> "STORAGE_ERROR_LOCKED"
      }
    }
    // Kotlin DataStore uses the same process-wide Context delegate on every
    // call and Activity recreation. No second factory is created here.
    return NativeLockReadOnlySnapshotReader(
      app.negrescoExistingLockDiagnostic, lifecycle
    ).inspectOnce()
  }
}

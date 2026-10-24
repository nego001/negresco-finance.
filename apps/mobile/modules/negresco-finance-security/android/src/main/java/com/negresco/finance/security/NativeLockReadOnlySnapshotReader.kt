package com.negresco.finance.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.first

/**
 * Fase 1: internal, injection-only read of an ALREADY-OWNED DataStore.
 *
 * No factory, file path, singleton creation, migration or write operation.
 * The caller MUST own the sole DataStore instance for its test file/process.
 * This is not exported by the Expo module or used for session authorization.
 *
 * VALID_UNTRUSTED means that a snapshot has parseable fields, NOT that a
 * disable transaction, user identity or anti-rollback proof was verified.
 */
internal class NativeLockReadOnlySnapshotReader(
  private val store: DataStore<Preferences>,
  private val lifecycle: NativeLockLifecycleFence
) {
  suspend fun inspectOnce(): String {
    // Even a diagnostic read needs a native foreground epoch. This does
    // NOT constitute a biometric, owner or crypto authorization.
    val epoch = lifecycle.beginDiagnosticEpoch() ?: return "LIFECYCLE_REVOKED_LOCKED"
    val result = try {
      NativeLockTypedSnapshotClassifier.classify(store.data.first())
    } catch (cancelled: CancellationException) {
      // Do not swallow lifecycle cancellation or pretend it is a valid read.
      throw cancelled
    } catch (_: Exception) {
      // Corruption, I/O and unexpected read failures must never yield OFF.
      "STORAGE_ERROR_LOCKED"
    }
    // A pause, user-leave or destruction during data.first() invalidates
    // even a syntactically valid result. Nothing from here grants access.
    return if (lifecycle.isStillDiagnosticEpoch(epoch)) result
    else "LIFECYCLE_REVOKED_LOCKED"
  }
}

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
  private val store: DataStore<Preferences>
) {
  suspend fun inspectOnce(): String {
    return try {
      NativeLockTypedSnapshotClassifier.classify(store.data.first())
    } catch (cancelled: CancellationException) {
      // Do not swallow lifecycle cancellation or pretend it is a valid read.
      throw cancelled
    } catch (_: Exception) {
      // Corruption, I/O and unexpected read failures must never yield OFF.
      "STORAGE_ERROR_LOCKED"
    }
  }
}

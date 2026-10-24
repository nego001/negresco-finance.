package com.negresco.finance.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Synthetic failing DataStore with NO filesystem, keys or financial records.
 * Verifies storage errors become locked and lifecycle cancellation propagates.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticReadOnlyNativeLockErrorTest {
  private fun failingStore(error: Throwable): DataStore<Preferences> =
    object : DataStore<Preferences> {
      override val data: Flow<Preferences> = flow { throw error }

      override suspend fun updateData(
        transform: suspend (t: Preferences) -> Preferences
      ): Preferences = throw UnsupportedOperationException("read-only fixture")
    }

  @Test fun readExceptionFailsClosedWithoutAnyUnlock() = runBlocking {
    val lifecycle = NativeLockLifecycleFence().apply { onForeground() }
    val reader = NativeLockReadOnlySnapshotReader(
      failingStore(IllegalStateException("synthetic-corruption")), lifecycle)
    assertEquals("STORAGE_ERROR_LOCKED", reader.inspectOnce())
  }

  @Test fun coroutineCancellationIsNeverSwallowedAsReadableSnapshot() = runBlocking {
    val lifecycle = NativeLockLifecycleFence().apply { onForeground() }
    val reader = NativeLockReadOnlySnapshotReader(
      failingStore(CancellationException("synthetic-background-transition")), lifecycle)
    try {
      reader.inspectOnce()
      fail("cancellation must propagate to the native lifecycle")
    } catch (_: CancellationException) {
      // Correct: cancelled reads never create an accepted state.
    }
  }
}

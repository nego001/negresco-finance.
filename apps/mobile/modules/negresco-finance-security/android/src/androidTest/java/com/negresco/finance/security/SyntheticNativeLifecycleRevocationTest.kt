package com.negresco.finance.security

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.emptyPreferences
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Activity lifecycle revocation for read-only, NON-AUTHORITATIVE diagnostics.
 * Fake DataStore has no files, keys, biometric prompts or finance records.
 * All events in this test are synthetic and never grant a session.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticNativeLifecycleRevocationTest {
  private fun readOnlyStore(
    started: CompletableDeferred<Unit>? = null,
    release: CompletableDeferred<Unit>? = null
  ): DataStore<Preferences> = object : DataStore<Preferences> {
    override val data: Flow<Preferences> = flow {
      started?.complete(Unit)
      release?.await()
      emit(emptyPreferences())
    }
    override suspend fun updateData(
      transform: suspend (t: Preferences) -> Preferences
    ): Preferences = throw UnsupportedOperationException("no mutation in lifecycle fixture")
  }

  @Test fun noForegroundCannotStartDataStoreRead() = runBlocking {
    val fence = NativeLockLifecycleFence()
    val reader = NativeLockReadOnlySnapshotReader(readOnlyStore(), fence)
    assertNull(fence.beginDiagnosticEpoch())
    assertEquals("LIFECYCLE_REVOKED_LOCKED", reader.inspectOnce())
  }

  @Test fun pauseInvalidatesPreviousEpochAndResumeNeverReusesIt() {
    val fence = NativeLockLifecycleFence()
    fence.onForeground()
    val first = fence.beginDiagnosticEpoch()
    assertNotNull(first)
    assertTrue(fence.isStillDiagnosticEpoch(first!!))
    fence.onBackground()
    assertFalse(fence.isStillDiagnosticEpoch(first))
    assertNull(fence.beginDiagnosticEpoch())
    fence.onForeground()
    val second = fence.beginDiagnosticEpoch()
    assertNotNull(second)
    assertFalse("a prior Activity epoch must never authorize future observations",
      fence.isStillDiagnosticEpoch(first))
    assertTrue(fence.isStillDiagnosticEpoch(second!!))
  }

  @Test fun userLeaveOrModuleDestructionPermanentlyRevokesPriorRead() = runBlocking {
    val fence = NativeLockLifecycleFence()
    fence.onForeground()
    val epoch = fence.beginDiagnosticEpoch()!!
    fence.onBackground() // OnUserLeavesActivity must revoke even before pause.
    assertFalse(fence.isStillDiagnosticEpoch(epoch))
    fence.onDestroyed() // OnActivityDestroys / OnDestroy.
    fence.onForeground() // Destroyed module may not reactivate.
    assertNull(fence.beginDiagnosticEpoch())
    assertEquals("LIFECYCLE_REVOKED_LOCKED",
      NativeLockReadOnlySnapshotReader(readOnlyStore(), fence).inspectOnce())
  }

  @Test fun completedReadFromPriorForegroundMustBeDiscarded() = runBlocking {
    val started = CompletableDeferred<Unit>()
    val release = CompletableDeferred<Unit>()
    val fence = NativeLockLifecycleFence().apply { onForeground() }
    val reader = NativeLockReadOnlySnapshotReader(readOnlyStore(started, release), fence)
    val pending = async { reader.inspectOnce() }
    started.await()
    fence.onBackground()
    release.complete(Unit)
    assertEquals("LIFECYCLE_REVOKED_LOCKED", pending.await())
  }

  @Test fun foregroundReadIsStillOnlyDiagnosticNotAccess() = runBlocking {
    val fence = NativeLockLifecycleFence().apply { onForeground() }
    val reader = NativeLockReadOnlySnapshotReader(readOnlyStore(), fence)
    assertEquals("MISSING_REQUIRES_VERIFIED_MIGRATION", reader.inspectOnce())
    fence.onBackground()
    assertEquals("LIFECYCLE_REVOKED_LOCKED", reader.inspectOnce())
  }
}

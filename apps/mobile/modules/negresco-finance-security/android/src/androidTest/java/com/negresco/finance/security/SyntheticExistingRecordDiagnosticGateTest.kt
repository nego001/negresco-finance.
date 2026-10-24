package com.negresco.finance.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Phase1 existing-record diagnostic preflight: never touches the target
 * lock file in these test cases, nor creates/migrates any preferences.
 * A passing test does NOT authenticate a native session or enable finance.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticExistingRecordDiagnosticGateTest {
  @Test fun backgroundCannotReadEvenWithAndroidContext() = runBlocking {
    val fence = NativeLockLifecycleFence()
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    assertEquals("LIFECYCLE_REVOKED_LOCKED",
      NativeLockExistingRecordDiagnostic.classifyExisting(context, fence))
  }

  @Test fun missingContextCannotStartNativeStorageRead() = runBlocking {
    val fence = NativeLockLifecycleFence().apply { onForeground() }
    assertEquals("STORAGE_ERROR_LOCKED",
      NativeLockExistingRecordDiagnostic.classifyExisting(null, fence))
  }

  @Test fun destroyedActivityCannotBeReusedByNativeReader() = runBlocking {
    val fence = NativeLockLifecycleFence().apply {
      onForeground()
      onDestroyed()
    }
    assertEquals("LIFECYCLE_REVOKED_LOCKED",
      NativeLockExistingRecordDiagnostic.classifyExisting(null, fence))
  }
}

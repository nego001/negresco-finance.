package com.negresco.finance.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Negative Android instrumentation: deletion failures are injected, not
 * performed against actual KeyStore aliases or real financial databases.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticDebugQaCleanupLedgerTest {
  private val sample = File("disposable-fixture-not-created")

  @Test fun failingAliasRevocationRetainsAliasAndBlocksCleanState() {
    val result = SyntheticDebugQaCleanupLedger.cleanup(
      alias = "fake-not-a-real-keystore-alias",
      directory = null,
      deleteAlias = { false },
      deleteDirectory = { error("directory deletion must not run") })
    assertFalse(result.complete)
    assertEquals("fake-not-a-real-keystore-alias", result.alias)
    assertNull(result.directory)
  }

  @Test fun failingDirectoryDeletionRetainsPathAndBlocksCleanState() {
    val result = SyntheticDebugQaCleanupLedger.cleanup(
      alias = null,
      directory = sample,
      deleteAlias = { error("alias deletion must not run") },
      deleteDirectory = { false })
    assertFalse(result.complete)
    assertEquals(sample, result.directory)
    assertNull(result.alias)
  }

  @Test fun retryCannotReportCleanUntilAllResiduesAreRemoved() {
    val initial = SyntheticDebugQaCleanupLedger.cleanup(
      alias = "fixture-alias",
      directory = sample,
      deleteAlias = { false },
      deleteDirectory = { true })
    assertFalse(initial.complete)
    assertEquals("fixture-alias", initial.alias)
    assertNull(initial.directory)
    val retried = SyntheticDebugQaCleanupLedger.cleanup(
      alias = initial.alias,
      directory = initial.directory,
      deleteAlias = { true },
      deleteDirectory = { error("already cleared directory must not run") })
    assertTrue(retried.complete)
    assertNull(retried.alias)
    assertNull(retried.directory)
  }

  @Test fun thrownRevocationAndDeletionCannotBeMisreportedAsPass() {
    val initial = SyntheticDebugQaCleanupLedger.cleanup(
      alias = "fixture-alias",
      directory = sample,
      deleteAlias = { throw IllegalStateException("synthetic alias deletion fault") },
      deleteDirectory = { throw IllegalStateException("synthetic directory deletion fault") })
    assertFalse(initial.complete)
    assertEquals("fixture-alias", initial.alias)
    assertEquals(sample, initial.directory)
    val retry = SyntheticDebugQaCleanupLedger.cleanup(
      alias = initial.alias,
      directory = initial.directory,
      deleteAlias = { true },
      deleteDirectory = { true })
    assertTrue(retry.complete)
  }
}

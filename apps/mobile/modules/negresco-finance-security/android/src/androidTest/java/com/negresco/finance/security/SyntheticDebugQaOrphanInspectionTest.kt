package com.negresco.finance.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

/** Synthetic enumeration fault injection. No keys, biometric prompts or DB. */
@RunWith(AndroidJUnit4::class)
class SyntheticDebugQaOrphanInspectionTest {
  private val hold = SyntheticDebugQaOrphanInspection.Decision.HOLD_INSPECTION_UNAVAILABLE
  private val residue = SyntheticDebugQaOrphanInspection.Decision.HOLD_ORPHANED_DEBUG_QA_RESIDUE
  private val clean = SyntheticDebugQaOrphanInspection.Decision.QA_FIXTURES_CLEAR

  @Test fun missingCacheListingCannotBeTreatedAsEmptyStorage() {
    assertEquals(hold, SyntheticDebugQaOrphanInspection.inspect(
      readAliases = { emptyList() }, readCache = { null }))
  }

  @Test fun thrownAndroidKeystoreEnumerationNeverProceedsToQa() {
    assertEquals(hold, SyntheticDebugQaOrphanInspection.inspect(
      readAliases = { throw IllegalStateException("synthetic keystore outage") },
      readCache = { error("should not read cache after Keystore failure") }))
  }

  @Test fun thrownCacheEnumerationNeverProceedsToQa() {
    assertEquals(hold, SyntheticDebugQaOrphanInspection.inspect(
      readAliases = { emptyList() },
      readCache = { throw IllegalStateException("synthetic cache outage") }))
  }

  @Test fun suspectAliasOrFolderAlwaysBlocksNextDebugQa() {
    assertEquals(residue, SyntheticDebugQaOrphanInspection.inspect(
      readAliases = { listOf("negresco_debug_sqlcipher_orphan") },
      readCache = { emptyList() }))
    assertEquals(residue, SyntheticDebugQaOrphanInspection.inspect(
      readAliases = { emptyList() },
      readCache = { listOf("negresco_qa_sqlcipher_orphan") }))
  }

  @Test fun cleanNamesPermitOnlyManualDebugPreparationNotFinancialAccess() {
    assertEquals(clean, SyntheticDebugQaOrphanInspection.inspect(
      readAliases = { listOf("unrelated_alias") },
      readCache = { listOf("unrelated_cache") }))
  }
}

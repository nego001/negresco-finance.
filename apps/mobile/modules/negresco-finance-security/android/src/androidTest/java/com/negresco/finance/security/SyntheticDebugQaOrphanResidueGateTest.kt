package com.negresco.finance.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Unattended negative-only QA tests; no KeyStore writes, no SQLCipher I/O.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticDebugQaOrphanResidueGateTest {
  @Test fun noResidualKeysOrFoldersPermitsOnlyPreparingManualQa() {
    assertTrue(SyntheticDebugQaOrphanResidueGate.isClear(emptyList(), emptyList()))
  }

  @Test fun survivingKeystoreAliasAfterProcessDeathBlocksNewQa() {
    assertFalse(SyntheticDebugQaOrphanResidueGate.isClear(
      listOf("negresco_debug_sqlcipher_abandoned"), emptyList()))
  }

  @Test fun survivingSqlcipherCacheFolderAfterProcessDeathBlocksNewQa() {
    assertFalse(SyntheticDebugQaOrphanResidueGate.isClear(
      emptyList(), listOf("negresco_qa_sqlcipher_orphaned")))
  }

  @Test fun unrelatedKeysDoNotMaskAnySyntheticQaResidue() {
    assertTrue(SyntheticDebugQaOrphanResidueGate.isClear(
      listOf("other_app_alias", "negresco_debug_keystore_not_sqlcipher"),
      listOf("other_cache", "negresco_misc")))
    assertFalse(SyntheticDebugQaOrphanResidueGate.isClear(
      listOf("other_app_alias", "negresco_debug_sqlcipher_crashed"),
      listOf("other_cache", "negresco_qa_sqlcipher_crashed")))
  }
}

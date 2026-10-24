package com.negresco.finance.security

import android.content.ComponentName
import android.view.ViewGroup
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.security.KeyStore
import java.util.UUID

/**
 * DEBUG-only Activity boundary. Fabricated cache folder, no biometrics, no
 * financial database and no real KeyStore alias provisioning.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticDebugQaOrphanActivityBoundaryTest {
  private fun aliases(): Set<String> =
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.aliases().toList()
      .filter { it.startsWith("negresco_debug_sqlcipher_") }.toSet()

  @Test fun orphanedFixtureFolderBlocksActivityBeforeBiometricPromptOrKeyCreation() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val info = context.packageManager.getActivityInfo(
      ComponentName(context, SyntheticBiometricSqlcipherManualQaActivity::class.java), 0)
    assertFalse("Debug QA Activity must never be exported", info.exported)
    val folder = File(context.cacheDir, "negresco_qa_sqlcipher_orphan_test_" + UUID.randomUUID())
    assertTrue("Disposable orphan fixture should be created", folder.mkdir())
    val beforeAliases = aliases()
    val scenario = ActivityScenario.launch(SyntheticBiometricSqlcipherManualQaActivity::class.java)
    try {
      scenario.onActivity { activity ->
        activity.startManualQa(null)
        val container = activity.findViewById<ViewGroup>(android.R.id.content)
        val layout = container.getChildAt(0) as ViewGroup
        val message = (layout.getChildAt(0) as TextView).text.toString()
        assertEquals("DEBUG QA: HOLD_ORPHANED_DEBUG_QA_RESIDUE", message)
      }
      assertTrue("The guard may not silently delete suspected residues", folder.isDirectory)
      assertEquals("A hold cannot mint an extra KeyStore alias", beforeAliases, aliases())
    } finally {
      scenario.close()
      assertTrue("Remove only the fixture created by this test", folder.delete())
    }
  }

  @Test fun unrelatedCacheEntryCannotTriggerOrphanResidueDecision() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val unrelated = File(context.cacheDir, "negresco_unrelated_qa_test_" + UUID.randomUUID())
    assertTrue(unrelated.mkdir())
    try {
      val aliases = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        .aliases().toList()
      val names = context.cacheDir.listFiles()?.map { it.name }
        ?: error("QA cache cannot be enumerated")
      // Other suite fixtures might coexist; remove only the unrelated fixture
      // from this check by testing it in isolation as a name.
      assertTrue(SyntheticDebugQaOrphanResidueGate.isClear(
        aliases.filterNot { it.startsWith("negresco_debug_sqlcipher_") },
        listOf(unrelated.name)))
    } finally {
      assertTrue(unrelated.delete())
    }
  }
}

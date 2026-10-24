package com.negresco.finance.security

import android.content.ComponentName
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.security.KeyStore

/**
 * Unattended NEGATIVE-only test. Never invokes startManualQa or a fingerprint.
 * Launch alone must not provision Keystore, database or a financial permission.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticBiometricSqlcipherQaIsolationTest {
  private fun aliases(): Set<String> =
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
      .aliases().toList().filter { it.startsWith("negresco_debug_sqlcipher_") }.toSet()

  @Test fun debugSqlcipherActivityLaunchCannotProvisionKeyOrSyntheticDatabase() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val info = context.packageManager.getActivityInfo(
      ComponentName(context, SyntheticBiometricSqlcipherManualQaActivity::class.java), 0)
    assertFalse("test-only activity must not be exported", info.exported)
    val beforeKeys = aliases()
    val beforeFolders = context.cacheDir.listFiles()?.count {
      it.name.startsWith("negresco_qa_sqlcipher_")
    } ?: 0
    val scenario = ActivityScenario.launch(SyntheticBiometricSqlcipherManualQaActivity::class.java)
    try {
      scenario.onActivity { activity ->
        val layout = activity.findViewById<android.view.ViewGroup>(android.R.id.content)
        val text = ((layout.getChildAt(0) as android.view.ViewGroup)
          .getChildAt(0) as android.widget.TextView).text.toString()
        assertTrue("QA only must be explicitly labelled", text.startsWith("DEBUG QA"))
      }
      assertEquals("idle launch cannot create a KeyStore alias", beforeKeys, aliases())
      assertEquals("idle launch cannot create a SQLCipher file", beforeFolders,
        context.cacheDir.listFiles()?.count {
          it.name.startsWith("negresco_qa_sqlcipher_")
        } ?: 0)
    } finally { scenario.close() }
    assertEquals("Activity close cannot create native keys", beforeKeys, aliases())
  }
}

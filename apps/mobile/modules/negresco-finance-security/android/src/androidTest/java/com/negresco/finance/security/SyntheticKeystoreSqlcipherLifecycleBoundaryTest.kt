package com.negresco.finance.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import net.zetetic.database.sqlcipher.SQLiteDatabase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.security.GeneralSecurityException
import java.security.KeyStore
import java.security.MessageDigest
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Synthetic AndroidTest-only vertical slice: Keystore wraps a test password,
 * SQLCipher holds one fake row and the native lifecycle revokes a stale epoch.
 * The test-owned fixturePermit is NOT biometric approval or real authorization.
 * No code here is exported to JS or shipped in a Release AAR. The key uses
 * setUserAuthenticationRequired(false) intentionally; this is NOT a vault.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticKeystoreSqlcipherLifecycleBoundaryTest {
  private data class Fixture(
    val directory: File, val database: File, val envelope: File,
    val alias: String, val binding: ByteArray, val marker: String
  )

  private fun store(): KeyStore =
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

  private fun prepare(): Fixture {
    System.loadLibrary("sqlcipher")
    val cache = InstrumentationRegistry.getInstrumentation().targetContext.cacheDir
    val directory = File(cache, "sec05_native_slice_" + UUID.randomUUID())
    check(directory.mkdirs())
    val database = File(directory, "fixture.db")
    val envelope = File(directory, "test-only-envelope.bin")
    val alias = "negresco_slice_" + UUID.randomUUID()
    val binding = ("SEC05|test-only|" + UUID.randomUUID() + "|fixture.db")
      .toByteArray(Charsets.UTF_8)
    val password = UUID.randomUUID().toString() + UUID.randomUUID().toString()
    val marker = "not-financial-" + UUID.randomUUID()
    try {
      val generator = KeyGenerator.getInstance(
        KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
      generator.init(KeyGenParameterSpec.Builder(
        alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .setUserAuthenticationRequired(false)
        .build())
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, generator.generateKey())
      cipher.updateAAD(binding)
      val iv = cipher.iv
      check(iv.size in 12..16)
      envelope.writeBytes(byteArrayOf(iv.size.toByte()) + iv +
        cipher.doFinal(password.toByteArray(Charsets.UTF_8)))
      val db = SQLiteDatabase.openOrCreateDatabase(database, password, null, null, null)
      try {
        db.execSQL("CREATE TABLE synthetic_record(id INTEGER PRIMARY KEY, value TEXT NOT NULL)")
        db.execSQL("INSERT INTO synthetic_record(id, value) VALUES (1, ?)", arrayOf(marker))
      } finally {
        db.close()
      }
      return Fixture(directory, database, envelope, alias, binding, marker)
    } catch (error: Throwable) {
      try { SQLiteDatabase.deleteDatabase(database) } catch (_: Exception) {}
      try { store().deleteEntry(alias) } catch (_: Exception) {}
      directory.deleteRecursively()
      throw error
    }
  }

  private fun cleanup(f: Fixture) {
    try {
      SQLiteDatabase.deleteDatabase(f.database)
    } finally {
      store().deleteEntry(f.alias)
      assertFalse(store().containsAlias(f.alias))
      assertTrue("test-only files must be removed", f.directory.deleteRecursively())
    }
  }

  /**
   * This is test instrumentation, not a production authorizer. Foreground
   * alone cannot proceed: the caller must provide a separate TEST permit.
   * Only a status string is returned, never decrypted data or a password.
   */
  private fun observeFixtureOnly(
    f: Fixture,
    lifecycle: NativeLockLifecycleFence,
    epoch: Long?,
    fixturePermit: Boolean,
    onCryptoReached: () -> Unit,
    onRowObserved: () -> Unit = {}
  ): String {
    if (!fixturePermit || epoch == null || !lifecycle.isStillDiagnosticEpoch(epoch))
      return "HOLD_TEST_PERMIT_OR_LIFECYCLE"
    onCryptoReached()
    // A genuine lifecycle event may race the preflight before key lookup.
    // Instrumentation hook deliberately injects that event here.
    if (!lifecycle.isStillDiagnosticEpoch(epoch)) return "HOLD_REVOKED_BEFORE_KEY_LOOKUP"
    val key = store().getKey(f.alias, null) as? SecretKey ?: return "HOLD_MISSING_TEST_KEY"
    val bytes = f.envelope.readBytes()
    if (bytes.size < 1 + 12 + 16) return "HOLD_INVALID_TEST_ENVELOPE"
    val ivSize = bytes[0].toInt() and 0xff
    if (ivSize !in 12..16 || bytes.size <= 1 + ivSize + 16)
      return "HOLD_INVALID_TEST_ENVELOPE"
    val secret = try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key,
        GCMParameterSpec(128, bytes.copyOfRange(1, 1 + ivSize)))
      cipher.updateAAD(f.binding)
      cipher.doFinal(bytes.copyOfRange(1 + ivSize, bytes.size))
    } catch (_: GeneralSecurityException) {
      return "HOLD_BAD_TEST_KEY_OR_TAG"
    }
    try {
      if (!lifecycle.isStillDiagnosticEpoch(epoch)) return "HOLD_REVOKED_BEFORE_READ"
      val db = SQLiteDatabase.openDatabase(f.database.absolutePath,
        secret.toString(Charsets.UTF_8), null,
        SQLiteDatabase.OPEN_READONLY, null, null)
      try {
        val matches = db.rawQuery("SELECT value FROM synthetic_record WHERE id = 1", null)
          .use { cursor -> cursor.moveToFirst() && cursor.getString(0) == f.marker }
        onRowObserved() // Inject deterministic revocation before reporting success.
        if (!lifecycle.isStillDiagnosticEpoch(epoch)) return "HOLD_REVOKED_AFTER_READ"
        return if (matches) "OBSERVED_FIXTURE_ONLY_NOT_AUTHORIZATION"
          else "HOLD_TEST_ROW_MISMATCH"
      } finally {
        db.close()
      }
    } finally {
      secret.fill(0) // Best effort: SQLCipher String copies cannot be wiped.
    }
  }

  @Test fun foregroundRevocationDeniesProtectedFixtureReadBeforeKeyRelease() {
    val fixture = prepare()
    val lifecycle = NativeLockLifecycleFence()
    var cryptoTouches = 0
    val touch: () -> Unit = { cryptoTouches += 1 }
    try {
      assertEquals("HOLD_TEST_PERMIT_OR_LIFECYCLE",
        observeFixtureOnly(fixture, lifecycle, null, true, touch))
      lifecycle.onForeground()
      val first = lifecycle.beginDiagnosticEpoch()!!
      assertEquals("HOLD_TEST_PERMIT_OR_LIFECYCLE",
        observeFixtureOnly(fixture, lifecycle, first, false, touch))
      assertEquals(0, cryptoTouches)
      assertEquals("OBSERVED_FIXTURE_ONLY_NOT_AUTHORIZATION",
        observeFixtureOnly(fixture, lifecycle, first, true, touch))
      assertEquals(1, cryptoTouches)
      lifecycle.onBackground()
      assertEquals("HOLD_TEST_PERMIT_OR_LIFECYCLE",
        observeFixtureOnly(fixture, lifecycle, first, true, touch))
      lifecycle.onForeground()
      assertEquals("HOLD_TEST_PERMIT_OR_LIFECYCLE",
        observeFixtureOnly(fixture, lifecycle, first, true, touch))
      val second = lifecycle.beginDiagnosticEpoch()!!
      assertFalse("a previous lifecycle epoch is not reused", first == second)
      assertEquals("HOLD_TEST_PERMIT_OR_LIFECYCLE",
        observeFixtureOnly(fixture, lifecycle, second, false, touch))
      assertEquals("no Keystore lookup for denied attempts", 1, cryptoTouches)
    } finally {
      lifecycle.onDestroyed()
      cleanup(fixture)
    }
  }

  @Test fun revocationBetweenPreflightAndKeystoreLookupMustHold() {
    val f = prepare()
    val lifecycle = NativeLockLifecycleFence().apply { onForeground() }
    try {
      val epoch = lifecycle.beginDiagnosticEpoch()!!
      val before = MessageDigest.getInstance("SHA-256").digest(f.database.readBytes())
      assertEquals("HOLD_REVOKED_BEFORE_KEY_LOOKUP",
        observeFixtureOnly(f, lifecycle, epoch, true,
          { lifecycle.onBackground() }))
      assertFalse(lifecycle.isStillDiagnosticEpoch(epoch))
      assertTrue("revocation must preserve ciphertext", before.contentEquals(
        MessageDigest.getInstance("SHA-256").digest(f.database.readBytes())))
      assertTrue("test key must remain for supervised retry", store().containsAlias(f.alias))
    } finally {
      lifecycle.onDestroyed()
      cleanup(f)
    }
  }

  @Test fun revocationAfterSqlcipherReadCannotReportSuccess() {
    val f = prepare()
    val lifecycle = NativeLockLifecycleFence().apply { onForeground() }
    try {
      val epoch = lifecycle.beginDiagnosticEpoch()!!
      val before = MessageDigest.getInstance("SHA-256").digest(f.database.readBytes())
      assertEquals("HOLD_REVOKED_AFTER_READ",
        observeFixtureOnly(f, lifecycle, epoch, true, {},
          { lifecycle.onBackground() }))
      assertFalse(lifecycle.isStillDiagnosticEpoch(epoch))
      assertTrue("read-path revocation must preserve ciphertext", before.contentEquals(
        MessageDigest.getInstance("SHA-256").digest(f.database.readBytes())))
    } finally {
      lifecycle.onDestroyed()
      cleanup(f)
    }
  }

  @Test fun missingKeystoreAliasDoesNotRecreateOrEraseNativeCiphertext() {
    val f = prepare()
    val lifecycle = NativeLockLifecycleFence().apply { onForeground() }
    try {
      val before = MessageDigest.getInstance("SHA-256").digest(f.database.readBytes())
      val envelopeBefore = f.envelope.readBytes()
      store().deleteEntry(f.alias)
      assertFalse(store().containsAlias(f.alias))
      assertEquals("HOLD_MISSING_TEST_KEY",
        observeFixtureOnly(f, lifecycle, lifecycle.beginDiagnosticEpoch(), true, {}))
      assertFalse("no automatic re-enrollment after key loss", store().containsAlias(f.alias))
      assertTrue("database ciphertext must survive key loss", before.contentEquals(
        MessageDigest.getInstance("SHA-256").digest(f.database.readBytes())))
      assertTrue("wrapped test envelope must not change",
        envelopeBefore.contentEquals(f.envelope.readBytes()))
    } finally {
      lifecycle.onDestroyed()
      cleanup(f)
    }
  }
}

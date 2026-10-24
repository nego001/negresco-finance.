package com.negresco.finance.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import net.zetetic.database.sqlcipher.SQLiteDatabase
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.security.GeneralSecurityException
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * SEC-05 / Phase 1 - Android INSTRUMENTATION ONLY, with fictional data.
 *
 * Tests AES/GCM envelope wrapping of a disposable SQLCipher test password via
 * an ephemeral AndroidKeyStore alias. No React Native bridge export; NO
 * user-auth-required key, biometric grant, hardware attestation, real account,
 * finance persistence, release APK or anti-rollback authority is implemented.
 *
 * The JVM String used by the SQLCipher test API is not guaranteed zeroizable:
 * this is an integration experiment, NOT a production key lifecycle design.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticKeystoreWrappedSqlcipherLifecycleTest {
  private fun store(): KeyStore =
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

  private fun makeKey(alias: String): SecretKey {
    val generator = KeyGenerator.getInstance(
      KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(KeyGenParameterSpec.Builder(
      alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      // IMPORTANT: this is NOT biometric or per-operation authorization.
      .setUserAuthenticationRequired(false)
      .build())
    return generator.generateKey()
  }

  private fun wrap(key: SecretKey, password: ByteArray, binding: ByteArray): ByteArray {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key)
    cipher.updateAAD(binding)
    val iv = cipher.iv
    require(iv.size in 12..16)
    val sealed = cipher.doFinal(password)
    return byteArrayOf(iv.size.toByte()) + iv + sealed
  }

  private fun unwrap(key: SecretKey, envelope: ByteArray, binding: ByteArray): ByteArray {
    require(envelope.size >= 1 + 12 + 16) { "Malformed synthetic envelope" }
    val ivLength = envelope[0].toInt() and 0xff
    require(ivLength in 12..16 && envelope.size > 1 + ivLength + 16)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, key,
      GCMParameterSpec(128, envelope.copyOfRange(1, 1 + ivLength)))
    cipher.updateAAD(binding)
    return cipher.doFinal(envelope.copyOfRange(1 + ivLength, envelope.size))
  }

  private fun fixtures(): File {
    val dir = File(InstrumentationRegistry.getInstrumentation().targetContext.cacheDir,
      "sec05k_keystore_sqlcipher_${UUID.randomUUID()}")
    check(dir.mkdirs()) { "Disposable database sandbox unavailable" }
    return dir
  }

  private fun create(file: File, password: ByteArray, value: String) {
    val pass = password.toString(Charsets.UTF_8)
    val db = SQLiteDatabase.openOrCreateDatabase(file, pass, null, null, null)
    try {
      db.execSQL("CREATE TABLE fixture(id INTEGER PRIMARY KEY, value TEXT NOT NULL)")
      db.execSQL("INSERT INTO fixture(id, value) VALUES (1, ?)", arrayOf(value))
    } finally {
      db.close()
    }
  }

  private fun read(file: File, password: ByteArray): String {
    // NEVER use openOrCreateDatabase for recovery: missing/wrong keys must
    // not seed another database or silently overwrite the existing file.
    val db = SQLiteDatabase.openDatabase(
      file.absolutePath, password.toString(Charsets.UTF_8), null,
      SQLiteDatabase.OPEN_READONLY, null, null)
    try {
      return db.rawQuery("SELECT value FROM fixture WHERE id = 1", null).use { cursor ->
        assertTrue(cursor.moveToFirst())
        cursor.getString(0)
      }
    } finally {
      db.close()
    }
  }

  private fun cleanup(root: File, database: File, alias: String) {
    try {
      SQLiteDatabase.deleteDatabase(database)
    } finally {
      store().deleteEntry(alias)
      assertFalse(store().containsAlias(alias))
      assertTrue("remove all synthetic artifacts", root.deleteRecursively())
    }
  }

  @Test fun wrappedKeyReopensSyntheticSqlcipherAndTamperDoesNotOverwriteDatabase() {
    System.loadLibrary("sqlcipher")
    val root = fixtures()
    val database = File(root, "disposable.db")
    val envelopeFile = File(root, "wrapped_test_only.bin")
    val alias = "negresco_wrapped_fixture_${UUID.randomUUID()}"
    val binding = ("SEC05K|account:${UUID.randomUUID()}|disposable.db")
      .toByteArray(Charsets.UTF_8)
    val password = (UUID.randomUUID().toString() + UUID.randomUUID().toString())
      .toByteArray(Charsets.UTF_8)
    val sample = "fixture-not-a-balance-${UUID.randomUUID()}"
    try {
      val key = makeKey(alias)
      val envelope = wrap(key, password, binding)
      envelopeFile.writeBytes(envelope)
      create(database, password, sample)
      password.fill(0)

      assertTrue(database.isFile && envelopeFile.isFile)
      val keyAgain = store().getKey(alias, null) as SecretKey
      assertNotNull(keyAgain)
      val reopenedPassword = unwrap(keyAgain, envelopeFile.readBytes(), binding)
      try {
        assertEquals(sample, read(database, reopenedPassword))
      } finally {
        reopenedPassword.fill(0)
      }

      val forgedEnvelope = envelopeFile.readBytes()
      forgedEnvelope[forgedEnvelope.lastIndex] =
        (forgedEnvelope.last().toInt() xor 1).toByte()
      var badTagRejected = false
      try {
        unwrap(keyAgain, forgedEnvelope, binding)
      } catch (_: GeneralSecurityException) {
        badTagRejected = true
      }
      assertTrue("tampered wrapped key must fail before database open", badTagRejected)
      assertArrayEquals(envelope, envelopeFile.readBytes())

      var wrongAccountRejected = false
      try {
        unwrap(keyAgain, envelope, "SEC05K|wrong-account".toByteArray(Charsets.UTF_8))
      } catch (_: GeneralSecurityException) {
        wrongAccountRejected = true
      }
      assertTrue("account-bound wrapped key must reject a different AAD", wrongAccountRejected)

      val finalPassword = unwrap(store().getKey(alias, null) as SecretKey,
        envelopeFile.readBytes(), binding)
      try {
        assertEquals(sample, read(database, finalPassword))
      } finally {
        finalPassword.fill(0)
      }
    } finally {
      password.fill(0)
      cleanup(root, database, alias)
    }
  }

  @Test fun lostKeystoreAliasCannotAutoReenrollOrEraseExistingCiphertext() {
    System.loadLibrary("sqlcipher")
    val root = fixtures()
    val database = File(root, "disposable.db")
    val envelopeFile = File(root, "wrapped_test_only.bin")
    val alias = "negresco_wrapped_fixture_${UUID.randomUUID()}"
    val binding = ("SEC05K|account:${UUID.randomUUID()}|disposable.db")
      .toByteArray(Charsets.UTF_8)
    val password = (UUID.randomUUID().toString() + UUID.randomUUID().toString())
      .toByteArray(Charsets.UTF_8)
    try {
      val envelope = wrap(makeKey(alias), password, binding)
      envelopeFile.writeBytes(envelope)
      create(database, password, "synthetic-preserve-on-key-loss")
      password.fill(0)
      val beforeLength = database.length()
      assertTrue(beforeLength > 0L)

      store().deleteEntry(alias)
      assertNull("missing test alias means HOLD, never regenerate", store().getKey(alias, null))
      assertFalse(store().containsAlias(alias))
      assertArrayEquals(envelope, envelopeFile.readBytes())
      assertEquals(beforeLength, database.length())
      assertTrue("losing key must not trigger a new encrypted DB", database.isFile)
      // In production, this case needs explicit owner-authorized recovery;
      // this fixture NEVER attempts to enroll a replacement or use a fallback.
    } finally {
      password.fill(0)
      cleanup(root, database, alias)
    }
  }
}

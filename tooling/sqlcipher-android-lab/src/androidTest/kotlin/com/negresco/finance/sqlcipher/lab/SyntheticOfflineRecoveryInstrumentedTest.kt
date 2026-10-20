package com.negresco.finance.sqlcipher.lab

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.security.SecureRandom
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Disposable emulator-only recovery verification; no biometric/Keystore bypass.
 * Real users and real data are never involved in this test package.
 */
@RunWith(AndroidJUnit4::class)
class SyntheticOfflineRecoveryInstrumentedTest {
  private val context: Context
    get() = InstrumentationRegistry.getInstrumentation().targetContext
  private val file: File
    get() = File(context.noBackupFilesDir, "negresco_sqlcipher_synthetic_v1.db")
  private val passphrase: ByteArray
    get() = ByteArray(32).also { SecureRandom().nextBytes(it) }
  private var ownsFixture = false

  @Before fun requireNoPriorFixture() {
    assertFalse("Existing fixture may never be silently replaced", file.exists())
  }

  @After fun cleanupOnlyOurDisposableFixture() {
    if (ownsFixture) {
      file.delete()
      File(file.path + "-wal").delete()
      File(file.path + "-shm").delete()
      File(file.path + "-journal").delete()
    }
  }

  private fun <T> withKit(block: (ByteArray, SyntheticOfflineRecoveryLab.Kit) -> T): T {
    val original = passphrase
    val kit = SyntheticOfflineRecoveryLab.createFreshSyntheticKit(original)
    try {
      return block(original, kit)
    } finally {
      original.fill(0)
      kit.recoverySecret.fill(0)
    }
  }

  @Test fun offlineRecoveryReopensTheExistingEncryptedDatabase() = withKit { original, kit ->
    ownsFixture = true
    SyntheticSqlCipherDatabase.createFreshSynthetic(context, original).use { db ->
      db.execSQL("INSERT INTO lab_probe(id, marker) VALUES (1, 'recovery-fixture')")
    }
    val recovered = SyntheticOfflineRecoveryLab.recoverSyntheticPassphrase(
      kit.envelope, kit.recoverySecret, kit.databaseId)
    try {
      assertArrayEquals(original, recovered)
      SyntheticSqlCipherDatabase.openExistingSynthetic(context, recovered).use { db ->
        db.rawQuery("SELECT marker FROM lab_probe WHERE id = 1", null).use { cursor ->
          assertTrue(cursor.moveToFirst())
          assertTrue(cursor.getString(0) == "recovery-fixture")
          assertFalse(cursor.moveToNext())
        }
      }
    } finally {
      recovered.fill(0)
    }
  }

  @Test fun wrongRecoverySecretCannotReleaseThePassphrase() = withKit { _, kit ->
    val wrong = ByteArray(32).also { SecureRandom().nextBytes(it) }
    try {
      assertTrue(runCatching {
        SyntheticOfflineRecoveryLab.recoverSyntheticPassphrase(
          kit.envelope, wrong, kit.databaseId)
      }.exceptionOrNull() is SyntheticOfflineRecoveryLab.Unavailable)
    } finally {
      wrong.fill(0)
    }
  }

  @Test fun modifiedCiphertextTagIsRejected() = withKit { _, kit ->
    val tampered = kit.envelope.copyOf()
    tampered[tampered.lastIndex] = (tampered.last().toInt() xor 0x01).toByte()
    assertTrue(runCatching {
      SyntheticOfflineRecoveryLab.recoverSyntheticPassphrase(
        tampered, kit.recoverySecret, kit.databaseId)
    }.exceptionOrNull() is SyntheticOfflineRecoveryLab.Unavailable)
  }

  @Test fun wrongDatabaseIdentityCannotSwapARecoveryKit() = withKit { _, kit ->
    val otherId = kit.databaseId.copyOf()
    otherId[0] = (otherId[0].toInt() xor 0x01).toByte()
    assertTrue(runCatching {
      SyntheticOfflineRecoveryLab.recoverSyntheticPassphrase(
        kit.envelope, kit.recoverySecret, otherId)
    }.exceptionOrNull() is SyntheticOfflineRecoveryLab.Unavailable)
  }

  @Test fun modifiedEnvelopeDatabaseIdentityFailsClosed() = withKit { _, kit ->
    val tampered = kit.envelope.copyOf()
    tampered[5] = (tampered[5].toInt() xor 0x01).toByte()
    assertTrue(runCatching {
      SyntheticOfflineRecoveryLab.recoverSyntheticPassphrase(
        tampered, kit.recoverySecret, kit.databaseId)
    }.exceptionOrNull() is SyntheticOfflineRecoveryLab.Unavailable)
  }

  @Test fun malformedVersionLengthAndMissingRecoverySecretFailClosed() = withKit { _, kit ->
    val version = kit.envelope.copyOf().also { it[4] = 2 }
    val truncated = kit.envelope.copyOf(kit.envelope.size - 1)
    val candidates = listOf(
      Pair(version, kit.recoverySecret),
      Pair(truncated, kit.recoverySecret),
      Pair(kit.envelope, ByteArray(0))
    )
    for ((envelope, key) in candidates) {
      assertTrue(runCatching {
        SyntheticOfflineRecoveryLab.recoverSyntheticPassphrase(envelope, key, kit.databaseId)
      }.exceptionOrNull() is SyntheticOfflineRecoveryLab.Unavailable)
    }
  }

  @Test fun separateRecoveryKitsNeverReuseDatabaseIdOrSecret() = withKit { original, kit ->
    val second = SyntheticOfflineRecoveryLab.createFreshSyntheticKit(original)
    try {
      assertFalse(kit.databaseId.contentEquals(second.databaseId))
      assertFalse(kit.recoverySecret.contentEquals(second.recoverySecret))
      assertFalse(kit.envelope.contentEquals(second.envelope))
    } finally {
      second.recoverySecret.fill(0)
    }
  }

  @Test fun failedOfflineRecoveryDoesNotOverwriteOrRecreateEncryptedDatabase() =
    withKit { original, kit ->
      ownsFixture = true
      SyntheticSqlCipherDatabase.createFreshSynthetic(context, original).use { db ->
        db.execSQL("INSERT INTO lab_probe(id, marker) VALUES (1, 'preserve-on-failure')")
      }
      val originalBytes = file.readBytes()
      val wrong = kit.recoverySecret.copyOf().also {
        it[0] = (it[0].toInt() xor 0x01).toByte()
      }
      try {
        assertTrue(runCatching {
          SyntheticOfflineRecoveryLab.recoverSyntheticPassphrase(
            kit.envelope, wrong, kit.databaseId)
        }.exceptionOrNull() is SyntheticOfflineRecoveryLab.Unavailable)
        assertTrue(file.exists())
        assertArrayEquals("Recovery failure must not change encrypted bytes", originalBytes,
          file.readBytes())
        SyntheticSqlCipherDatabase.openExistingSynthetic(context, original).use { db ->
          db.rawQuery("SELECT count(*) FROM lab_probe", null).use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertTrue(cursor.getLong(0) == 1L)
          }
        }
      } finally {
        wrong.fill(0)
      }
    }
}

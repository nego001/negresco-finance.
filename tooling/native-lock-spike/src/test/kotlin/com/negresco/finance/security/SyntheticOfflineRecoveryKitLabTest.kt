package com.negresco.finance.security

import java.security.SecureRandom
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** SEC-05G: all credentials and data keys below are throwaway fixtures. */
internal fun runSyntheticOfflineRecoveryKitScenarios() {
  val rng = SecureRandom()
  val dataKey = ByteArray(32).also(rng::nextBytes)
  val otherKey = ByteArray(32).also(rng::nextBytes)
  val accountA = "a".repeat(32)
  val accountB = "b".repeat(32)
  val export = SyntheticOfflineRecoveryKitCryptoLab.sealFixtureOnly(
    accountA, dataKey, keyVersion = 1L, ownerGeneration = 2L
  )
  val envelope = export.envelope
  val secret = export.recoverySecretCopyForFixtureOnly()

  fun restore(
    changed: SyntheticRecoveryKitEnvelopeLab = envelope, provided: ByteArray? = secret
  ) = SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(changed, provided)
  fun modified(
    account: String = envelope.opaqueAccountId,
    id: String = envelope.kitId,
    version: Long = envelope.keyVersion,
    generation: Long = envelope.ownerGeneration,
    salt: ByteArray = envelope.saltCopy(),
    nonce: ByteArray = envelope.nonceCopy(),
    encrypted: ByteArray = envelope.ciphertextCopy()
  ) = SyntheticRecoveryKitEnvelopeLab(account,id,version,generation,salt,nonce,encrypted)

  // 1: kit material is a 256-bit random secret, not a short PIN.
  check(secret.size == 32)

  // 2: data key ciphertext includes a 16-byte authentication tag.
  check(envelope.ciphertextCopy().size == 48)

  // 3: a correct offline kit recovers a disposable 256-bit test DEK.
  check(restore()!!.copyForFixtureOnly().contentEquals(dataKey))

  // 4: envelope ciphertext must not be a copy of plaintext data key.
  check(!envelope.ciphertextCopy().copyOfRange(0,32).contentEquals(dataKey))

  // 5: a different 256-bit recovery secret cannot recover the key.
  check(restore(provided = ByteArray(32).also(rng::nextBytes)) == null)

  // 6: null secret is an explicit failure, never an empty-password fallback.
  check(restore(provided = null) == null)

  // 7: passwords with the wrong entropy/length cannot be interpreted as kits.
  check(restore(provided = "123456".toByteArray()) == null)

  // 8: even 31 bytes of key material are insufficient.
  check(restore(provided = ByteArray(31)) == null)

  // 9: even 33 bytes are rejected without an implicit truncate.
  check(restore(provided = ByteArray(33)) == null)

  // 10: flipping one salt bit breaks the derived wrapping key.
  val salt = envelope.saltCopy().also { it[0] = (it[0].toInt() xor 1).toByte() }
  check(restore(modified(salt = salt)) == null)

  // 11: changing GCM nonce fails authentication.
  val nonce = envelope.nonceCopy().also { it[1] = (it[1].toInt() xor 2).toByte() }
  check(restore(modified(nonce = nonce)) == null)

  // 12: ciphertext bit flips fail closed.
  val encrypted = envelope.ciphertextCopy().also { it[0] = (it[0].toInt() xor 1).toByte() }
  check(restore(modified(encrypted = encrypted)) == null)

  // 13: changing the GCM tag fails closed.
  val tag = envelope.ciphertextCopy().also { it[it.lastIndex] =
    (it.last().toInt() xor 1).toByte()
  }
  check(restore(modified(encrypted = tag)) == null)

  // 14: another account, same ciphertext and secret, cannot reuse the envelope.
  check(restore(modified(account = accountB)) == null)

  // 15: kit ID substitution is authenticated with purpose-separated AAD.
  check(restore(modified(id = "123e4567-e89b-42d3-a456-426614174000")) == null)

  // 16: key version downgrade is authenticated.
  check(restore(modified(version = 2L)) == null)

  // 17: changing owner generation invalidates the envelope binding.
  check(restore(modified(generation = 3L)) == null)

  // 18: impossible/zero key generation is rejected.
  check(restore(modified(generation = 0L)) == null)

  // 19: zero version is rejected.
  check(restore(modified(version = 0L)) == null)

  // 20: noncanonical account identifiers never turn into different accounts.
  check(restore(modified(account = accountA.uppercase())) == null)
  check(restore(modified(account = "a".repeat(31))) == null)

  // 21: noncanonical kit UUID never produces an ambiguous payload.
  check(restore(modified(id = envelope.kitId.uppercase())) == null)
  check(restore(modified(id = "not-a-uuid")) == null)

  // 22: truncation and extension of ciphertext always fail.
  check(restore(modified(encrypted = envelope.ciphertextCopy().copyOf(47))) == null)
  check(restore(modified(encrypted = envelope.ciphertextCopy() + byteArrayOf(0))) == null)

  // 23: wrong salt and GCM nonce sizes fail before key use.
  check(restore(modified(salt = ByteArray(31))) == null)
  check(restore(modified(nonce = ByteArray(11))) == null)

  // 24: independent defensive copies prevent mutation of stored envelope.
  run {
    envelope.saltCopy().fill(0)
    envelope.nonceCopy().fill(0)
    envelope.ciphertextCopy().fill(0)
    val copiedSecret = export.recoverySecretCopyForFixtureOnly()
    copiedSecret.fill(0)
    check(restore()!!.copyForFixtureOnly().contentEquals(dataKey))
  }

  // 25: returning a data key fixture never aliases internal material.
  run {
    val recovered = restore()!!
    val first = recovered.copyForFixtureOnly()
    first.fill(0)
    check(recovered.copyForFixtureOnly().contentEquals(dataKey))
  }

  // 26: use purposefully redacted debugging/exception representations.
  check(!export.toString().contains(accountA))
  check(!export.toString().contains(secret.joinToString("") { "%02x".format(it) }))
  check(!restore()!!.toString().contains(dataKey.joinToString("") { "%02x".format(it) }))

  // 27: reissuing produces distinct 256-bit secret, salt, nonce and ciphertext.
  val rotated = SyntheticOfflineRecoveryKitCryptoLab.sealFixtureOnly(
    accountA, otherKey, keyVersion = 2L, ownerGeneration = 2L
  )
  check(rotated.envelope.kitId != envelope.kitId)
  check(!rotated.recoverySecretCopyForFixtureOnly().contentEquals(secret))
  check(!rotated.envelope.nonceCopy().contentEquals(envelope.nonceCopy()))
  check(!rotated.envelope.saltCopy().contentEquals(envelope.saltCopy()))
  check(!rotated.envelope.ciphertextCopy().contentEquals(envelope.ciphertextCopy()))
  check(SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
    rotated.envelope, rotated.recoverySecretCopyForFixtureOnly()
  )!!.copyForFixtureOnly().contentEquals(otherKey))

  // 28: registry does not pretend to have an account or known kit.
  val registry = SyntheticRecoveryKitRegistryLab(mapOf(accountA to 2L, accountB to 2L))
  check(registry.inspectFixtureOnly(envelope) == SyntheticKitRegistryCheck.DENY_NO_KIT)
  check(registry.inspectFixtureOnly(modified(account = "f".repeat(32))) ==
    SyntheticKitRegistryCheck.DENY_UNKNOWN_ACCOUNT)

  // 29: registration is only an in-memory metadata match, never authorization.
  check(registry.registerFixtureOnly(envelope) ==
    SyntheticKitRegistryCheck.ACTIVE_METADATA_MATCH_NOT_AUTHORIZATION)
  check(registry.inspectFixtureOnly(envelope) ==
    SyntheticKitRegistryCheck.ACTIVE_METADATA_MATCH_NOT_AUTHORIZATION)

  // 30: another account's envelope cannot be accepted under this account.
  check(registry.inspectFixtureOnly(modified(account = accountB)) ==
    SyntheticKitRegistryCheck.DENY_NO_KIT)

  // 31: rotation revokes previous kit in the registry.
  check(registry.registerFixtureOnly(rotated.envelope) ==
    SyntheticKitRegistryCheck.ACTIVE_METADATA_MATCH_NOT_AUTHORIZATION)
  check(registry.inspectFixtureOnly(envelope) ==
    SyntheticKitRegistryCheck.DENY_REVOKED_KIT)
  check(registry.inspectFixtureOnly(rotated.envelope) ==
    SyntheticKitRegistryCheck.ACTIVE_METADATA_MATCH_NOT_AUTHORIZATION)

  // 32: attempting to re-register an older version is not allowed.
  check(registry.registerFixtureOnly(envelope) ==
    SyntheticKitRegistryCheck.DENY_STALE_GENERATION_OR_KIT)

  // 33: generation change tombstones the currently active kit in registry.
  check(registry.revokeAndAdvanceGenerationFixtureOnly(accountA) ==
    SyntheticKitRegistryCheck.DENY_NO_KIT)
  check(registry.inspectFixtureOnly(rotated.envelope) ==
    SyntheticKitRegistryCheck.DENY_REVOKED_KIT)

  // 34: offline decryption of old backups STILL WORKS despite revocation:
  // a compromised old recovery secret and ciphertext cannot be "unlearned".
  check(restore()!!.copyForFixtureOnly().contentEquals(dataKey))
  check(SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
    rotated.envelope, rotated.recoverySecretCopyForFixtureOnly()
  )!!.copyForFixtureOnly().contentEquals(otherKey))

  // 35: new generation/version kit becomes valid metadata without reviving old.
  val newGeneration = SyntheticOfflineRecoveryKitCryptoLab.sealFixtureOnly(
    accountA, otherKey, keyVersion = 3L, ownerGeneration = 3L
  )
  check(registry.registerFixtureOnly(newGeneration.envelope) ==
    SyntheticKitRegistryCheck.ACTIVE_METADATA_MATCH_NOT_AUTHORIZATION)
  check(registry.inspectFixtureOnly(envelope) ==
    SyntheticKitRegistryCheck.DENY_REVOKED_KIT)
  check(registry.inspectFixtureOnly(newGeneration.envelope) ==
    SyntheticKitRegistryCheck.ACTIVE_METADATA_MATCH_NOT_AUTHORIZATION)

  // 36: restored key cannot be used as kit secret, nor does a kit grant a login.
  check(restore(provided = dataKey) == null)
  check(SyntheticKitRegistryCheck.entries.none {
    it.name == "AUTHENTICATED" || it.name == "ENROLLED" || it.name == "UNLOCKED"
  })

  // 37: concurrent read-only recovery operations never mutate the envelope.
  val pool = Executors.newFixedThreadPool(8)
  val start = CountDownLatch(1)
  try {
    val tasks = (1..8).map {
      pool.submit<Boolean> {
        start.await()
        restore()?.copyForFixtureOnly()?.contentEquals(dataKey) == true
      }
    }
    start.countDown()
    check(tasks.all { it.get(15L, TimeUnit.SECONDS) })
    check(envelope.ciphertextCopy().size == 48)
  } finally {
    pool.shutdownNow()
  }

  secret.fill(0)
  dataKey.fill(0)
  otherKey.fill(0)
  println("PASS: 37 offline recovery-kit integrity, copy, lifecycle and tampering scenarios (JVM lab only)")
}

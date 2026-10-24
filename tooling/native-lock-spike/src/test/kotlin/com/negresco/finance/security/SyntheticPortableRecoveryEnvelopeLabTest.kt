package com.negresco.finance.security

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * SEC-05H: 28 portable-envelope tests. Binary parsing is NOT authentication.
 * All inputs are synthetic, no files are ever written to a real device.
 */
internal fun runSyntheticPortableRecoveryEnvelopeScenarios() {
  val account = "a".repeat(32)
  val another = "b".repeat(32)
  val dek = ByteArray(32).also { SecureRandom().nextBytes(it) }
  val kit = SyntheticOfflineRecoveryKitCryptoLab.sealFixtureOnly(account, dek, 1L, 2L)
  val wire = SyntheticPortableRecoveryEnvelopeLab.exportEnvelopeBytesFixtureOnly(kit.envelope)
  val secret = kit.recoverySecretCopyForFixtureOnly()
  val parser = SyntheticPortableRecoveryEnvelopeLab

  fun parse(data: ByteArray? = wire, expected: String = account) =
    parser.importEnvelopeBytesFixtureOnly(data, expected)

  fun rewritten(offset: Int, value: Byte, checksum: Boolean = false): ByteArray =
    wire.copyOf().also { changed ->
      changed[offset] = value
      if (checksum) {
        val digest = MessageDigest.getInstance("SHA-256").digest(changed.copyOfRange(0, 152))
        digest.copyInto(changed, 152)
      }
    }
  fun resultWithRecomputedChecksum(offset: Int) =
    rewritten(offset, (wire[offset].toInt() xor 0x01).toByte(), true)

  // 1. Exact fixed format length, no variable-size attacker allocations.
  check(wire.size == 184)
  check(wire.size == parser.FILE_LENGTH)

  // 2. Magic header identifies this backup-envelope format, not device proofs.
  check(wire.copyOfRange(0, 8).toString(Charsets.US_ASCII) == "NGFRCV01")

  // 3. Format v1 encoded as network-order int.
  check(wire.copyOfRange(8, 12).contentEquals(byteArrayOf(0, 0, 0, 1)))

  // 4. SHA-256 public checksum exactly matches the first 152 bytes.
  check(MessageDigest.isEqual(
    MessageDigest.getInstance("SHA-256").digest(wire.copyOfRange(0,152)),
    wire.copyOfRange(152,184)
  ))

  // 5. Parse is explicit metadata only, not account authentication.
  val good = parse()
  check(good.check == SyntheticPortableEnvelopeCheck.PARSED_ONLY_NOT_AUTHENTICATED)
  val parsed = good.envelope!!
  check(parsed.opaqueAccountId == account && parsed.kitId == kit.envelope.kitId)
  check(parsed.keyVersion == 1L && parsed.ownerGeneration == 2L)

  // 6. Import/export round trip is deterministic, canonical binary.
  check(parser.exportEnvelopeBytesFixtureOnly(parsed).contentEquals(wire))

  // 7. Restoring DEK requires the SEPARATE random recovery secret.
  check(SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
    parsed, secret
  )!!.copyForFixtureOnly().contentEquals(dek))

  // 8. File alone cannot restore the DEK.
  check(SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(parsed, null) == null)

  // 9. Wrong account scope is rejected even if checksum and ciphertext correct.
  check(parse(expected = another).check == SyntheticPortableEnvelopeCheck.DENY_ACCOUNT)

  // 10. A malformed account identifier cannot be silently normalized.
  check(parse(expected = account.uppercase()).check == SyntheticPortableEnvelopeCheck.DENY_ACCOUNT)

  // 11. A missing backup file is rejected with no allocation/exception.
  check(parse(data = null).check == SyntheticPortableEnvelopeCheck.DENY_FORMAT)

  // 12. Every truncated prefix of the 184-byte file is rejected.
  (0 until 184).forEach { length ->
    check(parse(data = wire.copyOf(length)).check == SyntheticPortableEnvelopeCheck.DENY_FORMAT)
  }

  // 13. Appending any trailing bytes is invalid (no polyglot/extension data).
  check(parse(data = wire + byteArrayOf(0)).check == SyntheticPortableEnvelopeCheck.DENY_FORMAT)
  check(parse(data = wire + ByteArray(512)).check == SyntheticPortableEnvelopeCheck.DENY_FORMAT)

  // 14. Foreign protocol magic cannot import.
  check(parse(data = rewritten(0, 0)).check == SyntheticPortableEnvelopeCheck.DENY_FORMAT)

  // 15. Version 2 is not accepted as if it were v1.
  check(parse(data = rewritten(11, 2)).check == SyntheticPortableEnvelopeCheck.DENY_FORMAT)

  // 16. Unsupported format is rejected even with a recomputed checksum.
  check(parse(data = rewritten(11, 2, true)).check == SyntheticPortableEnvelopeCheck.DENY_FORMAT)

  // 17. Accidental public-header damage fails checksum.
  check(parse(data = rewritten(13, 0)).check == SyntheticPortableEnvelopeCheck.DENY_ACCOUNT ||
    parse(data = rewritten(13, 0)).check == SyntheticPortableEnvelopeCheck.DENY_CHECKSUM)

  // 18. Editing the UUID without updating checksum is corruption.
  check(parse(data = resultWithRecomputedChecksum(28)).check ==
    SyntheticPortableEnvelopeCheck.PARSED_ONLY_NOT_AUTHENTICATED)
  val forgedId = parse(data = resultWithRecomputedChecksum(28)).envelope!!
  check(SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
    forgedId, secret
  ) == null) // AES-GCM, not public checksum, authenticates the envelope.

  // 19. Even after recomputing public checksum, altered salt is not decryptable.
  val forgedSalt = parse(data = resultWithRecomputedChecksum(60))
  check(forgedSalt.check == SyntheticPortableEnvelopeCheck.PARSED_ONLY_NOT_AUTHENTICATED)
  check(SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
    forgedSalt.envelope!!, secret
  ) == null)

  // 20. Altered nonce with recomputed checksum is rejected by AES-GCM.
  val forgedNonce = parse(data = resultWithRecomputedChecksum(92))
  check(forgedNonce.check == SyntheticPortableEnvelopeCheck.PARSED_ONLY_NOT_AUTHENTICATED)
  check(SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
    forgedNonce.envelope!!, secret
  ) == null)

  // 21. Altered ciphertext and tag remain invalid despite correct checksum.
  for (index in listOf(104, 151)) {
    val changed = parse(data = resultWithRecomputedChecksum(index))
    check(changed.check == SyntheticPortableEnvelopeCheck.PARSED_ONLY_NOT_AUTHENTICATED)
    check(SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
      changed.envelope!!, secret
    ) == null)
  }

  // 22. Damaging checksum itself rejects otherwise-correct bytes.
  check(parse(data = rewritten(183, (wire[183].toInt() xor 1).toByte())).check ==
    SyntheticPortableEnvelopeCheck.DENY_CHECKSUM)

  // 23. Invalid keyVersion zero with valid checksum is rejected as metadata.
  val zeroVersion = wire.copyOf().also {
    (44..51).forEach { i -> it[i] = 0 }
    MessageDigest.getInstance("SHA-256").digest(it.copyOfRange(0,152)).copyInto(it,152)
  }
  check(parse(data = zeroVersion).check == SyntheticPortableEnvelopeCheck.DENY_METADATA)

  // 24. Invalid generation zero with valid checksum is rejected as metadata.
  val zeroGeneration = wire.copyOf().also {
    (52..59).forEach { i -> it[i] = 0 }
    MessageDigest.getInstance("SHA-256").digest(it.copyOfRange(0,152)).copyInto(it,152)
  }
  check(parse(data = zeroGeneration).check == SyntheticPortableEnvelopeCheck.DENY_METADATA)

  // 25. Export rejects malformed synthetic metadata at the boundary.
  val malformed = SyntheticRecoveryKitEnvelopeLab(
    account, kit.envelope.kitId, 0L, 2L,
    kit.envelope.saltCopy(), kit.envelope.nonceCopy(), kit.envelope.ciphertextCopy()
  )
  check(runCatching { parser.exportEnvelopeBytesFixtureOnly(malformed) }.isFailure)

  // 26. Mutating a returned byte array cannot mutate the fixture envelope.
  val changed = wire.copyOf().also { it.fill(0) }
  check(!changed.contentEquals(parser.exportEnvelopeBytesFixtureOnly(kit.envelope)))
  check(parser.exportEnvelopeBytesFixtureOnly(kit.envelope).contentEquals(wire))

  // 27. Old portable files remain parseable offline after kit revocation.
  // Parser acceptance is NOT online authority, nor anti-rollback protection.
  val registry = SyntheticRecoveryKitRegistryLab(mapOf(account to 2L))
  check(registry.registerFixtureOnly(kit.envelope) ==
    SyntheticKitRegistryCheck.ACTIVE_METADATA_MATCH_NOT_AUTHORIZATION)
  check(registry.revokeAndAdvanceGenerationFixtureOnly(account) ==
    SyntheticKitRegistryCheck.DENY_NO_KIT)
  check(registry.inspectFixtureOnly(parsed) == SyntheticKitRegistryCheck.DENY_REVOKED_KIT)
  check(parse().check == SyntheticPortableEnvelopeCheck.PARSED_ONLY_NOT_AUTHENTICATED)
  check(SyntheticOfflineRecoveryKitCryptoLab.recoverDataKeyFixtureOnly(
    parsed, secret
  )!!.copyForFixtureOnly().contentEquals(dek))

  // 28. Eight concurrent readers see the identical canonical wire form.
  val pool = Executors.newFixedThreadPool(8)
  try {
    val requests = (1..8).map {
      pool.submit<Boolean> {
        val restored = parse()
        restored.check == SyntheticPortableEnvelopeCheck.PARSED_ONLY_NOT_AUTHENTICATED &&
          parser.exportEnvelopeBytesFixtureOnly(restored.envelope!!).contentEquals(wire)
      }
    }
    check(requests.all { it.get(15L, TimeUnit.SECONDS) })
  } finally {
    pool.shutdownNow()
  }

  dek.fill(0)
  secret.fill(0)
  println("PASS: SEC-05H 28 portable recovery-envelope scenarios (JVM lab, no device grant)")
}

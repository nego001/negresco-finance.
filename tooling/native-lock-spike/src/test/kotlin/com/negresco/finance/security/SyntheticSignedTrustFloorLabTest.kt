package com.negresco.finance.security

import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.PublicKey
import java.security.SecureRandom
import java.security.Signature

/**
 * All authority keys, signatures and local views here are SYNTHETIC JVM
 * fixtures. No server, network, Android Keystore or real enrollment exists.
 */
internal fun runSignedAuthorityFloorScenarios() {
  val authority = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val stranger = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val localKey = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val otherKey = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val id = SyntheticSignedDeviceProofLab.fingerprint(localKey.public)!!
  val otherId = SyntheticSignedDeviceProofLab.fingerprint(otherKey.public)!!
  val local = SyntheticLedgerView(id, 3L, 2L, 8L, null)
  val floor = SignedFloorClaim(id, 3L, 2L, 8L)
  val rng = SecureRandom()
  fun challenge() = ByteArray(32).also { rng.nextBytes(it) }
  fun sign(pair: KeyPair, state: SignedFloorClaim, nonce: ByteArray): ByteArray {
    val signer = Signature.getInstance("Ed25519")
    signer.initSign(pair.private)
    signer.update(SyntheticSignedTrustFloorLab.payload(state, nonce))
    return signer.sign()
  }
  val issued = challenge()
  val signed = sign(authority, floor, issued)
  fun inspect(
    view: SyntheticLedgerView? = local,
    serverFloor: SignedFloorClaim? = floor,
    key: PublicKey? = authority.public,
    requested: ByteArray? = issued,
    returned: ByteArray? = issued,
    signature: ByteArray? = signed
  ) = SyntheticSignedTrustFloorLab.inspect(
    view, serverFloor, key, requested, returned, signature
  )
  val ready = SignedFloorCheck.PROCEED_TO_INDEPENDENT_NATIVE_AUTHORIZER

  // 1. A fresh valid signature agrees with equal device/epoch and sequence.
  check(inspect() == ready)

  // 2. A missing pre-pinned authority key fails closed.
  check(inspect(key = null) == SignedFloorCheck.DENY_MISSING_AUTHORITY)

  // 3. A different authority key cannot certify another authority's message.
  check(inspect(key = stranger.public) == SignedFloorCheck.DENY_SIGNATURE)

  // 4. Wrong key algorithm must not be accepted as Ed25519.
  val rsa = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
  check(inspect(key = rsa.public) == SignedFloorCheck.DENY_MISSING_AUTHORITY)

  // An attacker-defined key label is not proof of canonical Ed25519 DER.
  val mislabelledKey = object : PublicKey {
    override fun getAlgorithm() = "Ed25519"
    override fun getFormat() = "X.509"
    override fun getEncoded() = rsa.public.encoded.copyOf()
  }
  check(inspect(key = mislabelledKey) == SignedFloorCheck.DENY_MISSING_AUTHORITY)
  check(SyntheticSignedDeviceProofLab.fingerprint(mislabelledKey) == null)

  // 5. Tampered signature invalid even if counters appear healthy.
  val altered = signed.copyOf().also { it[0] = (it[0].toInt() xor 1).toByte() }
  check(inspect(signature = altered) == SignedFloorCheck.DENY_SIGNATURE)

  // 6. Truncated/overlong/absent signature never accepted.
  for (bad in listOf<ByteArray?>(null, signed.copyOf(63), signed + byteArrayOf(1))) {
    check(inspect(signature = bad) == SignedFloorCheck.DENY_SIGNATURE)
  }

  // 7. Independent request challenge cannot be replaced with another nonce.
  check(inspect(requested = challenge()) == SignedFloorCheck.DENY_CHALLENGE_MISMATCH)
  check(inspect(returned = challenge()) == SignedFloorCheck.DENY_CHALLENGE_MISMATCH)

  // 8. Empty, shortened or missing challenge fails closed before verifying.
  for (bad in listOf<ByteArray?>(null, ByteArray(0), ByteArray(31), ByteArray(33))) {
    check(inspect(requested = bad) == SignedFloorCheck.DENY_CHALLENGE_MISMATCH)
    check(inspect(returned = bad) == SignedFloorCheck.DENY_CHALLENGE_MISMATCH)
  }

  // 9. A response legitimately signed for an OLD challenge cannot be
  // borrowed for the next random challenge even with the same counters.
  val next = challenge()
  val nextSignature = sign(authority, floor, next)
  check(inspect(requested = next, returned = next, signature = signed) ==
    SignedFloorCheck.DENY_SIGNATURE)
  check(inspect(requested = next, returned = next, signature = nextSignature) == ready)

  // 10. Missing local or floor state cannot get a positive preflight.
  check(inspect(view = null) == SignedFloorCheck.DENY_MALFORMED_FLOOR)
  check(inspect(serverFloor = null) == SignedFloorCheck.DENY_MALFORMED_FLOOR)

  // 11. Invalid fields cannot be encoded for authority signature.
  for (bad in listOf(
    floor.copy(revision = -1L), floor.copy(revision = 0L),
    floor.copy(epoch = 0L), floor.copy(epoch = 4L),
    floor.copy(minLastSequence = -1L),
    floor.copy(minLastSequence = Long.MAX_VALUE)
  )) {
    check(runCatching { SyntheticSignedTrustFloorLab.payload(bad, issued) }.isFailure)
    check(inspect(serverFloor = bad) == SignedFloorCheck.DENY_MALFORMED_FLOOR)
  }

  // 12. Local state malformed is denied even with genuine authority proof.
  for (bad in listOf(local.copy(revision = 0L),
    local.copy(epoch = 4L), local.copy(lastSequence = -1L))) {
    check(inspect(view = bad) == SignedFloorCheck.DENY_MALFORMED_FLOOR)
  }

  // 13. Genuine signed floor for OTHER device does not authorize this device.
  val otherFloor = floor.copy(subject = otherId)
  check(inspect(serverFloor = otherFloor, signature = sign(authority, otherFloor, issued)) ==
    SignedFloorCheck.DENY_OTHER_DEVICE)

  // 14. Restored older revision cannot pass current authoritative revision.
  check(inspect(view = local.copy(revision = 2L)) ==
    SignedFloorCheck.DENY_ROLLED_BACK_REVISION)

  // 15. Local epoch older than signed active epoch is rejected.
  check(inspect(view = local.copy(epoch = 1L)) ==
    SignedFloorCheck.DENY_ROLLED_BACK_EPOCH)

  // 16. Old file sequence 5 cannot pass a signed minimum sequence 8.
  check(inspect(view = local.copy(lastSequence = 5L)) ==
    SignedFloorCheck.DENY_ROLLED_BACK_SEQUENCE)

  // 17. Local revision greater than signed floor also needs reconciliation.
  check(inspect(view = local.copy(revision = 4L)) ==
    SignedFloorCheck.DENY_ROLLED_BACK_REVISION)

  // 18. A newer sequence is consistent only if the authority really issued
  // a FRESH signed floor; replay resistance depends on the missing server.
  check(inspect(view = local.copy(lastSequence = 9L)) == ready)

  // 19. Editing a legitimate floor without re-signing must fail.
  check(inspect(serverFloor = floor.copy(minLastSequence = 9L)) ==
    SignedFloorCheck.DENY_SIGNATURE)

  // 20. Same subject but different epoch signature cannot be substituted.
  check(inspect(serverFloor = floor.copy(revision = 4L, epoch = 3L)) ==
    SignedFloorCheck.DENY_SIGNATURE)

  // 21. An old signed floor is not a durable monotonic anchor. Even if the
  // attacker has restored an old ledger AND matching old signed response,
  // a different FRESH challenge from the real issuer must be verified.
  check(inspect(requested = next, returned = issued, signature = signed) ==
    SignedFloorCheck.DENY_CHALLENGE_MISMATCH)

  // 22. Verification never returns financial authorization or a key.
  check(SignedFloorCheck.entries.none { it.name == "ALLOW" || it.name == "UNLOCK" })

  println("PASS: 22 signed remote-floor anti-rollback witness scenarios (JVM fixtures, no backend)")
}

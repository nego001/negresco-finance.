package com.negresco.finance.security

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.UUID

/**
 * SEC-05K disposable SHA-256 Merkle proof math based on RFC 9162 section 2.1.
 *
 * Unlike the older caller-supplied "proofVerified" boolean, this verifier
 * actually checks inclusion and append-only consistency proof hash paths.
 * Inputs, tree heads and the known earlier root are STILL synthetic test data.
 * There is NO authenticated log operator, durable high-water, signed tree
 * head, trusted owner, remote API, immutable storage, or production grant.
 */
internal object SyntheticMerkleProofVerifierLab {
  private fun hash(prefix: Byte, first: ByteArray, second: ByteArray? = null): ByteArray {
    val digest = MessageDigest.getInstance("SHA-256")
    digest.update(prefix)
    digest.update(first)
    if (second != null) digest.update(second)
    return digest.digest()
  }

  fun leafHashFixtureOnly(data: ByteArray): ByteArray = hash(0, data)
  private fun node(left: ByteArray, right: ByteArray): ByteArray = hash(1, left, right)
  private fun same(a: ByteArray, b: ByteArray): Boolean =
    a.size == 32 && b.size == 32 && MessageDigest.isEqual(a, b)

  /** Inclusion proof: leafHash must be SHA256(0x00 || raw canonical entry). */
  fun verifyInclusionFixtureOnly(
    leafHash: ByteArray, index: Long, size: Long, root: ByteArray,
    proof: List<ByteArray>
  ): Boolean {
    if (size <= 0L || index < 0L || index >= size ||
        leafHash.size != 32 || root.size != 32 || proof.size > 64 ||
        proof.any { it.size != 32 }) return false
    var fn = index
    var sn = size - 1L
    var result = leafHash.copyOf()
    for (sibling in proof) {
      if (sn == 0L) return false
      if ((fn and 1L) == 1L || fn == sn) {
        result = node(sibling, result)
        if ((fn and 1L) == 0L) {
          while (fn != 0L && (fn and 1L) == 0L) {
            fn = fn shr 1
            sn = sn shr 1
          }
        }
      } else {
        result = node(result, sibling)
      }
      fn = fn shr 1
      sn = sn shr 1
    }
    return sn == 0L && same(result, root)
  }

  /** RFC 9162 section 2.1.4.2. Old root is an INDEPENDENT trusted-input premise. */
  fun verifyConsistencyFixtureOnly(
    first: Long, second: Long, firstRoot: ByteArray, secondRoot: ByteArray,
    consistencyPath: List<ByteArray>
  ): Boolean {
    if (first <= 0L || second < first || firstRoot.size != 32 ||
        secondRoot.size != 32 || consistencyPath.size > 64 ||
        consistencyPath.any { it.size != 32 }) return false
    if (first == second)
      return consistencyPath.isEmpty() && same(firstRoot, secondRoot)
    if (consistencyPath.isEmpty()) return false
    val isPowerOfTwo = first and (first - 1L) == 0L
    val path = if (isPowerOfTwo)
      listOf(firstRoot.copyOf()) + consistencyPath
    else consistencyPath
    var fn = first - 1L
    var sn = second - 1L
    while ((fn and 1L) == 1L) {
      fn = fn shr 1
      sn = sn shr 1
    }
    var fr = path.first().copyOf()
    var sr = path.first().copyOf()
    for (sibling in path.drop(1)) {
      if (sn == 0L) return false
      if ((fn and 1L) == 1L || fn == sn) {
        fr = node(sibling, fr)
        sr = node(sibling, sr)
        if ((fn and 1L) == 0L) {
          while (fn != 0L && (fn and 1L) == 0L) {
            fn = fn shr 1
            sn = sn shr 1
          }
        }
      } else {
        sr = node(sr, sibling)
      }
      fn = fn shr 1
      sn = sn shr 1
    }
    return sn == 0L && same(fr, firstRoot) && same(sr, secondRoot)
  }
}

/**
 * Test-only tree builder; verifier above NEVER calls this builder or receives
 * the full leaf list, just old/new roots and supplied proof hashes.
 */
private object SyntheticMerkleTreeBuilderFixtureLab {
  private fun node(left: ByteArray, right: ByteArray): ByteArray =
    MessageDigest.getInstance("SHA-256").digest(byteArrayOf(1) + left + right)
  private fun split(size: Int): Int {
    var k = 1
    while (k * 2 < size) k *= 2
    return k
  }
  fun root(leaves: List<ByteArray>): ByteArray {
    require(leaves.isNotEmpty())
    if (leaves.size == 1)
      return SyntheticMerkleProofVerifierLab.leafHashFixtureOnly(leaves[0])
    val k = split(leaves.size)
    return node(root(leaves.subList(0, k)), root(leaves.subList(k, leaves.size)))
  }
  fun inclusion(leaves: List<ByteArray>, index: Int): List<ByteArray> {
    require(index in leaves.indices)
    if (leaves.size == 1) return emptyList()
    val k = split(leaves.size)
    return if (index < k)
      inclusion(leaves.subList(0, k), index) +
        root(leaves.subList(k, leaves.size))
    else inclusion(leaves.subList(k, leaves.size), index - k) +
      root(leaves.subList(0, k))
  }
  private fun subproof(first: Int, leaves: List<ByteArray>,
                       known: Boolean): List<ByteArray> {
    if (first == leaves.size) return if (known) emptyList() else listOf(root(leaves))
    val k = split(leaves.size)
    return if (first <= k)
      subproof(first, leaves.subList(0, k), known) +
        root(leaves.subList(k, leaves.size))
    else subproof(first - k, leaves.subList(k, leaves.size), false) +
      root(leaves.subList(0, k))
  }
  fun consistency(first: Int, leaves: List<ByteArray>): List<ByteArray> {
    require(first in 1 until leaves.size)
    return subproof(first, leaves, true)
  }
}

internal fun runSyntheticMerkleProofVerifierScenarios() {
  val verify = SyntheticMerkleProofVerifierLab
  val build = SyntheticMerkleTreeBuilderFixtureLab
  var checks = 0
  fun requireCase(ok: Boolean, description: String) {
    check(ok) { "SEC05K real proof-math fixture: " + description }
    checks++
  }

  val account = UUID.randomUUID().toString().replace("-", "")
  val epoch = UUID.randomUUID().toString()
  // Canonical test entry includes account+epoch+op+kit+generation+hash.
  // All tokens are UUIDs or canonical hex/decimal and cannot contain "|".
  val leaves = (0 until 33).map { index ->
    val operation = UUID.randomUUID()
    val kit = UUID.randomUUID()
    val hash = MessageDigest.getInstance("SHA-256")
      .digest(("sec05k-disposable-ciphertext-" + index).toByteArray())
      .joinToString("") { "%02x".format(it.toInt() and 255) }
    (account + "|" + epoch + "|" + operation + "|" + kit + "|" +
      (index + 1) + "|" + hash).toByteArray(StandardCharsets.US_ASCII)
  }

  for (n in 1..33) {
    val current = leaves.take(n)
    val currentRoot = build.root(current)
    for (index in current.indices) {
      val leafHash = verify.leafHashFixtureOnly(current[index])
      val path = build.inclusion(current, index)
      requireCase(verify.verifyInclusionFixtureOnly(
        leafHash, index.toLong(), n.toLong(), currentRoot, path),
        "RFC9162 inclusion verifies at non-power-of-two size")
      requireCase(!verify.verifyInclusionFixtureOnly(
        verify.leafHashFixtureOnly(leaves[(index + 1) % leaves.size]),
        index.toLong(), n.toLong(), currentRoot, path),
        "a different account/operation/ciphertext entry cannot use the proof")
      requireCase(!verify.verifyInclusionFixtureOnly(
        leafHash, n.toLong(), n.toLong(), currentRoot, path),
        "out-of-range index denied")
      if (path.isNotEmpty()) {
        val tampered = path.map { it.copyOf() }.toMutableList()
        tampered[0][0] = (tampered[0][0].toInt() xor 1).toByte()
        requireCase(!verify.verifyInclusionFixtureOnly(
          leafHash, index.toLong(), n.toLong(), currentRoot, tampered),
          "tampered inclusion sibling hash denied")
        requireCase(!verify.verifyInclusionFixtureOnly(
          leafHash, index.toLong(), n.toLong(), currentRoot, path.drop(1)),
          "truncated inclusion path denied")
      }
    }
    requireCase(verify.verifyConsistencyFixtureOnly(
      n.toLong(), n.toLong(), currentRoot, currentRoot, emptyList()),
      "identical tree head and empty path accepted mathematically")
    requireCase(!verify.verifyConsistencyFixtureOnly(
      n.toLong(), n.toLong(), currentRoot, currentRoot,
      listOf(currentRoot)), "spurious same-size path denied")
    for (m in 1 until n) {
      val earlierRoot = build.root(current.take(m))
      val proof = build.consistency(m, current)
      requireCase(verify.verifyConsistencyFixtureOnly(
        m.toLong(), n.toLong(), earlierRoot, currentRoot, proof),
        "actual RFC9162 append-only consistency hash proof verifies")
      requireCase(!verify.verifyConsistencyFixtureOnly(
        m.toLong(), n.toLong(), earlierRoot, currentRoot,
        proof.dropLast(1)), "missing Merkle sibling denies consistency")
      val bad = proof.map { it.copyOf() }.toMutableList()
      bad[0][0] = (bad[0][0].toInt() xor 1).toByte()
      requireCase(!verify.verifyConsistencyFixtureOnly(
        m.toLong(), n.toLong(), earlierRoot, currentRoot, bad),
        "mutated consistency proof denies a forged append-only claim")
      requireCase(!verify.verifyConsistencyFixtureOnly(
        m.toLong(), n.toLong(), currentRoot, earlierRoot, proof),
        "swapped old/new roots are not a consistency proof")
    }
  }
  val root = build.root(leaves)
  requireCase(!verify.verifyInclusionFixtureOnly(
    ByteArray(31), 0L, 33L, root, emptyList()),
    "malformed leaf digest rejected")
  requireCase(!verify.verifyConsistencyFixtureOnly(
    0L, 33L, root, root, emptyList()), "missing trusted previous head denied")
  requireCase(!verify.verifyConsistencyFixtureOnly(
    34L, 33L, root, root, emptyList()), "tree truncation denied")
  requireCase(!verify.verifyConsistencyFixtureOnly(
    33L, 34L, root, root, emptyList()),
    "absence of extension proof cannot justify newer size")
  val alternate = leaves.toMutableList()
  alternate[2] = "malicious replay with changed account and operation".toByteArray()
  requireCase(!verify.verifyConsistencyFixtureOnly(
    9L, 33L, build.root(leaves.take(9)), build.root(alternate),
    build.consistency(9, alternate)),
    "valid proof for rewritten history does not match independently pinned OLD root")
  requireCase(!verify.verifyInclusionFixtureOnly(
    verify.leafHashFixtureOnly(leaves[2]), 2L, 33L, build.root(alternate),
    build.inclusion(alternate, 2)),
    "valid-looking checkpoint cannot include an unchanged entry after substitution")

  // CRITICAL: a log that controls BOTH advertised roots can forge a perfect
  // mathematically correct proof for a fully rolled-back tree. Independently
  // authenticated/persisted old head and gossip are STILL required.
  val rolledBack = leaves.take(9)
  requireCase(verify.verifyConsistencyFixtureOnly(
    4L, 9L, build.root(rolledBack.take(4)), build.root(rolledBack),
    build.consistency(4, rolledBack)),
    "CRITICAL NEGATIVE: real SHA-256 proof math cannot identify both roots replayed OLD")
  val holdInput = SyntheticRekeyReconciliationInputLab(
    SyntheticRekeyAuthorityEvidenceLab.SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY,
    SyntheticRekeyJournalObservationLab.COMMITTED,
    SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED,
    SyntheticRekeyCandidateObservationLab.NEW_AUTHENTICATED,
    SyntheticRekeyAuthorityGenerationLab.NEW_CURRENT,
    true, 1L, 2L, 1L, 2L)
  requireCase(SyntheticJournalAuthorityReconciliationPolicyLab.decide(holdInput) ==
    SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
    "real hash-path verification is NOT trusted live authority or journal permission")
  println("PASS: SEC-05K " + checks + " cryptographic Merkle inclusion/consistency checks (RFC9162 fixture)")
  println("LIMIT: proof math has no trusted root provenance, immutable high-water, log signatures or real owner")
}

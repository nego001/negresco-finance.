package com.negresco.finance.security

import java.nio.charset.StandardCharsets
import java.security.MessageDigest

/**
 * SEC-05K: SHA-256 Merkle INCLUSION proof verifier in test-only JVM.
 * RFC 9162 Section 2.1 domain separation: SHA256(0x00 || leaf) and
 * SHA256(0x01 || left_hash || right_hash), with left-balanced split.
 *
 * Does NOT authenticate the root, provide a consistency proof, detect
 * equivocation between monitors, guarantee retention, or prove freshness.
 * A malicious issuer can invent a new tree and a valid inclusion path.
 * No production app/backend, keys, network, or financial accounts.
 */
internal object SyntheticMerkleInclusionProofLab {
  private fun sha(data: ByteArray): ByteArray =
    MessageDigest.getInstance("SHA-256").digest(data)

  fun leafHash(data: ByteArray): ByteArray = sha(byteArrayOf(0) + data)
  fun nodeHash(left: ByteArray, right: ByteArray): ByteArray {
    require(left.size == 32 && right.size == 32)
    return sha(byteArrayOf(1) + left + right)
  }

  // The highest power of two strictly less than n; supports arbitrary
  // non-power-of-two trees without overflow or floating-point approximations.
  private fun split(n: Int): Int {
    require(n > 1)
    return Integer.highestOneBit(n - 1)
  }

  fun verify(
    leaf: ByteArray, index: Int, treeSize: Int,
    proofBottomUp: List<ByteArray>, expectedRoot: ByteArray
  ): Boolean {
    if (treeSize <= 0 || treeSize > 1_000_000 || index < 0 ||
      index >= treeSize || expectedRoot.size != 32 || proofBottomUp.size > 21 ||
      proofBottomUp.any { it.size != 32 }) return false
    var consumed = 0
    fun reconstruct(size: Int, offset: Int, leafHash: ByteArray): ByteArray {
      if (size == 1) return leafHash
      val k = split(size)
      val withinLeft = offset < k
      val inner = if (withinLeft) reconstruct(k, offset, leafHash)
        else reconstruct(size - k, offset - k, leafHash)
      if (consumed >= proofBottomUp.size) throw IllegalArgumentException("missing sibling")
      val sibling = proofBottomUp[consumed++]
      return if (withinLeft) nodeHash(inner, sibling) else nodeHash(sibling, inner)
    }
    return try {
      val computed = reconstruct(treeSize, index, leafHash(leaf))
      consumed == proofBottomUp.size &&
        MessageDigest.isEqual(computed, expectedRoot)
    } catch (_: IllegalArgumentException) { false }
  }
}

/** Build a synthetic proof using the SAME RFC tree shape, for test vectors only. */
internal object SyntheticMerkleProofBuilderFixtureLab {
  private val h = SyntheticMerkleInclusionProofLab
  private fun split(n: Int) = Integer.highestOneBit(n - 1)
  private fun rootOf(leaves: List<ByteArray>): ByteArray {
    require(leaves.isNotEmpty())
    if (leaves.size == 1) return h.leafHash(leaves.single())
    val k = split(leaves.size)
    return h.nodeHash(rootOf(leaves.subList(0, k)), rootOf(leaves.subList(k, leaves.size)))
  }
  fun root(leaves: List<ByteArray>): ByteArray = rootOf(leaves)
  fun proof(leaves: List<ByteArray>, index: Int): List<ByteArray> {
    require(leaves.isNotEmpty() && index in leaves.indices)
    fun walk(part: List<ByteArray>, i: Int): List<ByteArray> {
      if (part.size == 1) return emptyList()
      val k = split(part.size)
      return if (i < k) walk(part.subList(0, k), i) +
        rootOf(part.subList(k, part.size))
      else walk(part.subList(k, part.size), i - k) +
        rootOf(part.subList(0, k))
    }
    return walk(leaves, index)
  }
}

internal fun runSyntheticMerkleInclusionProofScenarios() {
  val verifier = SyntheticMerkleInclusionProofLab
  val builder = SyntheticMerkleProofBuilderFixtureLab
  fun ascii(s: String) = s.toByteArray(StandardCharsets.UTF_8)
  var checks = 0
  fun checkCase(ok: Boolean, label: String) {
    check(ok) { "SEC05K Merkle inclusion fixture: $label" }
    checks++
  }
  val leafA = ascii("A")
  val leafB = ascii("B")
  val leafC = ascii("C")
  val three = listOf(leafA, leafB, leafC)
  val root = builder.root(three)

  // Precomputed independently as:
  // SHA256(0x01 || SHA256(0x01 || SHA256(0x00||"A") ||
  // SHA256(0x00||"B")) || SHA256(0x00||"C")).
  val trustedVector = "961d2e2be20f538ffdf56962a86d1bd165498f222684ee4c5e02c1e9f852adc5"
  val vectorBytes = trustedVector.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
  checkCase(MessageDigest.isEqual(root, vectorBytes),
    "three-leaf RFC-domain-separated tree matches independently computed digest")
  checkCase(verifier.verify(leafA, 0, 3, builder.proof(three, 0), vectorBytes),
    "leftmost inclusion against fixed independent root")
  checkCase(verifier.verify(leafB, 1, 3, builder.proof(three, 1), vectorBytes),
    "middle inclusion against fixed independent root")
  checkCase(verifier.verify(leafC, 2, 3, builder.proof(three, 2), vectorBytes),
    "rightmost unbalanced inclusion against fixed independent root")

  for (size in 1..13) {
    val leaves = (0 until size).map { ascii("synthetic-checkpoint-$size-$it") }
    val candidateRoot = builder.root(leaves)
    for (index in leaves.indices) {
      checkCase(verifier.verify(leaves[index], index, size,
        builder.proof(leaves, index), candidateRoot),
        "all-index inclusion for tree size $size, position $index")
    }
  }
  val path = builder.proof(three, 1)
  checkCase(!verifier.verify(ascii("A"), 1, 3, path, root),
    "wrong leaf content cannot borrow another leaf position")
  checkCase(!verifier.verify(leafB, 0, 3, path, root),
    "wrong index cannot reuse valid path")
  checkCase(!verifier.verify(leafB, 1, 2, path, root),
    "wrong tree size cannot reuse valid path")
  checkCase(!verifier.verify(leafB, 1, 3, emptyList(), root),
    "missing sibling fails closed")
  checkCase(!verifier.verify(leafB, 1, 3, path + ByteArray(32), root),
    "trailing sibling fails closed")
  checkCase(!verifier.verify(leafB, 1, 3, path.reversed(), root),
    "incorrect sibling ordering fails closed")
  checkCase(!verifier.verify(leafB, 1, 3,
    path.toMutableList().also { it[0] = it[0].copyOf().also { h -> h[0] = (h[0].toInt() xor 1).toByte() } },
    root), "tampered sibling fails closed")
  checkCase(!verifier.verify(leafB, 1, 3, path, root.copyOf().also {
    it[0] = (it[0].toInt() xor 1).toByte()
  }), "tampered root fails closed")
  checkCase(!verifier.verify(leafB, -1, 3, path, root),
    "negative index fails closed")
  checkCase(!verifier.verify(leafB, 3, 3, path, root),
    "out of range index fails closed")
  checkCase(!verifier.verify(leafB, 1, 0, path, root),
    "zero-sized tree fails closed")
  checkCase(!verifier.verify(leafB, 1, -1, path, root),
    "negative-sized tree fails closed")
  checkCase(!verifier.verify(leafB, 1, 1_000_001, path, root),
    "unbounded path computation refused")
  checkCase(!verifier.verify(leafB, 1, 3, path, ByteArray(31)),
    "invalid root size fails closed")
  checkCase(!verifier.verify(leafB, 1, 3, listOf(ByteArray(31)), root),
    "invalid sibling size fails closed")
  checkCase(!verifier.verify(leafB, 1, 3, List(22) { ByteArray(32) }, root),
    "oversized proof path fails closed")
  checkCase(verifier.verify(leafA, 0, 1, emptyList(),
    verifier.leafHash(leafA)), "single leaf has valid empty path")
  checkCase(!verifier.verify(leafA, 0, 1, listOf(ByteArray(32)),
    verifier.leafHash(leafA)), "single-leaf path cannot contain extra nodes")

  val dishonestLeaf = ascii("fake-newer-generation")
  val fakeTree = listOf(dishonestLeaf, ascii("fake-receipt"))
  checkCase(verifier.verify(dishonestLeaf, 0, 2,
    builder.proof(fakeTree, 0), builder.root(fakeTree)),
    "CRITICAL LIMIT: malicious issuer can fabricate root AND valid inclusion proof")
  // Inclusion says nothing about append-only extension, an independently
  // authenticated root, signature over tree size, or owner authorization.
  val recon = SyntheticRekeyReconciliationInputLab(
    SyntheticRekeyAuthorityEvidenceLab.SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY,
    SyntheticRekeyJournalObservationLab.COMMITTED,
    SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED,
    SyntheticRekeyCandidateObservationLab.NEW_AUTHENTICATED,
    SyntheticRekeyAuthorityGenerationLab.NEW_CURRENT,
    true, 7, 8, 10, 11
  )
  checkCase(SyntheticJournalAuthorityReconciliationPolicyLab.decide(recon) ==
    SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
    "positive Merkle inclusion NEVER grants journal recovery")
  println("PASS: SEC-05K $checks SHA-256 Merkle inclusion and malformed-path checks (test only)")
  println("LIMIT: no signed/pinned root, consistency proof, external high-water, retention or owner")
}

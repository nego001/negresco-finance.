package com.negresco.finance.security

import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.Signature

/** 15 cryptographic negative/positive assertions for account + invite binding. */
internal fun runSyntheticAccountBoundInviteProofScenarios() {
  val approver = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val candidate = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val stranger = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
  val oldId = SyntheticSignedDeviceProofLab.fingerprint(approver.public)!!
  val newId = SyntheticSignedDeviceProofLab.fingerprint(candidate.public)!!
  val intent = SyntheticDeviceEnrollmentIntent(oldId, newId, 1L, 1L, 1L)
  val accountId = "a".repeat(32)
  val otherAccount = "b".repeat(32)
  val invitationId = "123e4567-e89b-42d3-a456-426614174000"
  val otherInvite = "123e4567-e89b-42d3-a456-426614174001"
  val nonce = ByteArray(32) { (it + 1).toByte() }

  fun sign(key: KeyPair, account: String = accountId, invite: String = invitationId,
    request: SyntheticDeviceEnrollmentIntent = intent, challenge: ByteArray = nonce,
    candidateRole: Boolean): ByteArray =
    Signature.getInstance("Ed25519").run {
      initSign(key.private)
      update(SyntheticAccountBoundInviteProofLab.payload(
        account, invite, request, challenge, candidateRole))
      sign()
    }

  val oldSig = sign(approver, candidateRole = false)
  val newSig = sign(candidate, candidateRole = true)
  fun inspect(
    account: String = accountId,
    invite: String = invitationId,
    request: SyntheticDeviceEnrollmentIntent = intent,
    oldKey: java.security.PublicKey? = approver.public,
    newKey: java.security.PublicKey? = candidate.public,
    challenge: ByteArray? = nonce,
    returned: ByteArray? = nonce,
    approval: ByteArray? = oldSig,
    possession: ByteArray? = newSig
  ) = SyntheticAccountBoundInviteProofLab.inspect(
    account, invite, request, oldKey, newKey, challenge, returned, approval, possession
  )

  val ready = SyntheticBoundInviteProofCheck.PROOF_VERIFIED_ONLY
  check(inspect() == ready) // 1 valid cryptographic bindings

  // 2-3: Changing EITHER account or invitation rejects identical valid signatures.
  check(inspect(account = otherAccount) == SyntheticBoundInviteProofCheck.DENY_APPROVER_SIGNATURE)
  check(inspect(invite = otherInvite) == SyntheticBoundInviteProofCheck.DENY_APPROVER_SIGNATURE)

  // 4: A different signed sequence cannot replace the original.
  check(inspect(request = intent.copy(approvingSequence = 2L)) ==
    SyntheticBoundInviteProofCheck.DENY_APPROVER_SIGNATURE)

  // 5: A different registry revision/epoch is bound into BOTH signatures.
  check(inspect(request = intent.copy(revision = 2L, epoch = 2L)) ==
    SyntheticBoundInviteProofCheck.DENY_APPROVER_SIGNATURE)

  // 6: Role separation and candidate possession cannot be swapped.
  check(inspect(approval = newSig) == SyntheticBoundInviteProofCheck.DENY_APPROVER_SIGNATURE)
  check(inspect(possession = oldSig) == SyntheticBoundInviteProofCheck.DENY_CANDIDATE_SIGNATURE)

  // 7: Unknown or self-claimed keys never establish enrollment.
  check(inspect(oldKey = stranger.public) == SyntheticBoundInviteProofCheck.DENY_UNTRUSTED_KEY)
  check(inspect(newKey = stranger.public) == SyntheticBoundInviteProofCheck.DENY_UNTRUSTED_KEY)

  // 8: Challenge bytes must exactly match authority-held nonce.
  val changed = nonce.copyOf().also { it[0] = 0 }
  check(inspect(returned = changed) == SyntheticBoundInviteProofCheck.DENY_NONCE)

  // 9: Invalid length and absent nonce fail before crypto.
  check(inspect(returned = ByteArray(31)) == SyntheticBoundInviteProofCheck.DENY_NONCE)
  check(inspect(challenge = null) == SyntheticBoundInviteProofCheck.DENY_NONCE)

  // 10: Missing, short or wrong signature denied independently for both roles.
  check(inspect(approval = null) == SyntheticBoundInviteProofCheck.DENY_APPROVER_SIGNATURE)
  check(inspect(possession = ByteArray(63)) == SyntheticBoundInviteProofCheck.DENY_CANDIDATE_SIGNATURE)

  // 11: Account identifier must be a canonical opaque 128-bit lowercase string.
  check(inspect(account = "a".repeat(31)) ==
    SyntheticBoundInviteProofCheck.DENY_INVALID_BINDING)
  check(inspect(account = "A".repeat(32)) ==
    SyntheticBoundInviteProofCheck.DENY_INVALID_BINDING)

  // 12: Canonical lowercase UUID only, never permissive UUID parsing.
  check(inspect(invite = "123") == SyntheticBoundInviteProofCheck.DENY_INVALID_BINDING)
  check(inspect(invite = invitationId.uppercase()) ==
    SyntheticBoundInviteProofCheck.DENY_INVALID_BINDING)

  // 13: Self-registration and invalid counters have no canonical signed form.
  check(inspect(request = intent.copy(candidateDevice = oldId)) ==
    SyntheticBoundInviteProofCheck.DENY_INVALID_BINDING)
  check(inspect(request = intent.copy(approvingSequence = 0L)) ==
    SyntheticBoundInviteProofCheck.DENY_INVALID_BINDING)

  // 14: Role domains are distinct, not just signed bytes in different order.
  check(!SyntheticAccountBoundInviteProofLab.payload(accountId, invitationId, intent, nonce, false)
    .contentEquals(SyntheticAccountBoundInviteProofLab.payload(
      accountId, invitationId, intent, nonce, true)))

  // 15: Even valid proof is PROOF_ONLY. No grant-like status exists.
  check(SyntheticBoundInviteProofCheck.entries.none {
    it.name == "ALLOW" || it.name == "ENROLLED" || it.name == "UNLOCKED"
  })
  println("PASS: 15 account+invite bound Ed25519 proof scenarios (JVM lab only)")
}

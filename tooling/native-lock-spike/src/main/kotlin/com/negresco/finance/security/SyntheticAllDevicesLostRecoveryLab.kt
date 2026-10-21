package com.negresco.finance.security

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.PublicKey
import java.security.SecureRandom
import java.security.Signature
import java.util.UUID

/**
 * SEC-05F: ALL-DEVICES-LOST RECOVERY GATE SIMULATION. NOT an identity provider.
 *
 * An independently authenticated owner, fraud review, trusted authority key
 * provisioning, immutable audit, HSM, recovery secret, durable server ledger
 * and actual new-device enrollment DO NOT EXIST IN THIS LAB.
 *
 * The review authority is an Ed25519 TEST KEY pinned at construction. A signed
 * review and candidate possession prove only that the test keys signed bytes.
 * PROOF_ONLY_RECORDED NEVER adds a trusted device, issues a token or unlocks.
 */
internal data class SyntheticRecoveryAccountSeed(
  val accountId: String,
  val registry: DeviceTrustSnapshot,
  val ownerGeneration: Long
)

internal enum class SyntheticRecoveryStatus {
  PENDING_REVIEW, EXPIRED, INVALIDATED, PROOF_ONLY_RECORDED
}

internal enum class SyntheticRecoveryCheck {
  DENY_UNKNOWN_ACCOUNT,
  DENY_UNKNOWN_TICKET,
  DENY_INVALID_STATE,
  DENY_ACTIVE_DEVICE_EXISTS,
  DENY_REVOKED_OR_KNOWN_CANDIDATE,
  DENY_PENDING_REVIEW,
  DENY_MISSING_PINNED_AUTHORITY,
  DENY_CLOCK,
  DENY_TERMINAL_TICKET,
  DENY_STALE_GENERATION,
  DENY_INVALID_NONCE,
  DENY_WRONG_CANDIDATE,
  DENY_REVIEW_SIGNATURE,
  DENY_CANDIDATE_SIGNATURE,
  PROOF_RECORDED_NOT_ENROLLED
}

internal class SyntheticRecoveryTicketView(
  val accountId: String,
  val ticketId: String,
  val candidate: DeviceKeyFingerprint,
  val revision: Long,
  val epoch: Long,
  val ownerGeneration: Long,
  val issuedMillis: Long,
  val expiresMillis: Long,
  val status: SyntheticRecoveryStatus,
  pendingNonce: ByteArray?
) {
  private val nonce = pendingNonce?.copyOf()
  fun pendingNonceCopy(): ByteArray? = nonce?.copyOf()
}

/**
 * Canonical binary, role-separated payload. Explicitly bound to account,
 * recovery ticket UUID, replacement candidate, registry epoch/revision,
 * owner-generation fixture, issuance expiry and 32 random challenge bytes.
 */
internal object SyntheticRecoverySignedReviewLab {
  private val accountFormat = Regex("[0-9a-f]{32}")
  private val ticketFormat = Regex(
    "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
  )
  private val reviewDomain =
    "negresco.finance.recovery.external-review.ed25519.v1"
      .toByteArray(StandardCharsets.US_ASCII)
  private val candidateDomain =
    "negresco.finance.recovery.candidate-possession.ed25519.v1"
      .toByteArray(StandardCharsets.US_ASCII)

  private fun bytes(hex: String): ByteArray =
    hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()

  fun payload(
    view: SyntheticRecoveryTicketView,
    nonce: ByteArray,
    candidateRole: Boolean
  ): ByteArray {
    require(accountFormat.matches(view.accountId))
    require(ticketFormat.matches(view.ticketId))
    require(nonce.size == 32)
    require(view.revision > 0L && view.epoch > 0L &&
      view.epoch <= view.revision && view.ownerGeneration > 0L)
    require(view.issuedMillis > 0L && view.expiresMillis > view.issuedMillis)
    val domain = if (candidateRole) candidateDomain else reviewDomain
    val uuid = UUID.fromString(view.ticketId)
    return ByteArrayOutputStream().also { buffer ->
      DataOutputStream(buffer).use { output ->
        output.writeInt(domain.size)
        output.write(domain)
        output.writeInt(1)
        output.writeInt(16)
        output.write(bytes(view.accountId))
        output.writeLong(uuid.mostSignificantBits)
        output.writeLong(uuid.leastSignificantBits)
        output.writeInt(32)
        output.write(bytes(view.candidate.hex))
        output.writeLong(view.revision)
        output.writeLong(view.epoch)
        output.writeLong(view.ownerGeneration)
        output.writeLong(view.issuedMillis)
        output.writeLong(view.expiresMillis)
        output.writeInt(nonce.size)
        output.write(nonce)
      }
    }.toByteArray()
  }

  fun verify(
    view: SyntheticRecoveryTicketView,
    nonce: ByteArray,
    authorityPublicKey: PublicKey,
    candidatePublicKey: PublicKey,
    reviewSignature: ByteArray?,
    candidateSignature: ByteArray?
  ): SyntheticRecoveryCheck {
    if (!verifyOne(authorityPublicKey, view, nonce, false, reviewSignature))
      return SyntheticRecoveryCheck.DENY_REVIEW_SIGNATURE
    if (!verifyOne(candidatePublicKey, view, nonce, true, candidateSignature))
      return SyntheticRecoveryCheck.DENY_CANDIDATE_SIGNATURE
    return SyntheticRecoveryCheck.PROOF_RECORDED_NOT_ENROLLED
  }

  private fun verifyOne(
    key: PublicKey, view: SyntheticRecoveryTicketView,
    nonce: ByteArray, candidateRole: Boolean, signature: ByteArray?
  ): Boolean {
    if (signature == null || signature.size != 64 ||
        SyntheticSignedDeviceProofLab.fingerprint(key) == null) return false
    return try {
      val verifier = Signature.getInstance("Ed25519")
      verifier.initVerify(key)
      verifier.update(payload(view, nonce, candidateRole))
      verifier.verify(signature.copyOf())
    } catch (_: Exception) {
      false
    }
  }
}

/**
 * In-process fixture. Both the injected clock and account data are untrusted
 * for production. This is a review-gate demonstration, not enrollment.
 */
internal class SyntheticAllDevicesLostRecoveryLab(
  seeds: List<SyntheticRecoveryAccountSeed>,
  private val pinnedReviewAuthorityFixture: PublicKey?,
  private val labClockMillis: () -> Long
) {
  companion object { const val REVIEW_WINDOW_MILLIS = 10L * 60L * 1000L }
  private data class Account(
    var registry: DeviceTrustSnapshot,
    var ownerGeneration: Long
  )
  private class Ticket(
    val accountId: String,
    val id: String,
    val candidate: DeviceKeyFingerprint,
    val revision: Long,
    val epoch: Long,
    val ownerGeneration: Long,
    val issued: Long,
    val expires: Long,
    var nonce: ByteArray?,
    var status: SyntheticRecoveryStatus = SyntheticRecoveryStatus.PENDING_REVIEW
  )

  private val mutex = Any()
  private val rng = SecureRandom()
  private val accounts: Map<String, Account>
  private val tickets = mutableMapOf<Pair<String, String>, Ticket>()
  private val accountFormat = Regex("[0-9a-f]{32}")

  init {
    require(seeds.map { it.accountId }.toSet().size == seeds.size)
    require(seeds.all {
      accountFormat.matches(it.accountId) && it.ownerGeneration > 0L &&
        SyntheticDeviceTrustPolicy.wellFormed(it.registry)
    })
    accounts = seeds.associate {
      it.accountId to Account(copyRegistry(it.registry), it.ownerGeneration)
    }
  }

  private fun copyRegistry(s: DeviceTrustSnapshot) = s.copy(
    active = s.active.toSet(), revoked = s.revoked.toSet(),
    lastSequence = s.lastSequence.toMap()
  )

  private fun timestamp(): Long? = labClockMillis().takeIf {
    it > 0L && it <= Long.MAX_VALUE - REVIEW_WINDOW_MILLIS
  }

  private fun finish(ticket: Ticket, status: SyntheticRecoveryStatus) {
    check(ticket.status == SyntheticRecoveryStatus.PENDING_REVIEW)
    ticket.nonce?.fill(0)
    ticket.nonce = null
    ticket.status = status
  }

  private fun expire(ticket: Ticket): SyntheticRecoveryCheck? {
    if (ticket.status != SyntheticRecoveryStatus.PENDING_REVIEW) return null
    val now = timestamp() ?: return SyntheticRecoveryCheck.DENY_CLOCK
    if (now < ticket.issued) return SyntheticRecoveryCheck.DENY_CLOCK
    if (now >= ticket.expires) finish(ticket, SyntheticRecoveryStatus.EXPIRED)
    return null
  }

  private fun view(ticket: Ticket) = SyntheticRecoveryTicketView(
    ticket.accountId, ticket.id, ticket.candidate,
    ticket.revision, ticket.epoch, ticket.ownerGeneration,
    ticket.issued, ticket.expires, ticket.status, ticket.nonce
  )

  /**
   * Opening a review ticket is NOT approving it; it contains only a challenge.
   * Simulates a server-side account record with all prior devices revoked.
   */
  fun openReviewFixtureOnly(
    accountId: String, candidatePublicKey: PublicKey
  ): Pair<SyntheticRecoveryCheck, SyntheticRecoveryTicketView?> =
    synchronized(mutex) {
      val account = accounts[accountId]
        ?: return@synchronized SyntheticRecoveryCheck.DENY_UNKNOWN_ACCOUNT to null
      val state = account.registry
      if (!SyntheticDeviceTrustPolicy.wellFormed(state))
        return@synchronized SyntheticRecoveryCheck.DENY_INVALID_STATE to null
      if (state.active.isNotEmpty())
        return@synchronized SyntheticRecoveryCheck.DENY_ACTIVE_DEVICE_EXISTS to null
      if (state.revoked.isEmpty())
        return@synchronized SyntheticRecoveryCheck.DENY_INVALID_STATE to null
      val candidate = SyntheticSignedDeviceProofLab.fingerprint(candidatePublicKey)
        ?: return@synchronized SyntheticRecoveryCheck.DENY_WRONG_CANDIDATE to null
      if (candidate in state.revoked || candidate in state.active)
        return@synchronized SyntheticRecoveryCheck.DENY_REVOKED_OR_KNOWN_CANDIDATE to null
      val existing = tickets.values.filter { it.accountId == accountId }
      existing.forEach {
        val check = expire(it)
        if (check != null) return@synchronized check to null
      }
      if (existing.any { it.status == SyntheticRecoveryStatus.PENDING_REVIEW })
        return@synchronized SyntheticRecoveryCheck.DENY_PENDING_REVIEW to null
      val now = timestamp() ?: return@synchronized SyntheticRecoveryCheck.DENY_CLOCK to null
      val nonce = ByteArray(32).also { rng.nextBytes(it) }
      val ticket = Ticket(accountId, UUID.randomUUID().toString(), candidate,
        state.revision, state.epoch, account.ownerGeneration,
        now, now + REVIEW_WINDOW_MILLIS, nonce)
      tickets[accountId to ticket.id] = ticket
      SyntheticRecoveryCheck.PROOF_RECORDED_NOT_ENROLLED to view(ticket)
    }

  fun inspectFixtureOnly(accountId: String, ticketId: String):
    Pair<SyntheticRecoveryCheck, SyntheticRecoveryTicketView?> = synchronized(mutex) {
      if (accountId !in accounts)
        return@synchronized SyntheticRecoveryCheck.DENY_UNKNOWN_ACCOUNT to null
      val ticket = tickets[accountId to ticketId]
        ?: return@synchronized SyntheticRecoveryCheck.DENY_UNKNOWN_TICKET to null
      val timeCheck = expire(ticket)
      if (timeCheck != null) return@synchronized timeCheck to null
      SyntheticRecoveryCheck.PROOF_RECORDED_NOT_ENROLLED to view(ticket)
    }

  fun confirmReviewProofOnly(
    accountId: String,
    ticketId: String,
    candidatePublicKey: PublicKey,
    nonce: ByteArray?,
    signedExternalReview: ByteArray?,
    signedCandidatePossession: ByteArray?
  ): SyntheticRecoveryCheck = synchronized(mutex) {
    val account = accounts[accountId] ?: return@synchronized SyntheticRecoveryCheck.DENY_UNKNOWN_ACCOUNT
    val ticket = tickets[accountId to ticketId]
      ?: return@synchronized SyntheticRecoveryCheck.DENY_UNKNOWN_TICKET
    val check = expire(ticket)
    if (check != null) return@synchronized check
    if (ticket.status != SyntheticRecoveryStatus.PENDING_REVIEW)
      return@synchronized SyntheticRecoveryCheck.DENY_TERMINAL_TICKET
    if (account.registry.active.isNotEmpty() ||
        !SyntheticDeviceTrustPolicy.wellFormed(account.registry))
      return@synchronized SyntheticRecoveryCheck.DENY_INVALID_STATE
    if (ticket.revision != account.registry.revision ||
        ticket.epoch != account.registry.epoch ||
        ticket.ownerGeneration != account.ownerGeneration) {
      finish(ticket, SyntheticRecoveryStatus.INVALIDATED)
      return@synchronized SyntheticRecoveryCheck.DENY_STALE_GENERATION
    }
    val authority = pinnedReviewAuthorityFixture
    if (authority == null || SyntheticSignedDeviceProofLab.fingerprint(authority) == null)
      return@synchronized SyntheticRecoveryCheck.DENY_MISSING_PINNED_AUTHORITY
    if (SyntheticSignedDeviceProofLab.fingerprint(candidatePublicKey) != ticket.candidate)
      return@synchronized SyntheticRecoveryCheck.DENY_WRONG_CANDIDATE
    val stored = ticket.nonce ?: return@synchronized SyntheticRecoveryCheck.DENY_INVALID_STATE
    if (nonce == null || nonce.size != 32 || !MessageDigest.isEqual(stored, nonce))
      return@synchronized SyntheticRecoveryCheck.DENY_INVALID_NONCE
    val result = SyntheticRecoverySignedReviewLab.verify(
      view(ticket), stored, authority, candidatePublicKey,
      signedExternalReview, signedCandidatePossession
    )
    if (result != SyntheticRecoveryCheck.PROOF_RECORDED_NOT_ENROLLED)
      return@synchronized result
    finish(ticket, SyntheticRecoveryStatus.PROOF_ONLY_RECORDED)
    // No registry mutation: the new device is STILL UNKNOWN and cannot unlock.
    SyntheticRecoveryCheck.PROOF_RECORDED_NOT_ENROLLED
  }

  /** Fixture-only simulated owner generation change, not authenticated. */
  fun invalidateGenerationFixtureOnly(accountId: String): Boolean =
    synchronized(mutex) {
      val account = accounts[accountId] ?: return@synchronized false
      if (account.ownerGeneration == Long.MAX_VALUE ||
          account.registry.revision == Long.MAX_VALUE ||
          account.registry.epoch == Long.MAX_VALUE) return@synchronized false
      account.ownerGeneration++
      account.registry = copyRegistry(account.registry.copy(
        revision = account.registry.revision + 1L,
        epoch = account.registry.epoch + 1L
      ))
      tickets.values.filter {
        it.accountId == accountId && it.status == SyntheticRecoveryStatus.PENDING_REVIEW
      }.forEach { finish(it, SyntheticRecoveryStatus.INVALIDATED) }
      true
    }

  fun registryForTest(accountId: String): DeviceTrustSnapshot? =
    synchronized(mutex) { accounts[accountId]?.registry?.let(::copyRegistry) }
}

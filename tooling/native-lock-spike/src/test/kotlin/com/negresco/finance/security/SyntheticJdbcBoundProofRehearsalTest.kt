package com.negresco.finance.security

import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.sql.Connection
import java.sql.DriverManager
import java.sql.Timestamp
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * SEC-05E: throwaway PostgreSQL+JVM Ed25519 end-to-end transaction rehearsal.
 *
 * No authenticated account, HTTP server, owner strong auth, device enrollment,
 * financial permission or anti-rollback infrastructure is present.
 * All requests are created by test fixtures inside this JVM. The function
 * performs a PROOF_ONLY ledger increment, NEVER inserts a new trusted device.
 */
private data class LabProof(
  val account: UUID,
  val invitation: UUID,
  val nonce: ByteArray,
  val approvingSignature: ByteArray,
  val candidateSignature: ByteArray,
  val idempotencyDigest: ByteArray,
  val ownerGenerationFixture: Long = 1L
)

private class SyntheticJdbcBoundProofRehearsalLab {
  private val url = System.getenv("NEGRESCO_LAB_PG_URL")
    ?: error("SEC-05E may execute ONLY with explicit disposable PostgreSQL URL")
  private val user = System.getenv("NEGRESCO_LAB_PG_USER") ?: "postgres"
  private val password = System.getenv("NEGRESCO_LAB_PG_PASSWORD") ?: ""
  private val schema = "negresco_sec05c_lab"

  private fun connection(): Connection = DriverManager.getConnection(url, user, password)

  private fun invalid(): String = "DENY_INVALID_PROOF"

  // Caller-controlled account/authorization here is a synthetic test input;
  // there is NO login, token verifier, authorization service or network.
  fun rehearse(proof: LabProof, injectRollbackBeforeCommit: Boolean = false): String =
    connection().use { db ->
      db.autoCommit = false
      // Row locks serialize mutations even across real DB connections.
      // READ_COMMITTED is intentional; SERIALIZABLE needs retry handling.
      db.transactionIsolation = Connection.TRANSACTION_READ_COMMITTED
      fun outcome(reason: String): String {
        db.commit()
        return reason
      }
      try {
        if (proof.nonce.size != 32 || proof.idempotencyDigest.size != 32)
          return@use outcome("DENY_INVALID_INPUT")

        val account = db.prepareStatement(
          "SELECT registry_revision,registry_epoch,owner_auth_generation " +
            "FROM $schema.accounts WHERE account_id=? FOR UPDATE"
        ).use { st ->
          st.setObject(1, proof.account)
          st.executeQuery().use { r ->
            if (!r.next()) null else Triple(r.getLong(1), r.getLong(2), r.getLong(3))
          }
        } ?: return@use outcome("DENY_UNKNOWN_ACCOUNT")

        // Idempotency evidence is never a bearer token. Production must
        // authenticate the same account BEFORE revealing this result.
        val previous = db.prepareStatement(
          "SELECT invitation_id FROM $schema.enrollment_receipts " +
            "WHERE account_id=? AND idempotency_digest=?"
        ).use { st ->
          st.setObject(1, proof.account)
          st.setBytes(2, proof.idempotencyDigest)
          st.executeQuery().use { r ->
            if (r.next()) r.getObject(1, UUID::class.java) else null
          }
        }
        if (previous != null)
          return@use outcome(if (previous == proof.invitation)
            "ALREADY_RECORDED_NO_GRANT" else "DENY_IDEMPOTENCY_CONFLICT")

        data class PendingRow(
          val approver: ByteArray, val candidate: ByteArray, val candidateSpki: ByteArray,
          val revision: Long, val epoch: Long, val sequence: Long,
          val nonceDigest: ByteArray, val expires: Timestamp,
          val ownerGeneration: Long, val status: String
        )
        val invitation = db.prepareStatement(
          "SELECT approver_fingerprint,candidate_fingerprint,candidate_spki," +
            "registry_revision,registry_epoch,approving_sequence,nonce_digest," +
            "expires_at,owner_auth_generation,lifecycle FROM $schema.invites " +
            "WHERE account_id=? AND invitation_id=? FOR UPDATE"
        ).use { st ->
          st.setObject(1, proof.account)
          st.setObject(2, proof.invitation)
          st.executeQuery().use { r ->
            if (!r.next()) null else PendingRow(
              r.getBytes(1), r.getBytes(2), r.getBytes(3), r.getLong(4),
              r.getLong(5), r.getLong(6), r.getBytes(7),
              r.getTimestamp(8), r.getLong(9), r.getString(10)
            )
          }
        } ?: return@use outcome("DENY_UNKNOWN_INVITATION")
        if (invitation.status != "PENDING")
          return@use outcome("DENY_TERMINAL_INVITATION")

        val now = db.createStatement().use { st ->
          st.executeQuery("SELECT clock_timestamp()").use { r ->
            check(r.next())
            r.getTimestamp(1)
          }
        }
        if (!now.before(invitation.expires)) {
          db.prepareStatement(
            "UPDATE $schema.invites SET lifecycle='EXPIRED',finalized_at=? " +
              "WHERE account_id=? AND invitation_id=?"
          ).use { st ->
            st.setTimestamp(1, now); st.setObject(2, proof.account)
            st.setObject(3, proof.invitation); check(st.executeUpdate() == 1)
          }
          return@use outcome("DENY_EXPIRED")
        }
        if (account.first != invitation.revision || account.second != invitation.epoch ||
          account.third != invitation.ownerGeneration ||
          account.third != proof.ownerGenerationFixture)
          return@use outcome("DENY_STALE_ACCOUNT_STATE")

        data class Approver(val keySpki: ByteArray, val status: String, val last: Long)
        val approver = db.prepareStatement(
          "SELECT ed25519_spki,lifecycle,last_approving_sequence FROM $schema.devices " +
            "WHERE account_id=? AND public_key_fingerprint=? FOR UPDATE"
        ).use { st ->
          st.setObject(1, proof.account); st.setBytes(2, invitation.approver)
          st.executeQuery().use { r ->
            if (!r.next()) null else Approver(r.getBytes(1),r.getString(2),r.getLong(3))
          }
        } ?: return@use outcome("DENY_UNTRUSTED_APPROVER")
        if (approver.status != "ACTIVE")
          return@use outcome("DENY_REVOKED_APPROVER")
        if (invitation.sequence <= approver.last || invitation.sequence == Long.MAX_VALUE)
          return@use outcome("DENY_REPLAYED_SEQUENCE")
        if (account.first >= Long.MAX_VALUE - 1 || account.second >= Long.MAX_VALUE - 1)
          return@use outcome("DENY_COUNTER_OVERFLOW")

        val candidateKnown = db.prepareStatement(
          "SELECT 1 FROM $schema.devices WHERE account_id=? AND public_key_fingerprint=?"
        ).use { st ->
          st.setObject(1, proof.account); st.setBytes(2, invitation.candidate)
          st.executeQuery().use { it.next() }
        }
        if (candidateKnown) return@use outcome("DENY_KNOWN_CANDIDATE")
        if (!MessageDigest.isEqual(invitation.nonceDigest,
            MessageDigest.getInstance("SHA-256").digest(proof.nonce)))
          return@use outcome(invalid())

        // Both keys are reconstructed from STORED account-scoped DB rows,
        // not a public key supplied alongside the untrusted signatures.
        val oldKey = try {
          KeyFactory.getInstance("Ed25519").generatePublic(X509EncodedKeySpec(approver.keySpki))
        } catch (_: Exception) { return@use outcome(invalid()) }
        val newKey = try {
          KeyFactory.getInstance("Ed25519").generatePublic(X509EncodedKeySpec(invitation.candidateSpki))
        } catch (_: Exception) { return@use outcome(invalid()) }
        val intent = try {
          SyntheticDeviceEnrollmentIntent(
            DeviceKeyFingerprint.parse(invitation.approver.toHex()),
            DeviceKeyFingerprint.parse(invitation.candidate.toHex()),
            invitation.revision, invitation.epoch, invitation.sequence
          )
        } catch (_: IllegalArgumentException) { return@use outcome(invalid()) }
        val gate = SyntheticAccountBoundInviteProofLab.inspect(
          proof.account.toString().replace("-", ""), proof.invitation.toString(),
          intent, oldKey, newKey, proof.nonce, proof.nonce,
          proof.approvingSignature, proof.candidateSignature
        )
        if (gate != SyntheticBoundInviteProofCheck.PROOF_VERIFIED_ONLY)
          return@use outcome(invalid())

        db.prepareStatement(
          "UPDATE $schema.devices SET last_approving_sequence=? " +
            "WHERE account_id=? AND public_key_fingerprint=?"
        ).use { st ->
          st.setLong(1, invitation.sequence)
          st.setObject(2, proof.account); st.setBytes(3, invitation.approver)
          check(st.executeUpdate() == 1)
        }
        db.prepareStatement(
          "UPDATE $schema.accounts SET registry_revision=registry_revision+1," +
            "registry_epoch=registry_epoch+1 WHERE account_id=?"
        ).use { st -> st.setObject(1, proof.account); check(st.executeUpdate() == 1) }
        db.prepareStatement(
          "UPDATE $schema.invites SET lifecycle='CONSUMED',finalized_at=? " +
            "WHERE account_id=? AND invitation_id=?"
        ).use { st ->
          st.setTimestamp(1, now); st.setObject(2, proof.account)
          st.setObject(3, proof.invitation); check(st.executeUpdate() == 1)
        }
        db.prepareStatement(
          "INSERT INTO $schema.enrollment_receipts " +
            "(account_id,invitation_id,idempotency_digest,candidate_fingerprint," +
            "committed_revision,committed_epoch) VALUES (?,?,?,?,?,?)"
        ).use { st ->
          st.setObject(1, proof.account); st.setObject(2, proof.invitation)
          st.setBytes(3, proof.idempotencyDigest); st.setBytes(4, invitation.candidate)
          st.setLong(5, account.first + 1); st.setLong(6, account.second + 1)
          check(st.executeUpdate() == 1)
        }
        if (injectRollbackBeforeCommit)
          error("SYNTHETIC_INJECTED_ABORT_BEFORE_COMMIT")
        outcome("RECORDED_SIGNED_PROOF_FIXTURE_ONLY")
      } catch (ex: Exception) {
        db.rollback()
        throw ex
      }
    }

  fun seed(
    account: UUID, invite: UUID, approving: KeyPair, candidate: KeyPair,
    nonce: ByteArray, issuedMinutesAgo: Int = 0,
    approverRevoked: Boolean = false, ownerGeneration: Long = 1L
  ) {
    val oldFp = SyntheticSignedDeviceProofLab.fingerprint(approving.public)!!
    val candidateFp = SyntheticSignedDeviceProofLab.fingerprint(candidate.public)!!
    connection().use { db ->
      db.autoCommit = false
      try {
        db.prepareStatement(
          "INSERT INTO $schema.accounts(account_id,registry_revision," +
            "registry_epoch,owner_auth_generation) VALUES (?,1,1,?)"
        ).use { st ->
          st.setObject(1,account);st.setLong(2,ownerGeneration);check(st.executeUpdate()==1)
        }
        db.prepareStatement(
          "INSERT INTO $schema.devices(account_id,public_key_fingerprint,ed25519_spki," +
            "lifecycle,last_approving_sequence,revoked_at) " +
            "VALUES (?,?,?, ?,0,CASE WHEN ? THEN clock_timestamp() ELSE NULL END)"
        ).use { st ->
          st.setObject(1,account);st.setBytes(2,oldFp.hex.hexToBytes())
          st.setBytes(3,approving.public.encoded);st.setString(4,if (approverRevoked) "REVOKED" else "ACTIVE")
          st.setBoolean(5,approverRevoked);check(st.executeUpdate()==1)
        }
        db.prepareStatement(
          "INSERT INTO $schema.invites(account_id,invitation_id,approver_fingerprint," +
            "candidate_fingerprint,candidate_spki,registry_revision,registry_epoch," +
            "approving_sequence,nonce_digest,issued_at,expires_at,owner_auth_generation) " +
            "SELECT ?,?,?,?,?,1,1,1,?,fixed_time.issued," +
            "fixed_time.issued + INTERVAL '5 minutes',? " +
            "FROM (SELECT clock_timestamp() - (? * INTERVAL '1 minute') AS issued) fixed_time"
        ).use { st ->
          st.setObject(1,account);st.setObject(2,invite)
          st.setBytes(3,oldFp.hex.hexToBytes());st.setBytes(4,candidateFp.hex.hexToBytes())
          st.setBytes(5,candidate.public.encoded)
          st.setBytes(6,MessageDigest.getInstance("SHA-256").digest(nonce))
          st.setLong(7,ownerGeneration)
          st.setInt(8,issuedMinutesAgo)
          check(st.executeUpdate()==1)
        }
        db.commit()
      } catch (ex:Exception) {
        db.rollback()
        throw ex
      }
    }
  }

  fun ledger(account: UUID, invite: UUID): String = connection().use { db ->
    db.prepareStatement(
      "SELECT a.registry_revision,a.registry_epoch,d.last_approving_sequence,i.lifecycle," +
        "(SELECT count(*) FROM $schema.enrollment_receipts r WHERE r.account_id=a.account_id)," +
        "(SELECT count(*) FROM $schema.devices candidate WHERE candidate.account_id=a.account_id " +
        "AND candidate.public_key_fingerprint=i.candidate_fingerprint) " +
        "FROM $schema.accounts a JOIN $schema.invites i ON a.account_id=i.account_id " +
        "JOIN $schema.devices d ON d.account_id=a.account_id " +
        "AND d.public_key_fingerprint=i.approver_fingerprint " +
        "WHERE a.account_id=? AND i.invitation_id=?"
    ).use { st ->
      st.setObject(1,account);st.setObject(2,invite)
      st.executeQuery().use { r ->
        check(r.next())
        (1..6).joinToString(":") { r.getString(it) }
      }
    }
  }
}

private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it.toInt() and 255) }
private fun String.hexToBytes(): ByteArray = chunked(2).map { it.toInt(16).toByte() }.toByteArray()

private fun sign(
  account: UUID, invite: UUID, old: KeyPair, candidate: KeyPair, nonce: ByteArray,
  which: Boolean
): ByteArray {
  val intent = SyntheticDeviceEnrollmentIntent(
    SyntheticSignedDeviceProofLab.fingerprint(old.public)!!,
    SyntheticSignedDeviceProofLab.fingerprint(candidate.public)!!,1,1,1)
  val key = if (which) candidate else old
  return Signature.getInstance("Ed25519").run {
    initSign(key.private)
    update(SyntheticAccountBoundInviteProofLab.payload(
      account.toString().replace("-", ""),invite.toString(),intent,nonce,which))
    sign()
  }
}

private fun request(
  account: UUID,invite: UUID,old:KeyPair,candidate:KeyPair,nonce:ByteArray
) = LabProof(
  account,invite,nonce.copyOf(),
  sign(account,invite,old,candidate,nonce,false),
  sign(account,invite,old,candidate,nonce,true),
  MessageDigest.getInstance("SHA-256").digest(
    (account.toString()+invite.toString()).toByteArray(Charsets.US_ASCII))
)

fun main() {
  val lab = SyntheticJdbcBoundProofRehearsalLab()
  val keygen = KeyPairGenerator.getInstance("Ed25519")
  val rng = SecureRandom()
  fun id() = UUID.randomUUID()
  fun nonce() = ByteArray(32).also { rng.nextBytes(it) }
  fun deny(expected:String,action:()->String) {
    val actual=action()
    check(actual==expected) { "expected $expected, got $actual" }
  }

  // 1: both Ed25519 proofs verified INSIDE a PostgreSQL row-locked transaction.
  val account=id();val invite=id();val old=keygen.generateKeyPair()
  val candidate=keygen.generateKeyPair();val challenge=nonce()
  lab.seed(account,invite,old,candidate,challenge)
  val valid=request(account,invite,old,candidate,challenge)
  check(lab.ledger(account,invite)=="1:1:0:PENDING:0:0")

  // 2: signed proof tied to a different invitation cannot be consumed.
  val wrongInvite=request(account,id(),old,candidate,challenge)
  deny("DENY_INVALID_PROOF") {
    lab.rehearse(valid.copy(approvingSignature=wrongInvite.approvingSignature))
  }
  check(lab.ledger(account,invite)=="1:1:0:PENDING:0:0")

  // 3: altered candidate proof is denied with no changes.
  val altered=valid.candidateSignature.copyOf().also {
    it[0]=(it[0].toInt() xor 1).toByte()
  }
  deny("DENY_INVALID_PROOF") {
    lab.rehearse(valid.copy(candidateSignature=altered))
  }

  // 4: account-scoped signatures cannot be replayed against another account.
  val wrongAccount=request(id(),invite,old,candidate,challenge)
  deny("DENY_INVALID_PROOF") {
    lab.rehearse(valid.copy(approvingSignature=wrongAccount.approvingSignature))
  }

  // 5: invalid nonce digest is never accepted even if two keys signed it.
  val wrongNonce=nonce()
  deny("DENY_INVALID_PROOF") {
    lab.rehearse(request(account,invite,old,candidate,wrongNonce))
  }
  check(lab.ledger(account,invite)=="1:1:0:PENDING:0:0")

  // 6: abort AFTER the SQL updates but BEFORE commit rolls back everything.
  val failed=runCatching { lab.rehearse(valid,injectRollbackBeforeCommit=true) }
  check(failed.exceptionOrNull()?.message=="SYNTHETIC_INJECTED_ABORT_BEFORE_COMMIT")
  check(lab.ledger(account,invite)=="1:1:0:PENDING:0:0")

  // 7: eight independent JDBC connections race. One proof-only commit wins.
  val gate=CountDownLatch(1);val pool=Executors.newFixedThreadPool(8)
  try {
    val tasks=(1..8).map {
      pool.submit<String> {
        gate.await()
        lab.rehearse(valid)
      }
    }
    gate.countDown()
    val outcomes=tasks.map { it.get(25L,TimeUnit.SECONDS) }
    check(outcomes.count{it=="RECORDED_SIGNED_PROOF_FIXTURE_ONLY"}==1) {outcomes.toString()}
    check(outcomes.count{it=="ALREADY_RECORDED_NO_GRANT"}==7) {outcomes.toString()}
  } finally {pool.shutdownNow()}
  check(lab.ledger(account,invite)=="2:2:1:CONSUMED:1:0")

  // 8: idempotent retry does not repeat the counter or add any device.
  deny("ALREADY_RECORDED_NO_GRANT") {lab.rehearse(valid)}
  check(lab.ledger(account,invite)=="2:2:1:CONSUMED:1:0")

  // 9: same idempotency digest cannot refer to a different invitation.
  deny("DENY_IDEMPOTENCY_CONFLICT") {lab.rehearse(valid.copy(invitation=id()))}

  // 10: different idempotency digest doesn't bypass terminal state.
  deny("DENY_TERMINAL_INVITATION") {
    lab.rehearse(valid.copy(idempotencyDigest=nonce()))
  }

  // 11: expired invitation cannot be signed into existence.
  val expiredAccount=id();val expiredInvite=id();val expiredNonce=nonce()
  lab.seed(expiredAccount,expiredInvite,keygen.generateKeyPair(),
    keygen.generateKeyPair(),expiredNonce,issuedMinutesAgo=10)
  // Expiry must be checked BEFORE cryptographic validation.
  deny("DENY_EXPIRED") {
    lab.rehearse(LabProof(expiredAccount,expiredInvite,expiredNonce,
      ByteArray(64),ByteArray(64),nonce()))
  }
  check(lab.ledger(expiredAccount,expiredInvite)=="1:1:0:EXPIRED:0:0")

  // 12: revocation and owner generation fail closed.
  val revokedAccount=id();val revokedInvite=id()
  val revokedOld=keygen.generateKeyPair();val revokedNew=keygen.generateKeyPair()
  val revokedNonce=nonce()
  lab.seed(revokedAccount,revokedInvite,revokedOld,revokedNew,revokedNonce,approverRevoked=true)
  deny("DENY_REVOKED_APPROVER") {
    lab.rehearse(request(revokedAccount,revokedInvite,revokedOld,revokedNew,revokedNonce))
  }
  check(lab.ledger(revokedAccount,revokedInvite)=="1:1:0:PENDING:0:0")

  val guardedAccount=id();val guardedInvite=id()
  val guardedOld=keygen.generateKeyPair();val guardedNew=keygen.generateKeyPair()
  val guardedNonce=nonce()
  lab.seed(guardedAccount,guardedInvite,guardedOld,guardedNew,guardedNonce,ownerGeneration=4)
  deny("DENY_STALE_ACCOUNT_STATE") {
    lab.rehearse(request(guardedAccount,guardedInvite,guardedOld,guardedNew,guardedNonce))
  }
  check(lab.ledger(guardedAccount,guardedInvite)=="1:1:0:PENDING:0:0")

  println("PASS: SEC-05E PostgreSQL row-locked two-role Ed25519 proofs, 8 JDBC sessions,")
  println("      rollback, cross-account/cross-invite denial, expiry and zero device enrollment")
  println("LIMIT: no authenticated owner, real server, issuer attestation or device grant")
}

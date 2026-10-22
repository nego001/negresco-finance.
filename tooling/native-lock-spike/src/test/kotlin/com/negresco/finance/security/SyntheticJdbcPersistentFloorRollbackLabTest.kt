package com.negresco.finance.security

import java.nio.file.Files
import java.nio.file.Path
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.sql.DriverManager
import java.util.Comparator
import java.util.UUID

/**
 * SEC-05K: PostgreSQL rollback vs independent DISK-PERSISTED JVM witness.
 * All accounts, hashes, database rows and keys are disposable.
 * This deliberately proves a negative: signed floor files are replayable if
 * an attacker restores the witness directory as well as the database.
 */
internal fun runSyntheticJdbcPersistentFloorRollbackScenarios() {
  val db = SyntheticJdbcRekeyCasPersistenceLab()
  val crypto = SyntheticSignedRekeyAuthorityChallengeLab
  val root = Files.createTempDirectory("negresco-sec05k-floor-")
  var checks = 0
  fun verify(ok: Boolean, reason: String) {
    check(ok) { "SEC05K persistent floor: $reason" }
    checks++
  }
  fun claim(account: String, v: Long, g: Long): SyntheticRekeyGenerationClaimLab {
    val kit = UUID.randomUUID().toString()
    return SyntheticRekeyGenerationClaimLab(account, kit, v, g,
      MessageDigest.getInstance("SHA-256").digest(
        "sec05k-persistent-disposable-$account-$kit".toByteArray()))
  }
  fun quotedEquals(
    client: SyntheticPersistentFloorClientFixtureLab,
    pinned: java.security.PublicKey,
    expected: SyntheticRekeyGenerationClaimLab
  ): Boolean {
    val session = SyntheticSignedRekeyChallengeSessionLab(expected, pinned)
    val nonce = session.issueChallengeFixtureOnly()!!
    val quote = client.quote(nonce)!!
    return session.verifyOnceFixtureOnly(nonce, quote.first, quote.second) ==
      SyntheticSignedRekeyChallengeCheckLab.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY &&
      crypto.equivalentFixtureOnly(quote.first, expected)
  }
  val account = UUID.randomUUID().toString().replace("-", "")
  val old = claim(account, 7, 8)
  val fresh = claim(account, 8, 9)
  try {
    verify(db.bootstrapFixtureOnly(old) == "BOOTSTRAPPED_FIXTURE_ONLY",
      "disposable PostgreSQL enrolled")
    val pinned: java.security.PublicKey
    val oldSignedState: ByteArray
    SyntheticPersistentFloorClientFixtureLab(root).use { first ->
      pinned = first.publicKey
      verify(first.quote(ByteArray(32)) == null, "new durable floor has no implicit enrollment")
      verify(first.call("QUOTE|YQ==") == "DENY_MALFORMED",
        "short nonce rejected before enrollment")
      verify(first.enroll(old) == "OK_ENROLLED", "durable floor explicitly enrolled")
      verify(first.enroll(old) == "DENY_ALREADY_ENROLLED", "cannot reseed live floor")
      verify(quotedEquals(first, pinned, old), "first generation quote signed")
      oldSignedState = Files.readAllBytes(root.resolve("floor.state"))
    }

    SyntheticPersistentFloorClientFixtureLab(root).use { second ->
      verify(MessageDigest.isEqual(pinned.encoded, second.publicKey.encoded),
        "Ed25519 public key survives first independent JVM restart")
      verify(quotedEquals(second, pinned, old),
        "signed OLD floor survives first JVM restart")
      verify(second.enroll(old) == "DENY_ALREADY_ENROLLED",
        "a restarted child does not silently re-enroll")
      verify(db.compareAndSwapFixtureOnly(UUID.randomUUID(), old, fresh) ==
        "ADVANCED_FIXTURE_ONLY", "PostgreSQL CAS committed")
      verify(second.advance(old, fresh) == "OK_ADVANCED",
        "separate floor persisted new generation with atomic replace and fsync")
      verify(second.advance(old, fresh) == "DENY_PREDECESSOR",
        "old predecessor cannot be replayed during current process")
      verify(quotedEquals(second, pinned, fresh), "NEW signed floor matches DB")
    }

    val newSignedState = Files.readAllBytes(root.resolve("floor.state"))
    verify(!MessageDigest.isEqual(oldSignedState, newSignedState),
      "on-disk signed floor changed after successful advance")
    SyntheticPersistentFloorClientFixtureLab(root).use { third ->
      verify(MessageDigest.isEqual(pinned.encoded, third.publicKey.encoded),
        "signature identity remains pinned after second JVM restart")
      verify(quotedEquals(third, pinned, fresh),
        "NEW floor survives process shutdown and restart")
      verify(third.enroll(old) == "DENY_ALREADY_ENROLLED" &&
        third.advance(old, fresh) == "DENY_PREDECESSOR",
        "stale commands cannot lower disk-persisted floor")

      // Simulate privileged rollback of just this random account + receipt.
      // The witness JVM deliberately has no PostgreSQL connection.
      val url = System.getenv("NEGRESCO_LAB_PG_URL")
        ?: error("Disposable PostgreSQL URL required")
      val user = System.getenv("NEGRESCO_LAB_PG_USER")
        ?: System.getenv("PGUSER") ?: "postgres"
      val pass = System.getenv("NEGRESCO_LAB_PG_PASSWORD")
        ?: System.getenv("PGPASSWORD") ?: ""
      DriverManager.getConnection(url, user, pass).use { connection ->
        connection.autoCommit = false
        try {
          connection.prepareStatement(
            "DELETE FROM negresco_sec05k_cas_lab.operation_receipts WHERE account_id=?"
          ).use { ps ->
            ps.setString(1, account)
            verify(ps.executeUpdate() == 1, "one random PG receipt removed by test")
          }
          connection.prepareStatement(
            "UPDATE negresco_sec05k_cas_lab.generations SET " +
              "kit_id=?,version=?,generation=?,ciphertext_sha256=? WHERE account_id=?"
          ).use { ps ->
            ps.setObject(1, UUID.fromString(old.kitId))
            ps.setLong(2, old.version)
            ps.setLong(3, old.generation)
            ps.setBytes(4, old.ciphertextHash)
            ps.setString(5, account)
            verify(ps.executeUpdate() == 1, "one random PG generation restored")
          }
          connection.commit()
        } catch (error: Exception) {
          connection.rollback()
          throw error
        }
      }
      verify(crypto.equivalentFixtureOnly(db.currentFixtureOnly(account)!!, old) &&
        db.receiptsFixtureOnly(account) == 0, "PostgreSQL currently shows OLD without receipt")
      verify(quotedEquals(third, pinned, fresh),
        "running persistent child still signs NEW after PostgreSQL rollback")
    }
    SyntheticPersistentFloorClientFixtureLab(root).use { fourth ->
      verify(quotedEquals(fourth, pinned, fresh),
        "NEW signature still valid after both authority restart and PG rollback")
      verify(!crypto.equivalentFixtureOnly(db.currentFixtureOnly(account)!!,
        fourth.quote(ByteArray(32))!!.first),
        "persisted independently pinned floor detects database-only rollback")
      verify(fourth.enroll(old) == "DENY_ALREADY_ENROLLED" &&
        fourth.advance(old, fresh) == "DENY_PREDECESSOR",
        "re-enrollment and old CAS denied following authority restart")
    }

    val file = root.resolve("floor.state")
    Files.write(file, byteArrayOf(1, 2, 3))
    verify(runCatching { SyntheticPersistentFloorClientFixtureLab(root).use { } }.isFailure,
      "truncated signed floor fails closed on JVM restart")
    Files.write(file, newSignedState)
    SyntheticPersistentFloorClientFixtureLab(root).use { recovered ->
      verify(quotedEquals(recovered, pinned, fresh),
        "manual restoration of EXACT latest signed fixture permits read")
    }
    Files.delete(file)
    verify(runCatching { SyntheticPersistentFloorClientFixtureLab(root).use { } }.isFailure,
      "enrollment latch rejects missing floor.state after restart")
    Files.write(file, newSignedState)
    SyntheticPersistentFloorClientFixtureLab(root).use { recovered ->
      verify(quotedEquals(recovered, pinned, fresh),
        "latest signed fixture can be restored after partial deletion")
    }

    // Expected unresolved weakness: an attacker replays old valid state from
    // this same witness directory. Signatures validate, generation is OLD.
    Files.write(file, oldSignedState)
    SyntheticPersistentFloorClientFixtureLab(root).use { replayed ->
      verify(MessageDigest.isEqual(pinned.encoded, replayed.publicKey.encoded),
        "identity key remains pinned under signed-state replay")
      verify(quotedEquals(replayed, pinned, old),
        "KNOWN LIMIT: old signed authority state can itself be replayed")
      val strange = KeyPairGenerator.getInstance("Ed25519").generateKeyPair().public
      verify(!MessageDigest.isEqual(strange.encoded, replayed.publicKey.encoded),
        "unrelated public key differs from pinned authority")
    }
    verify(SyntheticJournalAuthorityReconciliationPolicyLab.decide(
      SyntheticRekeyReconciliationInputLab(
        SyntheticRekeyAuthorityEvidenceLab.SIGNED_CHALLENGE_FIXTURE_ONLY_NO_LIVE_AUTHORITY,
        SyntheticRekeyJournalObservationLab.CLEAN,
        SyntheticRekeyCiphertextObservationLab.OLD_AUTHENTICATED,
        SyntheticRekeyCandidateObservationLab.ABSENT,
        SyntheticRekeyAuthorityGenerationLab.NEW_CURRENT,
        true, old.version, fresh.version, old.generation, fresh.generation
      )) == SyntheticRekeyReconciliationDecisionLab.HOLD_EXTERNAL_AUTHORITY_REQUIRED,
      "disk-persisted fixture evidence NEVER promotes to trusted live authority")
  } finally {
    Files.walk(root).use { paths ->
      paths.sorted(Comparator.reverseOrder<Path>()).forEach { Files.deleteIfExists(it) }
    }
  }
  println("PASS: SEC-05K $checks persistent separate-JVM floor vs PostgreSQL rollback checks (fixture only)")
  println("LIMIT: restoring the old signed authority file is STILL POSSIBLE: no hardware monotonicity")
}

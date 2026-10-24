package com.negresco.finance.security

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.PublicKey
import java.sql.DriverManager
import java.util.UUID

/**
 * SEC-05K: disposable PostgreSQL and independent directory, NEVER production.
 * Tests DB-only rollback resilience and demonstrates FAILING trust boundary
 * when the authority file itself is reverted. No migration is authorized.
 */
internal fun runSyntheticJdbcDurableFloorRollbackScenarios() {
  val db = SyntheticJdbcRekeyCasPersistenceLab()
  val crypto = SyntheticSignedRekeyAuthorityChallengeLab
  var checks = 0
  fun verify(ok: Boolean, why: String) {
    check(ok) { "SEC05K durable floor: " + why }
    checks++
  }
  fun claim(account: String, v: Long, g: Long): SyntheticRekeyGenerationClaimLab {
    val kit = UUID.randomUUID().toString()
    return SyntheticRekeyGenerationClaimLab(account, kit, v, g,
      MessageDigest.getInstance("SHA-256").digest(
        ("durable-floor-fixture-" + account + kit).toByteArray(StandardCharsets.UTF_8)))
  }

  val account = UUID.randomUUID().toString().replace("-", "")
  val old = claim(account, 5, 8)
  val latest = claim(account, 6, 9)
  val root = Files.createTempDirectory("sec05k-external-authority-fixture-")
  verify(db.bootstrapFixtureOnly(old) == "BOOTSTRAPPED_FIXTURE_ONLY",
    "random PostgreSQL fixture seeded separately from durable authority")
  lateinit var pinned: PublicKey
  lateinit var oldAuthorityBytes: ByteArray

  SyntheticDurableFloorClientFixtureLab(root).use { floor ->
    pinned = floor.childPublicKey
    verify(floor.signedCurrent(ByteArray(32)) == null,
      "newly provisioned durable floor starts unenrolled")
    verify(floor.call("QUOTE|YQ==") == "DENY_MALFORMED_OR_CORRUPT",
      "short nonce denied")
    verify(floor.enroll(old) == "OK_ENROLLED",
      "explicit initial claim persisted on independent disk")
    oldAuthorityBytes = Files.readAllBytes(root.resolve("authority.state"))
    verify(floor.enroll(old) == "DENY_ALREADY_ENROLLED",
      "duplicate enrollment is rejected")
    verify(db.compareAndSwapFixtureOnly(UUID.randomUUID(), old, latest) ==
      "ADVANCED_FIXTURE_ONLY", "PostgreSQL CAS commits NEW generation")
    verify(floor.advance(old, latest) == "OK_ADVANCED",
      "separate process persists NEW generation")
    verify(floor.advance(old, latest) == "DENY_PREDECESSOR",
      "stale predecessor cannot reduce current generation")
    val badKit = claim(account, 7, 10)
    verify(floor.advance(old, badKit) == "DENY_PREDECESSOR",
      "stale alternate operation is rejected")
  }

  // Stronger than the previous volatile fixture: full child restart, same disk
  // and pinned key, while the PostgreSQL authority is a separate subsystem.
  SyntheticDurableFloorClientFixtureLab(root).use { restarted ->
    verify(MessageDigest.isEqual(pinned.encoded, restarted.childPublicKey.encoded),
      "restart retains signing key while independent directory is intact")
    verify(restarted.enroll(old) == "DENY_ALREADY_ENROLLED",
      "restart cannot silently re-enroll OLD")
    verify(restarted.advance(old, latest) == "DENY_PREDECESSOR",
      "restart refuses OLD predecessor")
    val session = SyntheticSignedRekeyChallengeSessionLab(latest, pinned)
    val nonce = session.issueChallengeFixtureOnly()!!
    val signed = restarted.signedCurrent(nonce)!!
    verify(crypto.equivalentFixtureOnly(signed.first, latest),
      "restart retains NEW generation")
    verify(session.verifyOnceFixtureOnly(nonce, signed.first, signed.second) ==
      SyntheticSignedRekeyChallengeCheckLab.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
      "fresh response is signed using pinned fixture key, not production authority")
    val wrongPin = SyntheticSignedRekeyChallengeSessionLab(
      latest, KeyPairGenerator.getInstance("Ed25519").generateKeyPair().public)
    val otherNonce = wrongPin.issueChallengeFixtureOnly()!!
    val other = restarted.signedCurrent(otherNonce)!!
    verify(wrongPin.verifyOnceFixtureOnly(otherNonce, other.first, other.second) ==
      SyntheticSignedRekeyChallengeCheckLab.DENY_SIGNATURE,
      "unexpected public key is refused")

    // Privileged SQL-only restore of this random disposable account and receipt.
    // This does NOT touch any actual owner, account, backup or APK.
    val url = System.getenv("NEGRESCO_LAB_PG_URL")
      ?: error("SEC05K disposable JDBC URL required")
    val user = System.getenv("NEGRESCO_LAB_PG_USER")
      ?: System.getenv("PGUSER") ?: "postgres"
    val password = System.getenv("NEGRESCO_LAB_PG_PASSWORD")
      ?: System.getenv("PGPASSWORD") ?: ""
    DriverManager.getConnection(url, user, password).use { conn ->
      conn.autoCommit = false
      try {
        conn.prepareStatement(
          "DELETE FROM negresco_sec05k_cas_lab.operation_receipts WHERE account_id=?"
        ).use {
          it.setString(1, account)
          verify(it.executeUpdate() == 1,
            "restore removes only disposable account receipt")
        }
        conn.prepareStatement(
          "UPDATE negresco_sec05k_cas_lab.generations SET " +
          "kit_id=?,version=?,generation=?,ciphertext_sha256=? WHERE account_id=?"
        ).use {
          it.setObject(1, UUID.fromString(old.kitId))
          it.setLong(2, old.version)
          it.setLong(3, old.generation)
          it.setBytes(4, old.ciphertextHash)
          it.setString(5, account)
          verify(it.executeUpdate() == 1,
            "restore rewinds only disposable PostgreSQL account")
        }
        conn.commit()
      } catch (e: Exception) {
        conn.rollback()
        throw e
      }
    }
    verify(crypto.equivalentFixtureOnly(db.currentFixtureOnly(account)!!, old),
      "PostgreSQL now at OLD after privileged restore")
    verify(db.receiptsFixtureOnly(account) == 0,
      "CAS receipt is gone from restored PostgreSQL")
    val afterDbRestore = SyntheticSignedRekeyChallengeSessionLab(latest, pinned)
    val fresh = afterDbRestore.issueChallengeFixtureOnly()!!
    val quote = restarted.signedCurrent(fresh)!!
    verify(afterDbRestore.verifyOnceFixtureOnly(fresh, quote.first, quote.second) ==
      SyntheticSignedRekeyChallengeCheckLab.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
      "durable independent floor STILL signs NEW after database restore")
    verify(!crypto.equivalentFixtureOnly(db.currentFixtureOnly(account)!!, quote.first),
      "persisted separate process detects PostgreSQL-only rollback")
    verify(restarted.advance(old, latest) == "DENY_PREDECESSOR",
      "SQL restore cannot force persisted floor to accept old CAS")
    verify(restarted.enroll(old) == "DENY_ALREADY_ENROLLED",
      "SQL receipt deletion cannot reenroll lower floor")

    // Filesystem tampering triggers explicit denial rather than a silent reset.
    val statePath = root.resolve("authority.state")
    val good = Files.readAllBytes(statePath)
    Files.write(statePath, "corrupt disposable fixture".toByteArray())
    verify(restarted.call("QUOTE|" +
      java.util.Base64.getEncoder().encodeToString(ByteArray(32))) ==
      "DENY_MALFORMED_OR_CORRUPT", "corrupted authority state fails closed")
    Files.write(statePath, good)
    verify(crypto.equivalentFixtureOnly(restarted.signedCurrent(ByteArray(32))!!.first, latest),
      "fixture works again after its own intact state is restored")
  }

  // Critical NEGATIVE case: backing up and restoring the authority's OWN state
  // is an attack outside this design's protection boundary. Even the old
  // signature validates under the SAME pinned key.
  Files.write(root.resolve("authority.state"), oldAuthorityBytes)
  SyntheticDurableFloorClientFixtureLab(root).use { compromised ->
    verify(MessageDigest.isEqual(pinned.encoded, compromised.childPublicKey.encoded),
      "critical limit: old authority snapshot retains identical signing key")
    val session = SyntheticSignedRekeyChallengeSessionLab(old, pinned)
    val nonce = session.issueChallengeFixtureOnly()!!
    val response = compromised.signedCurrent(nonce)!!
    verify(crypto.equivalentFixtureOnly(response.first, old),
      "critical limit: restoring authority file itself replays OLD generation")
    verify(session.verifyOnceFixtureOnly(nonce, response.first, response.second) ==
      SyntheticSignedRekeyChallengeCheckLab.VERIFIED_SIGNATURE_FIXTURE_ONLY_NOT_LIVE_AUTHORITY,
      "critical limit: replayed floor produces VALID signature with original pin")
  }
  // A guard only detects PARTIAL loss. Removing both guard and state is a
  // deliberate negative test: ordinary disk files are not rollback-proof.
  Files.delete(root.resolve("authority.state"))
  verify(runCatching {
    SyntheticDurableFloorClientFixtureLab(root).use { it.call("QUOTE|YQ==") }
  }.isFailure, "guard prevents silent reenrollment when state alone disappears")
  verify(!Files.exists(root.resolve("authority.state")),
    "denied startup does not recreate missing state under surviving guard")

  Files.delete(root.resolve("provisioned.guard"))
  SyntheticDurableFloorClientFixtureLab(root).use { wiped ->
    verify(wiped.signedCurrent(ByteArray(32)) == null,
      "critical limit: complete removal of guard AND state reprovisions empty authority")
    verify(!MessageDigest.isEqual(pinned.encoded, wiped.childPublicKey.encoded),
      "critical limit: full authority wipe silently creates new unpinned key")
    verify(wiped.enroll(old) == "OK_ENROLLED",
      "critical limit: full authority wipe permits OLD reenrollment")
  }
  println("PASS: SEC-05K " + checks +
    " durable independent JVM floor vs PostgreSQL-only rollback checks (fixture)")
  println("LIMIT: authority-file rollback still succeeds; no HSM, WORM, server or production trust")
}

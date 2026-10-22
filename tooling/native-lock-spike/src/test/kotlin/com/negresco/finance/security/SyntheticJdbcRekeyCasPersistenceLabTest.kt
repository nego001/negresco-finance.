package com.negresco.finance.security

import java.nio.file.Paths
import java.security.MessageDigest
import java.sql.Connection
import java.sql.DriverManager
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * SEC-05K only: a DISPOSABLE PostgreSQL CAS laboratory.
 * No API/authentication, deployed backend, financial SQLCipher, network authority,
 * trusted client identity, private keys or recovery-secret handling.
 */
internal class SyntheticJdbcRekeyCasPersistenceLab {
  private val url = System.getenv("NEGRESCO_LAB_PG_URL")
    ?: error("SEC-05K PG fixture requires explicit disposable JDBC URL")
  private val user = System.getenv("NEGRESCO_LAB_PG_USER")
    ?: System.getenv("PGUSER") ?: "postgres"
  private val pass = System.getenv("NEGRESCO_LAB_PG_PASSWORD")
    ?: System.getenv("PGPASSWORD") ?: ""
  private val schema = "negresco_sec05k_cas_lab"
  private fun connection(): Connection = DriverManager.getConnection(url,user,pass)

  fun bootstrapFixtureOnly(initial: SyntheticRekeyGenerationClaimLab): String {
    if (!SyntheticSignedRekeyAuthorityChallengeLab.validClaimFixtureOnly(initial))
      return "DENY_INVALID"
    connection().use { db ->
      db.prepareStatement("INSERT INTO $schema.generations " +
        "(account_id,kit_id,version,generation,ciphertext_sha256) VALUES (?,?,?,?,?) " +
        "ON CONFLICT (account_id) DO NOTHING").use { ps ->
        ps.setString(1,initial.accountId)
        ps.setObject(2,UUID.fromString(initial.kitId))
        ps.setLong(3,initial.version)
        ps.setLong(4,initial.generation)
        ps.setBytes(5,initial.ciphertextHash)
        return if (ps.executeUpdate()==1) "BOOTSTRAPPED_FIXTURE_ONLY" else "DENY_RESEED"
      }
    }
  }

  private fun readClaim(rs: java.sql.ResultSet, offset: Int, account: String) =
    SyntheticRekeyGenerationClaimLab(account,rs.getObject(offset,UUID::class.java).toString(),
      rs.getLong(offset+1),rs.getLong(offset+2),rs.getBytes(offset+3))

  fun currentFixtureOnly(account: String): SyntheticRekeyGenerationClaimLab? =
    connection().use { db ->
      db.prepareStatement("SELECT kit_id,version,generation,ciphertext_sha256 " +
        "FROM $schema.generations WHERE account_id=?").use { ps ->
        ps.setString(1,account)
        ps.executeQuery().use { rs ->
          if(rs.next()) readClaim(rs,1,account) else null
        }
      }
    }

  /** Reads fixture operation payload for an independent JVM restart rehearsal. */
  fun persistedOperationFixtureOnly(account: String, op: UUID):
    Pair<SyntheticRekeyGenerationClaimLab,SyntheticRekeyGenerationClaimLab>? =
    connection().use { db ->
      db.prepareStatement("SELECT before_kit,before_version,before_generation,before_sha256," +
        "after_kit,after_version,after_generation,after_sha256 " +
        "FROM $schema.operation_receipts WHERE account_id=? AND operation_id=?").use { ps ->
        ps.setString(1,account)
        ps.setObject(2,op)
        ps.executeQuery().use { rs ->
          if(rs.next()) Pair(readClaim(rs,1,account),readClaim(rs,5,account)) else null
        }
      }
    }

  fun receiptsFixtureOnly(account: String): Int = connection().use { db ->
    db.prepareStatement("SELECT count(*) FROM $schema.operation_receipts WHERE account_id=?")
      .use { ps ->
        ps.setString(1,account)
        ps.executeQuery().use { rs -> check(rs.next());rs.getInt(1) }
      }
  }

  /**
   * SELECT FOR UPDATE serializes per-account CAS among independent JDBC
   * sessions. Generation + receipt commit or rollback within ONE DB transaction.
   * A null response is lost AFTER DB.commit(), never an uncommitted update.
   */
  fun compareAndSwapFixtureOnly(
    op: UUID,
    before: SyntheticRekeyGenerationClaimLab,
    after: SyntheticRekeyGenerationClaimLab,
    loseResponseAfterCommit: Boolean = false,
    abortBeforeCommit: Boolean = false
  ): String? {
    val crypto = SyntheticSignedRekeyAuthorityChallengeLab
    if(!crypto.validClaimFixtureOnly(before) || !crypto.validClaimFixtureOnly(after) ||
      before.accountId != after.accountId || before.kitId == after.kitId ||
      before.version >= Long.MAX_VALUE - 1 || before.generation >= Long.MAX_VALUE - 1 ||
      after.version != before.version+1 || after.generation != before.generation+1)
      return "DENY_INVALID"
    return connection().use { db ->
      db.autoCommit=false
      db.transactionIsolation=Connection.TRANSACTION_READ_COMMITTED
      fun finish(status:String):String { db.commit(); return status }
      try {
        val current = db.prepareStatement("SELECT kit_id,version,generation,ciphertext_sha256 " +
          "FROM $schema.generations WHERE account_id=? FOR UPDATE").use { ps ->
          ps.setString(1,before.accountId)
          ps.executeQuery().use { rs ->
            if(rs.next()) readClaim(rs,1,before.accountId) else null
          }
        } ?: return@use finish("DENY_UNKNOWN_ACCOUNT")

        val persisted = db.prepareStatement(
          "SELECT before_kit,before_version,before_generation,before_sha256," +
            "after_kit,after_version,after_generation,after_sha256 " +
            "FROM $schema.operation_receipts WHERE account_id=? AND operation_id=?"
        ).use { ps ->
          ps.setString(1,before.accountId);ps.setObject(2,op)
          ps.executeQuery().use { rs ->
            if(rs.next()) Pair(readClaim(rs,1,before.accountId),
              readClaim(rs,5,before.accountId)) else null
          }
        }
        if(persisted != null) {
          if(!crypto.equivalentFixtureOnly(persisted.first,before) ||
            !crypto.equivalentFixtureOnly(persisted.second,after))
            return@use finish("DENY_IDEMPOTENCY_COLLISION")
          return@use finish(if(crypto.equivalentFixtureOnly(current,after))
            "ALREADY_APPLIED_CURRENT_FIXTURE_ONLY" else "DENY_STALE_RECEIPT_NOT_CURRENT")
        }
        if(!crypto.equivalentFixtureOnly(current,before))
          return@use finish("DENY_STALE_OR_CONFLICTING_GENERATION")
        db.prepareStatement("UPDATE $schema.generations SET " +
          "kit_id=?,version=?,generation=?,ciphertext_sha256=? WHERE account_id=?").use { ps ->
          ps.setObject(1,UUID.fromString(after.kitId));ps.setLong(2,after.version)
          ps.setLong(3,after.generation);ps.setBytes(4,after.ciphertextHash)
          ps.setString(5,before.accountId)
          check(ps.executeUpdate()==1)
        }
        db.prepareStatement("INSERT INTO $schema.operation_receipts " +
          "(account_id,operation_id,before_kit,before_version,before_generation,before_sha256," +
          "after_kit,after_version,after_generation,after_sha256) " +
          "VALUES (?,?,?,?,?,?,?,?,?,?)").use { ps ->
          ps.setString(1,before.accountId);ps.setObject(2,op)
          ps.setObject(3,UUID.fromString(before.kitId));ps.setLong(4,before.version)
          ps.setLong(5,before.generation);ps.setBytes(6,before.ciphertextHash)
          ps.setObject(7,UUID.fromString(after.kitId));ps.setLong(8,after.version)
          ps.setLong(9,after.generation);ps.setBytes(10,after.ciphertextHash)
          check(ps.executeUpdate()==1)
        }
        if(abortBeforeCommit) error("SEC05K_INJECTED_ROLLBACK_BEFORE_PG_COMMIT")
        db.commit()
        if(loseResponseAfterCommit) null else "ADVANCED_FIXTURE_ONLY"
      } catch (error:Exception) {
        db.rollback()
        throw error
      }
    }
  }
}

private fun labClaim(
  account: String,version:Long,generation:Long,kit:String=UUID.randomUUID().toString()
): SyntheticRekeyGenerationClaimLab =
  SyntheticRekeyGenerationClaimLab(account,kit,version,generation,
    MessageDigest.getInstance("SHA-256")
      .digest("sec05k-disposable-v$version-g$generation-$kit".toByteArray()))

private fun matches(
  a:SyntheticRekeyGenerationClaimLab?,b:SyntheticRekeyGenerationClaimLab
):Boolean = a!=null&&SyntheticSignedRekeyAuthorityChallengeLab.equivalentFixtureOnly(a,b)

/** Child process: only account/op UUID identifiers, no secrets in argv. */
fun main(args:Array<String>) {
  if(args.size==3 && args[0]=="--verify-persisted-cas-fixture-only") {
    val lab = SyntheticJdbcRekeyCasPersistenceLab()
    val op=UUID.fromString(args[2]);val pair=lab.persistedOperationFixtureOnly(args[1],op)
      ?: error("missing committed operation on restarted process")
    check(matches(lab.currentFixtureOnly(args[1]),pair.second))
    check(lab.compareAndSwapFixtureOnly(op,pair.first,pair.second)==
      "ALREADY_APPLIED_CURRENT_FIXTURE_ONLY")
    check(lab.receiptsFixtureOnly(args[1])==1)
    println("SEC05K_PG_CHILD_PERSISTED_CAS=VERIFIED_FIXTURE_ONLY")
    return
  }
  require(args.isEmpty()) { "Unexpected SEC05K JDBC fixture arguments" }
  var checks=0
  fun verify(ok:Boolean,reason:String) {check(ok){"SEC-05K PostgreSQL CAS $reason"};checks++}
  fun result(actual:String?,expected:String,reason:String) =
    verify(actual==expected,reason+" expected $expected got $actual")
  val lab=SyntheticJdbcRekeyCasPersistenceLab()
  val acct=UUID.randomUUID().toString().replace("-","")
  val before=labClaim(acct,2,3)
  val after=labClaim(acct,3,4)
  val op=UUID.randomUUID()
  result(lab.bootstrapFixtureOnly(before),"BOOTSTRAPPED_FIXTURE_ONLY",
    "seed synthetic generation")
  result(lab.bootstrapFixtureOnly(before),"DENY_RESEED","cannot re-bootstrap account")
  verify(lab.compareAndSwapFixtureOnly(op,before,after,loseResponseAfterCommit=true)==null,
    "CAS commits and intentionally loses reply")
  verify(matches(lab.currentFixtureOnly(acct),after),
    "new JDBC session reads committed generation after lost response")
  verify(lab.receiptsFixtureOnly(acct)==1,
    "receipt persisted in same transaction as generation")
  result(lab.compareAndSwapFixtureOnly(op,before,after),
    "ALREADY_APPLIED_CURRENT_FIXTURE_ONLY","exact replay across JDBC sessions")
  verify(lab.receiptsFixtureOnly(acct)==1,"idempotent retry did not duplicate receipt")

  val java = Paths.get(System.getProperty("java.home"),"bin",
    if(System.getProperty("os.name").lowercase().contains("win"))"java.exe" else "java")
  val child=ProcessBuilder(java.toString(),"-cp",System.getProperty("java.class.path"),
    "com.negresco.finance.security.SyntheticJdbcRekeyCasPersistenceLabTestKt",
    "--verify-persisted-cas-fixture-only",acct,op.toString())
    .redirectErrorStream(true).start()
  verify(child.waitFor(30L,TimeUnit.SECONDS),"fresh JVM completes separate persisted receipt read")
  val output=child.inputStream.bufferedReader().use{it.readText()}
  verify(child.exitValue()==0 &&
    output.contains("SEC05K_PG_CHILD_PERSISTED_CAS=VERIFIED_FIXTURE_ONLY"),
    "independent JVM sees durable CAS and exact idempotent operation")
  val alternative=labClaim(acct,3,4)
  result(lab.compareAndSwapFixtureOnly(op,before,alternative),
    "DENY_IDEMPOTENCY_COLLISION","same UUID conflicting payload rejected")
  result(lab.compareAndSwapFixtureOnly(UUID.randomUUID(),before,after),
    "DENY_STALE_OR_CONFLICTING_GENERATION","different op cannot reapply old predecessor")

  val latest=labClaim(acct,4,5)
  result(lab.compareAndSwapFixtureOnly(UUID.randomUUID(),after,latest),
    "ADVANCED_FIXTURE_ONLY","second generation advances once")
  result(lab.compareAndSwapFixtureOnly(op,before,after),
    "DENY_STALE_RECEIPT_NOT_CURRENT",
    "older successful receipt never represents current generation")
  verify(matches(lab.currentFixtureOnly(acct),latest),
    "second committed generation durable across connections")
  verify(lab.receiptsFixtureOnly(acct)==2,"two distinct updates have two receipts")
  val abortedAcct=UUID.randomUUID().toString().replace("-","")
  val a=labClaim(abortedAcct,3,4);val b=labClaim(abortedAcct,4,5)
  result(lab.bootstrapFixtureOnly(a),"BOOTSTRAPPED_FIXTURE_ONLY","abort fixture enrolled")
  verify(runCatching{lab.compareAndSwapFixtureOnly(UUID.randomUUID(),a,b,
    abortBeforeCommit=true)}.exceptionOrNull()?.message==
    "SEC05K_INJECTED_ROLLBACK_BEFORE_PG_COMMIT",
    "crash injected between writes and COMMIT")
  verify(matches(lab.currentFixtureOnly(abortedAcct),a) &&
    lab.receiptsFixtureOnly(abortedAcct)==0,
    "DB rollback includes BOTH generation and idempotency receipt")

  val raceAccount=UUID.randomUUID().toString().replace("-","")
  val old=labClaim(raceAccount,7,8);val optionA=labClaim(raceAccount,8,9)
  val optionB=labClaim(raceAccount,8,9)
  lab.bootstrapFixtureOnly(old)
  val gate=CountDownLatch(1);val pool=Executors.newFixedThreadPool(8)
  try {
    val tasks=(1..8).map { idx ->
      pool.submit<String?> {
        gate.await()
        lab.compareAndSwapFixtureOnly(UUID.randomUUID(),old,
          if(idx%2==0)optionA else optionB)
      }
    }
    gate.countDown()
    val results=tasks.map{it.get(25L,TimeUnit.SECONDS)}
    verify(results.count{it=="ADVANCED_FIXTURE_ONLY"}==1,
      "only one of eight concurrent JDBC CAS sessions wins")
    verify(results.count{it=="DENY_STALE_OR_CONFLICTING_GENERATION"}==7,
      "seven competing JDBC sessions reject stale predecessor")
    verify(lab.receiptsFixtureOnly(raceAccount)==1,
      "competing writers cannot produce multiple committed receipts")
  } finally {pool.shutdownNow()}
  runSyntheticJdbcJournalAuthorityDivergenceScenarios()
  runSyntheticJdbcSignedReadRaceScenarios()
  runSyntheticJdbcIsolatedFloorRollbackScenarios()
  runSyntheticJdbcPersistentFloorRollbackScenarios()
  runSyntheticJdbcDurableFloorRollbackScenarios()
  runSyntheticJdbcThreeDomainRollbackBoundaryScenarios()
  runSyntheticJdbcLocalFenceDoesNotFencePgScenarios()
  runSyntheticJdbcCrossDomainCommitOrderScenarios()
  runSyntheticJdbcAllDomainsRollbackIndistinguishabilityScenarios()
  println("PASS: SEC-05K $checks PostgreSQL durable CAS and restart checks (fixture only)")
  println("LIMIT: disposable DB, no real authority authentication, no SQLCipher integration")
}

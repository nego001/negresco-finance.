import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

test('SEC-05E verifies real bound Ed25519 signatures against database-provisioned fixture keys',()=>{
 const src=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/SyntheticJdbcBoundProofRehearsalTest.kt');
 assert.match(src,/SyntheticAccountBoundInviteProofLab\.inspect/);
 assert.match(src,/SyntheticBoundInviteProofCheck\.PROOF_VERIFIED_ONLY/);
 assert.match(src,/KeyFactory\.getInstance\("Ed25519"\)/);
 assert.match(src,/X509EncodedKeySpec\(approver\.keySpki\)/);
 assert.match(src,/X509EncodedKeySpec\(invitation\.candidateSpki\)/);
 assert.match(src,/MessageDigest\.isEqual\(invitation\.nonceDigest/);
 assert.match(src,/account\.third != proof\.ownerGenerationFixture/);
 assert.match(src,/WHERE account_id=\? FOR UPDATE/);
 assert.match(src,/FROM \$schema\.devices/);
 assert.match(src,/db\.rollback\(\)/);
 assert.match(src,/db\.commit\(\)/);
 assert.match(src,/clock_timestamp\(\)/);
});

test('proof-verified database rehearsals never add new trusted devices',()=>{
 const src=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/SyntheticJdbcBoundProofRehearsalTest.kt');
 assert.match(src,/No authenticated account, HTTP server/);
 const consumeOnly = src.split('  fun seed(')[0];
 assert.doesNotMatch(consumeOnly,/INSERT INTO \$schema\.devices/);
 assert.match(src,/RECORDED_SIGNED_PROOF_FIXTURE_ONLY/);
 assert.match(src,/ALREADY_RECORDED_NO_GRANT/);
 assert.match(src,/DENY_IDEMPOTENCY_CONFLICT/);
 assert.match(src,/DENY_REVOKED_APPROVER/);
 assert.match(src,/DENY_STALE_ACCOUNT_STATE/);
 assert.match(src,/ThreadPoolExecutor|max_workers|newFixedThreadPool\(8\)/);
 assert.match(src,/injectRollbackBeforeCommit=true/);
 assert.match(src,/zero device enrollment/);
});

test('SEC-05E JDBC is test-scope only, CI-only, not an Android dependency or API',()=>{
 const gradle=read('tooling/native-lock-spike/build.gradle.kts');
 const workflow=read('.github/workflows/ci.yml');
 const mobile=read('apps/mobile/package.json');
 const app=read('apps/mobile/app.json');
 assert.match(gradle,/testImplementation\("org\.postgresql:postgresql:/);
 assert.match(gradle,/tasks\.register<JavaExec>\("pgBoundProofCheck"\)/);
 assert.match(workflow,/pgBoundProofCheck --no-daemon/);
 assert.match(workflow,/authority-postgres-lab:/);
 assert.doesNotMatch(mobile,/postgresql|pgBoundProofCheck|SyntheticJdbcBoundProofRehearsal/);
 assert.doesNotMatch(app,/postgresql|pgBoundProofCheck|SyntheticJdbcBoundProofRehearsal/);
});

test('SEC-05E keeps backend owner authentication and registration explicitly blocked',()=>{
 const doc=read('docs/security/SEC_05E_JDBC_CRYPTO_TX_LAB.md');
 assert.match(doc,/SEC-05E/);
 assert.match(doc,/autenticação real do titular/);
 assert.match(doc,/não cadastra nenhum aparelho/);
 assert.match(doc,/BLOQUEADO/);
 assert.match(doc,/commit/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const kotlin = 'tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/';
const fixtures = 'tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/';
const ddl = 'tooling/security-authority-protocol-lab/postgres/001_sec05c_schema.sql';

test('two Ed25519 roles sign canonical bytes that bind account, invite and devices', () => {
 const src=read(kotlin+'SyntheticAccountBoundInviteProofLab.kt');
 assert.match(src,/accountPattern = Regex\("\[0-9a-f\]\{32\}"\)/);
 assert.match(src,/invitationPattern =/);
 assert.match(src,/account-invite\.approver\.ed25519\.v1/);
 assert.match(src,/account-invite\.candidate\.ed25519\.v1/);
 assert.match(src,/UUID\.fromString\(invitationId\)/);
 assert.match(src,/output\.write\(hexBytes\(accountId\)\)/);
 assert.match(src,/output\.writeLong\(uuid\.mostSignificantBits\)/);
 assert.match(src,/output\.writeLong\(uuid\.leastSignificantBits\)/);
 assert.match(src,/output\.write\(hexBytes\(intent\.approvingDevice\.hex\)\)/);
 assert.match(src,/output\.write\(hexBytes\(intent\.candidateDevice\.hex\)\)/);
 assert.match(src,/output\.writeLong\(intent\.approvingSequence\)/);
 assert.match(src,/output\.write\(nonce\)/);
 assert.match(src,/MessageDigest\.isEqual\(issuedNonce, receivedNonce\)/);
 assert.match(src,/verifier\.verify\(signature\.copyOf\(\)\)/);
 assert.match(src,/PROOF_VERIFIED_ONLY/);
 assert.doesNotMatch(src,/\b(?:ALLOW|UNLOCKED|ENROLLED)\b/);
});

test('SEC-05B authority consumes only account and UUID bound signed proof', () => {
 const authority=read(kotlin+'SyntheticAccountInviteAuthorityLab.kt');
 const specs=read(fixtures+'SyntheticAccountInviteAuthorityLabTest.kt');
 assert.match(authority,/SyntheticAccountBoundInviteProofLab\.inspect\(/);
 assert.match(authority,/accountId, i\.id, i\.intent, scope\.approverPublicKey/);
 assert.match(authority,/SyntheticBoundInviteProofCheck\.PROOF_VERIFIED_ONLY/);
 assert.match(specs,/PASS: 30 account-scoped invitation authority scenarios/);
 assert.match(specs,/A signature for another account cannot consume/);
 assert.match(specs,/An otherwise-valid signature for a different invitation UUID fails/);
});

test('account-bound proof regressions run in Kotlin policyCheck; never in Expo', () => {
 const specs=read(fixtures+'SyntheticAccountBoundInviteProofLabTest.kt');
 const runner=read(fixtures+'NativeLockCoordinatorTest.kt');
 const gradle=read('tooling/native-lock-spike/build.gradle.kts');
 const mobile=read('apps/mobile/package.json');
 const appConfig=read('apps/mobile/app.json');
 assert.match(specs,/PASS: 15 account\+invite bound Ed25519 proof scenarios/);
 assert.match(specs,/DENY_APPROVER_SIGNATURE/);
 assert.match(specs,/DENY_CANDIDATE_SIGNATURE/);
 assert.match(runner,/runSyntheticAccountBoundInviteProofScenarios\(\)/);
 assert.match(runner,/runSyntheticAccountInviteAuthorityScenarios\(\)/);
 assert.match(gradle,/dependsOn\("policyCheck"\)/);
 assert.doesNotMatch(mobile,/SyntheticAccountBoundInviteProofLab|native-lock-spike/);
 assert.doesNotMatch(appConfig,/SyntheticAccountBoundInviteProofLab|native-lock-spike/);
});

test('undeployed PostgreSQL design has per-account uniqueness and terminal receipts', () => {
 const sql=read(ddl);
 assert.match(sql,/DESIGN FIXTURE ONLY/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS negresco_sec05c_lab\.accounts/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS negresco_sec05c_lab\.devices/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS negresco_sec05c_lab\.invites/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS negresco_sec05c_lab\.enrollment_receipts/);
 assert.match(sql,/PRIMARY KEY \(account_id, invitation_id\)/);
 assert.match(sql,/PRIMARY KEY \(account_id, public_key_fingerprint\)/);
 assert.match(sql,/UNIQUE \(account_id, nonce_digest\)/);
 assert.match(sql,/UNIQUE \(account_id, invitation_id\)/);
 assert.match(sql,/WHERE lifecycle = 'PENDING'/);
 assert.match(sql,/expires_at = issued_at \+ INTERVAL '5 minutes'/);
 assert.match(sql,/PRIMARY KEY \(account_id, idempotency_digest\)/);
 assert.match(sql,/COMMIT;/);
 const smoke=read('tooling/security-authority-protocol-lab/postgres/002_sec05c_schema_smoke.sql');
 const workflow=read('.github/workflows/ci.yml');
 assert.match(smoke,/PENDING uniqueness NOT enforced/);
 assert.match(smoke,/TTL check NOT enforced/);
 assert.match(smoke,/nonce replay uniqueness NOT enforced/);
 assert.match(smoke,/duplicate receipt NOT rejected/);
 assert.match(workflow,/authority-postgres-lab:/);
 assert.match(workflow,/postgres:16/);
 assert.match(workflow,/002_sec05c_schema_smoke.sql/);
});

test('documentation refuses to claim a server, authenticated accounts or production anti-rollback', () => {
 const spec=read('docs/security/SEC_05C_TRANSACTIONAL_ACCOUNT_BOUND_PROTOCOL.md');
 assert.match(spec,/sem backend implementado/);
 assert.match(spec,/SERIALIZABLE/);
 assert.match(spec,/FOR UPDATE/);
 assert.match(spec,/recibo/);
 assert.match(spec,/Gate de produção SEC-05: BLOQUEADO/);
});


test('SEC-05D CI-only receipt rehearsal is isolated from production and never enrolls devices', () => {
 const sql=read('tooling/security-authority-protocol-lab/postgres/003_sec05d_ci_receipt_rehearsal.sql');
 const python=read('tooling/security-authority-protocol-lab/tests/sec05d_multi_connection_smoke.py');
 const ci=read('.github/workflows/ci.yml');
 assert.match(sql,/CI-ONLY TEST FUNCTION/);
 assert.match(sql,/DO NOT DEPLOY OR EXPOSE AS AN API/);
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/FROM negresco_sec05c_lab\.accounts\s+WHERE account_id = p_account FOR UPDATE/);
 assert.match(sql,/checked_at := clock_timestamp\(\)/);
 assert.match(sql,/DENY_STALE_ACCOUNT_STATE/);
 assert.match(sql,/DENY_REPLAYED_SEQUENCE/);
 assert.match(sql,/ALREADY_RECORDED_NO_GRANT/);
 assert.match(sql,/RECORDED_FIXTURE_ONLY/);
 assert.match(sql,/UPDATE negresco_sec05c_lab\.devices SET/);
 assert.doesNotMatch(sql,/INSERT INTO negresco_sec05c_lab\.devices/);
 assert.match(python,/ThreadPoolExecutor\(max_workers=8\)/);
 assert.match(python,/BEGIN; SELECT/);
 assert.match(python,/ROLLBACK;/);
 assert.match(python,/DENY_IDEMPOTENCY_CONFLICT/);
 assert.match(python,/DENY_UNKNOWN_INVITATION/);
 assert.match(python,/DENY_EXPIRED/);
 assert.match(python,/DENY_REVOKED_OR_UNKNOWN_APPROVER/);
 assert.match(python,/zero device enrollment/);
 assert.match(ci,/003_sec05d_ci_receipt_rehearsal\.sql/);
 assert.match(ci,/sec05d_multi_connection_smoke\.py/);
 const mainSchema=read('tooling/security-authority-protocol-lab/postgres/001_sec05c_schema.sql');
 assert.doesNotMatch(mainSchema,/ci_rehearse_receipt_only/);
});

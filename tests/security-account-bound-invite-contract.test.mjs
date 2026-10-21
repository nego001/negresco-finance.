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
});

test('documentation refuses to claim a server, authenticated accounts or production anti-rollback', () => {
 const spec=read('docs/security/SEC_05C_TRANSACTIONAL_ACCOUNT_BOUND_PROTOCOL.md');
 assert.match(spec,/sem backend implementado/);
 assert.match(spec,/SERIALIZABLE/);
 assert.match(spec,/FOR UPDATE/);
 assert.match(spec,/recibo/);
 assert.match(spec,/Gate de produção SEC-05: BLOQUEADO/);
});

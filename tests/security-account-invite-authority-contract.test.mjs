import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('SEC-05B account authority is an isolated in-memory Kotlin laboratory',()=>{
 const source=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticAccountInviteAuthorityLab.kt');
 const app=read('apps/mobile/package.json');
 const android=read('apps/mobile/app.json');
 assert.match(source,/SEC-05B: isolated, IN-MEMORY account-scoped authority/);
 assert.match(source,/NOT a server/);
 assert.match(source,/process termination loses the ledger/);
 assert.match(source,/private val accounts: Map<String, Account>/);
 assert.match(source,/private val invitations = mutableMapOf<Pair<String, String>, Invitation>/);
 assert.match(source,/synchronized\(mutex\)/);
 assert.doesNotMatch(app,/SyntheticAccountInviteAuthorityLab|native-lock-spike/);
 assert.doesNotMatch(android,/SyntheticAccountInviteAuthorityLab|native-lock-spike/);
});

test('invites are terminal and cannot grant actual new-device membership',()=>{
 const source=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticAccountInviteAuthorityLab.kt');
 assert.match(source,/PENDING, CONSUMED_PROOF_ONLY, CANCELLED, EXPIRED, INVALIDATED/);
 assert.match(source,/SyntheticDeviceEnrollmentProofLab\.inspect/);
 assert.match(source,/PROCEED_TO_INDEPENDENT_PERSISTENT_ENROLLMENT_PROTOCOL/);
 assert.match(source,/MessageDigest\.isEqual\(storedNonce, receivedNonce\)/);
 assert.match(source,/finish\(i, SyntheticAuthorityInviteStatus\.CONSUMED_PROOF_ONLY\)/);
 assert.match(source,/lastSequence = state\.lastSequence \+/);
 assert.match(source,/never return an authorization token/);
 assert.doesNotMatch(source,/\b(?:UNLOCKED|SQLCIPHER_PASSWORD|ISSUE_ACCESS_TOKEN)\b/);
});

test('expiry, revocation, account separation and rollback checks are synthetic and fail closed',()=>{
 const source=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticAccountInviteAuthorityLab.kt');
 assert.match(source,/MAX_AGE_MS = 5L \* 60L \* 1000L/);
 assert.match(source,/if \(timestamp >= invitation\.expires\)/);
 assert.match(source,/SyntheticAuthorityInviteStatus\.EXPIRED/);
 assert.match(source,/SyntheticAuthorityInviteStatus\.INVALIDATED/);
 assert.match(source,/fun revokeApproverFixtureOnly/);
 assert.match(source,/fun compareFixtureSnapshot/);
 assert.match(source,/EXACT_FIXTURE_MATCH_NOT_AUTHORIZATION/);
 assert.match(source,/UNKNOWN_ACCOUNT/);
 assert.match(source,/OUTSTANDING_INVITATION/);
});

test('25 JVM adversarial scenarios run under policyCheck; server claims remain forbidden',()=>{
 const tests=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/SyntheticAccountInviteAuthorityLabTest.kt');
 const runner=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/NativeLockCoordinatorTest.kt');
 const gradle=read('tooling/native-lock-spike/build.gradle.kts');
 const doc=read('docs/security/SEC_05B_ACCOUNT_INVITE_AUTHORITY_LAB.md');
 assert.match(tests,/PASS: 25 account-scoped invitation authority scenarios/);
 assert.match(tests,/CountDownLatch/);
 assert.match(tests,/Concurrent|concurrent/);
 assert.match(tests,/REVOKED_OR_UNKNOWN/);
 assert.match(tests,/UNKNOWN_INVITATION/);
 assert.match(runner,/runSyntheticAccountInviteAuthorityScenarios\(\)/);
 assert.match(gradle,/dependsOn\("policyCheck"\)/);
 assert.match(doc,/Não existe backend real/);
 assert.match(doc,/SEC-05/);
});

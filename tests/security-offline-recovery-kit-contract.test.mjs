import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const base = 'tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/';
const specs = 'tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/';

test('SEC-05G recovery secret is CSPRNG 256-bit, not a PIN or login credential',()=>{
 const code=read(base+'SyntheticOfflineRecoveryKitLab.kt');
 assert.match(code,/OFFLINE data-key backup\/recovery lab/);
 assert.match(code,/SECRET_BYTES = 32/);
 assert.match(code,/rng\.nextBytes\(it\)/);
 assert.match(code,/SECRET_BYTES\) return null/);
 assert.match(code,/a human PIN\/password is NOT an acceptable input/i);
 assert.doesNotMatch(code,/PASSCODE_6_DIGIT|ALLOW_FINANCIAL_ACCESS|ISSUE_SESSION_TOKEN/);
});

test('SEC-05G uses purpose-separated HKDF SHA-256 and AES-256-GCM authenticated envelope',()=>{
 const code=read(base+'SyntheticOfflineRecoveryKitLab.kt');
 assert.match(code,/HKDF extract\/expand/);
 assert.match(code,/HmacSHA256/);
 assert.match(code,/AES\/GCM\/NoPadding/);
 assert.match(code,/GCM_TAG_BITS = 128/);
 assert.match(code,/NONCE_BYTES = 12/);
 assert.match(code,/SALT_BYTES = 32/);
 assert.match(code,/output|out\.write\(hexBytes\(account\)\)/);
 assert.match(code,/out\.writeLong\(generation\)/);
 assert.match(code,/out\.write\(nonce\)/);
 assert.match(code,/cipher\.updateAAD\(/);
 assert.match(code,/GeneralSecurityException/);
 assert.match(code,/return null/);
});

test('offline ciphertext owner generation and public metadata cannot act as authority',()=>{
 const code=read(base+'SyntheticOfflineRecoveryKitLab.kt');
 assert.match(code,/ACTIVE_METADATA_MATCH_NOT_AUTHORIZATION/);
 assert.match(code,/DENY_REVOKED_KIT/);
 assert.match(code,/revokeAndAdvanceGenerationFixtureOnly/);
 assert.match(code,/Old envelope \+ old secret remain decryptable OFFLINE/);
 assert.match(code,/data-key backup/);
 assert.doesNotMatch(code,/INSERT INTO.*trusted_devices/);
});

test('37 Kotlin adversarial scenarios execute in JVM policyCheck, not Expo',()=>{
 const scenario=read(specs+'SyntheticOfflineRecoveryKitLabTest.kt');
 const runner=read(specs+'NativeLockCoordinatorTest.kt');
 const gradle=read('tooling/native-lock-spike/build.gradle.kts');
 const mobile=read('apps/mobile/package.json');
 const config=read('apps/mobile/app.json');
 assert.match(scenario,/PASS: 37 offline recovery-kit integrity/);
 assert.match(scenario,/newFixedThreadPool\(8\)/);
 assert.match(scenario,/DENY_REVOKED_KIT/);
 assert.match(scenario,/wrong entropy\/length/);
 assert.match(runner,/runSyntheticOfflineRecoveryKitScenarios\(\)/);
 assert.match(gradle,/dependsOn\("policyCheck"\)/);
 assert.doesNotMatch(mobile,/SyntheticOfflineRecoveryKitLab|native-lock-spike/);
 assert.doesNotMatch(config,/SyntheticOfflineRecoveryKitLab|native-lock-spike/);
});

test('SEC-05G docs forbid magical offline revocation, false E2EE recovery or production promises',()=>{
 const doc=read('docs/security/SEC_05G_OFFLINE_RECOVERY_KIT_LAB.md');
 assert.match(doc,/SEC-05G/);
 assert.match(doc,/não é uma prova de identidade/);
 assert.match(doc,/antiga DEK offline/);
 assert.match(doc,/256 bits/);
 assert.match(doc,/Argon2id/);
 assert.match(doc,/kit.*perde.*cópias|perde tanto os dispositivos/);
 assert.match(doc,/BLOQUEADO/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const source='tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/';
const spec='tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/';

test('SEC-05I independently re-enters ciphertext and secret without retaining the latter',()=>{
 const code=read(source+'SyntheticRecoveryKitCeremonyLab.kt');
 assert.match(code,/SyntheticRecoveryKitCeremonyLab/);
 assert.match(code,/SyntheticCleanRoomRecoveryLab/);
 assert.match(code,/independentlyPresentedSecret/);
 assert.match(code,/separateRecoverySecret/);
 assert.match(code,/SyntheticPortableRecoveryEnvelopeLab\.importEnvelopeBytesFixtureOnly/);
 assert.match(code,/SyntheticOfflineRecoveryKitCryptoLab\.recoverDataKeyFixtureOnly/);
 assert.match(code,/MessageDigest\.isEqual/);
 assert.match(code,/copy\.fill\(0\)/);
 assert.doesNotMatch(code,/val (?:persisted|cached|saved)Secret\s*=/);
});

test('ceremony never claims stored backup, identity, authorization or new device',()=>{
 const code=read(source+'SyntheticRecoveryKitCeremonyLab.kt');
 assert.match(code,/PREPARED_NOT_STORED/);
 assert.match(code,/VERIFIED_OFFLINE_NOT_STORED_OR_AUTHORIZED/);
 assert.match(code,/VERIFIED_OFFLINE_ONLY/);
 assert.match(code,/DENY_ACCOUNT_SCOPE/);
 assert.match(code,/DENY_BACKUP_CHANGED/);
 assert.match(code,/DENY_BAD_CLOCK/);
 assert.match(code,/DENY_TERMINAL/);
 assert.match(code,/15L \* 60L \* 1000L/);
 assert.doesNotMatch(code,/ISSUE_AUTH_TOKEN|AUTHORIZE_BANK_TRANSACTION|TRUSTED_NEW_DEVICE/);
});

test('thirty Kotlin regressions run in JVM policyCheck and never in the mobile app',()=>{
 const suite=read(spec+'SyntheticRecoveryKitCeremonyLabTest.kt');
 const runner=read(spec+'NativeLockCoordinatorTest.kt');
 const gradle=read('tooling/native-lock-spike/build.gradle.kts');
 const mobile=read('apps/mobile/package.json');
 const config=read('apps/mobile/app.json');
 assert.match(suite,/PASS: SEC-05I 30 independent re-entry/);
 assert.match(suite,/newFixedThreadPool\(8\)/);
 assert.match(suite,/DENY_DATA_KEY_MISMATCH/);
 assert.match(suite,/DENY_BACKUP_CHANGED/);
 assert.match(suite,/DENY_BAD_CLOCK/);
 assert.match(suite,/DENY_TERMINAL/);
 assert.match(runner,/runSyntheticRecoveryKitCeremonyScenarios\(\)/);
 assert.match(gradle,/dependsOn\("policyCheck"\)/);
 assert.doesNotMatch(mobile,/SyntheticRecoveryKitCeremonyLab|native-lock-spike/);
 assert.doesNotMatch(config,/SyntheticRecoveryKitCeremonyLab|native-lock-spike/);
});

test('documentation rejects false confidence about durable storage and owner authentication',()=>{
 const doc=read('docs/security/SEC_05I_OFFLINE_BACKUP_CEREMONY_LAB.md');
 assert.match(doc,/NÃO é um sistema de backup funcional/);
 assert.match(doc,/não prova armazenamento durável/);
 assert.match(doc,/segredo aleatório de recuperação de 256 bits/);
 assert.match(doc,/30 grupos de testes/);
 assert.match(doc,/BLOQUEADO/);
});

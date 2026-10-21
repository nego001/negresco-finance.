import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const sourcePath = 'tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/';
const specPath = 'tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/';

test('SEC-05H writes a canonical fixed 184-byte encrypted envelope without recovery phrase',()=>{
 const src=read(sourcePath+'SyntheticPortableRecoveryEnvelopeLab.kt');
 assert.match(src,/FILE_LENGTH = 184/);
 assert.match(src,/PAYLOAD_LENGTH = 152/);
 assert.match(src,/NGFRCV01/);
 assert.match(src,/ByteOrder\.BIG_ENDIAN/);
 assert.match(src,/out\.putLong\(e\.keyVersion\)/);
 assert.match(src,/out\.putLong\(e\.ownerGeneration\)/);
 assert.match(src,/out\.put\(e\.saltCopy\(\)\)/);
 assert.match(src,/out\.put\(e\.nonceCopy\(\)\)/);
 assert.match(src,/out\.put\(e\.ciphertextCopy\(\)\)/);
 assert.doesNotMatch(src,/recoverySecretCopyForFixtureOnly|privateKey|import.*Secret/i);
});

test('SEC-05H strict parser enforces account scope, file length and public checksum',()=>{
 const src=read(sourcePath+'SyntheticPortableRecoveryEnvelopeLab.kt');
 assert.match(src,/data = input\.copyOf\(\)/);
 assert.match(src,/input\.size != FILE_LENGTH/);
 assert.match(src,/account != expectedAccountId/);
 assert.match(src,/DENY_ACCOUNT/);
 assert.match(src,/DENY_CHECKSUM/);
 assert.match(src,/DENY_METADATA/);
 assert.match(src,/MessageDigest\.isEqual/);
 assert.match(src,/PARSED_ONLY_NOT_AUTHENTICATED/);
 assert.match(src,/AES-GCM validates authenticity later/);
});

test('28 Kotlin scenarios include stale envelope and recomputed-checksum tampering',()=>{
 const src=read(specPath+'SyntheticPortableRecoveryEnvelopeLabTest.kt');
 const runner=read(specPath+'NativeLockCoordinatorTest.kt');
 const gradle=read('tooling/native-lock-spike/build.gradle.kts');
 assert.match(src,/PASS: SEC-05H 28 portable recovery-envelope scenarios/);
 assert.match(src,/resultWithRecomputedChecksum/);
 assert.match(src,/DENY_REVOKED_KIT/);
 assert.match(src,/newFixedThreadPool\(8\)/);
 assert.match(src,/0 until 184/);
 assert.match(runner,/runSyntheticPortableRecoveryEnvelopeScenarios\(\)/);
 assert.match(gradle,/dependsOn\("policyCheck"\)/);
});

test('SEC-05H stays isolated from Expo and does not claim operational recovery',()=>{
 const mobile=read('apps/mobile/package.json');
 const config=read('apps/mobile/app.json');
 const doc=read('docs/security/SEC_05H_PORTABLE_ENVELOPE_LAB.md');
 assert.doesNotMatch(mobile,/SyntheticPortableRecoveryEnvelopeLab|native-lock-spike/);
 assert.doesNotMatch(config,/SyntheticPortableRecoveryEnvelopeLab|native-lock-spike/);
 assert.match(doc,/arquivo NUNCA armazena o segredo/);
 assert.match(doc,/SHA-256 público apenas detecta dano acidental/);
 assert.match(doc,/não autentica o titular nem aprova um celular/);
 assert.match(doc,/SEC-05H/);
 assert.match(doc,/BLOQUEADO/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('device proof is Ed25519, operation-bound and never an unlock',()=>{
 const src=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticSignedDeviceProofLab.kt');
 assert.match(src,/Signature\.getInstance\("Ed25519"\)/);
 assert.match(src,/Signature\.getInstance\("Ed25519", labVerifierProvider\)/);
 assert.match(src,/verifier\.verify\(signature\.copyOf\(\)\)/);
 assert.match(src,/canonicalEd25519Spki/);
 assert.match(src,/ed25519SpkiPrefix/);
 assert.match(src,/encoded\.size != ed25519SpkiPrefix\.size \+ 32/);
 assert.match(src,/MessageDigest\.isEqual\(/);
 assert.match(src,/MessageDigest\.getInstance\("SHA-256"\)/);
 assert.match(src,/claim\.registryRevision/);
 assert.match(src,/claim\.epoch/);
 assert.match(src,/claim\.sequence/);
 assert.match(src,/wireCode\(claim\.operation\)/);
 assert.match(src,/independentlyIssuedNonce/);
 assert.match(src,/MessageDigest\.isEqual\(independentlyIssuedNonce, presentedNonce\)/);
 assert.doesNotMatch(src,/generateKeyPair\(|KeyStore\.getInstance\(|\bALLOW\b/);
});

test('verified signature is rechecked against current synthetic replay state',()=>{
 const trust=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticDeviceTrustLab.kt');
 const scenarios=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/SyntheticSignedDeviceProofLabTest.kt');
 const runner=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/NativeLockCoordinatorTest.kt');
 assert.match(trust,/fun recordSignedSyntheticOperation\(/);
 assert.match(trust,/SyntheticSignedDeviceProofLab\.verify\(/);
 assert.match(trust,/return recordSequenceAfterTrustedVerification\(claim, floor\)/);
 assert.match(trust,/DENY_INVALID_DEVICE_SIGNATURE/);
 assert.match(trust,/compareAndSet\(current, updated\)/);
 assert.match(scenarios,/runSignedDeviceProofScenarios/);
 assert.match(scenarios,/DENY_REVOKED/);
 assert.match(scenarios,/CountDownLatch\(1\)/);
 assert.match(scenarios,/Ed25519 signed device proof scenarios/);
 assert.match(scenarios,/RFC 8410 SPKI must contain exactly Ed25519 OID/);
 assert.match(scenarios,/portableSpki/);
 assert.match(scenarios,/explicitVerifier/);
 assert.match(scenarios,/modified, explicitVerifier/);
 assert.match(runner,/runSignedDeviceProofScenarios\(\)/);
});

test('Ed25519 laboratory has no production/Expo integration',()=>{
 const app=read('apps/mobile/app.json');
 const mobile=read('apps/mobile/package.json');
 const src=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticSignedDeviceProofLab.kt');
 assert.doesNotMatch(app,/SyntheticSignedDeviceProofLab|native-lock-spike/);
 assert.doesNotMatch(mobile,/SyntheticSignedDeviceProofLab|native-lock-spike/);
 assert.match(src,/trust anchor\/public key registration/);
 assert.match(src,/durable counter persistence/);
 assert.match(src,/JVM-LAB/);
});

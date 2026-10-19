import test from 'node:test';
import assert from 'node:assert/strict';
import {KeyPurpose,KeyState,validateKeyManifest,transitionKeyState,explainNativeDatabaseBlockers}
 from '../packages/security-core/src/key-lifecycle.mjs';

const validManifest=()=>({
 schemaVersion:1,
 descriptors:[
  {purpose:KeyPurpose.SQLCIPHER_PAGE,handle:'negresco.sqlcipher.page.v1',location:'android-keystore-wrapped',exportable:false,backEndCanDecrypt:false,version:1},
  {purpose:KeyPurpose.E2EE_ROOT,handle:'negresco.e2ee.root.v1',location:'android-keystore-wrapped',exportable:false,backEndCanDecrypt:false,version:1},
  {purpose:KeyPurpose.RECOVERY_WRAP,handle:'negresco.recovery.offline.v1',location:'offline-e2ee-enveloped',exportable:false,backEndCanDecrypt:false,version:1}
 ]
});
test('key purposes have independent handles and locations',()=>{
 assert.deepEqual(validateKeyManifest(validManifest()),{valid:true,errors:[]});
});
test('one key cannot be reused for SQLCipher, record E2EE and recovery',()=>{
 const m=validManifest();
 m.descriptors[1].handle=m.descriptors[0].handle;
 assert.ok(validateKeyManifest(m).errors.includes('KEY_ALIAS_REUSED'));
 m.descriptors[2].purpose=KeyPurpose.SQLCIPHER_PAGE;
 assert.ok(validateKeyManifest(m).errors.includes('DUPLICATE_KEY_PURPOSE'));
 assert.ok(validateKeyManifest(m).errors.includes('MISSING_KEY_PURPOSE'));
});
test('unexpected secret material, backdoor or server key exposure is denied',()=>{
 const m=validManifest();
 m.descriptors[0].rawKey='THIS MUST NEVER BE IN METADATA';
 m.descriptors[1].backEndCanDecrypt=true;
 assert.ok(validateKeyManifest(m).errors.includes('UNEXPECTED_OR_SECRET_KEY_FIELD'));
 assert.ok(validateKeyManifest(m).errors.includes('BACKEND_DECRYPTION_FORBIDDEN'));
});
test('all sensitive key handles must be nonexportable, versioned and protected',()=>{
 const m=validManifest();
 m.descriptors[0].exportable=true;
 m.descriptors[1].location='plaintext-async-storage';
 m.descriptors[2].version=0;
 const errors=validateKeyManifest(m).errors;
 assert.ok(errors.includes('EXPORTABLE_KEY_MATERIAL'));
 assert.ok(errors.includes('UNSAFE_KEY_LOCATION'));
 assert.ok(errors.includes('INVALID_KEY_VERSION'));
});
test('unknown schema and incomplete or extra manifest objects fail closed',()=>{
 assert.equal(validateKeyManifest(null).valid,false);
 assert.equal(validateKeyManifest({schemaVersion:2,descriptors:[]}).valid,false);
 const m=validManifest();m.privateKey='secret';
 assert.equal(validateKeyManifest(m).valid,false);
});
test('biometric invalidation requires offline recovery, not a silent reset',()=>{
 assert.equal(transitionKeyState(KeyState.UNSEALED,'BACKGROUND').state,KeyState.SEALED);
 assert.equal(transitionKeyState(KeyState.SEALED,'KEYSTORE_INVALIDATED').state,KeyState.RECOVERY_REQUIRED);
 assert.equal(transitionKeyState(KeyState.RECOVERY_REQUIRED,'AUTHENTICATED_NATIVE_UNSEAL').ok,false);
 assert.equal(transitionKeyState(KeyState.RECOVERY_REQUIRED,'VERIFIED_OFFLINE_RECOVERY').state,KeyState.SEALED);
 assert.equal(transitionKeyState(KeyState.DESTROYED,'RANDOMLY_PROVISIONED').ok,false);
});
test('unknown transitions never grant access',()=>{
 const a=transitionKeyState(KeyState.SEALED,'JS_ONLY_BIOMETRIC_SUCCESS');
 assert.equal(a.ok,false);
 assert.equal(a.state,KeyState.SEALED);
 assert.equal(transitionKeyState('BOGUS','anything').ok,false);
});
test('native SQLCipher has no plaintext database fallback',()=>{
 for(const backend of [undefined,'sqlite','sqlcipher-js','plaintext-sqlite']){
  assert.ok(explainNativeDatabaseBlockers({backend}).includes('NATIVE_SQLCIPHER_REQUIRED'));
 }
 const blockers=explainNativeDatabaseBlockers({backend:'native-sqlcipher',keySource:'android-keystore-unwrapped'});
 assert.ok(blockers.includes('RECOVERY_PLAN_NOT_TESTED'));
 assert.ok(blockers.includes('ANDROID_DEVICE_TEST_REQUIRED'));
 assert.ok(blockers.includes('NATIVE_AUDIT_REQUIRED'));
 assert.deepEqual(explainNativeDatabaseBlockers({
  backend:'native-sqlcipher',keySource:'android-keystore-unwrapped',
  recoveryReady:true,deviceTested:true,nativeAuditApproved:true
 }),[]);
});

/**
 * Negresco Finance: POLICY ONLY, NOT cryptographic key generation or proof.
 * This module never receives secret bytes or passphrases. The native bridge
 * MUST independently enforce these gates and perform cryptographic work.
 */
export const KeyPurpose=Object.freeze({
 SQLCIPHER_PAGE:'sqlcipher-page',
 E2EE_ROOT:'e2ee-root',
 RECOVERY_WRAP:'offline-recovery-wrap'
});
export const KeyState=Object.freeze({
 NOT_CREATED:'NOT_CREATED',
 SEALED:'SEALED',
 UNSEALED:'UNSEALED',
 RECOVERY_REQUIRED:'RECOVERY_REQUIRED',
 DESTROYED:'DESTROYED'
});
const purposeSet=new Set(Object.values(KeyPurpose));
const descriptorKeys=new Set(['purpose','handle','location','exportable','backEndCanDecrypt','version']);
const manifestKeys=new Set(['schemaVersion','descriptors']);

export function validateKeyManifest(manifest){
 const errors=[];
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))
  return {valid:false,errors:['INVALID_MANIFEST']};
 if(Object.keys(manifest).some(k=>!manifestKeys.has(k)))errors.push('UNEXPECTED_MANIFEST_FIELD');
 if(manifest.schemaVersion!==1)errors.push('UNSUPPORTED_SCHEMA_VERSION');
 if(!Array.isArray(manifest.descriptors)||manifest.descriptors.length!==3){
  errors.push('THREE_DISTINCT_KEY_PURPOSES_REQUIRED');
  return {valid:false,errors};
 }
 const handles=new Set();
 const purposes=new Set();
 for(const descriptor of manifest.descriptors){
  if(!descriptor||typeof descriptor!=='object'||Array.isArray(descriptor)){
   errors.push('INVALID_KEY_DESCRIPTOR');
   continue;
  }
  // Unknown fields include rawKey, seed, password or plaintext key bytes.
  if(Object.keys(descriptor).some(k=>!descriptorKeys.has(k)))
   errors.push('UNEXPECTED_OR_SECRET_KEY_FIELD');
  if(!purposeSet.has(descriptor.purpose))errors.push('UNKNOWN_KEY_PURPOSE');
  if(purposes.has(descriptor.purpose))errors.push('DUPLICATE_KEY_PURPOSE');
  purposes.add(descriptor.purpose);
  if(typeof descriptor.handle!=='string'||!/^[a-z][a-z0-9.-]{11,110}$/.test(descriptor.handle))
   errors.push('INVALID_KEY_HANDLE');
  else if(handles.has(descriptor.handle))errors.push('KEY_ALIAS_REUSED');
  handles.add(descriptor.handle);
  const expectedLocation=descriptor.purpose===KeyPurpose.RECOVERY_WRAP?
   'offline-e2ee-enveloped':'android-keystore-wrapped';
  if(descriptor.location!==expectedLocation)errors.push('UNSAFE_KEY_LOCATION');
  if(descriptor.exportable!==false)errors.push('EXPORTABLE_KEY_MATERIAL');
  if(descriptor.backEndCanDecrypt!==false)errors.push('BACKEND_DECRYPTION_FORBIDDEN');
  if(!Number.isSafeInteger(descriptor.version)||descriptor.version<1)
   errors.push('INVALID_KEY_VERSION');
 }
 for(const p of purposeSet){
  if(!purposes.has(p))errors.push('MISSING_KEY_PURPOSE');
 }
 return {valid:errors.length===0,errors:[...new Set(errors)]};
}

/**
 * Models an event in the *client policy*. The native layer must verify every
 * authenticated transition, never trust a caller-provided string as proof.
 */
export function transitionKeyState(previous,event){
 if(!Object.values(KeyState).includes(previous))return {ok:false,state:KeyState.SEALED,reason:'UNKNOWN_STATE'};
 const allowed={
  [KeyState.NOT_CREATED]:{RANDOMLY_PROVISIONED:KeyState.SEALED},
  [KeyState.SEALED]:{
   AUTHENTICATED_NATIVE_UNSEAL:KeyState.UNSEALED,
   KEYSTORE_INVALIDATED:KeyState.RECOVERY_REQUIRED
  },
  [KeyState.UNSEALED]:{
   BACKGROUND:KeyState.SEALED,
   LOCK_NOW:KeyState.SEALED,
   KEYSTORE_INVALIDATED:KeyState.RECOVERY_REQUIRED
  },
  [KeyState.RECOVERY_REQUIRED]:{VERIFIED_OFFLINE_RECOVERY:KeyState.SEALED},
  [KeyState.DESTROYED]:{}
 };
 const next=allowed[previous][event];
 if(!next)return {ok:false,state:previous,reason:'DENIED_OR_UNVERIFIED_TRANSITION'};
 return {ok:true,state:next,reason:'POLICY_TRANSITION_ONLY'};
}

/** Gate for a *future* native adapter, not an authorization token. */
export function explainNativeDatabaseBlockers({
 backend,
 keySource,
 recoveryReady,
 deviceTested,
 nativeAuditApproved
}={}){
 const blockers=[];
 if(backend!=='native-sqlcipher')blockers.push('NATIVE_SQLCIPHER_REQUIRED');
 if(keySource!=='android-keystore-unwrapped')blockers.push('TRUSTED_NATIVE_KEY_REQUIRED');
 if(recoveryReady!==true)blockers.push('RECOVERY_PLAN_NOT_TESTED');
 if(deviceTested!==true)blockers.push('ANDROID_DEVICE_TEST_REQUIRED');
 if(nativeAuditApproved!==true)blockers.push('NATIVE_AUDIT_REQUIRED');
 return blockers;
}

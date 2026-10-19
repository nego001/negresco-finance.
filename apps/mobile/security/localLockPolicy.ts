/** A UI-only access gate. Never treat this as encryption or a backend session. */
export const LOCAL_LOCK_PREF_KEY='negresco.local_lock.v1';
export const LOCAL_LOCK_ENABLED='enabled';
export const LOCAL_LOCK_DISABLE_PENDING='disable-pending';
export const LOCAL_LOCK_DISABLED='disabled';
export type LocalLockStatus='loading'|'off'|'locked'|'unlocked'|'error';
export function parseLocalLockPreference(value:string|null):boolean{
  if(value===null)return false; // Existing installations remain usable until opt-in.
  if(value===LOCAL_LOCK_ENABLED||value===LOCAL_LOCK_DISABLE_PENDING)return true;
  if(value===LOCAL_LOCK_DISABLED)return false;
  throw new Error('Unknown local lock preference; do not silently disable.');
}
export function isStrongBiometryAvailable(hardware:boolean,enrolled:boolean,level:number):boolean{
  // Expo LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG = 3.
  return hardware&&enrolled&&level===3;
}
export function canFinishAuthentication(success:boolean,attemptEpoch:number,currentEpoch:number,appState:string):boolean{
  return success&&attemptEpoch===currentEpoch&&appState==='active';
}
export function shouldCoverAndLockOnState(next:string):boolean{
  return next==='inactive'||next==='background';
}

/**
 * Android biometric and authenticated SecureStore prompts may produce a
 * transient "inactive". A genuine "background" must ALWAYS invalidate the
 * current session, even if a native authentication prompt is on screen.
 */
export function shouldInvalidateLocalSession(nextState:string,nativePromptActive:boolean):boolean{
 return nextState==='background'||(nextState==='inactive'&&!nativePromptActive);
}

/**
 * Best-effort, two-step opt-out. Pending always reloads as locked after a crash.
 * If the session is revoked during the final write, re-arm the lock.
 * AsyncStorage offers no atomic cancellation: process death during the final
 * write may still leave 'disabled' persisted. Do not treat this as a security
 * transaction or as protection of encrypted financial data.
 */
export type LockPreferenceWriter={setItem:(key:string,value:string)=>Promise<void>};
export type DisablePreferenceOutcome='disabled'|'interrupted'|'failed';
export async function persistBiometricOptOut(
 store:LockPreferenceWriter,sessionIsValid:()=>boolean
):Promise<DisablePreferenceOutcome>{
 try{
  await store.setItem(LOCAL_LOCK_PREF_KEY,LOCAL_LOCK_DISABLE_PENDING);
  if(!sessionIsValid())return 'interrupted';
  await store.setItem(LOCAL_LOCK_PREF_KEY,LOCAL_LOCK_DISABLED);
  if(sessionIsValid())return 'disabled';
 }catch{
  // Even a rejected storage write could have been persisted by its backend.
 }
 try{
  await store.setItem(LOCAL_LOCK_PREF_KEY,LOCAL_LOCK_ENABLED);
  return 'interrupted';
 }catch{
  // The persistent state is unknown. The caller must cover the UI and report it.
  return 'failed';
 }
}

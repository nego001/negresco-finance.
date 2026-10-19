/** A UI-only access gate. Never treat this as encryption or a backend session. */
export const LOCAL_LOCK_PREF_KEY='negresco.local_lock.v1';
export const LOCAL_LOCK_ENABLED='enabled';
export const LOCAL_LOCK_DISABLE_PENDING='disable-pending';
export const LOCAL_LOCK_DISABLED='disabled';
export const LOCAL_LOCK_OPTOUT_JOURNAL_KEY='negresco.local_lock.optout.v1';
export const LOCAL_LOCK_OPTOUT_PENDING='pending';
export type LocalLockStatus='loading'|'off'|'locked'|'unlocked'|'error';
export function parseLocalLockPreference(value:string|null):boolean{
  if(value===null)return false; // Existing installations remain usable until opt-in.
  if(value===LOCAL_LOCK_ENABLED||value===LOCAL_LOCK_DISABLE_PENDING)return true;
  if(value===LOCAL_LOCK_DISABLED)return false;
  throw new Error('Unknown local lock preference; do not silently disable.');
}
/** A surviving opt-out intent overrides a disabled marker after process death. */
export function parseLocalLockWithJournal(value:string|null,journal:string|null):boolean{
 if(journal===LOCAL_LOCK_OPTOUT_PENDING)return true;
 if(journal!==null)throw new Error('Unknown biometric opt-out journal; fail closed.');
 return parseLocalLockPreference(value);
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
 * JS/AsyncStorage-only write-ahead journal (not a native transaction).
 * The journal must be persisted before the main preference can be disabled.
 * On the next launch, journal='pending' always means locked, even if the
 * primary key is already 'disabled'. Removal of the journal is the final step.
 *
 * A process death during journal removal, or a lifecycle event racing with
 * that final I/O, still has a residual opt-out risk. Full safety requires
 * serialized native lifecycle/persistence and device QA.
 */
export type LockPreferenceWriter={
 setItem:(key:string,value:string)=>Promise<void>;
 removeItem:(key:string)=>Promise<void>;
};
export type DisablePreferenceOutcome='disabled'|'interrupted'|'failed';
export async function persistBiometricOptOut(
 store:LockPreferenceWriter,sessionIsValid:()=>boolean
):Promise<DisablePreferenceOutcome>{
 try{
  await store.setItem(LOCAL_LOCK_OPTOUT_JOURNAL_KEY,LOCAL_LOCK_OPTOUT_PENDING);
  if(!sessionIsValid())return 'interrupted';
  await store.setItem(LOCAL_LOCK_PREF_KEY,LOCAL_LOCK_DISABLE_PENDING);
  if(!sessionIsValid())return 'interrupted';
  await store.setItem(LOCAL_LOCK_PREF_KEY,LOCAL_LOCK_DISABLED);
  if(!sessionIsValid())throw new Error('Authentication expired before opt-out commit');
  await store.removeItem(LOCAL_LOCK_OPTOUT_JOURNAL_KEY);
  if(sessionIsValid())return 'disabled';
 }catch{
  // A rejected write can still have reached disk. The recovery below
  // always re-arms the journal first, then the primary preference.
 }
 try{
  await store.setItem(LOCAL_LOCK_OPTOUT_JOURNAL_KEY,LOCAL_LOCK_OPTOUT_PENDING);
  await store.setItem(LOCAL_LOCK_PREF_KEY,LOCAL_LOCK_ENABLED);
  return 'interrupted';
 }catch{
  return 'failed';
 }
}

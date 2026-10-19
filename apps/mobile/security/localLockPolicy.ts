/** A UI-only access gate. Never treat this as encryption or a backend session. */
export const LOCAL_LOCK_PREF_KEY='negresco.local_lock.v1';
export type LocalLockStatus='loading'|'off'|'locked'|'unlocked'|'error';
export function parseLocalLockPreference(value:string|null):boolean{
  if(value===null)return false; // Existing installations remain usable until opt-in.
  if(value==='enabled')return true;
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

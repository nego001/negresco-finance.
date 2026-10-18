export const AuthState=Object.freeze({LOCKED:'LOCKED',UNLOCKED:'UNLOCKED',EXPIRED:'EXPIRED'});
export const SensitiveAction=Object.freeze({VIEW_PRIVATE_DATA:'view.private',PREPARE_PIX:'pix.prepare',CONFIRM_PIX:'pix.confirm',EXPORT_DATA:'data.export'});
export function evaluateSession(session,now=Date.now()){
 if(!session||session.authenticated!==true||typeof session.userId!=='string'||!session.userId.trim())return {state:AuthState.LOCKED,reason:'NOT_AUTHENTICATED'};
 if(!Number.isFinite(session.expiresAt)||now>=session.expiresAt)return {state:AuthState.EXPIRED,reason:'SESSION_EXPIRED'};
 return {state:AuthState.UNLOCKED,reason:'OK'};
}
export function authorizeSensitiveAction({session,action,stepUp,consent},now=Date.now()){
 const evaluated=evaluateSession(session,now);
 if(evaluated.state!==AuthState.UNLOCKED)return {allowed:false,reason:evaluated.reason};
 if(!Object.values(SensitiveAction).includes(action))return {allowed:false,reason:'UNKNOWN_ACTION'};
 if(action===SensitiveAction.CONFIRM_PIX||action===SensitiveAction.EXPORT_DATA){
  if(!stepUp||stepUp.verified!==true||stepUp.userId!==session.userId||!Number.isFinite(stepUp.verifiedAt)||stepUp.verifiedAt>now||now-stepUp.verifiedAt>120000)return {allowed:false,reason:'STEP_UP_REQUIRED'};
 }
 if(action===SensitiveAction.CONFIRM_PIX&&consent!==true)return {allowed:false,reason:'EXPLICIT_CONSENT_REQUIRED'};
 return {allowed:true,reason:'AUTHORIZED'};
}

/** Pure, deny-by-default consent decisions. No persistence is implied. */
export function evaluateConsent(grant,{userId,scope,purpose,resourceId,now=Date.now()}={}){
  if(!grant||typeof userId!=='string'||!userId||typeof scope!=='string'||!scope||typeof purpose!=='string'||!purpose)return {allowed:false,reason:'INVALID_REQUEST'};
  if(grant.userId!==userId||grant.scope!==scope||grant.purpose!==purpose)return {allowed:false,reason:'CONSENT_MISMATCH'};
  if(grant.revoked===true)return {allowed:false,reason:'CONSENT_REVOKED'};
  if(grant.granted!==true)return {allowed:false,reason:'CONSENT_NOT_GRANTED'};
  if(!Number.isFinite(grant.expiresAt)||!Number.isFinite(now)||now>=grant.expiresAt)return {allowed:false,reason:'CONSENT_EXPIRED'};
  if(typeof grant.resourceId!=='string'||!grant.resourceId||grant.resourceId!==resourceId)return {allowed:false,reason:'RESOURCE_MISMATCH'};
  return {allowed:true,reason:'CONSENT_VALID'};
}
export function revokeConsent(grant,now=Date.now()){
  if(!grant||!Number.isFinite(now))throw new TypeError('Invalid consent');
  return Object.freeze({...grant,revoked:true,revokedAt:now});
}

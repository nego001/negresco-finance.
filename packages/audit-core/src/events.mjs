/** Metadata-only event builder. Storage, integrity signatures and retention belong to a backend. */
const allowedTypes=new Set(['SESSION_DENIED','CONSENT_DENIED','DELEGATION_DENIED','PIX_DRAFT_REJECTED','POLICY_DENIED','POLICY_ALLOWED']);
const safeId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value);
export function createAuditEvent({type,correlationId,actorId,reasonCode},now=Date.now()){
  if(!allowedTypes.has(type)||!safeId(correlationId)||!safeId(actorId)||!safeId(reasonCode)||!Number.isFinite(now))throw new TypeError('Invalid audit metadata');
  return Object.freeze({type,correlationId,actorId,reasonCode,timestamp:now});
}

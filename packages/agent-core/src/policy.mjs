/** Deterministic authorization; LLM decisions cannot override it. */
export function authorizeDelegation(task, context) {
  if (!context?.sessionValid || context.userId !== task.userId) return {allowed:false,reasonCode:'INVALID_SESSION',grantedScopes:[]};
  if (task.requestedBy !== 'cto') return {allowed:false,reasonCode:'CTO_ROUTING_REQUIRED',grantedScopes:[]};
  if (task.targetAgent === 'cto' || task.targetAgent === 'negresco') return {allowed:false,reasonCode:'INVALID_SPECIALIST',grantedScopes:[]};
  const forbidden = ['payment.execute','investment.execute','crypto.keys.read','audit.disable'];
  if (task.scopes.some(scope => forbidden.includes(scope))) return {allowed:false,reasonCode:'SENSITIVE_ACTION_REQUIRES_SEPARATE_FLOW',grantedScopes:[]};
  if (!task.scopes.every(scope => context.grantedScopes.includes(scope))) return {allowed:false,reasonCode:'SCOPE_NOT_GRANTED',grantedScopes:[]};
  return {allowed:true,reasonCode:'ALLOWED',grantedScopes:[...task.scopes]};
}
export function voiceForIdentity(identity) {
  const voices = {feminine:'feminine',masculine:'masculine',neutral:'neutral'};
  if (!Object.hasOwn(voices,identity)) throw new Error('Unsupported identity');
  return voices[identity];
}
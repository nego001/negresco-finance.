import {evaluateSession,AuthState,authorizeSensitiveAction,SensitiveAction} from '../../auth-core/src/session.mjs';
import {authorizeDelegation} from '../../agent-core/src/policy.mjs';
import {assessDeviceRisk,authorizeRiskyOperation} from '../../security-core/src/risk.mjs';
import {validatePixDraft,IntegrationMode} from '../../contracts/src/finance.mjs';
import {modules} from '../../module-registry/src/registry.mjs';

export const Capability=Object.freeze({
  VIEW:'finance.view',PIX_PREPARE:'pix.prepare',PIX_EXECUTE:'pix.execute',
  AGENT_DELEGATE:'agent.delegate'
});
const denied=(reason)=>Object.freeze({allowed:false,reason});
const accepted=(reason,extra={})=>Object.freeze({allowed:true,reason,...extra});

/** Pure policy gate. This is not a payment processor or a substitute for backend checks. */
export function evaluateCapability(request,environment,now=Date.now()){
  if(!request||!environment||!Object.values(Capability).includes(request.capability))return denied('UNKNOWN_CAPABILITY');
  const session=environment.session;
  const state=evaluateSession(session,now);
  if(state.state!==AuthState.UNLOCKED)return denied(state.reason);
  if(request.userId!==session.userId)return denied('USER_MISMATCH');
  if(!Array.isArray(environment.scopes))return denied('SCOPES_MISSING');
  const required={
    [Capability.VIEW]:'finance.read',
    [Capability.PIX_PREPARE]:'pix.prepare',
    [Capability.PIX_EXECUTE]:'pix.execute',
    [Capability.AGENT_DELEGATE]:'agent.delegate'
  }[request.capability];
  if(!environment.scopes.includes(required))return denied('SCOPE_NOT_GRANTED');
  if(request.capability===Capability.VIEW){
    if(!modules['open-finance'])return denied('MODULE_DISABLED');
    const risk=authorizeRiskyOperation({assessment:assessDeviceRisk(environment.signals??{}),operation:'read'});
    return risk.allowed?accepted('READ_ALLOWED'):denied(risk.reason);
  }
  if(request.capability===Capability.AGENT_DELEGATE){
    if(!modules.ai)return denied('MODULE_DISABLED');
    if(!request.task||request.task.userId!==session.userId)return denied('INVALID_TASK');
    const decision=authorizeDelegation(request.task,{sessionValid:true,userId:session.userId,grantedScopes:environment.scopes});
    return decision.allowed?accepted('DELEGATION_ALLOWED',{grantedScopes:decision.grantedScopes}):denied(decision.reasonCode);
  }
  if(!modules.pix)return denied('MODULE_DISABLED');
  const draft=validatePixDraft(request.draft);
  if(!draft.valid)return denied(draft.reason);
  if(request.capability===Capability.PIX_PREPARE){
    const auth=authorizeSensitiveAction({session,action:SensitiveAction.PREPARE_PIX},now);
    return auth.allowed?accepted('DRAFT_VALIDATED_ONLY'):denied(auth.reason);
  }
  // Deliberately fail closed: LIVE requires a separately audited server-side flow.
  if(environment.integrationMode!==IntegrationMode.LIVE)return denied('LIVE_INTEGRATION_REQUIRED');
  const auth=authorizeSensitiveAction({session,action:SensitiveAction.CONFIRM_PIX,stepUp:environment.stepUp,consent:request.consent},now);
  if(!auth.allowed)return denied(auth.reason);
  const risk=authorizeRiskyOperation({assessment:assessDeviceRisk(environment.signals??{}),operation:'payment',serverVerified:environment.serverVerified===true});
  if(!risk.allowed)return denied(risk.reason);
  return denied('PAYMENT_EXECUTION_NOT_IMPLEMENTED');
}

export const AgentIds=Object.freeze(['cto','negresco','guardian','finance','open-finance','pix','investments','cards','goals','auditor','operations']);
export const AgentCapabilities=Object.freeze({
  cto:['delegate.request','result.review'],
  negresco:['conversation','delegate.request'],
  guardian:['security.assess'],
  finance:['transactions.read','budget.analyze'],
  'open-finance':['accounts.read','transactions.read'],
  pix:['payment.prepare','payment.status.read'],
  investments:['investments.read','investments.explain'],
  cards:['cards.read'],
  goals:['goals.read','goals.propose'],
  auditor:['audit.read'],
  operations:['system.health.read']
});
export function supportsCapability(agentId,capability) {
  return (AgentCapabilities[agentId]??[]).includes(capability);
}

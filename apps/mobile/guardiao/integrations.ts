/** Explicit integration boundaries. No scraping or banking access without provider approval. */
export type ConnectionState={status:'not-connected'|'connected';provider:string;consentId?:string;expiresAt?:string};
export function canMonitorBank(state:ConnectionState,now:string):boolean{
 return state.status==='connected'&&state.provider.trim().length>0&&typeof state.consentId==='string'&&state.consentId.length>0&&typeof state.expiresAt==='string'&&Date.parse(state.expiresAt)>Date.parse(now);
}
export const reclameAqui:ConnectionState={status:'not-connected',provider:'Reclame Aqui'};
export const bankMonitoring:ConnectionState={status:'not-connected',provider:''};
export function availabilityMessage(state:ConnectionState):string{
 return state.status==='not-connected'?'Integração não conectada. Nenhum dado externo foi consultado.':'Conector configurado; verifique permissões e disponibilidade antes de consultar.';
}

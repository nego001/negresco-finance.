/** Evidence contracts. All unverified fields remain explicitly unknown. */
export type EvidenceSource='bank-authorized'|'official-registry'|'consumer-report'|'document-user'|'news';
export type Evidence={id:string;source:EvidenceSource;title:string;url?:string;checkedAt:string;summary:string;entityCnpj?:string};
export type ClaimStatus='confirmed'|'hypothesis'|'unknown';
export type InvestigatedClaim={value:string|null;status:ClaimStatus;evidenceIds:string[]};
export type Investigation={
 id:string;createdAt:string;notificationBank:InvestigatedClaim;
 registrationBank:InvestigatedClaim;issuer:InvestigatedClaim;
 beneficiary:InvestigatedClaim;commercialOrigin:InvestigatedClaim;
 evidence:Evidence[];result:'inconclusive'|'warning'|'no-indicators-found';
};
const unknown=():InvestigatedClaim=>({value:null,status:'unknown',evidenceIds:[]});
export function createInvestigation(id:string,createdAt:string):Investigation{
 return {id,createdAt,notificationBank:unknown(),registrationBank:unknown(),issuer:unknown(),beneficiary:unknown(),commercialOrigin:unknown(),evidence:[],result:'inconclusive'};
}
export function validateInvestigation(i:Investigation):string[]{
 const errors:string[]=[];const ids=new Set(i.evidence.map(e=>e.id));
 for(const [field,claim] of Object.entries({notificationBank:i.notificationBank,registrationBank:i.registrationBank,issuer:i.issuer,beneficiary:i.beneficiary,commercialOrigin:i.commercialOrigin})){
  if(claim.status==='confirmed'&&(!claim.value||claim.evidenceIds.length===0))errors.push(field+': confirmação sem evidência');
  if(claim.status==='unknown'&&(claim.value!==null||claim.evidenceIds.length!==0))errors.push(field+': desconhecido deve permanecer vazio');
  if(claim.evidenceIds.some(id=>!ids.has(id)))errors.push(field+': evidência inexistente');
 }
 for(const e of i.evidence){
  if(!e.id||!e.title||!e.checkedAt||!e.summary)errors.push('evidência incompleta');
  if(e.url&&!/^https:\/\//i.test(e.url))errors.push('URL não segura');
 }
 return errors;
}

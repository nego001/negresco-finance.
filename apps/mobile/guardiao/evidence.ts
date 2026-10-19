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
 const errors:string[]=[];const evidenceById=new Map(i.evidence.map(e=>[e.id,e] as const));const ids=new Set(evidenceById.keys());
 if(ids.size!==i.evidence.length)errors.push('identificador de evidência duplicado');
 for(const [field,claim] of Object.entries({notificationBank:i.notificationBank,registrationBank:i.registrationBank,issuer:i.issuer,beneficiary:i.beneficiary,commercialOrigin:i.commercialOrigin})){
  if(claim.status==='confirmed'&&(!claim.value||claim.evidenceIds.length===0))errors.push(field+': confirmação sem evidência');
  if(claim.status==='unknown'&&(claim.value!==null||claim.evidenceIds.length!==0))errors.push(field+': desconhecido deve permanecer vazio');
  if(claim.evidenceIds.some(id=>!ids.has(id)))errors.push(field+': evidência inexistente');
  // A public CNPJ record, news article or complaint cannot establish who issued a boleto.
  if(claim.status==='confirmed'&&claim.evidenceIds.some(id=>evidenceById.get(id)?.source!=='bank-authorized'))errors.push(field+': confirmação exige evidência bancária autorizada');
 }
 for(const e of i.evidence){
  if(!e.id||!e.title||!e.checkedAt||!e.summary)errors.push('evidência incompleta');
  if(e.url&&!/^https:\/\//i.test(e.url))errors.push('URL não segura');
 }
 return errors;
}

/**
 * Human-readable coverage for the Guardião screen. This does not promote a
 * registry lookup, a checksum, or a missing result into proof of legitimacy.
 */
import type {BoletoInspection} from './validator';
import type {CompanyResult} from './company';
export type EvidenceReviewState='local-checked'|'local-invalid'|'external-response'|'external-unavailable'|'not-checked';
export type EvidenceReviewRow={
 id:'checksum'|'company'|'beneficiary'|'origin'|'bank'|'reputation';
 title:string;
 status:EvidenceReviewState;
 source:string;
 detail:string;
};
export type EvidenceReview={rows:EvidenceReviewRow[];externalResponses:number;legitimacy:'unknown'};
export function buildEvidenceReview(inspection:BoletoInspection|null,company:CompanyResult|null):EvidenceReview{
 const checksum:EvidenceReviewRow=inspection
  ? {id:'checksum',title:'Dígitos verificadores',status:inspection.valid?'local-checked':'local-invalid',source:'Cálculo no aparelho',detail:inspection.valid?'Os dígitos conferem. Isso não confirma beneficiário, origem ou legitimidade.':inspection.explanation}
  : {id:'checksum',title:'Dígitos verificadores',status:'not-checked',source:'Cálculo no aparelho',detail:'Nenhuma linha digitável analisada.'};
 const registry:EvidenceReviewRow=!company
  ? {id:'company',title:'Cadastro de empresa',status:'not-checked',source:'BrasilAPI · consulta opcional',detail:'Nenhum CNPJ consultado.'}
  : company.status==='found'
    ? {id:'company',title:'Cadastro de empresa',status:'external-response',source:'BrasilAPI · serviço de terceiros',detail:'Cadastro localizado: '+(company.legalName||'nome não informado')+'. Não foi comprovado vínculo com o boleto.'}
    : company.status==='not-found'
      ? {id:'company',title:'Cadastro de empresa',status:'external-response',source:'BrasilAPI · serviço de terceiros',detail:'Cadastro não localizado nessa fonte; isso não prova fraude.'}
      : {id:'company',title:'Cadastro de empresa',status:'external-unavailable',source:'BrasilAPI · tentativa',detail:company.message||'Consulta não concluída.'};
 return {
  legitimacy:'unknown',
  externalResponses:company&&(company.status==='found'||company.status==='not-found')?1:0,
  rows:[
   checksum,
   registry,
   {id:'beneficiary',title:'Beneficiário da cobrança',status:'not-checked',source:'Banco do beneficiário',detail:'Não confirmado com o banco.'},
   {id:'origin',title:'Origem da compra',status:'not-checked',source:'Contrato ou pedido',detail:'Nenhuma compra ou contrato vinculado.'},
   {id:'bank',title:'Registro bancário',status:'not-checked',source:'Instituição autorizada',detail:'Nenhuma conta ou serviço bancário conectado.'},
   {id:'reputation',title:'Reputação da empresa',status:'not-checked',source:'Reclame Aqui',detail:'Nenhuma avaliação ou reclamação consultada.'}
  ]
 };
}

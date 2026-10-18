import type {BoletoInspection} from './validator';
export type LocalReport={createdAt:string;kind:string;digits:number;checksum:'consistent'|'inconsistent';legitimacy:'unknown';sourcesConsulted:0;issuer:null;beneficiary:null;commercialOrigin:null};
export function createLocalReport(result:BoletoInspection,createdAt:string):LocalReport{
 return {createdAt,kind:result.kind,digits:result.digits,checksum:result.valid?'consistent':'inconsistent',legitimacy:'unknown',sourcesConsulted:0,issuer:null,beneficiary:null,commercialOrigin:null};
}
function escapeHtml(v:string){return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));}
export function renderReportHtml(report:LocalReport):string{
 const date=escapeHtml(report.createdAt),kind=escapeHtml(report.kind);
 return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><style>body{font-family:Arial,sans-serif;padding:32px;color:#172235}h1{color:#164c85}section{margin:20px 0;padding:14px;border:1px solid #c9d5e2;border-radius:8px}p{line-height:1.55}.warn{color:#9a4d00}</style></head><body><h1>Negresco Finance | Guardião de Boletos</h1><p>Relatório de inspeção matemática local</p><section><p>Data: '+date+'</p><p>Tipo: '+kind+'</p><p>Quantidade de dígitos: '+report.digits+'</p><p>Dígitos verificadores: '+(report.checksum==='consistent'?'Consistentes':'Inconsistentes')+'</p></section><section><h2>Investigação e evidências</h2><p>Beneficiário: não identificado</p><p>Emissor: não identificado</p><p>Origem comercial: não identificada</p><p>Fontes externas consultadas: 0</p><p>Legitimidade da cobrança: inconclusiva</p></section><p class="warn">A conferência matemática não confirma dívida, beneficiário ou ausência de fraude. Confirme os dados no aplicativo oficial do banco antes de pagar.</p><p>Não contém linha digitável completa, CPF, CNPJ ou dados bancários pessoais.</p></body></html>';
}

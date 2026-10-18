import type {BoletoInspection} from './validator';
import type {CompanyResult} from './company';

/** A report contains no full boleto line, full CNPJ or confidential banking data. */
export type RegistrySnapshot={
 status:'found'|'not-found'|'unavailable';
 legalName?:string;
 registration?:string;
 checkedAt?:string;
 message?:string;
};
export type LocalReport={
 createdAt:string;kind:string;digits:number;
 checksum:'consistent'|'inconsistent';
 legitimacy:'unknown';sourcesConsulted:0|1;
 issuer:null;beneficiary:null;commercialOrigin:null;
 registry?:RegistrySnapshot;
};
export function createLocalReport(result:BoletoInspection,createdAt:string,company?:CompanyResult|null):LocalReport{
 const sourcesConsulted:0|1=company&&(company.status==='found'||company.status==='not-found')?1:0;
 const registry:RegistrySnapshot|undefined=company?{
  status:company.status,
  legalName:company.legalName?.slice(0,160),
  registration:company.registration?.slice(0,80),
  checkedAt:company.checkedAt,
  message:company.message?.slice(0,160),
 }:undefined;
 return {
  createdAt,kind:result.kind,digits:result.digits,
  checksum:result.valid?'consistent':'inconsistent',
  legitimacy:'unknown',sourcesConsulted,
  issuer:null,beneficiary:null,commercialOrigin:null,
  ...(registry?{registry}:{})
 };
}
function escapeHtml(v:string){return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));}
export function renderReportHtml(report:LocalReport):string{
 const date=escapeHtml(report.createdAt);
 const kind=escapeHtml(report.kind);
 const status=report.checksum==='consistent'?'Dígitos consistentes':'Dígitos inconsistentes ou formato inválido';
 const company=report.registry;
 let companyHtml='<p>Nenhuma consulta externa de CNPJ incluída neste relatório.</p>';
 if(company){
  const name=company.status==='found'?'Cadastro encontrado':company.status==='not-found'?'Cadastro não encontrado nesta fonte':'Consulta não concluída';
  const fields=[
   company.legalName?'<p><strong>Razão social:</strong> '+escapeHtml(company.legalName)+'</p>':'',
   company.registration?'<p><strong>Situação informada:</strong> '+escapeHtml(company.registration)+'</p>':'',
   company.checkedAt?'<p><strong>Consulta em:</strong> '+escapeHtml(company.checkedAt)+'</p>':'',
   company.message?'<p><strong>Observação:</strong> '+escapeHtml(company.message)+'</p>':''
  ].join('');
  companyHtml='<p><strong>BrasilAPI (terceiros):</strong> '+name+'</p>'+fields+
   '<p class="warning">Consulta independente: não há comprovação de que essa empresa seja emissora ou beneficiária do boleto.</p>';
 }
 return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/>
 <style>
 *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:35px;color:#172235;background:#fff}
 h1{font-size:25px;color:#163e76;margin:0 0 5px}h2{font-size:16px;margin:0 0 12px;color:#153d70}
 p{line-height:1.5;margin:7px 0;font-size:12px}
 .eyebrow{font-size:10px;letter-spacing:2px;color:#3872b0;font-weight:bold;margin-bottom:9px}
 .subtitle{font-size:12px;color:#526983;margin-bottom:20px}
 .card{border:1px solid #d8e4f2;border-radius:10px;padding:17px;margin:14px 0;page-break-inside:avoid}
 .status{border-left:4px solid #3476bc;background:#eef5fd;padding:12px;border-radius:5px;font-weight:bold}
 .warning{color:#754d12;background:#fff7e8;border-radius:5px;padding:9px}
 .footer{border-top:1px solid #d8e4f2;padding-top:14px;margin-top:23px;color:#526983;font-size:11px}
 </style></head><body>
 <div class="eyebrow">NEGRESCO FINANCE · GUARDIÃO</div>
 <h1>Relatório de evidências</h1>
 <p class="subtitle">Inspeção matemática local e consultas opcionais, sem veredito de autenticidade.</p>
 <div class="card"><h2>1. Verificação local</h2>
 <p><strong>Data:</strong> ${date}</p><p><strong>Tipo:</strong> ${kind}</p>
 <p><strong>Quantidade de dígitos:</strong> ${report.digits}</p>
 <div class="status">${status}</div>
 <p>Esta verificação analisa apenas a estrutura e os dígitos verificadores da linha digitável.</p></div>
 <div class="card"><h2>2. Consulta de cadastro empresarial</h2>
 <p>Fontes externas consultadas: ${report.sourcesConsulted}</p>
 ${companyHtml}</div>
 <div class="card"><h2>3. O que continua desconhecido</h2>
 <p>Beneficiário: não identificado no banco</p>
 <p>Emissor: não identificado no banco</p>
 <p>Origem comercial e dívida: não comprovadas</p>
 <p>Registro bancário: não consultado</p>
 <p>Reclame Aqui: não consultado</p>
 <p><strong>Legitimidade da cobrança: inconclusiva.</strong></p></div>
 <p class="warning">A conferência matemática e o cadastro de CNPJ não confirmam dívida, beneficiário ou ausência de fraude. Confira os dados no aplicativo oficial do banco antes de pagar.</p>
 <p class="footer">Gerado localmente. Não contém linha digitável completa, CPF, CNPJ completo ou dados bancários pessoais. Nenhuma operação de pagamento foi realizada.</p>
 </body></html>`;
}

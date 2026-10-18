/** Deterministic, offline checksum inspection. Not an authenticity or ownership check. */
export type BoletoInspection = {valid:boolean;kind:string;digits:number;explanation:string};
const mod10=(s:string)=>{let sum=0,m=2;for(let i=s.length-1;i>=0;i--){let n=Number(s[i])*m;sum+=Math.floor(n/10)+n%10;m=m===2?1:2;}return (10-sum%10)%10;};
const mod11=(s:string)=>{let sum=0,m=2;for(let i=s.length-1;i>=0;i--){sum+=Number(s[i])*m;m=m===9?2:m+1;}const r=11-sum%11;return r===0||r===10||r===11?1:r;};
export function inspectBoleto(input:string):BoletoInspection{
 if(typeof input!=='string'||input.length>80)return {kind:'FORMATO DESCONHECIDO',digits:0,valid:false,explanation:'Entrada inválida ou muito longa.'};
 const digits=input.replace(/[.\s-]/g,'');
 const base={kind:'FORMATO DESCONHECIDO',digits:digits.length};
 if(!/^\d+$/.test(digits))return {...base,valid:false,explanation:'Use somente números, espaços, pontos ou hífens.'};
 if(digits.length===47){
  const fields=[[0,9,9],[10,20,20],[21,31,31]] as const;
  const checks=fields.every(([a,b,d])=>mod10(digits.slice(a,b))===Number(digits[d]));
  const barcode=digits.slice(0,4)+digits.slice(32,47)+digits.slice(4,9)+digits.slice(10,20)+digits.slice(21,31);
  const general=mod11(barcode.slice(0,4)+barcode.slice(5))===Number(barcode[4]);
  return {kind:'BOLETO BANCÁRIO',digits:47,valid:checks&&general,explanation:checks&&general?'Os dígitos verificadores conferem. Isso NÃO confirma beneficiário, origem, registro bancário ou ausência de fraude.':'Há inconsistência em um ou mais dígitos verificadores. Confira a digitação e valide a cobrança no banco.'};
 }
 if(digits.length===48){
  if(digits[0]!=='8')return {kind:'ARRECADAÇÃO',digits:48,valid:false,explanation:'O formato de arrecadação deve começar com 8.'};
  const ref=Number(digits[2]);if(![6,7,8,9].includes(ref))return {kind:'ARRECADAÇÃO',digits:48,valid:false,explanation:'Identificador de valor ou módulo de verificação desconhecido.'};
  const check=ref===6||ref===7?mod10:mod11;
  const valid=[0,12,24,36].every(a=>check(digits.slice(a,a+11))===Number(digits[a+11]));
  return {kind:'ARRECADAÇÃO',digits:48,valid,explanation:valid?'Os dígitos verificadores dos quatro blocos conferem. Isso NÃO confirma a legitimidade da cobrança.':'Um ou mais blocos têm dígito verificador inconsistente.'};
 }
 return {...base,valid:false,explanation:'Esperados 47 dígitos (boleto bancário) ou 48 (arrecadação).'};
}

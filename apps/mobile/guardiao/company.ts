/** Public third-party company registry lookup. Never proof of a boleto's authenticity. */
export type CompanyResult={status:'found'|'not-found'|'unavailable';cnpj:string;legalName?:string;registration?:string;source?:string;checkedAt?:string;message?:string};
export function normalizeCnpj(input:string):string|null{
 const n=input.replace(/\D/g,'');if(n.length!==14||/^(\d)\1{13}$/.test(n))return null;
 const dv=(s:string,w:number[])=>{const r=w.reduce((a,v,i)=>a+v*Number(s[i]),0)%11;return r<2?0:11-r;};
 if(dv(n.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2])!==Number(n[12]))return null;
 if(dv(n.slice(0,13),[6,5,4,3,2,9,8,7,6,5,4,3,2])!==Number(n[13]))return null;
 return n;
}
/** Opt-in lookup. Deadline covers both the HTTP request and JSON parsing. */
export async function consultCnpj(input:string,fetcher:typeof fetch=fetch,timeoutMs=8000):Promise<CompanyResult>{
 const cnpj=normalizeCnpj(input);
 if(!cnpj)return {status:'unavailable',cnpj:'',message:'CNPJ inválido.'};
 const source='https://brasilapi.com.br/api/cnpj/v1/'+cnpj;
 const controller=new AbortController();
 let timer:ReturnType<typeof setTimeout>|undefined;
 const timeout=new Promise<never>((_,reject)=>{
  timer=setTimeout(()=>{controller.abort();reject(new Error('lookup-timeout'));},timeoutMs);
 });
 try{
  const lookup=async():Promise<CompanyResult>=>{
   const r=await fetcher(source,{headers:{Accept:'application/json'},signal:controller.signal});
   if(r.status===404)return {status:'not-found',cnpj,source,message:'Não encontrado nesta fonte.'};
   if(!r.ok)return {status:'unavailable',cnpj,message:'Fonte temporariamente indisponível.'};
   const data=await r.json();
   if(typeof data?.razao_social!=='string'||!data.razao_social.trim())return {status:'unavailable',cnpj,message:'Resposta inesperada.'};
   return {status:'found',cnpj,legalName:data.razao_social,registration:typeof data.descricao_situacao_cadastral==='string'?data.descricao_situacao_cadastral:undefined,source,checkedAt:new Date().toISOString()};
  };
  return await Promise.race([lookup(),timeout]);
 }catch(error){
  return {status:'unavailable',cnpj,message:error instanceof Error&&error.message==='lookup-timeout'?'Tempo limite da consulta excedido.':'Falha de conexão.'};
 }finally{if(timer!==undefined)clearTimeout(timer);}
}

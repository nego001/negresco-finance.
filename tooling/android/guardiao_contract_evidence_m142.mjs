import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {parse} from './guardiao_contract_differential_m140.mjs';
export function compare(a,b){
 assert.equal(a.totals.tests,b.totals.tests);
 const result={baseline:a.totals,candidate:b.totals,baselineOnly:[],both:[],candidateOnly:[],affectedFiles:0,baselineValid:a.totals.fail===0,integrationApproved:false,approvedForProduction:false,stableReleaseAllowed:false};
 const files=new Set();
 for(let i=0;i<a.cases.length;i++){
  const x=a.cases[i],y=b.cases[i];assert.equal(x.name,y.name,'test inventory changed');
  const info=z=>({name:z.name,location:z.location,code:z.code,operator:z.operator});
  if(!x.pass&&!y.pass){result.both.push({baseline:info(x),candidate:info(y)});files.add(x.location.split(':')[0]);files.add(y.location.split(':')[0])}
  else if(!x.pass){result.baselineOnly.push(info(x));files.add(x.location.split(':')[0])}
  else if(!y.pass){result.candidateOnly.push(info(y));files.add(y.location.split(':')[0])}
 }
 result.affectedFiles=files.size;
 result.integrationApproved=result.baselineValid&&b.totals.fail===0;
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{assert.equal(process.argv.length,6);const [a,as,b,bs]=process.argv.slice(2);console.log(JSON.stringify(compare(parse(readFileSync(a,'utf8'),Number(as)),parse(readFileSync(b,'utf8'),Number(bs))),null,2))}catch(e){console.error('BLOCK (LAB): invalid differential evidence: '+e.message);process.exitCode=1}
}

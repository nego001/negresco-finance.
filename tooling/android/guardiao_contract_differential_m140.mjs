import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
export function parse(raw,status){
 assert.ok([0,1].includes(status),'unexpected process exit');
 const totals={};
 const cases=[];
 let current=null;
 for(const line of raw.split(/\r?\n/)){
  const count=/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$/.exec(line);
  if(count){assert.ok(!Object.hasOwn(totals,count[1]));totals[count[1]]=Number(count[2]);}
  const result=/^(not ok|ok) (\d+) - (.+)$/.exec(line);
  if(result){current={number:Number(result[2]),name:result[3],pass:result[1]==='ok',location:null,code:null,operator:null};cases.push(current);continue}
  if(!current||current.pass)continue;
  const loc=/^  location: ['"]?(?:file:\/\/)?[^\n]*?\/(tests\/[a-zA-Z0-9_.-]+\.test\.mjs):(\d+):(\d+)/.exec(line);
  if(loc)current.location=loc[1]+':'+loc[2]+':'+loc[3];
  const meta=/^  (code|operator): ['"]?([a-zA-Z0-9_.-]{1,80})['"]?$/.exec(line);
  if(meta)current[meta[1]]=meta[2];
 }
 for(const key of ['tests','pass','fail','cancelled','skipped','todo'])assert.ok(Number.isSafeInteger(totals[key]),key);
 assert.equal(totals.cancelled+totals.skipped+totals.todo,0);
 assert.equal(totals.pass+totals.fail,totals.tests);
 assert.equal(cases.length,totals.tests);
 assert.equal(cases.filter(x=>!x.pass).length,totals.fail);
 assert.equal(status,totals.fail?1:0);
 assert.equal(new Set(cases.map(x=>x.number)).size,cases.length);
 for(const c of cases.filter(x=>!x.pass))assert.ok(c.location,'missing failure location: '+c.name);
 return {totals,cases};
}
export function differential(a,b){
 assert.equal(a.totals.tests,b.totals.tests);
 assert.equal(a.totals.fail,0,'baseline must pass');
 for(let i=0;i<a.cases.length;i++)assert.equal(a.cases[i].name,b.cases[i].name,'test inventory changed');
 const failures=b.cases.filter(x=>!x.pass);
 const files={};
 for(const item of failures){const path=item.location.split(':')[0];(files[path]??=[]).push({name:item.name,location:item.location,code:item.code,operator:item.operator});}
 return {baseline:a.totals,candidate:b.totals,affectedFiles:Object.keys(files).length,failuresByFile:files,approvedForProduction:false,stableReleaseAllowed:false,integrationApproved:b.totals.fail===0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{assert.equal(process.argv.length,6);const [a,as,b,bs]=process.argv.slice(2);const out=differential(parse(readFileSync(a,'utf8'),Number(as)),parse(readFileSync(b,'utf8'),Number(bs)));console.log(JSON.stringify(out,null,2));}catch(e){console.error('BLOCK (LAB): invalid contract differential: '+e.message);process.exitCode=1}
}

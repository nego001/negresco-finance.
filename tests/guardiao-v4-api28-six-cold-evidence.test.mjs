import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const ledgerPath='docs/security/P0_GUARDIAO_V4_API28_SIX_COLD_EVIDENCE.json',scriptPath='tooling/android/guardiao_v4_api28_six_cold_evidence.py';
const ledger=JSON.parse(readFileSync(ledgerPath,'utf8'));
const source=readFileSync(scriptPath,'utf8');
function run(path=ledgerPath){return spawnSync('python3',[scriptPath,path],{encoding:'utf8',timeout:15000});}

test('six separately identified successful candidate first PDFs have bounded evidence and production BLOCK',()=>{
 const v=run();
 assert.equal(v.status,0,v.stderr);
 assert.match(v.stdout,/PASS \(LAB\): candidate API28 cold first PDF evidence snapshot for 6 trials/);
 assert.match(v.stdout,/chooser-under-5s=3 chooser-5-to-15s=3/);
 assert.match(v.stdout,/no historical APK tested/);
 assert.match(v.stdout,/BLOCK \(PRODUCTION\): approvedForProduction=false stableReleaseAllowed=false/);
 const ids=ledger.trials.map(x=>x.jobId);
 assert.equal(new Set(ids).size,6);
 assert.deepEqual(ledger.trials.map(x=>x.trial),[1,2,3,4,5,6]);
 assert.ok(ledger.trials.every(x=>x.originalReleaseTested===false));
});
test('forged job PASS, approval, candidate identity and missing receiver never validate',()=>{
 const dir=mkdtempSync(join(tmpdir(),'guardiao-cold-proof-'));
 const path=join(dir,'temp.json');
 try{
  const mutated=[
   {...ledger,trials:ledger.trials.slice(0,5)},
   {...ledger,trials:[...ledger.trials,{...ledger.trials[5],trial:7}]},
   {...ledger,trials:ledger.trials.map((x,i)=>i===0?{...x,jobId:42}:x)},
   {...ledger,trials:ledger.trials.map((x,i)=>i===1?{...x,cacheCleared:false}:x)},
   {...ledger,trials:ledger.trials.map((x,i)=>i===3?{...x,semanticTextVerified:false}:x)},
   {...ledger,trials:ledger.trials.map((x,i)=>i===2?{...x,originalReleaseTested:true}:x)},
   {...ledger,trials:ledger.trials.map((x,i)=>i===4?{...x,chooserObservationBand:'unknown'}:x)},
   {...ledger,approvedForProduction:true},
   {...ledger,stableReleaseAllowed:true},
   {...ledger,candidateApkSha256:ledger.historicalReleaseSha256},
   {...ledger,workflowConclusion:'failure'},
   {...ledger,ciContractsPassed:1466},
   {...ledger,extra:'unknown'},
  ];
  for (const [i,data] of mutated.entries()){
   writeFileSync(path,JSON.stringify(data));
   const p=run(path);
   assert.equal(p.status,1,'forged case '+i);
   assert.equal(p.stdout.trim(),'BLOCK (LAB): six-cold evidence snapshot cannot be verified');
  }
  writeFileSync(path,JSON.stringify(ledger).replace('"trial":1,','"trial":1,"trial":1,'));
  assert.equal(run(path).status,1,'duplicate JSON key rejected');
  writeFileSync(path,JSON.stringify(ledger)+'x'.repeat(12000));
  assert.equal(run(path).status,1,'oversized evidence rejected');
  const link=join(dir,'link.json');symlinkSync(path,link);
  assert.equal(run(link).status,1,'symlink rejected');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('evidence custody is read-only and cannot fetch, rebuild, upload, merge or claim original',()=>{
 assert.match(source,/CANDIDATE = "3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6"/);
 assert.match(source,/ORIGINAL = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"/);
 assert.match(source,/os\.O_NOFOLLOW/);
 assert.match(source,/object_pairs_hook=unique_keys/);
 assert.match(source,/BLOCK \(PRODUCTION\): approvedForProduction=false stableReleaseAllowed=false/);
 assert.doesNotMatch(source,/requests|urllib|socket|subprocess|upload-artifact|os\.walk|rglob\(|os\.system/);
 assert.doesNotMatch(source,/print\(contents\)|print\(value\)|print\(path\)/);
});

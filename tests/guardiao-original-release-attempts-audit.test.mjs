import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const dataPath='docs/security/P0_GUARDIAO_ORIGINAL_RELEASE_SIX_ATTEMPTS_AUDIT.json', scriptPath='tooling/android/guardiao_original_release_attempts_audit.py';
const source=readFileSync(scriptPath,'utf8');
const data=JSON.parse(readFileSync(dataPath,'utf8'));
function audit(sourcePath=dataPath){
 return spawnSync('python3',[scriptPath,sourcePath],{encoding:'utf8',timeout:15000});
}
test('historical report is exactly six attempts and always blocks production',()=>{
 const result=audit();
 assert.equal(result.status,0,result.stderr);
 const lines=result.stdout.trim().split(/\r?\n/);
 assert.equal(lines.filter(x=>x.includes('original-api28-attempt-')).length,6);
 assert.equal(lines.filter(x=>x.endsWith('pdf-receipt-unverified')).length,3);
 assert.equal(lines.filter(x=>x.endsWith('pdf-and-pair-verified')).length,1);
 assert.equal(lines.filter(x=>x.endsWith('pdf-verified-api26-artifact-missing')).length,2);
 assert.ok(lines.includes('BLOCK (PRODUCTION): original Release not approved'));
 assert.doesNotMatch(result.stdout,/file:\/\/|<html|content:\/\/|\/data\/user\//);
});
test('false pair PASS, false PDF PASS, forged API, missing fields and extra attempts fail closed',()=>{
 const dir=mkdtempSync(join(tmpdir(),'negresco-archive-audit-'));
 const file=join(dir,'cases.json');
 try{
  const invalid=[
   {...data,attempts:data.attempts.map(x=>x.attempt===1?{...x,api28:'success'}:x)},
   {...data,attempts:data.attempts.map(x=>x.attempt===4?{...x,pair:'success'}:x)},
   {...data,attempts:data.attempts.map(x=>x.attempt===2?{...x,downloadedArtifactApis:[28]}:x)},
   {...data,attempts:data.attempts.slice(0,5)},
   {...data,attempts:[...data.attempts,{...data.attempts[5],attempt:7}]},
   {...data,attempts:data.attempts.map(x=>x.attempt===6?{...x,api28JobId:123}:x)},
   {...data,runId:40808040079},
   {...data,originalApkSha256:'0'.repeat(64)},
   {...data,extra:'not allowed'},
   {...data,attempts:data.attempts.map(x=>x.attempt===6?{...x,api26:'failure'}:x)}
  ];
  for(const [i,v] of invalid.entries()){
   writeFileSync(file,JSON.stringify(v));
   const r=audit(file);
   assert.equal(r.status,1,'case '+i);
   assert.equal(r.stdout.trim(),'BLOCK (LAB): original six-attempt evidence ledger unverified');
  }
  writeFileSync(file,JSON.stringify(data).replace('"attempt":1,','"attempt":1,"attempt":1,'));
  assert.equal(audit(file).status,1,'duplicate JSON keys must be rejected');
  writeFileSync(file,JSON.stringify(data)+'x'.repeat(10000));
  assert.equal(audit(file).status,1,'oversized input rejected');
  const link=join(dir,'symlink.json');symlinkSync(file,link);
  assert.equal(audit(link).status,1,'symlinked source rejected');
 }finally{rmSync(dir,{force:true,recursive:true});}
});
test('offline parser does not inspect Android content or call network/logs',()=>{
 assert.match(source,/RUN_ID = 40808040078/);
 assert.match(source,/ORIGINAL_SHA = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"/);
 assert.match(source,/MAX_FILE = 8192/);
 assert.match(source,/object_pairs_hook=unique_keys/);
 assert.match(source,/BLOCK \(PRODUCTION\): original Release not approved/);
 assert.doesNotMatch(source,/subprocess|urllib|requests|socket|os\.system|os\.walk|rglob\(|adb|upload-artifact|open\([^)]*["']w/);
});

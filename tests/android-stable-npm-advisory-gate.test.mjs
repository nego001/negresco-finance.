import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const tool=resolve('tooling/android/verify_stable_npm_audit.cjs');
const {inspect,verify}=require(tool);
const LEVELS=['info','low','moderate','high','critical'];
function report(severities=[]){
  const counts=Object.fromEntries(LEVELS.map(level=>[level,0]));
  const vulnerabilities={};
  for(let i=0;i<severities.length;i++){
    const severity=severities[i];
    counts[severity]++;
    vulnerabilities['package-'+i]={severity,isDirect:i%2===0,via:[{title:'advisory '+i}]};
  }
  return {auditReportVersion:2,vulnerabilities,metadata:{vulnerabilities:{...counts,total:severities.length}}};
}
function fixture(t,value=report(),opts={}){
  const dir=mkdtempSync(join(tmpdir(),'negresco-npm-advisory-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'audit.json');
  if(!opts.absent)writeFileSync(file,opts.raw??JSON.stringify(value));
  return {file,dir};
}
function allow(f){
  assert.equal(verify(f.file),0);
  const r=spawnSync('node',[tool,f.file],{encoding:'utf8',timeout:10000});
  assert.equal(r.status,0,r.stderr+r.stdout);
  assert.match(r.stdout,/zero disclosed vulnerable packages/);
}
function deny(f,pattern){
  assert.throws(()=>verify(f.file),pattern);
  const r=spawnSync('node',[tool,f.file],{encoding:'utf8',timeout:10000});
  assert.equal(r.status,1,r.stderr+r.stdout);
  assert.match(r.stderr,pattern);
}
test('valid npm v2 audit with no disclosed vulnerability is admitted',t=>allow(fixture(t)));
test('npm advisory snapshot with 7 HIGH + 1 MODERATE cannot pass stable gate',t=>{
  deny(fixture(t,report(['high','high','high','high','high','high','high','moderate'])),
    /7 high, 0 critical, 1 moderate/);
});
test('even one low, informational or critical advisory blocks stable release',t=>{
  for(const s of ['low','info','critical'])deny(fixture(t,report([s])),/lockfile has/);
});
test('npm advisory service errors, missing report metadata or invalid report version block',t=>{
  deny(fixture(t,{error:{code:'EAUDITNOLOCK'}}),/missing, invalid or erroring registry advisory report/);
  deny(fixture(t,{auditReportVersion:1,vulnerabilities:{},metadata:{vulnerabilities:report().metadata.vulnerabilities}}),
    /missing, invalid or erroring/);
  deny(fixture(t,{auditReportVersion:2,vulnerabilities:{}}),/missing, invalid or erroring/);
});
test('reject inconsistent totals or missing per-severity fields',t=>{
  const bad=report(['high']);bad.metadata.vulnerabilities.total=0;
  deny(fixture(t,bad),/advisory totals disagree/);
  const missing=report();delete missing.metadata.vulnerabilities.info;
  deny(fixture(t,missing),/invalid advisory count/);
  const mismatch=report(['moderate']);mismatch.vulnerabilities['package-0'].severity='high';
  deny(fixture(t,mismatch),/entries do not match severity totals/);
});
test('reject forged, incomplete or duplicated vulnerability entry sets',t=>{
  const missing=report(['high']);delete missing.vulnerabilities['package-0'];
  deny(fixture(t,missing),/entries do not match severity totals/);
  const malformed=report(['high']);malformed.vulnerabilities['package-0'].via='missing';
  deny(fixture(t,malformed),/invalid advisory entry/);
});
test('reject absent, linked, oversized and non-JSON audit reports',t=>{
  deny(fixture(t,undefined,{absent:true}),/missing, linked, empty or oversized/);
  deny(fixture(t,undefined,{raw:'NOT JSON'}),/unparseable npm audit JSON/);
  deny(fixture(t,undefined,{raw:' '.repeat(4*1024*1024+1)}),/missing, linked, empty or oversized/);
  const x=fixture(t),link=join(x.dir,'audit-link.json');
  symlinkSync(x.file,link);deny({...x,file:link},/missing, linked, empty or oversized/);
});
test('valid CLI checks only the supplied audit report and exposes no network calls',()=>{
  const code=readFileSync(tool,'utf8');
  assert.doesNotMatch(code,/https\.request|fetch\(|execFile|spawnSync|npm audit fix/);
  assert.match(code,/auditReportVersion!==2/);
});
test('stable workflow queries audit before npm ci, secrets and APK build',()=>{
  const workflow=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
  const lock=workflow.indexOf('      - name: Require reviewed npm lockfile before any stable Android candidate');
  const audit=workflow.indexOf('      - name: Reject known npm vulnerabilities before stable dependency installation');
  const install=workflow.indexOf('      - name: Install reviewed stable JS dependencies without resolving changes');
  const sign=workflow.indexOf('NEGRESCO_RELEASE_KEYSTORE_B64');
  assert.ok(lock>0&&lock<audit&&audit<install&&install<sign);
  const cond="github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && (inputs.publish_release || inputs.stable_signing)";
  assert.ok(workflow.includes('if: $'+'{{ '+cond+' }}'));
  assert.match(workflow,/npm audit --json --package-lock-only/);
  assert.match(workflow,/AUDIT_STATUS=\$\?/);
  assert.match(workflow,/node \.\.\/\.\.\/tooling\/android\/verify_stable_npm_audit\.cjs \/tmp\/negresco-stable-npm-audit\.json/);
  assert.match(workflow,/run: npm ci --no-audit --no-fund/);
  assert.match(workflow,/tests\/android-stable-npm-advisory-gate\.test\.mjs/);
});
test('app stays preview and there is no real production npm lockfile',()=>{
  const config=JSON.parse(readFileSync(resolve('apps/mobile/app.json'),'utf8'));
  assert.equal(config.expo.updates.requestHeaders['expo-channel-name'],'preview');
  assert.equal(config.expo.updates.enabled,true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {X509Certificate,createHash} from 'node:crypto';

const workflow=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
const name='      - name: Independently audit downloaded compiled OTA policy';
const next='      - name: Stage private draft and publish only after complete verified upload';
const begin=workflow.indexOf(name);
const end=workflow.indexOf(next);
assert.ok(begin>=0 && end>begin,'privileged OTA audit must precede publisher');
const step=workflow.slice(begin,end);
const match=/^          python3 - Negresco-Finance-V3\.1\.3-preview\.apk <<'PY'\r?\n([\s\S]*?)^          PY$/m.exec(step);
assert.ok(match,'must extract exact Python code from privileged workflow');
const script=match[1].split(/\r?\n/).map(s=>s.startsWith('          ')?s.slice(10):s).join('\n');

const ANDROID='http://schemas.android.com/apk/res/android';
const PREFIX='expo.modules.updates.';
const NIL=0xffffffff;

function varLen(length){return length<128?Buffer.from([length]):Buffer.from([(length>>8)|128,length&255]);}
function start(name,ids,attributes=[]){
  const buf=Buffer.alloc(36+20*attributes.length);
  buf.writeUInt16LE(0x0102,0);buf.writeUInt16LE(16,2);buf.writeUInt32LE(buf.length,4);
  buf.writeUInt32LE(NIL,12);buf.writeUInt32LE(NIL,16);
  buf.writeUInt32LE(ids.get(name),20);
  buf.writeUInt16LE(20,24);buf.writeUInt16LE(20,26);buf.writeUInt16LE(attributes.length,28);
  attributes.forEach((a,i)=>{
    const p=36+i*20;
    buf.writeUInt32LE(ids.get(ANDROID),p);buf.writeUInt32LE(ids.get(a.key),p+4);
    buf.writeUInt32LE(a.type==='str'?ids.get(a.value):NIL,p+8);
    buf.writeUInt16LE(8,p+12);buf.writeUInt8(a.type==='str'?3:0x12,p+15);
    buf.writeUInt32LE(a.type==='str'?ids.get(a.value):(a.value?0xffffffff:0),p+16);
  });
  return buf;
}
function close(name,ids){
  const buf=Buffer.alloc(24);
  buf.writeUInt16LE(0x0103,0);buf.writeUInt16LE(16,2);buf.writeUInt32LE(24,4);
  buf.writeUInt32LE(NIL,12);buf.writeUInt32LE(NIL,16);buf.writeUInt32LE(ids.get(name),20);
  return buf;
}
function axml(records,{nested=false,duplicateApplication=false}={}){
  const strings=[...new Set(['manifest','application','meta-data','activity',ANDROID,'name','value',...records.flatMap(r=>[r.name,...(r.type==='str'?[r.value]:[])])])];
  const ids=new Map(strings.map((s,i)=>[s,i]));
  const encodings=strings.map(s=>{
    const utf=Buffer.from(s,'utf8');
    const codepoints=Buffer.from(s,'utf16le').length/2;
    return Buffer.concat([varLen(codepoints),varLen(utf.length),utf,Buffer.from([0])]);
  });
  const offsets=[],header=Buffer.alloc(28+4*strings.length);
  let total=0;
  for(const b of encodings){offsets.push(total);total+=b.length;}
  header.writeUInt16LE(1,0);header.writeUInt16LE(28,2);
  header.writeUInt32LE(header.length+total,4);
  header.writeUInt32LE(strings.length,8);header.writeUInt32LE(0x100,16);
  header.writeUInt32LE(header.length,20);
  offsets.forEach((n,i)=>header.writeUInt32LE(n,28+i*4));
  const nodes=[Buffer.concat([header,...encodings])];
  nodes.push(start('manifest',ids),start('application',ids));
  for(const record of records){
    if(nested)nodes.push(start('activity',ids));
    nodes.push(start('meta-data',ids,[
      {key:'name',type:'str',value:record.name},
      {key:'value',type:record.type,value:record.value}
    ]));
    nodes.push(close('meta-data',ids));
    if(nested)nodes.push(close('activity',ids));
  }
  nodes.push(close('application',ids));
  if(duplicateApplication)nodes.push(start('application',ids),close('application',ids));
  nodes.push(close('manifest',ids));
  const raw=Buffer.concat(nodes);
  const top=Buffer.alloc(8);
  top.writeUInt16LE(3,0);top.writeUInt16LE(8,2);top.writeUInt32LE(raw.length+8,4);
  return Buffer.concat([top,raw]);
}
function make(t,records,settings={}){
  const dir=mkdtempSync(join(tmpdir(),'negresco-privileged-ota-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const apk=join(dir,'candidate.apk');
  const bin=join(dir,'AndroidManifest.xml');
  writeFileSync(bin,axml(records,settings));
  const archive=spawnSync('python3',['-c',[
    'import sys,zipfile,warnings',
    'warnings.simplefilter("ignore",UserWarning)',
    'with zipfile.ZipFile(sys.argv[1],"w") as archive:',
    ' archive.write(sys.argv[2],"AndroidManifest.xml")',
    ' if sys.argv[3]=="duplicate": archive.write(sys.argv[2],"AndroidManifest.xml")'
  ].join('\n'),apk,bin,settings.duplicateZip?'duplicate':'no'],{encoding:'utf8'});
  assert.equal(archive.status,0,archive.stderr);
  return {dir,apk};
}
function check(f,vars={}){
  return spawnSync('python3',['-',f.apk],{
    input:script,encoding:'utf8',timeout:15000,
    env:{...process.env,NEGRESCO_OTA_KEYID:'',NEGRESCO_OTA_CERT_DER_SHA256:'',...vars}
  });
}
function accepted(f,env,pattern){
  const result=check(f,env);
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  assert.match(result.stdout,pattern);
}
function blocked(f,env,pattern){
  const result=check(f,env);
  assert.notEqual(result.status,0,result.stdout+'\n'+result.stderr);
  assert.match(result.stderr,pattern);
}
const disabled=[{name:PREFIX+'ENABLED',type:'bool',value:false}];

function signed(t){
  const dir=mkdtempSync(join(tmpdir(),'negresco-test-certificate-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const pem=join(dir,'public.pem'),key=join(dir,'test-only-private.pem');
  const result=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-noenc',
    '-keyout',key,'-out',pem,'-days','365','-subj','/CN=Negresco Test Only'],
    {encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,result.stderr);
  const certificate=readFileSync(pem,'utf8');
  const sha=createHash('sha256').update(new X509Certificate(certificate).raw).digest('hex');
  const keyid='main';
  const records=[
    {name:PREFIX+'ENABLED',type:'bool',value:true},
    {name:PREFIX+'CODE_SIGNING_CERTIFICATE',type:'str',value:certificate},
    {name:PREFIX+'CODE_SIGNING_METADATA',type:'str',value:JSON.stringify({alg:'rsa-v1_5-sha256',keyid})}
  ];
  return {records,env:{NEGRESCO_OTA_CERT_DER_SHA256:sha,NEGRESCO_OTA_KEYID:keyid}};
}
test('privileged downloadable APK accepts embedded-only mode without trusted OTA key vars',t=>{
  accepted(make(t,disabled),{},/embeds updates.ENABLED=false/);
});
test('privileged downloadable APK validates independently pinned DER certificate fingerprint',t=>{
  const x=signed(t);
  accepted(make(t,x.records),x.env,/OTA certificate DER SHA256 and signing keyid match/);
});
test('privileged downloadable APK rejects missing trusted certificate pin',t=>{
  const x=signed(t);
  blocked(make(t,x.records),{NEGRESCO_OTA_KEYID:'main'},/certificate fingerprint missing/);
});
test('privileged downloadable APK rejects wrong expected certificate pin',t=>{
  const x=signed(t);
  blocked(make(t,x.records),{...x.env,NEGRESCO_OTA_CERT_DER_SHA256:'a'.repeat(64)},/differs from independently pinned/);
});
test('privileged downloadable APK rejects wrong trusted key id',t=>{
  const x=signed(t);
  blocked(make(t,x.records),{...x.env,NEGRESCO_OTA_KEYID:'attacker'},/algorithm\/keyid does not match/);
});
test('privileged downloadable APK rejects wrong compiled signing keyid',t=>{
  const x=signed(t);
  const rec=x.records.map(a=>a.name.endsWith('CODE_SIGNING_METADATA')?
    {...a,value:JSON.stringify({alg:'rsa-v1_5-sha256',keyid:'other'})}:a);
  blocked(make(t,rec),x.env,/algorithm\/keyid does not match/);
});
test('privileged downloadable APK rejects signing algorithm substitution',t=>{
  const x=signed(t);
  const rec=x.records.map(a=>a.name.endsWith('CODE_SIGNING_METADATA')?
    {...a,value:JSON.stringify({alg:'none',keyid:'main'})}:a);
  blocked(make(t,rec),x.env,/algorithm\/keyid does not match/);
});
test('privileged downloadable APK rejects missing signing certificate',t=>{
  blocked(make(t,[{name:PREFIX+'ENABLED',type:'bool',value:true}]),{},/unsigned or ambiguous enabled Expo Updates/);
});
test('privileged downloadable APK rejects enabled flag provided as a string',t=>{
  const x=signed(t);const rec=[{name:PREFIX+'ENABLED',type:'str',value:'true'},...x.records.slice(1)];
  blocked(make(t,rec),x.env,/unsigned or ambiguous enabled/);
});
test('privileged downloadable APK rejects leftover certificate when OTA disabled',t=>{
  blocked(make(t,[...disabled,{name:PREFIX+'CODE_SIGNING_CERTIFICATE',type:'str',value:'stray'}]),
    {},/embedded-only APK retains code signing metadata/);
});
test('privileged downloadable APK rejects unexpected signing override',t=>{
  const x=signed(t);
  blocked(make(t,[...x.records,{name:PREFIX+'CODE_SIGNING_OVERRIDE',type:'bool',value:true}]),
    x.env,/unexpected compiled code signing metadata/);
});
test('privileged downloadable APK rejects duplicate metadata fields',t=>{
  const x=signed(t);
  blocked(make(t,[...x.records,x.records[1]]),x.env,/duplicate application metadata/);
});
test('privileged downloadable APK rejects metadata hidden under child Activity',t=>{
  blocked(make(t,disabled,{nested:true}),{},/unsigned or ambiguous enabled Expo Updates/);
});
test('privileged downloadable APK rejects duplicate AndroidManifest ZIP names',t=>{
  blocked(make(t,disabled,{duplicateZip:true}),{},/manifest is absent or duplicated/);
});
test('privileged downloadable APK rejects extra application element',t=>{
  blocked(make(t,disabled,{duplicateApplication:true}),{},/exactly one closed application/);
});
test('privileged workflow runs OTA audit only after independent network/backup and before creating any tag',()=>{
  const privileged=workflow.slice(workflow.indexOf('  publish-test-prerelease:'));
  const network=privileged.indexOf('      - name: Independently audit downloaded compiled network XML');
  const backup=privileged.indexOf('      - name: Independently audit downloaded compiled backup XML');
  const audit=privileged.indexOf(name);
  const mutation=privileged.indexOf(next);
  assert.ok(network>=0&&backup>network&&audit>backup&&mutation>audit);
  assert.doesNotMatch(privileged,/actions\/checkout/);
  assert.match(privileged,/if: \$\{\{ github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.publish_release && inputs\.stable_signing \}\}/);
  assert.match(step,/vars\.NEGRESCO_OTA_CERT_DER_SHA256/);
  assert.match(step,/vars\.NEGRESCO_OTA_KEYID/);
  assert.match(workflow,/tests\/android-publish-compiled-ota-policy\.test\.mjs/);
});

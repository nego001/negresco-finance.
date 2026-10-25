import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,chmodSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const workflow=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
const source=readFileSync(resolve('tooling/android/verify_compiled_ota_runtime.py'),'utf8');
const publisher=workflow.slice(workflow.indexOf('  publish-test-prerelease:'));
const start='      - name: Independently audit downloaded compiled OTA runtime resource';
const before='      - name: Independently audit downloaded compiled OTA policy';
const after='      - name: Stage private draft and publish only after complete verified upload';
const offset=publisher.indexOf(start);
const end=publisher.indexOf(after);
const step=publisher.slice(offset,end);
const match=/python3 - Negresco-Finance-V3\.1\.3-preview\.apk "\$BUILD_TOOLS\/aapt2" 3\.1\.3 <<'PY'\r?\n([\s\S]*?)^          PY$/m.exec(step);
assert.ok(match,'privileged publisher must embed its own Python verifier');
const pythonCode=match[1].split(/\r?\n/).map(line=>line.startsWith('          ')?line.slice(10):line).join('\n').trimEnd()+'\n';
const RID='0x7f120045',VERSION='3.1.3';
const KEY='expo.modules.updates.EXPO_RUNTIME_VERSION';
const goodManifest=[
  'E: manifest (line=2)',
  '  E: application (line=8)',
  '    E: meta-data (line=21)',
  '      A: android:name(0x01010003)="'+KEY+'" (Raw: "'+KEY+'")',
  '      A: android:value(0x01010024)=@'+RID+' (Raw: "@string/expo_runtime_version")',
  '    E: activity (line=27)'
].join('\n');
const goodResources=[
  'Package name=com.negresco.finance id=7f',
  '  type string id=12 entryCount=99',
  '    resource '+RID+' string/expo_runtime_version',
  '      () "3.1.3"',
  '    resource 0x7f120046 string/app_name',
  '      () "Negresco Finance"'
].join('\n');
function binaryManifest(options={}){
  const uri='http://schemas.android.com/apk/res/android';
  const meta='expo.modules.updates.EXPO_RUNTIME_VERSION';
  const names=['manifest','application','meta-data',uri,'name','value',meta,'3.1.3'];
  const ids=new Map(names.map((v,i)=>[v,i]));
  const n8=value=>value<128?Buffer.from([value]):Buffer.from([(value>>8)|0x80,value&255]);
  const encoded=names.map(s=>{
    const b=Buffer.from(s,'utf8');
    return Buffer.concat([n8(s.length),n8(b.length),b,Buffer.from([0])]);
  });
  const base=28+names.length*4,pool=Buffer.alloc(base);
  pool.writeUInt16LE(1,0);pool.writeUInt16LE(28,2);
  pool.writeUInt32LE(base+encoded.reduce((n,b)=>n+b.length,0),4);
  pool.writeUInt32LE(names.length,8);pool.writeUInt32LE(0x100,16);
  pool.writeUInt32LE(base,20);
  let offset=0;
  encoded.forEach((b,i)=>{pool.writeUInt32LE(offset,28+i*4);offset+=b.length;});
  const chunks=[Buffer.concat([pool,...encoded])];
  const NO=0xffffffff;
  const begin=(tag,attrs=[])=>{
    const b=Buffer.alloc(36+20*attrs.length);
    b.writeUInt16LE(0x0102,0);b.writeUInt16LE(16,2);b.writeUInt32LE(b.length,4);
    b.writeUInt32LE(NO,12);b.writeUInt32LE(NO,16);
    b.writeUInt32LE(ids.get(tag),20);b.writeUInt16LE(20,24);
    b.writeUInt16LE(20,26);b.writeUInt16LE(attrs.length,28);
    attrs.forEach((a,i)=>{
      const p=36+20*i;b.writeUInt32LE(ids.get(uri),p);
      b.writeUInt32LE(ids.get(a.key),p+4);
      const str=a.type===3;
      b.writeUInt32LE(str?ids.get(a.value):NO,p+8);
      b.writeUInt16LE(8,p+12);b.writeUInt8(a.type,p+15);
      b.writeUInt32LE(str?ids.get(a.value):a.value,p+16);
    });
    chunks.push(b);
  };
  const end=tag=>{
    const b=Buffer.alloc(24);
    b.writeUInt16LE(0x0103,0);b.writeUInt16LE(16,2);b.writeUInt32LE(24,4);
    b.writeUInt32LE(NO,12);b.writeUInt32LE(NO,16);
    b.writeUInt32LE(ids.get(tag),20);chunks.push(b);
  };
  begin('manifest');begin('application');
  if(!options.omitRuntime){
    const fields=[
      {key:'name',type:3,value:meta},
      options.literalRuntime?{key:'value',type:3,value:'3.1.3'}:
        {key:'value',type:1,value:parseInt(options.manifestRef??'0x7f120045',16)}
    ];
    begin('meta-data',fields);end('meta-data');
    if(options.duplicateRuntime){begin('meta-data',fields);end('meta-data');}
  }
  end('application');end('manifest');
  const data=Buffer.concat(chunks),header=Buffer.alloc(8);
  header.writeUInt16LE(3,0);header.writeUInt16LE(8,2);
  header.writeUInt32LE(data.length+8,4);
  return Buffer.concat([header,data]);
}


function fixture(t,changes={}){
  const temp=mkdtempSync(join(tmpdir(),'negresco-privileged-runtime-'));
  t.after(()=>rmSync(temp,{recursive:true,force:true}));
  const bin=join(temp,'signed.apk'),aapt=join(temp,'aapt2');
  const manifestFile=join(temp,'compiled-manifest.xml');
  writeFileSync(manifestFile,binaryManifest(changes));
  const zipCode=[
    'import sys,zipfile,warnings',
    'warnings.filterwarnings("ignore",category=UserWarning)',
    'with zipfile.ZipFile(sys.argv[1],"w") as archive:',
    ' archive.write(sys.argv[2],"AndroidManifest.xml")',
    ' archive.writestr("resources.arsc",b"ABCDEFGH")',
    ' if sys.argv[3]=="duplicate": archive.writestr("resources.arsc",b"ABCDEFGH")'
  ].join('\n');
  const prep=spawnSync('python3',['-c',zipCode,bin,manifestFile,changes.duplicate?'duplicate':'no'],{encoding:'utf8'});
  assert.equal(prep.status,0,prep.stderr);
  writeFileSync(aapt,[
    '#!/usr/bin/env python3',
    'import os,sys',
    'if sys.argv[1:3]!=["dump","xmltree"] and sys.argv[1:3]!=["dump","resources"]: sys.exit(90)',
    'if sys.argv[2]=="xmltree":',
    ' if sys.argv[4:]!=["--file","AndroidManifest.xml"]: sys.exit(91)',
    ' print(os.environ["MOCK_MANIFEST"])',
    'else: print(os.environ["MOCK_RESOURCES"])'
  ].join('\n')+'\n',{mode:0o755});
  chmodSync(aapt,0o755);
  return {bin,aapt,manifest:changes.manifest??goodManifest,
    resources:changes.resources??goodResources};
}
function execute(f){
  return spawnSync('python3',['-',f.bin,f.aapt,VERSION],{
    encoding:'utf8',input:pythonCode,timeout:10000,
    env:{...process.env,MOCK_MANIFEST:f.manifest,MOCK_RESOURCES:f.resources}
  });
}
function approved(f){
  const p=execute(f);
  assert.equal(p.status,0,p.stderr+p.stdout);
  assert.match(p.stdout,/compiled APK OTA runtime resource 3.1.3/);
}
function denied(f,pattern){
  const p=execute(f);
  assert.notEqual(p.status,0,p.stderr+p.stdout);
  assert.match(p.stderr,pattern);
}
test('privileged publisher carries an exact inline copy of the compiled verifier',()=>{
  assert.equal(pythonCode,source,'publisher may not trust file scripts supplied by an artifact');
  assert.ok(offset>publisher.indexOf(before) && end>offset);
  assert.doesNotMatch(publisher,/actions\/checkout@/);
  assert.match(publisher,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.publish_release && inputs\.stable_signing/);
});
test('privileged auditor approves an exact nonlocalized 3.1.3 compiled resource',t=>approved(fixture(t)));
test('privileged auditor blocks a localized OTA runtime in downloaded APK',t=>{
  denied(fixture(t,{resources:goodResources.replace('() "3.1.3"','() "3.1.3"\n      (pt-rBR) "9.9.9"')}),
    /exactly one default nonlocalized value/);
});
test('privileged auditor blocks a different runtime in APK resources',t=>{
  denied(fixture(t,{resources:goodResources.replace('() "3.1.3"','() "3.1.2"')}),
    /exactly one default nonlocalized value/);
});
test('privileged auditor blocks altered manifest ID',t=>{
  denied(fixture(t,{manifestRef:'0x7f120055'}),
    /resource ID disagree/);
});
test('privileged auditor blocks missing runtime metadata in manifest',t=>{
  denied(fixture(t,{omitRuntime:true}),
    /typed binary application OTA runtime reference/);
});
test('privileged auditor blocks duplicate resources.arsc in downloaded artifact',t=>{
  denied(fixture(t,{duplicate:true}),/resources.arsc must be unique/);
});
test('privileged auditor blocks duplicate runtime definitions',t=>{
  const conflict='\n    resource '+RID+' string/expo_runtime_version\n      () "3.1.3"';
  denied(fixture(t,{resources:goodResources+conflict}),/duplicated compiled OTA runtime resource/);
});
test('privileged auditor runs after other download checks and before creating a draft release',()=>{
  const backup=publisher.indexOf('      - name: Independently audit downloaded compiled backup XML');
  const ota=publisher.indexOf('      - name: Independently audit downloaded compiled OTA policy');
  assert.ok(backup>0 && ota>backup && offset>ota && end>offset);
  assert.match(step,/test -x "\$BUILD_TOOLS\/aapt2"/);
  assert.match(workflow,/tests\/android-publisher-ota-runtime-proof\.test\.mjs/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,rmSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const script=resolve('tooling/android/verify_compiled_ota_runtime.py');
const version='3.1.3',rid='0x7f120045',name='expo.modules.updates.EXPO_RUNTIME_VERSION';
const manifest=[
 'E: manifest (line=2)',
 '  E: application (line=8)',
 '    E: meta-data (line=21)',
 '      A: android:name(0x01010003)="'+name+'" (Raw: "'+name+'")',
 '      A: android:value(0x01010024)=@'+rid+' (Raw: "@string/expo_runtime_version")',
 '    E: activity (line=27)'
].join('\n');
const resources=[
 'Binary APK',
 'Package name=com.negresco.finance id=7f',
 '  type string id=12 entryCount=99',
 '    resource '+rid+' string/expo_runtime_version',
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

function trial(t,mod={}){
  const dir=mkdtempSync(join(tmpdir(),'negresco-compiled-runtime-'));
  t.after(()=>rmSync(dir,{force:true,recursive:true}));
  const apk=join(dir,'test.apk');
  const manifestFile=join(dir,'compiled-manifest.xml');
  writeFileSync(manifestFile,binaryManifest(mod));
  const aapt2=join(dir,'aapt2');
  const zip=spawnSync('python3',['-c',[
    'import sys,zipfile,warnings',
    'warnings.filterwarnings("ignore",category=UserWarning)',
    'with zipfile.ZipFile(sys.argv[1],"w") as archive:',
    ' archive.write(sys.argv[2],"AndroidManifest.xml")',
    ' archive.writestr("resources.arsc",b"ABCDEFGH")',
    ' if sys.argv[3]=="duplicate": archive.writestr("resources.arsc",b"ABCDEFGH")'
  ].join('\n'),apk,manifestFile,mod.duplicate?'duplicate':'safe'],{encoding:'utf8'});
  assert.equal(zip.status,0,zip.stderr);
  writeFileSync(aapt2,[
    '#!/usr/bin/env python3',
    'import os,sys',
    'if sys.argv[1:3]!=["dump","xmltree"] and sys.argv[1:3]!=["dump","resources"]: sys.exit(70)',
    'if sys.argv[2]=="xmltree":',
    ' if sys.argv[4:]!=["--file","AndroidManifest.xml"]:sys.exit(71)',
    ' print(os.environ["TEST_MANIFEST"])',
    'else: print(os.environ["TEST_RESOURCES"])'
  ].join('\n')+'\n',{mode:0o755});
  chmodSync(aapt2,0o755);
  return {dir,apk,aapt2,manifest:mod.manifest??manifest,
    resources:mod.resources??resources,version:mod.version??version};
}
function run(f){
  return spawnSync('python3',[script,f.apk,f.aapt2,f.version],{
    encoding:'utf8',timeout:10000,env:{...process.env,TEST_MANIFEST:f.manifest,TEST_RESOURCES:f.resources}
  });
}
function allows(f){
  const r=run(f);assert.equal(r.status,0,r.stderr+r.stdout);
  assert.match(r.stdout,/exactly one nonlocalized value/);
}
function rejects(f,msg){
  const r=run(f);assert.notEqual(r.status,0,r.stdout+r.stderr);
  assert.match(r.stderr,msg);
}
test('AAPT2 manifest resource ID must map to one default nonlocalized runtime',t=>allows(trial(t)));
test('AAPT2 accepts canonical string8 and string16 renderings',t=>{
  const f=trial(t,{resources:resources.replace('() "3.1.3"','() (string8) "3.1.3"')});
  allows(f);
  allows(trial(t,{resources:resources.replace('() "3.1.3"','() (string16) "3.1.3"')}));
});
test('compiled runtime guard rejects French locale override',t=>{
  rejects(trial(t,{resources:resources.replace('() "3.1.3"','() "3.1.3"\n      (fr) "9.9.9"')}),/exactly one default nonlocalized/);
});
test('compiled runtime guard rejects even identical localized duplicate',t=>{
  rejects(trial(t,{resources:resources.replace('() "3.1.3"','() "3.1.3"\n      (pt-rBR) "3.1.3"')}),/exactly one default nonlocalized/);
});
test('compiled runtime guard rejects package resource version mismatch',t=>{
  rejects(trial(t,{resources:resources.replace('() "3.1.3"','() "1.0.0"')}),/exactly one default nonlocalized/);
});
test('compiled runtime guard rejects a substituted resource ID',t=>{
  rejects(trial(t,{resources:resources.replace(rid,'0x7f120099')}),/resource ID disagree/);
});
test('compiled runtime guard rejects renamed resource',t=>{
  rejects(trial(t,{resources:resources.replace('string/expo_runtime_version','string/other_runtime')}),/resource ID disagree/);
});
test('compiled runtime guard rejects duplicate table definitions',t=>{
  const dup='    resource '+rid+' string/expo_runtime_version\n      () "3.1.3"';
  rejects(trial(t,{resources:resources+'\n'+dup}),/duplicated compiled OTA runtime resource/);
});
test('compiled runtime guard rejects missing runtime meta-data',t=>{
  rejects(trial(t,{omitRuntime:true}),/exactly one compiled application/);
});
test('compiled runtime guard rejects literal AndroidManifest runtime instead of a resource',t=>{
  rejects(trial(t,{literalRuntime:true}),/typed resource reference/);
});
test('compiled runtime guard rejects duplicated runtime metadata',t=>{
  rejects(trial(t,{duplicateRuntime:true}),/duplicate application metadata/);
});
test('compiled runtime guard rejects conflicting version command argument',t=>{
  rejects(trial(t,{version:'3.1.2'}),/exactly one default nonlocalized/);
});
test('compiled runtime guard rejects invalid version format',t=>{
  rejects(trial(t,{version:'anything goes'}),/explicit pinned appVersion/);
});
test('compiled runtime guard rejects malformed resources configuration',t=>{
  rejects(trial(t,{resources:resources.replace('() "3.1.3"','() @0x7f000000')}),/unexpected or indirect OTA runtime table value/);
});
test('compiled runtime guard rejects duplicate resources.arsc archive entries',t=>{
  rejects(trial(t,{duplicate:true}),/resources.arsc must be unique/);
});
test('compiled runtime audit must execute before APK artifact upload',()=>{
  const wf=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
  const segment=wf.slice(wf.indexOf('  build-test-apk:'),wf.indexOf('  publish-test-prerelease:'));
  const check=segment.indexOf('      - name: Audit compiled Expo OTA runtime resource');
  const upload=segment.indexOf('      - name: Upload standalone APK');
  assert.ok(check>=0&&upload>check);
  assert.match(segment,/verify_compiled_ota_runtime\.py "\$APK" "\$BUILD_TOOLS\/aapt2"/);
  assert.match(wf,/tooling\/android\/verify_compiled_ota_runtime\.py/);
  assert.match(wf,/tests\/android-compiled-ota-runtime\.test\.mjs/);
});

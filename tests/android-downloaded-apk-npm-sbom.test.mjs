import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const tool=resolve('tooling/android/npm_lock_cyclonedx_sbom.cjs');
const {sbom,capture,verify,purl}=require(tool);
const integrity='sha512-'+Buffer.alloc(64,7).toString('base64');
const pkg=(name,version='1.2.3',other={})=>({
  version,resolved:'https://registry.npmjs.org/'+name+'/-/'+name.split('/').at(-1)+'-'+version+'.tgz',
  integrity,license:'MIT',...other
});
function lock(){
  return {
    name:'@negresco/mobile',version:'3.1.3',lockfileVersion:3,
    packages:{
      '':{name:'@negresco/mobile',version:'3.1.3'},
      'node_modules/postcss':pkg('postcss','8.5.23'),
      'node_modules/image-size':pkg('image-size','2.0.3',{dev:true}),
      'node_modules/@expo/code-signing-certificates':pkg('@expo/code-signing-certificates','0.0.6'),
      'node_modules/expo/node_modules/semver':pkg('semver','7.1.0',{optional:true,license:'ISC'})
    }
  };
}
function fixture(t,change){
  const folder=mkdtempSync(join(tmpdir(),'negresco-sbom-'));
  t.after(()=>rmSync(folder,{recursive:true,force:true}));
  const source=join(folder,'package-lock.json'),bom=join(folder,'inventory.json');
  const doc=lock();change?.(doc);
  writeFileSync(source,JSON.stringify(doc));
  return {folder,source,bom};
}
function allow(f){
  capture(f.source,f.bom);
  verify(f.source,f.bom);
  const file=JSON.parse(readFileSync(f.bom,'utf8'));
  assert.equal(file.components.length,4);
  assert.equal(file.metadata.properties[2].value,createHash('sha256').update(readFileSync(f.source)).digest('hex'));
  return file;
}
function deny(f,message){
  assert.throws(()=>capture(f.source,f.bom),message);
  const result=spawnSync('node',[tool,'capture',f.source,f.bom],{encoding:'utf8',timeout:10000});
  assert.equal(result.status,1,result.stdout+result.stderr);
  assert.match(result.stderr,message);
}
test('CycloneDX 1.6 inventory is complete, deterministic and bound to lock SHA',t=>{
  const f=fixture(t);
  const bom=allow(f);
  assert.equal(bom.bomFormat,'CycloneDX');
  assert.equal(bom.specVersion,'1.6');
  assert.equal(bom.metadata.properties[0].value,'unreviewed-npm-build-graph-not-apk-runtime');
  assert.equal(bom.metadata.properties[1].value,'false');
  assert.deepEqual(bom.components.map(c=>c['bom-ref']),Object.keys(lock().packages).slice(1).sort().map(p=>'npm-lock:'+p));
  assert.equal(bom.components[0].hashes[0].alg,'SHA-512');
  assert.equal(bom.components[0].hashes[0].content,Buffer.alloc(64,7).toString('hex'));
});
test('scoped npm package and nested dependency paths remain distinct',t=>{
  const report=allow(fixture(t));
  const scoped=report.components.find(c=>c.name==='@expo/code-signing-certificates');
  const nested=report.components.find(c=>c['bom-ref']==='npm-lock:node_modules/expo/node_modules/semver');
  assert.equal(scoped.purl,'pkg:npm/%40expo/code-signing-certificates@0.0.6');
  assert.equal(nested.name,'semver');
  assert.equal(nested.properties.find(p=>p.name==='negresco:npm-optional').value,'true');
  assert.equal(purl('@negresco/mobile','3.1.3'),'pkg:npm/%40negresco/mobile@3.1.3');
});
test('consecutive SBOM generation produces identical bytes',t=>{
  const f=fixture(t);capture(f.source,f.bom);
  const data=readFileSync(f.bom);
  rmSync(f.bom);
  capture(f.source,f.bom);
  assert.deepEqual(readFileSync(f.bom),data);
});
test('SBOM integrity is independently checked against exact downloaded npm lock',t=>{
  const f=fixture(t);capture(f.source,f.bom);
  const doc=JSON.parse(readFileSync(f.source,'utf8'));
  doc.packages['node_modules/postcss'].version='8.5.24';
  writeFileSync(f.source,JSON.stringify(doc));
  assert.throws(()=>verify(f.source,f.bom),/downloaded SBOM differs/);
});
test('tampered SBOM component versions, hashes or approval metadata are detected',t=>{
  for(const mutate of [
    x=>x.components[0].version='0.0.0',
    x=>x.components[0].hashes[0].content='0'.repeat(128),
    x=>x.metadata.properties[1].value='true',
    x=>x.components.pop()
  ]){
    const f=fixture(t);capture(f.source,f.bom);
    const report=JSON.parse(readFileSync(f.bom,'utf8'));
    mutate(report);writeFileSync(f.bom,JSON.stringify(report));
    assert.throws(()=>verify(f.source,f.bom),/downloaded SBOM differs/);
  }
});
test('off-registry, HTTP and credential-bearing tarballs are refused',t=>{
  for(const resolved of [
    'https://evil.example/npm/archive.tgz',
    'http://registry.npmjs.org/postcss/-/postcss-8.5.23.tgz',
    'https://user:secret@registry.npmjs.org/postcss.tgz',
    'file:../postcss.tgz'
  ])deny(fixture(t,l=>l.packages['node_modules/postcss'].resolved=resolved),/unsafe registry URL|unparseable package registry URL/);
});
test('missing, truncated and SHA-1 integrity values fail closed',t=>{
  for(const integrity of [undefined,'sha1-bogus','sha512-xyz']){
    deny(fixture(t,l=>l.packages['node_modules/postcss'].integrity=integrity),/package lacks pinned SHA-512 integrity/);
  }
});
test('npm local links, in-bundle and malformed package names cannot enter inventory',t=>{
  deny(fixture(t,l=>l.packages['node_modules/postcss'].link=true),/unexpected npm lock package record/);
  deny(fixture(t,l=>l.packages['node_modules/postcss'].inBundle=true),/unexpected npm lock package record/);
  deny(fixture(t,l=>l.packages['node_modules/..']=pkg('other')),/invalid npm lock package path/);
});
test('duplicate JSON keys in malicious npm lockfile are rejected',t=>{
  const f=fixture(t);
  const raw=readFileSync(f.source,'utf8').replace('"lockfileVersion":3','"lockfileVersion":3,"lockfileVersion":3');
  writeFileSync(f.source,raw);
  deny(f,/invalid or duplicate-key lockfile JSON/);
});
test('symlinked npm lock or SBOM are rejected',t=>{
  const f=fixture(t),link=join(f.folder,'link.json');
  symlinkSync(f.source,link);
  assert.throws(()=>capture(link,f.bom),/missing, linked or oversized/);
  capture(f.source,f.bom);
  const alt=join(f.folder,'sbom-link.json');
  symlinkSync(f.bom,alt);
  assert.throws(()=>verify(f.source,alt),/missing, linked or oversized/);
});
test('can neither silently overwrite existing SBOM nor accept wrong mobile identity',t=>{
  const f=fixture(t);capture(f.source,f.bom);
  assert.throws(()=>capture(f.source,f.bom),/refuse to overwrite/);
  deny(fixture(t,d=>d.name='attacker'),/wrong npm v3 lockfile identity/);
});
test('independent CI regenerates exactly the same npm SBOM after downloading APK',()=>{
  const wf=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
  assert.match(wf,/lab\/p01-downloaded-apk-npm-sbom-v1/);
  const build=wf.slice(wf.indexOf('  assemble-combined-lab-apk:'),wf.indexOf('  reverify-downloaded-combined-apk:'));
  const check=wf.slice(wf.indexOf('  reverify-downloaded-combined-apk:'));
  assert.match(build,/npm_lock_cyclonedx_sbom\.cjs capture/);
  assert.match(build,/apps\/mobile\/NPM_BUILD_GRAPH_CYCLONEDX\.json/);
  assert.match(build,/COMBINED_APK_PROVENANCE\.json/);
  assert.match(check,/npm_lock_cyclonedx_sbom\.cjs verify/);
  assert.match(check,/combined-apk\/NPM_BUILD_GRAPH_CYCLONEDX\.json/);
  assert.ok(check.indexOf('verify_combined_apk_provenance.cjs verify')<check.indexOf('npm_lock_cyclonedx_sbom.cjs verify'));
  assert.ok(check.indexOf('npm_lock_cyclonedx_sbom.cjs verify')<check.indexOf('verify_compiled_ota_runtime.py'));
  assert.match(check,/permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(check,/npm ci|npm install|contents: write|secrets\.|gh release/);
});

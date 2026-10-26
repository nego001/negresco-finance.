import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,symlinkSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const require=createRequire(import.meta.url);
const tool=resolve('tooling/android/gradle_release_runtime_inventory.cjs');
const {parseReport,generate,capture,verify}=require(tool);
const commit='1'.repeat(40);
const graph=[
  '> Task :app:dependencies',
  '',
  '------------------------------------------------------------',
  "Project ':app'",
  '------------------------------------------------------------',
  'releaseRuntimeClasspath - Runtime classpath of release.',
  '+--- project :expo',
  '|    +--- com.facebook.react:react-android:0.81.5',
  '|    |    +--- androidx.core:core:1.14.0 -> 1.15.0',
  '|    |    +--- com.squareup.okio:okio:3.9.0 (c)',
  '|    |    \\--- org.jetbrains.kotlin:kotlin-stdlib:2.0.21',
  '+--- project :react-native-screens',
  '|    +--- androidx.core:core:1.15.0 (*)',
  '|    \\--- androidx.activity:activity:1.9.3',
  '\\--- com.squareup.okhttp3:okhttp:4.12.0',
  '     \\--- com.squareup.okio:okio:3.9.0',
  '',
  'BUILD SUCCESSFUL in 17s',
  ''
].join('\n');
function fixture(t,change){
  const dir=mkdtempSync(join(tmpdir(),'negresco-gradle-runtime-'));
  t.after(()=>rmSync(dir,{force:true,recursive:true}));
  const report=join(dir,'gradle.txt'),apk=join(dir,'app-release.apk'),inventory=join(dir,'inventory.json');
  writeFileSync(report,change?.report??graph);
  writeFileSync(apk,change?.apk??Buffer.from('synthetic Android APK content used for unit checks'));
  return {dir,report,apk,inventory};
}
function deny(f,re){
  assert.throws(()=>capture(f.report,f.apk,commit,f.inventory),re);
  const run=spawnSync('node',[tool,'capture',f.report,f.apk,commit,f.inventory],{encoding:'utf8',timeout:10000});
  assert.equal(run.status,1,run.stderr);
  assert.match(run.stderr,re);
}
test('parse Gradle releaseRuntimeClasspath, versions, projects, and constraints',()=>{
  const p=parseReport(graph);
  assert.equal(p.configuration,'releaseRuntimeClasspath');
  assert.equal(p.components.length,5);
  assert.deepEqual(p.localProjects,[':expo',':react-native-screens']);
  assert.equal(p.selectionEdgeCount,8);
  assert.equal(p.constraintEdgeCount,1);
  assert.equal(p.parseErrors,0);
  assert.deepEqual(p.components.find(x=>x.name==='core'),{
    group:'androidx.core',name:'core',version:'1.15.0',coordinate:'androidx.core:core:1.15.0'
  });
});
test('capture and verify raw native graph bound to exact APK and source commit',t=>{
  const f=fixture(t);
  capture(f.report,f.apk,commit,f.inventory);
  verify(f.report,f.apk,commit,f.inventory);
  const d=JSON.parse(readFileSync(f.inventory,'utf8'));
  assert.equal(d.sourceCommit,commit);
  assert.equal(d.approvedForProduction,false);
  assert.match(d.scope,/NOT APK CONTAINED COMPONENTS/);
  assert.equal(d.apkSha256,createHash('sha256').update(readFileSync(f.apk)).digest('hex'));
  assert.equal(d.gradleReportSha256,createHash('sha256').update(readFileSync(f.report)).digest('hex'));
  assert.equal(d.components.length,5);
});
test('captured native graph is deterministic with no timestamps/random values',t=>{
  const f=fixture(t);
  assert.deepEqual(generate(f.report,f.apk,commit),generate(f.report,f.apk,commit));
});
test('tampering downloaded APK, raw Gradle output, or generated inventory is refused',t=>{
  for(const which of ['apk','report','inventory']){
    const f=fixture(t);capture(f.report,f.apk,commit,f.inventory);
    writeFileSync(f[which],Buffer.concat([readFileSync(f[which]),Buffer.from('\nmalicious bytes')]));
    assert.throws(()=>verify(f.report,f.apk,commit,f.inventory),/downloaded Gradle graph\/APK\/SHA differs/);
  }
});
test('wrong Git SHA or forged production approval is refused',t=>{
  const f=fixture(t);capture(f.report,f.apk,commit,f.inventory);
  assert.throws(()=>verify(f.report,f.apk,'2'.repeat(40),f.inventory),/differs from producer/);
  const doc=JSON.parse(readFileSync(f.inventory,'utf8'));
  doc.approvedForProduction=true;
  writeFileSync(f.inventory,JSON.stringify(doc));
  assert.throws(()=>verify(f.report,f.apk,commit,f.inventory),/differs from producer/);
});
test('malformed Gradle report, failed or unresolved dependency blocks',t=>{
  for(const line of [
    '     \\--- androidx.core:core:1.15.0 FAILED',
    '     \\--- com.google:missing:1.0.0 (n)',
    '     +--- org.demo:artifact:+',
    '     +--- evil dependency from nowhere',
    '     +--- androidx.core:core:1.15.+'
  ]){
    const out=graph.replace('     \\--- com.squareup.okio:okio:3.9.0',line);
    deny(fixture(t,{report:out}),/could not resolve|marked dependency unresolved|concrete Maven component version|unparsed Gradle classpath/);
  }
});
test('reject wrong or duplicated configuration heading',t=>{
  deny(fixture(t,{report:graph.replace('releaseRuntimeClasspath -','debugRuntimeClasspath -')}),/missing or duplicate/);
  deny(fixture(t,{report:graph+'\nreleaseRuntimeClasspath - Unexpected duplicate.\n'}),/missing or duplicate/);
});
test('reject binary and ANSI report escapes',t=>{
  deny(fixture(t,{report:graph+'\x1b[31m'}),/unsafe ANSI\/binary/);
  deny(fixture(t,{report:graph+'\0'}),/unsafe ANSI\/binary/);
});
test('reject Gradle report without native dependencies',t=>{
  const empty='releaseRuntimeClasspath - configuration\nNo dependencies\nBUILD SUCCESSFUL\n';
  deny(fixture(t,{report:empty}),/empty or missing resolved native libraries/);
});
test('reject symlinked source or evidence and existing overwrite',t=>{
  const f=fixture(t),link=join(f.dir,'linked.txt');
  symlinkSync(f.report,link);
  assert.throws(()=>generate(link,f.apk,commit),/missing, linked, nonregular or oversized/);
  capture(f.report,f.apk,commit,f.inventory);
  assert.throws(()=>capture(f.report,f.apk,commit,f.inventory),/refusing to overwrite/);
  const fake=join(f.dir,'linked-evidence.json');
  symlinkSync(f.inventory,fake);
  assert.throws(()=>verify(f.report,f.apk,commit,fake),/missing, linked, nonregular or oversized/);
});
test('read-only downloaded workflow rederives native graph before binary OTA audit',()=>{
  const wf=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
  assert.match(wf,/lab\/p01-android-gradle-runtime-inventory-v1/);
  const a=wf.indexOf('  assemble-combined-lab-apk:');
  const b=wf.indexOf('  reverify-downloaded-combined-apk:');
  const producer=wf.slice(a,b),verifier=wf.slice(b);
  assert.match(producer,/\.\/gradlew :app:dependencies/);
  assert.match(producer,/--configuration releaseRuntimeClasspath/);
  assert.match(producer,/gradle_release_runtime_inventory\.cjs capture/);
  assert.match(producer,/ANDROID_RELEASE_RUNTIME_DEPENDENCIES\.txt/);
  assert.match(producer,/apps\/mobile\/ANDROID_RELEASE_RUNTIME_INVENTORY\.json/);
  assert.match(verifier,/gradle_release_runtime_inventory\.cjs verify/);
  assert.match(verifier,/combined-apk\/ANDROID_RELEASE_RUNTIME_INVENTORY\.json/);
  assert.ok(verifier.indexOf('gradle_release_runtime_inventory.cjs verify')<
            verifier.indexOf('verify_compiled_ota_runtime.py'));
  assert.match(verifier,/permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(verifier,/npm ci|npm install|gradlew|contents: write|secrets\.|gh release/);
});

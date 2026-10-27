import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const script='tooling/android/forge_141_candidate_apk_inventory.py',sha='c'.repeat(40);
const run=args=>spawnSync('python3',[script,...args],{encoding:'utf8'});
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'negresco-forge141-apk-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const apk=join(root,'app-release.apk'),lock=join(root,'lock.json');
 const upstream=join(root,'proof.json'),out=join(root,'result.json');
 const l={name:'@negresco/mobile',lockfileVersion:3,packages:{'node_modules/node-forge':{version:'1.4.1'}}};
 const lockBytes=Buffer.from(JSON.stringify(l));writeFileSync(lock,lockBytes);
 const lockSha=createHash('sha256').update(lockBytes).digest('hex');
 writeFileSync(upstream,JSON.stringify({sourceCommit:sha,approvedForProduction:false,
  stableReleaseAllowed:false,upstream:{version:'1.4.1'},candidate:{lockSha256:lockSha}}));
 const mk=["import zipfile,sys","with zipfile.ZipFile(sys.argv[1], 'w') as z:",
 " for n in range(56): z.writestr(f'lib/arm64-v8a/lib{n}.so',b'ALIB')",
 " for n in range(3): z.writestr(f'classes{n+1}.dex',b'DEX!')",
 " z.writestr('assets/index.android.bundle',bytes.fromhex('c61fbc03')+b'X'*80)"].join('\n');
 const proc=spawnSync('python3',['-c',mk,apk],{encoding:'utf8'});
 assert.equal(proc.status,0,proc.stderr);
 return {apk,lock,upstream,out,args:[apk,lock,upstream,sha,out]};
}
test('APK inventory binds Hermes, 56 ELF, 3 DEX and forge 1.4.1',t=>{
 const f=fixture(t);
 const c=run(['capture',...f.args]);assert.equal(c.status,0,c.stderr);
 const v=run(['verify',...f.args]);assert.equal(v.status,0,v.stderr);
 const d=JSON.parse(readFileSync(f.out,'utf8'));
 assert.equal(d.approvedForProduction,false);assert.equal(d.stableReleaseAllowed,false);
 assert.equal(d.sharedLibraries,56);assert.equal(d.dexFiles,3);assert.equal(d.hermesSize,84);
});
test('modified upstream proof fails on independent recheck',t=>{
 const f=fixture(t);assert.equal(run(['capture',...f.args]).status,0);
 writeFileSync(f.upstream,JSON.stringify({sourceCommit:sha,approvedForProduction:true,
  stableReleaseAllowed:false,upstream:{version:'1.4.1'},candidate:{lockSha256:'x'}}));
 const v=run(['verify',...f.args]);assert.notEqual(v.status,0);assert.match(v.stderr,/BLOCK/);
});
test('workflow retains independent APK audit and no production publishing',()=>{
 const wf=readFileSync('.github/workflows/forge-141-android-candidate.yml','utf8');
 assert.match(wf,/lab\/p01-forge-141-android-candidate-v1/);
 assert.match(wf,/forge_141_candidate_apk_inventory\.py capture/);
 assert.match(wf,/forge_141_candidate_apk_inventory\.py verify/);
 for(const leaf of ['source-package.json','candidate-lock.json','FORGE_141_PROVENANCE.json','FORGE_141_APK_INVENTORY.json']){
  assert.ok(wf.includes('forge141-review/forge141-apk-lab/'+leaf),'missing artifact subdir '+leaf);
  assert.ok(!wf.includes('forge141-review/'+leaf),'root-relative artifact confusion '+leaf);
 }
 assert.match(wf,/npm audit --json --package-lock-only/g);
 assert.match(wf,/CN=Android Debug/g);
 assert.match(wf,/verify_compiled_preview_ota\.py/g);
 assert.doesNotMatch(wf,/contents: write|gh release|eas update|expo publish/);
});

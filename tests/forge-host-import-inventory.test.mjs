import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {report,execute,scan}=require('../tooling/android/forge_host_import_inventory.cjs');
const commit='b'.repeat(40);
const versions={'expo':'54.0.38','expo-updates':'29.0.20',
 '@expo/cli':'54.0.28','@expo/code-signing-certificates':'0.0.6','node-forge':'1.4.0'};
function fixture(t){
 const project=mkdtempSync(join(tmpdir(),'negresco-host-forge-'));
 t.after(()=>rmSync(project,{force:true,recursive:true}));
 const modules=join(project,'node_modules');mkdirSync(modules);
 const lock=join(project,'candidate-lock.json');
 const packages={};
 for(const [name,version] of Object.entries(versions)){
  const location='node_modules/'+name;
  const folder=join(project,location);mkdirSync(folder,{recursive:true});
  writeFileSync(join(folder,'package.json'),JSON.stringify({name,version}));
  writeFileSync(join(folder,'main.js'),name==='@expo/code-signing-certificates'?
    "const forge = require('node-forge');\nmodule.exports = forge;\n":
    name==='@expo/cli'?"import cert from '@expo/code-signing-certificates';":"module.exports = true;");
  packages[location]={version};
 }
 const nested=join(project,'node_modules/expo/node_modules/@expo/cli');
 mkdirSync(nested,{recursive:true});
 writeFileSync(join(nested,'package.json'),JSON.stringify({name:'@expo/cli',version:'54.0.28'}));
 writeFileSync(join(nested,'index.cjs'),"const forge=require('node-forge/lib/forge');");
 packages['node_modules/expo/node_modules/@expo/cli']={version:'54.0.28'};
 writeFileSync(lock,JSON.stringify({name:'@negresco/mobile',version:'3.1.3',
  lockfileVersion:3,packages}));
 return {project,modules,lock,output:join(project,'HOST_FORGE_IMPORT_INVENTORY.json')};
}
test('records every exact npm package location and classifies lexical host references',t=>{
 const f=fixture(t);const r=report(f.modules,f.lock,commit);
 assert.equal(r.scannedPackages.length,6);
 assert.equal(r.stableReleaseAllowed,false);
 const cert=r.scannedPackages.find(x=>x.package==='@expo/code-signing-certificates');
 assert.equal(cert.lexicalLiteralImports,1);
 assert.equal(cert.filesWithMentions,1);
 const cli=r.scannedPackages.filter(x=>x.package==='@expo/cli');
 assert.equal(cli.length,2);assert.equal(cli.reduce((n,x)=>n+x.lexicalLiteralImports,0),1);
 assert.doesNotMatch(JSON.stringify(r),/index\.cjs|main\.js|module\.exports|node-forge\/lib\/forge/);
});
test('independent fresh file scan catches changed installed source and report forgery',t=>{
 const f=fixture(t);execute(['capture',f.modules,f.lock,commit,f.output]);
 execute(['verify',f.modules,f.lock,commit,f.output]);
 const cert=join(f.modules,'@expo/code-signing-certificates','main.js');
 writeFileSync(cert,'module.exports = 1;');
 assert.throws(()=>execute(['verify',f.modules,f.lock,commit,f.output]),/disagrees/);
});
test('source symlinks and lock version drift are rejected',t=>{
 const f=fixture(t);
 symlinkSync(join(f.project,'candidate-lock.json'),join(f.modules,'expo','unsafe.js'));
 assert.throws(()=>scan(join(f.modules,'expo')),/symlink/);
 rmSync(join(f.modules,'expo','unsafe.js'));
 const l=JSON.parse(readFileSync(f.lock));
 l.packages['node_modules/node-forge'].version='1.4.1';
 writeFileSync(f.lock,JSON.stringify(l));
 assert.throws(()=>report(f.modules,f.lock,commit),/version changed/);
});
test('workflow has two separate npm ci jobs, only a report artifact, and no build publication',()=>{
 const wf=readFileSync(resolve('.github/workflows/image-size-major-lab.yml'),'utf8');
 assert.match(wf,/lab\/p01-forge-host-import-inventory-v1/);
 assert.match(wf,/  host-forge-imports:/);
 assert.match(wf,/  verify-host-forge-imports:/);
 assert.match(wf,/npm ci --ignore-scripts --no-audit --no-fund/g);
 assert.match(wf,/forge_host_import_inventory\.cjs capture/);
 assert.match(wf,/forge_host_import_inventory\.cjs verify/);
 const upload=wf.slice(wf.indexOf('      - name: Upload host import report only'),
  wf.indexOf('  verify-host-forge-imports:'));
 assert.match(upload,/HOST_FORGE_IMPORT_INVENTORY\.json/);
 assert.doesNotMatch(upload,/node_modules\/|\.js\.map|sourcesContent|\.js\n/);
});

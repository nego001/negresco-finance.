import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';

const require=createRequire(import.meta.url);
const tool=require('../tooling/android/npm_lock_cyclonedx_sbom.cjs');
const hash='sha512-'+Buffer.alloc(64,13).toString('base64');
function entry(name,version='1.2.3',extra={}){
  return {version,resolved:'https://registry.npmjs.org/'+name+'/-/'+name.split('/').at(-1)+'-'+version+'.tgz',
    integrity:hash,...extra};
}
function lock(){
  return {name:'@negresco/mobile',version:'3.1.3',lockfileVersion:3,packages:{
    '':{name:'@negresco/mobile',version:'3.1.3',dependencies:{alpha:'^1.0.0'},
      devDependencies:{beta:'^2.0.0'}},
    'node_modules/alpha':entry('alpha','1.0.0',{dependencies:{'@vendor/shared':'^4.0.0'},
      peerDependencies:{'optional-view':'^9.0.0','@vendor/shared':'^4.0.0'},
      peerDependenciesMeta:{'optional-view':{optional:true}}}),
    'node_modules/beta':entry('beta','2.0.0',{optionalDependencies:{alpha:'^1.0.0'}}),
    'node_modules/@vendor/shared':entry('@vendor/shared','4.0.0'),
    'node_modules/alpha/node_modules/@vendor/shared':entry('@vendor/shared','4.2.1',
      {dependencies:{alpha:'^1.0.0'}})
  }};
}
const bom=data=>tool.sbom(Buffer.from(JSON.stringify(data)));
const refs=obj=>obj.dependencies.map(x=>x.ref);
const row=(obj,ref)=>obj.dependencies.find(x=>x.ref==='npm-lock:'+ref);
const props=obj=>Object.fromEntries(obj.metadata.properties.map(x=>[x.name,x.value]));
function fixture(t,mutate){
  const dir=mkdtempSync(join(tmpdir(),'negresco-dependency-edges-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const input=join(dir,'npm-lock.json'),out=join(dir,'npm-bom.json');
  const data=lock();mutate?.(data);writeFileSync(input,JSON.stringify(data));
  return {input,out};
}
test('CycloneDX 1.6 emits each package plus root with unique referentially valid edges',()=>{
  const x=bom(lock());
  const names=new Set(['npm-lock:root',...x.components.map(c=>c['bom-ref'])]);
  assert.equal(x.bomFormat,'CycloneDX');
  assert.equal(x.metadata.component['bom-ref'],'npm-lock:root');
  assert.equal(x.dependencies.length,x.components.length+1);
  assert.equal(new Set(refs(x)).size,x.dependencies.length);
  for(const d of x.dependencies){
    assert.ok(names.has(d.ref),d.ref);
    assert.deepEqual(d.dependsOn,[...d.dependsOn].sort());
    for(const v of d.dependsOn)assert.ok(names.has(v),v);
  }
});
test('root includes direct production and development requirements exactly',()=>{
  assert.deepEqual(row(bom(lock()),'root').dependsOn,
    ['npm-lock:node_modules/alpha','npm-lock:node_modules/beta']);
});
test('nested npm resolution prefers nearest installed scoped package',()=>{
  const x=bom(lock());
  assert.deepEqual(row(x,'node_modules/alpha').dependsOn,
    ['npm-lock:node_modules/alpha/node_modules/@vendor/shared']);
  assert.deepEqual(row(x,'node_modules/alpha/node_modules/@vendor/shared').dependsOn,
    ['npm-lock:node_modules/alpha']);
});
test('multiple dependency kinds to same package produce one CycloneDX edge',()=>{
  const x=bom(lock());
  const edges=row(x,'node_modules/alpha').dependsOn;
  assert.equal(edges.length,1);
  assert.equal(props(x)['negresco:distinct-graph-edges'],'6');
  assert.equal(props(x)['negresco:resolved-graph-requirements'],'7');
  assert.deepEqual(JSON.parse(props(x)['negresco:graph-edge-kinds']),{
    dependencies:3,optionalDependencies:1,devDependencies:1,peerDependencies:2
  });
});
test('uninstalled optional peer requirements are explicitly recorded, not falsely installed',()=>{
  const x=bom(lock());
  assert.equal(props(x)['negresco:unresolved-peer-count'],'1');
  const missing=JSON.parse(props(x)['negresco:unresolved-peers-json']);
  assert.deepEqual(missing,[{from:'node_modules/alpha',name:'optional-view',
    declared:'^9.0.0',optional:true}]);
  assert.ok(!x.components.some(c=>c.name==='optional-view'));
});
test('uninstalled mandatory peer remains visible and marked non-optional',()=>{
  const v=lock();delete v.packages['node_modules/alpha'].peerDependenciesMeta;
  const x=bom(v);
  assert.equal(JSON.parse(props(x)['negresco:unresolved-peers-json'])[0].optional,false);
});
test('missing direct root dependency fails closed',()=>{
  const v=lock();delete v.packages['node_modules/alpha'];
  assert.throws(()=>bom(v),/unresolved non-peer dependencies dependency alpha from root/);
});
test('missing transitive hard or optional dependency fails closed',()=>{
  for(const section of ['dependencies','optionalDependencies']){
    const v=lock();v.packages['node_modules/alpha'][section]={ghost:'^2.0.0'};
    assert.throws(()=>bom(v),/unresolved non-peer/);
  }
});
test('missing dev dependency fails closed and never becomes an unresolved peer',()=>{
  const v=lock();v.packages[''].devDependencies={unknown:'^1.0.0'};
  assert.throws(()=>bom(v),/unresolved non-peer devDependencies/);
});
test('invalid peer metadata and dependency ranges are rejected',()=>{
  const bad=lock();bad.packages['node_modules/alpha'].peerDependenciesMeta['optional-view'].optional='yes';
  assert.throws(()=>bom(bad),/invalid peerDependenciesMeta/);
  const bad2=lock();bad2.packages['node_modules/alpha'].dependencies['@vendor/shared']='';
  assert.throws(()=>bom(bad2),/invalid dependencies range/);
});
test('lockfile package path traversal cannot be emitted into dependency graph',()=>{
  const data=lock();data.packages['node_modules/../outside']=entry('outside');
  assert.throws(()=>bom(data),/invalid npm lock package path/);
});
test('edges and missing-peer warnings regenerate deterministically from exactly the same lockfile',t=>{
  const f=fixture(t);
  tool.capture(f.input,f.out);
  const bytes=readFileSync(f.out);
  tool.verify(f.input,f.out);
  assert.equal(JSON.parse(bytes).dependencies.length,5);
  assert.equal(props(JSON.parse(bytes))['negresco:source-lock-sha256'],
    createHash('sha256').update(readFileSync(f.input)).digest('hex'));
  rmSync(f.out);tool.capture(f.input,f.out);
  assert.deepEqual(readFileSync(f.out),bytes);
});
test('tampering with dependency edges or missing-peer notes is detected after download',t=>{
  for(const change of [
    x=>x.dependencies[0].dependsOn=[],
    x=>x.dependencies.pop(),
    x=>x.metadata.properties.find(p=>p.name==='negresco:unresolved-peer-count').value='0',
    x=>x.metadata.properties.find(p=>p.name==='negresco:unresolved-peers-json').value='[]'
  ]){
    const f=fixture(t);tool.capture(f.input,f.out);
    const a=JSON.parse(readFileSync(f.out,'utf8'));change(a);
    writeFileSync(f.out,JSON.stringify(a));
    assert.throws(()=>tool.verify(f.input,f.out),/downloaded SBOM differs/);
  }
});
test('full dependency graph includes edge kinds and not Android execution claims',()=>{
  const x=bom(lock());
  assert.equal(props(x)['negresco:scope'],'unreviewed-npm-build-graph-not-apk-runtime');
  assert.equal(props(x)['negresco:release-approved'],'false');
  assert.ok(Array.isArray(x.dependencies));
  assert.equal(JSON.parse(props(x)['negresco:unresolved-peers-json']).length,1);
});

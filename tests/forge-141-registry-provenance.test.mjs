import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {make,run}=require('../tooling/android/forge_141_registry_provenance.cjs');
const sha='c'.repeat(40);
function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'forge141-proof-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const rsa=join(dir,'rsa.js'),upstream=join(dir,'tag.js'),pkg=join(dir,'package.json');
 const audit=join(dir,'audit.json'),tar=join(dir,'forge.tar.gz'),lock=join(dir,'lock.json'),out=join(dir,'out.json');
 const code='_encodeDigestInfo(oid, capture.digest, true);\n_encodeDigestInfo(oid, capture.digest, false);\nd.substring(0, withParameters.length) !== withParameters';
 writeFileSync(rsa,code);writeFileSync(upstream,code);
 writeFileSync(pkg,JSON.stringify({name:'node-forge',version:'1.4.1'}));
 writeFileSync(audit,JSON.stringify({metadata:{vulnerabilities:{total:0,high:0,critical:0}},vulnerabilities:{}}));
 writeFileSync(tar,'SYNTHETIC-ARCHIVE');
 const integrity='sha512-'+createHash('sha512').update(readFileSync(tar)).digest('base64');
 const entries={'node_modules/node-forge':{version:'1.4.1',integrity},
 'node_modules/expo/node_modules/@expo/cli':{version:'54.0.28',dependencies:{'node-forge':'^1.3.3'}},
 'node_modules/@expo/code-signing-certificates':{version:'0.0.6',dependencies:{'node-forge':'^1.3.3'}},
 'node_modules/expo-updates':{version:'29.0.20'}};
 writeFileSync(lock,JSON.stringify({name:'@negresco/mobile',version:'3.1.3',lockfileVersion:3,packages:entries}));
 return {rsa,upstream,pkg,audit,tar,lock,out,args:[lock,tar,rsa,upstream,pkg,audit,sha,out]};
}
test('new registry tarball, pinned tag and zero-advisory audit all match',t=>{
 const f=fixture(t);const r=make(...f.args.slice(0,7));
 assert.equal(r.upstream.version,'1.4.1');
 assert.equal(r.stableReleaseAllowed,false);
 run(['capture',...f.args]);run(['verify',...f.args]);
});
test('an independent registry tarball change is rejected',t=>{
 const f=fixture(t);writeFileSync(f.tar,'CHANGED-ARCHIVE');
 assert.throws(()=>make(...f.args.slice(0,7)),/integrity/);
});
test('mutating audited RSA source is rejected',t=>{
 const f=fixture(t);writeFileSync(f.rsa,'missing DER canonicalization');
 assert.throws(()=>make(...f.args.slice(0,7)),/differs/);
});
test('new or withdrawn advisory triggers failure, not suppression',t=>{
 const f=fixture(t);writeFileSync(f.audit,JSON.stringify({metadata:{vulnerabilities:{total:1,high:1,critical:0}},vulnerabilities:{'node-forge':{severity:'high'}}}));
 assert.throws(()=>make(...f.args.slice(0,7)),/advisory/);
});
test('provenance lab requires two checks and never publishes APK',()=>{
 const s=readFileSync('.github/workflows/forge-141-provenance-lab.yml','utf8');
 assert.match(s,/lab\/p01-forge-141-supply-chain-validation-v1/);
 assert.match(s,/forge_141_registry_provenance\.cjs capture/);
 assert.match(s,/forge_141_registry_provenance\.cjs verify/);
 assert.match(s,/npm ci --ignore-scripts/);
 assert.doesNotMatch(s,/contents: write|gh release|expo publish|eas update|upload.*\.apk/);
});

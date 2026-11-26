import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,lstatSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL} from 'node:url';
const preview={enabled:true,checkAutomatically:'ON_LOAD',fallbackToCacheTimeout:0,url:'https://u.expo.dev/a506611f-a159-4341-bed7-28dcbd47bf95',requestHeaders:{'expo-channel-name':'preview'}};
export function embeddedOnly(config){
 assert.ok(config&&typeof config==='object'&&!Array.isArray(config));
 assert.ok(config.expo&&isDeepStrictEqual(config.expo.updates,preview),'unexpected preview config');
 return {...config,expo:{...config.expo,updates:{enabled:false}}};
}
export function verifyCandidate(original,actual){
 assert.deepEqual(actual,embeddedOnly(original));
 return {mode:'embedded-only',approvedForProduction:false,stableReleaseAllowed:false};
}
function run(mode){
 assert.equal(process.env.GITHUB_ACTIONS,'true');
 assert.equal(process.env.GITHUB_REF,'refs/heads/lab/p01-guardiao-active-integration-m149-v1');
 assert.ok(['apply','verify'].includes(mode));
 const file='app.json';
 assert.ok(lstatSync(file).isFile());assert.equal(realpathSync(file),resolve(file));
 const original=JSON.parse(execFileSync('git',['show','HEAD:apps/mobile/app.json'],{encoding:'utf8'}));
 const actual=JSON.parse(readFileSync(file,'utf8'));
 if(mode==='apply'){assert.deepEqual(actual,original);writeFileSync(file,JSON.stringify(embeddedOnly(original),null,2)+'\n')}
 console.log(JSON.stringify(verifyCandidate(original,JSON.parse(readFileSync(file,'utf8')))));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{assert.equal(process.argv.length,3);run(process.argv[2])}catch(e){console.error('BLOCK (LAB): embedded-only policy scope or config mismatch: '+e.message);process.exitCode=1}
}

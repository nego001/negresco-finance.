import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
export const expected=Object.freeze(['apps/mobile/App.tsx','apps/mobile/package-lock.json','apps/mobile/package.json']);
export function validate(raw){
 assert.ok(typeof raw==='string'&&raw.endsWith('\0'),'expected NUL-terminated Git paths');
 const paths=raw.slice(0,-1).split('\0');
 assert.deepEqual([...paths].sort(),expected);
 return paths.length;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REF,'refs/heads/lab/p01-guardiao-integration-rehearsal-m138-v1');assert.equal(validate(readFileSync(0,'utf8')),3);console.log('PASS (LAB): exact three integration paths')}catch{console.error('BLOCK (LAB): unexpected staged integration scope');process.exitCode=1}
}

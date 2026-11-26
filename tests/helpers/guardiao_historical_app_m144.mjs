import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export function historicalAppPath(){
 const path='tooling/android/fixtures/m139-historical-baseline/App.tsx';
 assert.ok(lstatSync(path).isFile());
 const b=readFileSync(path);
 assert.equal(b.length,68538);
 assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),'9e706f4714f3a913823a02678c5c0e3dc89ecfdd');
 return path;
}

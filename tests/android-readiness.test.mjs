import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=(path)=>readFileSync(new URL(path,root),'utf8');

test('SQLCipher and zero-knowledge are formally assigned only to Negresco Finance',()=>{
 const adr=read('docs/decisions/0001-sqlcipher-zero-knowledge-negresco-only.md');
 const phase=read('docs/PHASE1_BASELINE.md');
 assert.match(adr,/somente no repositório/);
 assert.match(adr,/Security Black/);
 assert.match(adr,/não significa que o SQLCipher/);
 assert.match(phase,/ADR 0001/);
});

test('Android readiness tool is read-only and checks package metadata',()=>{
 const source=read('tooling/windows/android-v31-readonly-preflight.ps1');
 assert.match(source,/\[CmdletBinding\(\)\]/);
 assert.match(source,/Get-FileHash/);
 assert.match(source,/adb\.exe/);
 assert.match(source,/shell pm path \$packageName/);
 assert.match(source,/shell dumpsys package \$packageName/);
 assert.doesNotMatch(source,/\badb\s+(?:install|uninstall|push)\b/i);
 assert.doesNotMatch(source,/shell\s+pm\s+clear\b/i);
 assert.doesNotMatch(source,/shell\s+rm\s+-/i);
});

test('Samsung manual QA checklist explicitly protects installed app data',()=>{
 const qa=read('docs/ANDROID_QA_V3.1.md');
 assert.match(qa,/QA-21/);
 assert.match(qa,/QA-22/);
 assert.match(qa,/não desinstalar antes/i);
});

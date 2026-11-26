import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const w=readFileSync('.github/workflows/guardiao-stable-policy-rehearsal-m147.yml','utf8');
test('M147 invokes original stable dependency policies and both negative controls without release privileges',()=>{for(const x of ['verify_stable_npm_lock.cjs package.json package-lock.json','verify_stable_npm_audit.cjs "$RUNNER_TEMP/m147-audit.json"','m147-invalid-lock.json','m147-invalid-audit.json','npm ci --ignore-scripts','guardiao_portable_metro_m141.mjs apply','guardiao_portable_metro_m141.mjs verify','contents: read','persist-credentials: false'])assert.ok(w.includes(x),x);assert.doesNotMatch(w,/contents: write|secrets\.|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch:|gh release|eas update|expo publish/)});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('M149 R2 mobile static check uses reviewed locked path whenever a lock is tracked',()=>{const w=readFileSync('.github/workflows/mobile-check.yml','utf8');assert.match(w,/git ls-files --error-unmatch package-lock\.json/);assert.match(w,/npm install --no-audit --no-fund\n        if: steps.mobile_lock.outputs.tracked == 'false'/);assert.match(w,/guardiao_ci_locked_install_m148\.mjs install\n        if: steps.mobile_lock.outputs.tracked == 'true'/);assert.match(w,/node \.\/node_modules\/typescript\/bin\/tsc --noEmit/);assert.match(w,/guardiao_ci_locked_install_m148\.mjs verify\n        if: steps.mobile_lock.outputs.tracked == 'true'/)});

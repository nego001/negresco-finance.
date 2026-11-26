import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyBytes} from '../tooling/android/guardiao_ci_locked_install_m148.mjs';
const ci=readFileSync('.github/workflows/ci.yml','utf8');
test('M148 both native CI jobs detect tracked lock before installation and use mutually exclusive paths',()=>{for(const s of ["id: mobile_lock","if: steps.mobile_lock.outputs.tracked == 'false'","if: steps.mobile_lock.outputs.tracked == 'true'","guardiao_ci_locked_install_m148.mjs install","guardiao_ci_locked_install_m148.mjs prebuild"]){assert.equal(ci.split(s).length-1,s.startsWith('if:')?4:2,s)}assert.equal(ci.split('git ls-files --error-unmatch package-lock.json').length-1,2)});
test('M148 rejects unknown manifest and lock bytes before any installation',()=>{assert.throws(()=>verifyBytes(Buffer.from('{}'),Buffer.from('{}')));assert.throws(()=>verifyBytes(readFileSync('tooling/android/fixtures/m139-historical-baseline/package.json'),readFileSync('tooling/android/fixtures/guardiao-mobile-m135-package-lock.json')))});

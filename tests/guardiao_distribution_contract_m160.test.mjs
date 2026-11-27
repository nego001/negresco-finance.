import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {propose} from '../tooling/android/guardiao_distribution_route_m159.mjs';
import {verifyDistributionRoute} from './helpers/guardiao_distribution_contract_m160.mjs';
test('M160 validates historical and reviewed candidate but rejects altered audit, lock, or signing routes',()=>{const b=readFileSync('tooling/android/fixtures/guardiao-distribution-baseline-m161.yml.txt','utf8');const c=propose(b);assert.equal(verifyDistributionRoute(b),'historical');assert.equal(verifyDistributionRoute(c),'reviewed-proposal');for(const changed of [c.replace('guardiao_ci_locked_install_m148.mjs install','npm install'),c.replace('AUDIT_STATUS=$?','AUDIT_STATUS=0'),c.replace('test "${{ steps.mobile_lock.outputs.tracked }}" = true','true'),c.replace('inputs.publish_release && inputs.stable_signing','inputs.publish_release')]){assert.notEqual(changed,c);assert.throws(()=>verifyDistributionRoute(changed));}});

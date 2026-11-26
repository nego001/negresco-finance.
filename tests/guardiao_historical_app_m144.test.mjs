import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {historicalAppPath} from './helpers/guardiao_historical_app_m144.mjs';
test('M144 historical transform input has exact immutable pre-integration bytes',()=>{const p=historicalAppPath();assert.equal(p,'tooling/android/fixtures/m139-historical-baseline/App.tsx');const s=readFileSync(p,'utf8');assert.ok(s.includes('style={[s.bottom,s.labBottomBounds]}'));assert.ok(s.includes('labAndroidRootHitOrder:{zIndex:4,elevation:4}'))});

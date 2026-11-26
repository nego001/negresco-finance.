import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {historicalAppPath} from './helpers/guardiao_historical_app_m144.mjs';
import {reconstructLayout,validateLayout,verifyActiveLayout} from './helpers/guardiao_active_layout_m146.mjs';
test('M146 checks exact historical and reviewed candidate layout, not an arbitrary replacement',()=>{const old=readFileSync(historicalAppPath(),'utf8'),next=reconstructLayout();assert.equal(validateLayout(old,'historical'),'historical');assert.equal(validateLayout(next,'reviewed-lab-candidate'),'reviewed-lab-candidate');assert.throws(()=>validateLayout(old,'reviewed-lab-candidate'));assert.throws(()=>validateLayout(next,'historical'));assert.ok(['historical','reviewed-lab-candidate'].includes(verifyActiveLayout()))});
test('M146 rejects even small candidate layout, accessibility or PDF gate drift',()=>{const next=reconstructLayout();for(const [a,b] of [['paddingBottom:insets.bottom','paddingBottom:0'],['accessibilityRole="tab"','accessibilityRole="button"'],['releasePdfGate()','void 0'],["keyboardShouldPersistTaps={page==='Guardião'?'handled':'never'}","keyboardShouldPersistTaps='never'"]]){assert.ok(next.includes(a));assert.throws(()=>validateLayout(next.replace(a,b),'reviewed-lab-candidate'))}});

test('M146 R2 rejects duplicate or restored obsolete bottom bar styles',()=>{const next=reconstructLayout();assert.throws(()=>validateLayout(next+'\nstyle={s.bottom}','reviewed-lab-candidate'));assert.throws(()=>validateLayout(next.replace('style={s.bottom}','style={[s.bottom,s.labBottomBounds]}'),'reviewed-lab-candidate'))});

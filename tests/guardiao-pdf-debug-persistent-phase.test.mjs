import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync('apps/mobile/App.tsx','utf8');
const runner=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');
const baseline=readFileSync('tooling/android/guardiao_pdf_ui_emulator_smoke.py','utf8');
const lifecycle=readFileSync('apps/mobile/guardiao/pdfExport.ts','utf8');

test('fixed Debug marker records last phase without making native await wait for UI',()=>{
 assert.match(app,/useState<PdfExportPendingPhase\|null>\(null\)/);
 assert.match(app,/if\(typeof __DEV__!=='undefined'&&__DEV__\)setLabLastPdfStartedPhase\(null\)/);
 assert.match(app,/onPendingPhase:stage=>\{[\s\S]*?if\(typeof __DEV__==='undefined'\|\|!__DEV__\)return;[\s\S]*?setLabLastPdfStartedPhase\(stage\)/);
 assert.match(app,/typeof __DEV__!=='undefined'&&__DEV__&&labLastPdfStartedPhase&&/);
 assert.ok(app.includes('accessibilityLabel={') && app.includes('LAB: última etapa PDF iniciada:'));
 assert.match(app,/labPendingLabels:Record<PdfExportPendingPhase,string>/);
 assert.match(lifecycle,/if\(!reportPending\('share'\)\)return 'cancelled'/);
 assert.match(lifecycle,/await ports\.share\(createdUri\)/);
 const pending=app.indexOf('onPendingPhase:stage=>');
 const status=app.indexOf('setLabLastPdfStartedPhase(stage)',pending);
 const native=app.indexOf('share:uri=>Sharing.shareAsync',pending);
 assert.ok(pending>=0 && status>pending && native>status,'callback is synchronous and precedes native share');
 assert.doesNotMatch(app.slice(pending,native),/setTimeout|sleep\(|await new Promise|console\.log|fetch\(/);
});

test('persistent marker is checked only after real PDF receipt, without weakening gates',()=>{
 const receive=runner.indexOf('semantic.run_lab()');
 const report=runner.indexOf('report = json.loads(semantic.REPORT',receive);
 const verified=runner.indexOf('nativePdfSemanticTextVerified',report);
 const fallback=runner.indexOf('if not observed:',verified);
 const collector=runner.indexOf('confirmed = collect_persistent_visual_share_marker()',fallback);
 const confirmed=runner.indexOf('if confirmed:',collector);
 const marker=runner.indexOf('observed.add("lab-share-entered-after-receipt")',confirmed);
 const reject=runner.indexOf('raise RuntimeError("no actual debug-only phase marker was observed")',marker);
 assert.ok(receive>=0 && report>receive && verified>report && fallback>verified && collector>fallback && confirmed>collector && marker>confirmed && reject>marker);
 assert.match(runner,/for _ in range\(2\):/);
 assert.match(runner,/for movement in \(base\.scroll_forward_precise, base\.scroll_backward\):/);
 assert.match(runner,/exact_visual_share_marker\(base\.xml_nodes\(\)\)/);
 assert.match(runner,/len\(matches\) == 1/);
 assert.match(runner,/observed\.add\("lab-share-entered-after-receipt"\)/);
 assert.match(runner,/report\.get\("receiverCacheClean"\) is not True/);
 assert.match(runner,/report\.get\("approvedForProduction"\) is not False/);
 assert.match(runner,/report\.get\("stableReleaseAllowed"\) is not False/);
 assert.match(baseline,/if not validate_receiver_receipt\(receipt\):/);
 assert.match(baseline,/if not receiver_cache_empty_of_pdf\(\):/);
 assert.doesNotMatch(runner,/logcat.*print|screencap|upload-artifact|approvedForProduction.*True/i);
});

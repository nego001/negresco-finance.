import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {exportPdfWithLifecycleGuard} from '../apps/mobile/guardiao/pdfExport.ts';

const pythonPrelude=[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'from unittest.mock import patch',
 'import guardiao_v5_api28_resolver_focus_readonly_lab as f',
 'import guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab as g',
 "FRAME=[{'package':'android','class':'android.widget.ListView','resource-id':'android:id/resolver_list','bounds':'[0,0][400,800]','clickable':'true'}]",
 "APP=[{'package':g.BASE.PACKAGE,'class':'android.widget.TextView','text':'Início'}]",
 "assert f.resource.classify(FRAME,400,800)[0]=='present'",
 'def block():',
 "  with patch.object(g.BASE,'screen_size',return_value=(400,800)),patch.object(g.BASE,'xml_nodes',side_effect=[FRAME,APP]) as xml,patch.object(g.home,'observed_single_app_pid',side_effect=['900','900']),patch.object(g.scoped,'scoped_triplet_category',side_effect=lambda n,w,h:g.scoped.PASS if n is APP else 'home-not-bounded'):",
 '    try: g.attest_triplet("900","pre-return")',
 '    except RuntimeError as exc:',
 "      assert str(exc)=='scoped three-tab geometry was not twice verified'",
 "    else: raise AssertionError('must block despite second app snapshot')",
 '    assert xml.call_count==2',
].join('\n');
function runProbe(tail){
 const z=spawnSync('python3',['-c',pythonPrelude+'\n'+tail.join('\n')],{encoding:'utf8',timeout:25000});
 assert.equal(z.status,0,z.stderr);
 assert.match(z.stdout,/PASS \(LAB\): post chooser gate remains strict/);
}

test('a resolver-first snapshot and app focus sampled afterwards still blocks before Home tap',()=>{
 runProbe([
  "raw='mCurrentFocus=Window{abc u0 com.negresco.finance/.MainActivity}'",
  "with patch.object(f.home.base,'adb',return_value=raw) as adb:",
  "  assert f.observe(FRAME,400,800)==('resolver-marker-present','window-focus-app')",
  '  assert adb.call_count==1',
  'block()',
  "print('PASS (LAB): post chooser gate remains strict')"
 ]);
});

test('the later focus being chooser or unknown cannot override the initial resolver tree',()=>{
 runProbe([
  "for raw,expected in [('mCurrentFocus=Window{abc u0 android/com.android.internal.app.ResolverActivity}','window-focus-chooser'),('invalid','window-focus-unconfirmed')]:",
  "  with patch.object(f.home.base,'adb',return_value=raw):",
  "    assert f.observe(FRAME,400,800)==('resolver-marker-present',expected)",
  '  block()',
  "print('PASS (LAB): post chooser gate remains strict')"
 ]);
});

test('native Sharing completion alone cannot attest Android Home readiness',async()=>{
 let resolveShare;
 const pending=new Promise(resolve=>{resolveShare=resolve;});
 const phases=[];
 const task=exportPdfWithLifecycleGuard({
  html:'<p>synthetic only</p>',
  print:async()=>({uri:'file:///data/user/0/com.negresco.finance/cache/Print/12345678-1234-4123-a123-123456789abc.pdf'}),
  sharingAvailable:async()=>true,
  share:async()=>pending,
  isCurrent:()=>true,
  isOwnedPdfUri:()=>true,
  onPendingPhase:stage=>phases.push(stage),
 });
 for(let i=0;i<8;i++)await Promise.resolve();
 assert.deepEqual(phases,['print','availability','share']);
 resolveShare();
 assert.equal(await task,'shared','only the native promise has settled');
 runProbe([
  "raw='mCurrentFocus=Window{abc u0 com.negresco.finance/.MainActivity}'",
  "with patch.object(f.home.base,'adb',return_value=raw):",
  "  assert f.observe(FRAME,400,800)==('resolver-marker-present','window-focus-app')",
  'block()',
  "print('PASS (LAB): post chooser gate remains strict')"
 ]);
});

test('source contracts keep two snapshots and the original PID/geometry gate',()=>{
 const app=readFileSync('apps/mobile/App.tsx','utf8');
 const flow=readFileSync('apps/mobile/guardiao/pdfExport.ts','utf8');
 const gate=readFileSync('tooling/android/guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab.py','utf8');
 const focus=readFileSync('tooling/android/guardiao_v5_api28_resolver_focus_readonly_lab.py','utf8');
 assert.match(app,/share:uri=>Sharing\.shareAsync\(uri,\{mimeType:'application\/pdf'/);
 assert.match(flow,/await ports\.share\(createdUri\)/);
 assert.match(gate,/first = scoped\.scoped_triplet_category\(BASE\.xml_nodes\(\), width, height\)/);
 assert.match(gate,/second = scoped\.scoped_triplet_category\(BASE\.xml_nodes\(\), width, height\)/);
 assert.match(gate,/first != scoped\.PASS or second != scoped\.PASS/);
 assert.match(gate,/attest_triplet\(pid, "pre-return"\)/);
 assert.match(focus,/return original\(nodes, width, height\)/);
 assert.doesNotMatch(flow,/Promise\.race|setTimeout|AbortController/);
});

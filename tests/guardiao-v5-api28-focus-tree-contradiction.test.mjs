import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const common=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'from unittest.mock import patch',
  'import guardiao_v5_api28_pre_snapshot_focus_lab as pre',
  'import guardiao_v5_api28_resolver_focus_readonly_lab as after',
  'import guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab as gate',
  "FRAME=[{'package':'android','class':'android.widget.ListView','resource-id':'android:id/resolver_list','bounds':'[0,0][400,800]','clickable':'true'}]",
  "APP=[{'package':gate.BASE.PACKAGE,'class':'android.widget.TextView','text':'Início'}]",
  "assert after.resource.classify(FRAME,400,800)[0]=='present'",
  'def replay(first,second,pid1="900",pid2="900"):',
  '  def check(nodes,w,h):',
  "    return gate.scoped.PASS if nodes is APP else 'home-not-bounded'",
  "  with patch.object(gate.BASE,'screen_size',return_value=(400,800)):",
  "    with patch.object(gate.BASE,'xml_nodes',side_effect=[first,second]) as snaps:",
  "      with patch.object(gate.home,'observed_single_app_pid',side_effect=[pid1,pid2]) as pids:",
  "        with patch.object(gate.scoped,'scoped_triplet_category',side_effect=check) as geometry:",
  '          failure=None',
  '          try: gate.attest_triplet("900","pre-return")',
  '          except RuntimeError as err: failure=str(err)',
  '          assert snaps.call_count==2 and pids.call_count==2 and geometry.call_count==2',
  '          return failure',
].join('\n');

function probe(lines){
 const p=spawnSync('python3',['-c',common+'\n'+lines.join('\n')],{encoding:'utf8',timeout:25000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS \(LAB\): contradictory focus tree BLOCK/);
 assert.doesNotMatch(p.stdout,/mCurrentFocus|ResolverActivity|MainActivity|android:id/);
}

test('focus APP before + resolver first + focus APP after + app second must BLOCK',()=>{
 probe([
  "raw='mCurrentFocus=Window{abc u0 com.negresco.finance/.MainActivity}'",
  "with patch.object(pre.home.base,'adb',return_value=raw) as adb:",
  "  assert pre.sample()=='window-focus-app'",
  "  assert after.observe(FRAME,400,800)==('resolver-marker-present','window-focus-app')",
  "  assert adb.call_count==2",
  "  assert replay(FRAME,APP)=='scoped three-tab geometry was not twice verified'",
  "  assert adb.call_count==2",
  "print('PASS (LAB): contradictory focus tree BLOCK')",
 ]);
});

test('the same contradictory focus cannot promote resolver->resolver or app->resolver',()=>{
 probe([
  "raw='mCurrentFocus=Window{abc u0 com.negresco.finance/.MainActivity}'",
  "with patch.object(pre.home.base,'adb',return_value=raw):",
  "  assert pre.sample()=='window-focus-app'",
  "  assert after.observe(FRAME,400,800)[1]=='window-focus-app'",
  "for first,second in [(FRAME,FRAME),(APP,FRAME)]:",
  "  assert replay(first,second)=='scoped three-tab geometry was not twice verified'",
  "print('PASS (LAB): contradictory focus tree BLOCK')",
 ]);
});

test('two app-owned UI snapshots still require the same PID',()=>{
 probe([
  'assert replay(APP,APP) is None',
  "assert replay(APP,APP,pid2='901')=='scoped three-tab geometry was not twice verified'",
  "print('PASS (LAB): contradictory focus tree BLOCK')",
 ]);
});

test('the app and original immutable Release remain unchanged',()=>{
 const pre=readFileSync('tooling/android/guardiao_v5_api28_pre_snapshot_focus_lab.py','utf8');
 const later=readFileSync('tooling/android/guardiao_v5_api28_resolver_focus_readonly_lab.py','utf8');
 const gate=readFileSync('tooling/android/guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab.py','utf8');
 const flow=readFileSync('apps/mobile/guardiao/pdfExport.ts','utf8');
 assert.match(pre,/return old_attest\(pid, stage\)/);
 assert.match(pre,/return old_xml\(\*args, \*\*kwargs\)/);
 assert.match(pre,/scoped\.attest_triplet = old_attest/);
 assert.match(pre,/scoped\.BASE\.xml_nodes = old_xml/);
 assert.match(later,/return original\(nodes, width, height\)/);
 assert.match(gate,/first != scoped\.PASS or second != scoped\.PASS/);
 assert.match(gate,/attest_triplet\(pid, "pre-return"\)/);
 assert.match(flow,/await ports\.share\(createdUri\)/);
 assert.doesNotMatch(flow,/Promise\.race|AbortController/);
});

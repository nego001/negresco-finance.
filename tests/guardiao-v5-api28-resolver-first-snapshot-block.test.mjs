import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const source=readFileSync('tooling/android/guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab.py','utf8');
const resource=readFileSync('tooling/android/guardiao_v5_api28_framework_resource_signals_lab.py','utf8');

function probe(script){
 const z=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:20000});
 assert.equal(z.status,0,z.stderr);
 assert.match(z.stdout,/PASS \(LAB\): resolver-first-snapshot-boundary/);
}

const header=[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'from unittest.mock import patch',
 'import guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab as d',
 'import guardiao_v5_api28_framework_resource_signals_lab as resource',
 "FRAME=[{'package':'android','class':'android.widget.ListView','resource-id':'android:id/resolver_list','bounds':'[0,0][400,800]','clickable':'true','enabled':'true'}]",
 "APP=[{'package':d.BASE.PACKAGE,'class':'android.view.View','bounds':'[0,0][400,800]'}]",
 "assert resource.classify(FRAME,400,800)[0]=='present'",
 'assert d.scoped.scoped_triplet_category(FRAME,400,800)!=d.scoped.PASS',
 'def verdict(nodes,width,height):',
 '    assert (width,height)==(400,800)',
 "    return d.scoped.PASS if nodes is APP else 'home-not-bounded'",
 'def call(first,second,first_pid="900",second_pid="900",stage="pre-return"):',
 '    reads=iter([first,second])',
 "    with patch.object(d.BASE,'screen_size',return_value=(400,800)), patch.object(d.BASE,'xml_nodes',side_effect=lambda:next(reads)) as xml, patch.object(d.BASE,'adb',side_effect=AssertionError('unexpected adb')) as adb:",
 "        with patch.object(d.home,'observed_single_app_pid',side_effect=[first_pid,second_pid]) as pid, patch.object(d.scoped,'scoped_triplet_category',side_effect=verdict) as triplet:",
 '            error=None',
 '            try: d.attest_triplet("900",stage)',
 '            except RuntimeError as exc: error=exc',
 '            return error,xml.call_count,triplet.call_count,pid.call_count,adb.call_count',
].join('\n');

test('real framework resolver fixture is structurally distinct from app-owned Home',()=>{
 probe(header+'\n'+[
  "assert resource.classify(FRAME,400,800)==('present','absent','absent','present','absent','one')",
  "assert d.scoped.scoped_triplet_category(FRAME,400,800)=='home-not-bounded'",
  "print('PASS (LAB): resolver-first-snapshot-boundary')"
 ].join('\n'));
});

test('first snapshot from Android resolver then app is BLOCK, not recovered by second',()=>{
 probe(header+'\n'+[
  'err,reads,triplets,pids,adbs=call(FRAME,APP)',
  'assert isinstance(err,RuntimeError)',
  'assert str(err)=="scoped three-tab geometry was not twice verified"',
  'assert (reads,triplets,pids,adbs)==(2,2,2,0)',
  "print('PASS (LAB): resolver-first-snapshot-boundary')"
 ].join('\n'));
});

test('app followed by resolver and resolver followed by resolver both BLOCK',()=>{
 probe(header+'\n'+[
  'for first,second in ((APP,FRAME),(FRAME,FRAME)):',
  '    err,reads,triplets,pids,adbs=call(first,second)',
  '    assert isinstance(err,RuntimeError)',
  '    assert str(err)=="scoped three-tab geometry was not twice verified"',
  '    assert (reads,triplets,pids,adbs)==(2,2,2,0)',
  "print('PASS (LAB): resolver-first-snapshot-boundary')"
 ].join('\n'));
});

test('two valid app snapshots PASS only with unchanged same-PID, never send input',()=>{
 probe(header+'\n'+[
  'err,reads,triplets,pids,adbs=call(APP,APP)',
  'assert err is None',
  'assert (reads,triplets,pids,adbs)==(2,2,2,0)',
  'err,reads,triplets,pids,adbs=call(APP,APP,second_pid="901")',
  'assert isinstance(err,RuntimeError)',
  'assert str(err)=="scoped three-tab geometry was not twice verified"',
  'assert (reads,triplets,pids,adbs)==(2,2,2,0)',
  "print('PASS (LAB): resolver-first-snapshot-boundary')"
 ].join('\n'));
});

test('no bypass, new wait, relaxed geometry, app update or real data in test branch',()=>{
 for(const needle of [
  'first = scoped.scoped_triplet_category(BASE.xml_nodes(), width, height)',
  'second = scoped.scoped_triplet_category(BASE.xml_nodes(), width, height)',
  'first != scoped.PASS or second != scoped.PASS',
  'attest_triplet(pid, "pre-return")',
  'original_restore(pid)',
  'attest_triplet(pid, "post-return")',
 ])assert.ok(source.includes(needle),needle);
 for(const needle of ['original = previous.classify',
   'previous.classify = classify_existing','previous.classify = original',
   'return original(nodes, width, height)'])assert.ok(resource.includes(needle),needle);
 assert.doesNotMatch(resource,/\.adb\(|\.xml_nodes\(|sleep\(|input.*tap|force-stop/i);
});

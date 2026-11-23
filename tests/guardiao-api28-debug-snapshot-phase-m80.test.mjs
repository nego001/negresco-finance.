import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-api28-debug-pre-pix-repeat-m79.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-api28-debug-snapshot-boundary-m80.yml','utf8');
const runner=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_two_step_lab.py','utf8');
const stage=readFileSync('tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py','utf8');
const helper=readFileSync('tooling/android/guardiao_api28_debug_snapshot_phase_m80.py','utf8');
const external=readFileSync('tooling/android/guardiao_api28_debug_external_a11y_readonly_lab.py','utf8');
const policy=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_SNAPSHOT_PHASE_M80.md','utf8');

test('M80 workflow differs from M79 only in isolation, labels and sample size',()=>{
 let expected=old;
 const changes=[["name: Guardiao API28 Debug pre-Pix three independent repeats M79","name: Guardiao API28 Debug snapshot phase attribution M80"],["lab/p01-guardiao-api28-debug-pre-pix-repeat-m79-v1","lab/p01-guardiao-api28-debug-snapshot-boundary-m80-v1"],["guardiao-debug-pre-pix-m79-","guardiao-debug-snapshot-m80-"],["name: M79 trial ${{ matrix.trial }} - two consecutive guarded Debug cycles","name: M80 trial ${{ matrix.trial }} - snapshot phase diagnostic"],["trial: [1, 2, 3]","trial: [1, 2]"],["name: Recheck existing pre-Pix gates in three independent Debug emulators","name: Diagnose existing single UI snapshot phase in two Debug emulators"]];
 for(const [a,b] of changes){assert.equal(expected.split(a).length,2,a); expected=expected.replace(a,b);}
 assert.equal(current,expected);
 assert.match(current,/trial: \[1, 2\]/);
 assert.match(current,/fail-fast: false/);
 assert.match(current,/api-level: 28/);
 assert.match(current,/assembleDebug/);
 assert.match(current,/script: python3 tooling\/android\/guardiao_api28_debug_nav_two_cycles_staging_lab\.py/);
 assert.doesNotMatch(current,/assembleRelease|upload-artifact|download-artifact|workflow_dispatch:|schedule:|pull_request:|secrets\./);
});
test('M80 retains exact pre-existing input/read/cleanup counts and PPP',()=>{
 assert.equal((runner.match(/BASE\.screen_size\(\)/g)||[]).length,1);
 assert.equal((runner.match(/BASE\.xml_nodes\(\)/g)||[]).length,1);
 assert.equal((runner.match(/BASE\.adb\("shell", "rm", "-f", "\/sdcard\/negresco_ui\.xml", timeout=15\)/g)||[]).length,1);
 assert.equal((runner.match(/private_snapshot\(\)/g)||[]).length,4);
 assert.equal((runner.match(/guarded_preview_tap\((pix_center|home_center)\)/g)||[]).length,2);
 assert.equal((runner.match(/BASE\.adb\("shell", "input", "tap"/g)||[]).length,1);
 assert.equal((runner.match(/time\.sleep\(2\.0\)/g)||[]).length,2);
 assert.match(runner,/finally:\s*\n\s*# Always delete exactly as before/);
 assert.match(runner,/SNAPSHOT_DIAGNOSTIC = "snapshot-cleanup-unconfirmed"/);
 assert.match(stage,/ENV \(LAB\): debug-nav-snapshot=/);
 assert.match(stage,/CYCLES: tuple\[str, str\] = \("first", "second"\)/);
 assert.match(external,/time\.sleep\(30\.0\)/);
 assert.match(external,/\("idle-observed", "all-present", "PPP"\)/);
 assert.doesNotMatch(stage,/"input"|"tap"|time\.sleep|xml_nodes\(/);
});
test('M80 category allowlist contains no device, IO or private raw logging capability',()=>{
 for(const c of ['not-started','snapshot-screen-size-unconfirmed','snapshot-ui-tree-unconfirmed','snapshot-shape-unconfirmed','snapshot-cleanup-unconfirmed','snapshot-attested'])
   assert.ok(helper.includes('"'+c+'"'),c);
 assert.match(stage,/if snapshot not in SNAPSHOT_CATEGORIES:/);
 assert.doesNotMatch(helper,/\.adb\(|subprocess|xml_nodes\(|print\(|logging|socket|time\.sleep|requests|urllib/);
});
test('M80 five synthetic snapshot outcomes fail closed and always delete XML once',()=>{
 const script=[
 'import sys,types',
 "sys.path.insert(0,'tooling/android')",
 "for n in ('guardiao_api28_debug_external_a11y_readonly_lab','guardiao_api28_debug_home_readiness_census_lab','guardiao_api28_debug_targetid_presence_lab','guardiao_api28_debug_nav_preview_guard'):",
 ' sys.modules[n]=types.ModuleType(n)',
 "o=sys.modules['guardiao_api28_debug_external_a11y_readonly_lab']",
 'o.debug=types.SimpleNamespace(base=None)',
 "o.DEBUG_PACKAGE='fixture.invalid'",
 'import guardiao_api28_debug_nav_preview_two_step_lab as m',
 'class Fake:',
 ' def __init__(self,fail): self.fail=fail;self.calls=[]',
 ' def screen_size(self):',
 "  self.calls.append('size')",
 "  if self.fail=='size': raise RuntimeError('fixture')",
 "  return (0,900) if self.fail=='shape' else (1080,900)",
 ' def xml_nodes(self):',
 "  self.calls.append('nodes')",
 "  if self.fail=='tree': raise RuntimeError('fixture')",
 '  return []',
 ' def adb(self,*args,**kwargs):',
 "  self.calls.append('rm')",
 "  assert args==('shell','rm','-f','/sdcard/negresco_ui.xml')",
 "  assert kwargs=={'timeout':15}",
 "  if self.fail=='cleanup': raise RuntimeError('fixture')",
 "cases={'ok':('snapshot-attested',['size','nodes','rm']),'size':('snapshot-screen-size-unconfirmed',['size','rm']),'tree':('snapshot-ui-tree-unconfirmed',['size','nodes','rm']),'shape':('snapshot-shape-unconfirmed',['size','nodes','rm']),'cleanup':('snapshot-cleanup-unconfirmed',['size','nodes','rm'])}",
 'for fail,(expected,calls) in cases.items():',
 ' base=Fake(fail);m.BASE=base',
 ' try:',
 '  value=m.private_snapshot()',
 "  assert fail=='ok' and value==([],1080,900)",
 ' except Exception:',
 "  assert fail!='ok'",
 ' assert base.calls==calls,(fail,base.calls)',
 ' assert m.SNAPSHOT_DIAGNOSTIC==expected,(fail,m.SNAPSHOT_DIAGNOSTIC)',
 "print('PASS (LAB): M80 fixed snapshot categories and cleanup invariants')"
 ].join('\n');
 const r=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): M80 fixed snapshot categories and cleanup invariants/);
});
test('M80 preserves history and Release blocks',()=>{
 for(const x of ['M75','M76','M77','M78','M79','M80','1,695/1,695','#120','#126','Draft',
  'approvedForProduction=false','stableReleaseAllowed=false','No retries'])
 assert.ok(policy.includes(x),x);
});

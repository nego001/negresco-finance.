import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const workflow=readFileSync('.github/workflows/guardiao-original-release-api28-two-cycle-lab.yml','utf8');
const runner=readFileSync('tooling/android/guardiao_original_release_two_cycle_lab.py','utf8');
const auditor=readFileSync('tooling/android/verify_guardiao_api28_two_cycle_receipts.py','utf8');

test('API28 two-cycle laboratory pins original Release and never publishes APK',()=>{
 assert.match(workflow,/lab\/p01-guardiao-debug-metro-phase-v1/);
 assert.match(workflow,/name: negresco-finance-v313-security-preview/);
 assert.match(workflow,/run-id: 40617164086/);
 assert.match(workflow,/29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a/);
 assert.match(workflow,/sha256sum --check --strict/);
 assert.match(workflow,/test ! -L test-apk\/Negresco-Finance-V3\.1\.3-preview\.apk/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/python3 tooling\/android\/guardiao_original_release_two_cycle_lab\.py/);
 assert.match(workflow,/needs: android-api28-two-cycle/);
 assert.match(workflow,/verify_guardiao_api28_two_cycle_receipts\.py two-cycle-review/);
 assert.match(workflow,/name: guardiao-api28-two-cycle-metadata-unreviewed/);
 assert.match(workflow,/retention-days: 2/);
 assert.doesNotMatch(workflow,/workflow_dispatch|assembleRelease|eas update|upload-apk|signingConfig|secrets\./i);
 assert.doesNotMatch(workflow,/path:\s*[^\n]*(?:\.apk|\.pdf|logcat|screenshots?)/i);
});

test('both cycles require fresh app data, fresh callback state and per-cycle real receipt gates',()=>{
 assert.match(runner,/CYCLES = \("a", "b"\)/);
 assert.match(runner,/if len\(sys\.argv\) != 1 or OUT\.exists\(\) or semantic\.REPORT\.exists\(\):/);
 assert.match(runner,/if index:\s*\n\s*cleared = base\.adb\("shell", "pm", "clear", base\.PACKAGE/);
 assert.match(runner,/if cleared\.strip\(\) != "Success":/);
 assert.match(runner,/semantic\.observed = None/);
 assert.match(runner,/replay\.run\(\)/);
 assert.match(runner,/parsed = receipt\.read_receipt\(semantic\.REPORT\)/);
 assert.match(runner,/receipt\.verify\(parsed, 28\)/);
 assert.match(runner,/semantic\.REPORT\.replace\(folder \/ receipt\.MEMBER\)/);
 const reset=runner.indexOf('semantic.observed = None');
 const run=runner.indexOf('replay.run()',reset);
 const verify=runner.indexOf('receipt.verify(parsed, 28)',run);
 const move=runner.indexOf('semantic.REPORT.replace(folder / receipt.MEMBER)',verify);
 assert.ok(reset>=0&&run>reset&&verify>run&&move>verify);
 assert.doesNotMatch(runner,/print\([^\n]*(?:FIXTURE|parsed|receivedPdfSha256|xml_nodes|REPORT\.read_text)/);
});

test('both receipts reject missing, symlinked, extra, wrong API and altered evidence',()=>{
 const code=[
 'import sys,tempfile,pathlib,json',
 "sys.path.insert(0,'tooling/android')",
 'import verify_guardiao_api28_two_cycle_receipts as v',
 'import verify_collection48_receipt as r',
 'with tempfile.TemporaryDirectory() as tmp:',
 '  root=pathlib.Path(tmp)/"two-cycles"',
 '  root.mkdir()',
 '  def fixture():',
 '    x={k:True for k in r.TRUE_FLAGS}',
 '    x.update({k:False for k in r.FALSE_FLAGS})',
 '    x.update({"api":28,"apkSha256":r.APK_SHA,"scope":r.SCOPE,"sourceFixture":r.FIXTURE,"schemaVersion":2,"pdfPageCount":1,"pdfPages":1,"nonblankPages":1,"textPagesVerified":1,"pdfSizeBytes":2048,"receivedPdfSha256":"a"*64})',
 '    return x',
 '  for cycle in ("a","b"):',
 '    folder=root/("cycle-"+cycle)',
 '    folder.mkdir()',
 '    (folder/r.MEMBER).write_text(json.dumps(fixture()))',
 '  v.verify_two_cycles(root)',
 '  receipt=root/"cycle-b"/r.MEMBER',
 '  receipt.unlink()',
 '  try: v.verify_two_cycles(root)',
 '  except Exception: pass',
 '  else: raise AssertionError("missing cycle accepted")',
 '  receipt.write_text(json.dumps(dict(fixture(),api=26)))',
 '  try: v.verify_two_cycles(root)',
 '  except Exception: pass',
 '  else: raise AssertionError("wrong API accepted")',
 '  receipt.unlink()',
 '  receipt.symlink_to(root/"cycle-a"/r.MEMBER)',
 '  try: v.verify_two_cycles(root)',
 '  except Exception: pass',
 '  else: raise AssertionError("symlink accepted")',
 '  receipt.unlink()',
 '  receipt.write_text(json.dumps(fixture()))',
 '  extra=root/"untracked"',
 '  extra.mkdir()',
 '  try: v.verify_two_cycles(root)',
 '  except Exception: pass',
 '  else: raise AssertionError("extra directory accepted")',
 'print("PASS: two-cycle receipt gate rejects unsafe or missing evidence")'
 ].join('\n');
 const r=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'PASS: two-cycle receipt gate rejects unsafe or missing evidence');
 assert.match(auditor,/read_member_at\(folder_fd\)/);
 assert.match(auditor,/receipt\.verify\(parsed, 28\)/);
 assert.match(auditor,/receipt\.open_no_symlink_path\(root, DIR_FLAGS\)/);
 assert.doesNotMatch(auditor,/print\(parsed|print\(root|upload|\.pdf/);
});

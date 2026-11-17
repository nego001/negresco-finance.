import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const w=readFileSync('.github/workflows/guardiao-v5-api28-resource-signals-eight-trials.yml','utf8');
const p=readFileSync('tooling/android/guardiao_v5_api28_framework_resource_signals_lab.py','utf8');
const base=readFileSync('tooling/android/guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab.py','utf8');

test('eight independent cold emulator attempts using unchanged Android API28 test APK',()=>{
 for(const needle of [
  'lab/p01-guardiao-v5-api28-resource-signals-eight-trials-v1', 'api: [28]',
  'trial: [1, 2, 3, 4, 5, 6, 7, 8]',
  'fail-fast: false', 'run-id: 43789332636',
  '0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4',
  'CN=Android Debug', 'sha256sum --check --strict',
  '-no-snapshot', 'persist-credentials: false',
  'script: python3 tooling/android/guardiao_v5_api28_framework_resource_signals_lab.py',
  'contents: read', 'actions: read',
 ]) assert.ok(w.includes(needle),needle);
 assert.doesNotMatch(w,/contents: write|continue-on-error: true|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch:|pull_request:|schedule:|secrets\./i);
});

test('stress uses same read-only pipeline and no extra Android reads or gestures',()=>{
 for(const needle of ['original = previous.classify',
  'previous.classify = classify_existing', 'previous.classify = original',
  'return original(nodes, width, height)', 'previous.run()']) assert.ok(p.includes(needle),needle);
 const begin=p.indexOf('def classify('),end=p.indexOf('\ndef run()',begin);
 assert.ok(begin>=0&&end>begin);
 assert.doesNotMatch(p.slice(begin,end),/\.adb\(|\.xml_nodes\(|print\(|sleep\(|tap\(|swipe\(/);
});

test('repeated stress preserves both strict pre-return snapshots and existing PID gate',()=>{
 for(const needle of [
  'first = scoped.scoped_triplet_category(BASE.xml_nodes(), width, height)',
  'second = scoped.scoped_triplet_category(BASE.xml_nodes(), width, height)',
  'first != scoped.PASS or second != scoped.PASS',
  'attest_triplet(pid, "pre-return")',
  'original_restore(pid)',
  'attest_triplet(pid, "post-return")',
 ]) assert.ok(base.includes(needle),needle);
 assert.doesNotMatch(w,/retry|retries|sleep 30|sleep 60/i);
});

test('no app build, new files, data capture or public uploads from workflow',()=>{
 assert.doesNotMatch(w,/screenshot|logcat|adb shell dumpsys|npm run build|gradlew assemble|upload-artifact|artifacts: write|actions: write/i);
 assert.match(w,/Build permissionless independent PDF receiver/);
 assert.match(w,/independent/i);
});

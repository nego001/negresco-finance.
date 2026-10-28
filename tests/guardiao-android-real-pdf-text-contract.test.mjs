import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const runner = readFileSync('tooling/android/guardiao_android_export_pdf_text_emulator_smoke.py','utf8');
const original = readFileSync('tooling/android/guardiao_pdf_ui_emulator_smoke.py','utf8');
const receiver = readFileSync('tooling/android/pdf-receiver-lab/app/src/main/java/com/negresco/pdfreceiver/lab/ReceiverActivity.java','utf8');
const manifest = readFileSync('tooling/android/pdf-receiver-lab/app/src/main/AndroidManifest.xml','utf8');
const workflow = readFileSync('.github/workflows/guardiao-android-real-pdf-text-lab.yml','utf8');

test('one-shot synthetic capture is private, default-off, not enabled via untrusted share intent',()=>{
  assert.match(manifest,/android:debuggable="true"/);
  assert.doesNotMatch(manifest,/<uses-permission/);
  assert.match(receiver,/CAPTURE_MARKER = "allow-synthetic-text-check-once"/);
  assert.match(receiver,/CAPTURE_FILE = "captured-synthetic-report\.pdf"/);
  assert.match(receiver,/new File\(getFilesDir\(\), CAPTURE_MARKER\)/);
  assert.match(receiver,/if \(marker\.isFile\(\)\)/);
  assert.match(receiver,/if \(!marker\.delete\(\)\) throw new IllegalStateException/);
  assert.match(receiver,/if \(snapshot\.exists\(\)\) throw new IllegalStateException/);
  assert.match(receiver,/if \(snapshot\.length\(\) != size\)/);
  assert.match(receiver,/temp\.delete\(\)/);
  assert.match(receiver,/syntheticTextCapture/);
  assert.doesNotMatch(receiver,/getBooleanExtra\(.*CAPTURE|System\.out|android\.util\.Log|file:\/\/\/sdcard|Environment\.getExternal/);
});

test('existing UI fixture and receiver gates remain unchanged in normal mode',()=>{
  assert.match(original,/FIXTURE = "0" \* 47/);
  assert.match(original,/EXPECTED_SHA = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"/);
  assert.match(original,/if after_verified_receipt is None:/);
  assert.match(original,/receive_from_chooser\(api, digest\)/);
  assert.match(original,/if after_receiver_install is not None:/);
  assert.match(original,/if not receiver_cache_empty_of_pdf\(\):/);
  assert.match(original,/if not validate_receiver_receipt\(receipt\):/);
});

test('independent extractor checks actual Android APK PDF bytes and field semantics',()=>{
  assert.match(runner,/import guardiao_pdf_ui_emulator_smoke as base/);
  assert.match(runner,/base\.FIXTURE not in \("0" \* 47, "8" \+ "0" \* 47\)/);
  assert.match(runner,/base\.run_smoke\(after_receiver_install=prepare_private_one_shot,/);
  assert.match(runner,/after_verified_receipt=inspect_real_android_pdf/);
  assert.match(runner,/receipt\.get\("syntheticTextCapture"\) is not True/);
  assert.match(runner,/base\.adb\("shell", "run-as", PKG, "touch", MARKER\)/);
  assert.match(runner,/base\.adb\("shell", "run-as", PKG, "rm", "-f", CAPTURE, MARKER\)/);
  assert.match(runner,/"adb", "exec-out", "run-as", PKG, "cat", CAPTURE/);
  assert.match(runner,/hashlib\.sha256\(raw\)\.hexdigest\(\)/);
  assert.match(runner,/digest != receipt\.get\("sha256"\)/);
  assert.match(runner,/len\(raw\) != receipt\.get\("bytes"\)/);
  assert.match(runner,/pdftotext/);
  assert.match(runner,/pdfinfo/);
  assert.match(runner,/for i in range\(1, pages \+ 1\):/);
  assert.match(runner,/Legitimidade da cobrança: inconclusiva\./);
  assert.match(runner,/Nenhuma operação de pagamento foi realizada\./);
  assert.match(runner,/privateCaptureDeleted": True/);
  assert.match(runner,/finally:\s*\n        # Mandatory regardless of output or extraction failure\./);
  assert.match(runner,/ensure_absent\(\)/);
  assert.doesNotMatch(runner,/print\(raw\)|print\(actual\)|print\(text\)|screencap|logcat|requests\.|httpx\./);
});

test('workflow runs only on old Android emulators with audited SHA and metadata-only artifact',()=>{
  assert.match(workflow,/lab\/p01-guardiao-android-export-pdf-text-api26-28-v1/);
  assert.match(workflow,/permissions:\s*\n  contents: read\s*\n  actions: read/);
  assert.match(workflow,/persist-credentials: false/);
  assert.match(workflow,/api: \[26, 28\]/);
  assert.match(workflow,/target: google_apis/);
  assert.match(workflow,/run-id: 40617164086/);
  assert.match(workflow,/29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a/);
  assert.match(workflow,/guardiao_android_export_pdf_text_emulator_smoke\.py/);
  assert.match(workflow,/path: guardiao-android-real-pdf-text-receipt\.json/);
  assert.match(workflow,/retention-days: 2/);
  assert.doesNotMatch(workflow,/contents: write|workflow_dispatch|secrets\.|eas update|expo publish|gh release|path: .*\.pdf|adb pull|\badb\s+(?:shell\s+)?(?:screencap|logcat)\b/);
});

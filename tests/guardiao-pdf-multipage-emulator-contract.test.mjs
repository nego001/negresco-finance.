import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const provider = readFileSync('tooling/android/pdf-receiver-lab/app/src/main/java/com/negresco/pdfreceiver/lab/FixturePdfProvider.java', 'utf8');
const receiver = readFileSync('tooling/android/pdf-receiver-lab/app/src/main/java/com/negresco/pdfreceiver/lab/ReceiverActivity.java', 'utf8');
const manifest = readFileSync('tooling/android/pdf-receiver-lab/app/src/main/AndroidManifest.xml', 'utf8');
const build = readFileSync('tooling/android/pdf-receiver-lab/build_receiving_apk.sh', 'utf8');
const runner = readFileSync('tooling/android/guardiao_pdf_multipage_emulator_smoke.py', 'utf8');
const workflow = readFileSync('.github/workflows/guardiao-pdf-multipage-emulator-lab.yml', 'utf8');

test('isolated multipage lab stays branch-only, read-only and unrelated to financial APK', () => {
  assert.match(workflow, /lab\/p01-guardiao-pdf-multipage-fixture-26-28-v1/);
  assert.match(workflow, /permissions:\s*\n  contents: read/);
  assert.match(workflow, /api: \[26, 28\]/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /guardiao_pdf_multipage_emulator_smoke.py/);
  assert.doesNotMatch(workflow, /contents: write|workflow_dispatch|gh release|eas update|expo publish|secrets\.|download-artifact/);
  assert.match(runner, /"financialApkInstalled": False/);
  assert.match(runner, /"crossAppShareValidatedHere": False/);
  assert.match(runner, /"approvedForProduction": False, "stableReleaseAllowed": False/);
});

test('fixture provider is private and streams exactly three synthetic pages without files', () => {
  assert.match(manifest, /android:name="\.FixturePdfProvider"/);
  assert.match(manifest, /android:exported="false"/);
  assert.match(manifest, /android:grantUriPermissions="false"/);
  assert.doesNotMatch(manifest, /<uses-permission/);
  assert.match(provider, /ParcelFileDescriptor\.createPipe\(\)/);
  assert.match(provider, /new ParcelFileDescriptor\.AutoCloseOutputStream\(pipe\[1\]\)/);
  assert.match(provider, /new PdfDocument\(\)/);
  assert.match(provider, /for \(int n = 1; n <= 3; n\+\+\)/);
  assert.match(provider, /blankMiddle && n == 2/);
  assert.match(provider, /document\.writeTo\(out\)/);
  assert.match(provider, /"\/nonblank-3"/);
  assert.match(provider, /"\/blank-middle-3"/);
  assert.doesNotMatch(provider, /getExternalFilesDir|FileOutputStream|HttpURLConnection|Socket\(|android\.util\.Log|System\.out/);
});

test('receiver fail-closed reason distinguishes blank page 2 from unrelated failures', () => {
  assert.match(receiver, /for \(int index = 0; index < pages; index\+\+\)/);
  assert.match(receiver, /renderer\.openPage\(index\)/);
  assert.match(receiver, /if \(!hasVisibleInk\(bmp\)\)/);
  assert.match(receiver, /throw new BlankPageException\(index\)/);
  assert.match(receiver, /catch \(BlankPageException blank\)/);
  assert.match(receiver, /"rejectedPageIndex/);
  assert.match(receiver, /blank\.pageIndex/);
  assert.match(receiver, /blank-page/);
  assert.match(receiver, /temp\.delete\(\)/);
  assert.doesNotMatch(receiver, /Log\.|System\.out|BitmapFactory|compress\(/);
});

test('runner clears stale receipt, checks exact positive and negative outcomes, and fails on cache inspection error', () => {
  assert.match(runner, /run-as", PKG, "rm", "-f", "files\/receipt.json"/);
  assert.match(runner, /run-as", PKG, "cat", "files\/receipt.json"/);
  assert.match(runner, /"nonblank-3", True/);
  assert.match(runner, /"blank-middle-3", False/);
  assert.match(runner, /receipt\["pages"\] != 3/);
  assert.match(runner, /receipt\["nonblankPages"\] != 3/);
  assert.match(runner, /receipt\.get\("reason"\) != "blank-page"/);
  assert.match(runner, /receipt\["rejectedPageIndex"\] != 1/);
  assert.match(runner, /if not receiver_cache_clean\(\):/);
  assert.match(runner, /"ls", "cache", check=True/);
  assert.match(runner, /"syntheticOnly": True/);
  assert.doesNotMatch(runner, /adb\("shell", "screencap"|adb\("shell", "logcat"|write_bytes|adb\("pull"|print\(receipt\)/);
});

test('receiver publishes a receipt only after private cache removal is attempted', () => {
  const method = receiver.slice(receiver.indexOf('private void receiveAndRender()'),
                                receiver.indexOf('private static final class BlankPageException'));
  assert.equal((method.match(/writeReceipt\\(/g) || []).length, 1);
  assert.match(method, /boolean cacheClean = temp == null \\|\\| temp\\.delete\\(\\) \\|\\| !temp\\.exists\\(\\)/);
  assert.match(method, /if \\(!cacheClean\\)/);
  assert.match(method, /cache-cleanup-failed/);
  assert.ok(method.indexOf('temp.delete()') < method.indexOf('writeReceipt(receipt)'));
  assert.doesNotMatch(method.slice(0, method.indexOf('} finally {')), /writeReceipt\\(/);
});

test('SDK-only build compiles provider and nested exception; no external packaging service', () => {
  assert.match(build, /FixturePdfProvider\.java/);
  assert.match(build, /\$SOURCE" "\$FIXTURE_SOURCE"/);
  assert.match(build, /"\$WORK\/classes\/com\/negresco\/pdfreceiver\/lab\/"\*\.class/);
  assert.match(build, /--min-api 26/);
  assert.match(build, /Receiver APK must have zero Android permissions/);
  assert.doesNotMatch(build, /curl |wget |mvn |gradle |https?:\/\//);
  assert.match(workflow, /retention-days: 2/);
  assert.doesNotMatch(workflow, /upload.*\.pdf|screencap|logcat/);
});

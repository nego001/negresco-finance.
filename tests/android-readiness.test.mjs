import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=(path)=>readFileSync(new URL(path,root),'utf8');

test('SQLCipher and zero-knowledge are formally assigned only to Negresco Finance',()=>{
 const adr=read('docs/decisions/0001-sqlcipher-zero-knowledge-negresco-only.md');
 const phase=read('docs/PHASE1_BASELINE.md');
 assert.match(adr,/somente no repositório/);
 assert.match(adr,/Security Black/);
 assert.match(adr,/não significa que o SQLCipher/);
 assert.match(phase,/ADR 0001/);
});

test('Android readiness tool is read-only and checks package metadata',()=>{
 const source=read('tooling/windows/android-v31-readonly-preflight.ps1');
 assert.match(source,/\[CmdletBinding\(\)\]/);
 assert.match(source,/Get-FileHash/);
 assert.match(source,/adb\.exe/);
 assert.match(source,/shell pm path \$packageName/);
 assert.match(source,/shell dumpsys package \$packageName/);
 assert.doesNotMatch(source,/\badb\s+(?:install|uninstall|push)\b/i);
 assert.doesNotMatch(source,/shell\s+pm\s+clear\b/i);
 assert.doesNotMatch(source,/shell\s+rm\s+-/i);
});

test('Samsung manual QA checklist explicitly protects installed app data',()=>{
 const qa=read('docs/ANDROID_QA_V3.1.md');
 assert.match(qa,/QA-21/);
 assert.match(qa,/QA-22/);
 assert.match(qa,/não desinstalar antes/i);
});

test('Windows update verifier compares installed public APK identity without device writes',()=>{
 const source=read('tooling/windows/compare-installed-apk.ps1');
 assert.match(source,/\[CmdletBinding\(\)\]/);
 assert.match(source,/Find-AndroidTool 'apksigner'/);
 assert.match(source,/Find-AndroidTool 'aapt'/);
 assert.match(source,/shell pm path \$packageName/);
 assert.match(source,/pull \$deviceApk \$localCopy/);
 assert.match(source,/Remove-Item -LiteralPath \$localCopy -Force/);
 assert.match(source,/\$installedCert -cne \$candidateCert/);
 assert.match(source,/\$candidate\.VersionCode -le \$installed\.VersionCode/);
 assert.match(source,/\$packageName='com\.negresco\.finance'/);
 assert.doesNotMatch(source,/shell\s+pm\s+(?:clear|uninstall|install)\b/i);
 assert.doesNotMatch(source,/&\s+\$adb(?:\.Source)?[^\n]*\b(?:install|uninstall|push|root|remount)\b/i);
});
test('PowerShell 5.1 parser audit covers both read-only Windows tools',()=>{
 const workflow=read('.github/workflows/windows-readonly-tools-check.yml');
 assert.match(workflow,/windows-latest/);
 assert.match(workflow,/windows\/compare-installed-apk\.ps1/);
 assert.match(workflow,/windows\/android-v31-readonly-preflight\.ps1/);
 assert.match(workflow,/Parser\]::ParseFile/);
});

test('native lock Kotlin spike is isolated from APK and checked in CI',()=>{
 const path='tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/NativeLockCoordinator.kt';
 const source=read(path);
 const nativeCheck=read('.github/workflows/ci.yml');
 const config=read('apps/mobile/app.json');
 assert.match(source,/internal interface AtomicLockStore/);
 assert.match(source,/internal fun interface NativeBiometricVerifier/);
 assert.match(source,/private var promptInFlight = false/);
 assert.match(source,/generation\+\+/);
 assert.match(nativeCheck,/native-lock-spike:/);
 assert.match(nativeCheck,/gradle -p tooling\/native-lock-spike policyCheck --no-daemon/);
 assert.doesNotMatch(config,/NegrescoNativeLock|NativeLockCoordinator/);
});

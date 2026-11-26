import {historicalAppPath} from './helpers/guardiao_historical_app_m144.mjs';
import {originalManifest} from './helpers/guardiao_dependency_state_m143.mjs';
historicalAppPath();
originalManifest();
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-pdf-two-same-pid-lab.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-safe-insets-pdf-m114.yml','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_SAFE_INSETS_PDF_M114.md','utf8');
const apply=(s,pairs)=>{for(const [a,b] of pairs){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}return s;};
test('M114 exact existing two PDF workflow except scoped M111 app and dependency setup',()=>{
 assert.equal(current,apply(old,[["Guardiao Android 9 Debug two PDFs in one PID (synthetic lab only)","Guardiao Android 9 Debug safe insets PDF M114"],["      - lab/p01-guardiao-debug-pdf-two-same-pid-v1\n      - lab/p01-guardiao-pdf-phase-readonly-v1","      - lab/p01-guardiao-debug-safe-insets-pdf-m114-v1"],["guardiao-debug-pdf-two-same-pid-","guardiao-debug-safe-insets-pdf-m114-"],["Two independent synthetic Debug PDFs in same live PID API28","M114 two synthetic PDFs with M111 safe insets API28"],["      - name: Install isolated mobile dependencies and prebuild a new Android test project","      - name: Apply exact M111 app and package only in disposable Debug workspace\n        run: |\n          set -euo pipefail\n          python3 tooling/android/guardiao_debug_safe_insets_pdf_m114.py apply\n      - name: Install isolated mobile dependencies and prebuild a new Android test project"],["          npm install --no-audit --no-fund\n          npx tsc --noEmit","          npm install --no-audit --no-fund\n          node -e 'const b=require(\"expo/bundledNativeModules.json\"); const p=require(\"react-native-safe-area-context/package.json\"); if(b[\"react-native-safe-area-context\"]!==\"~5.6.0\" || p.version!==\"5.6.0\") process.exit(1); console.log(\"PASS (LAB): Expo SDK safe area dependency version attested\")'\n          npx tsc --noEmit"]]));
 for(const x of ['api-level: 28','script: python3 tooling/android/guardiao_debug_pdf_two_same_pid_lab.py','build_receiving_apk.sh','verify-debug-apk','pdftotext','assembleDebug']) assert.ok(current.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, os, tempfile',
 "from pathlib import Path",
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_safe_insets_pdf_m114 as m',
 'import guardiao_debug_safe_insets_m111 as p',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M114 uses exact M111 transformations on two temporary files only',()=>run([
 'assert m.app_transform is p.app_transform and m.package_transform is p.package_transform',
 'a=__import__("pathlib").Path("tooling/android/fixtures/m139-historical-baseline/App.tsx").read_text(encoding="utf-8"); b=__import__("pathlib").Path("tooling/android/fixtures/m139-historical-baseline/package.json").read_text(encoding="utf-8")',
 'os.environ.update(GITHUB_ACTIONS="true",GITHUB_REF=m.LAB_REF)',
 'with tempfile.TemporaryDirectory() as d:',
 ' m.APP=Path(d)/"App.tsx"; m.PACKAGE=Path(d)/"package.json"',
 ' m.APP.write_text(a,encoding="utf-8"); m.PACKAGE.write_text(b,encoding="utf-8")',
 ' m.apply()',
 ' assert m.APP.read_text(encoding="utf-8")==p.app_transform(a)',
 ' assert m.PACKAGE.read_text(encoding="utf-8")==p.package_transform(b)',
 ' assert len(list(Path(d).iterdir()))==2'
]));
test('M114 blocks invalid scope or missing file before writes',()=>run([
 'a=__import__("pathlib").Path("tooling/android/fixtures/m139-historical-baseline/App.tsx").read_text(encoding="utf-8"); b=__import__("pathlib").Path("tooling/android/fixtures/m139-historical-baseline/package.json").read_text(encoding="utf-8")',
 'with tempfile.TemporaryDirectory() as d:',
 ' m.APP=Path(d)/"App.tsx"; m.PACKAGE=Path(d)/"package.json"',
 ' m.APP.write_text(a,encoding="utf-8"); m.PACKAGE.write_text(b,encoding="utf-8")',
 ' os.environ.update(GITHUB_ACTIONS="true",GITHUB_REF="refs/heads/main")',
 ' try: m.apply(); raise AssertionError("scope must reject")',
 ' except RuntimeError: pass',
 ' assert m.APP.read_text(encoding="utf-8")==a and m.PACKAGE.read_text(encoding="utf-8")==b',
 ' os.environ["GITHUB_REF"]=m.LAB_REF',
 ' m.PACKAGE.unlink()',
 ' try: m.apply(); raise AssertionError("missing package must reject")',
 ' except RuntimeError: pass',
 ' assert m.APP.read_text(encoding="utf-8")==a'
]));
test('M114 preserves M113 evidence and production gates',()=>{
 for(const x of ["M113","1,850/1,850","4/4 cycles","same PID","no PDF","gestural","threebutton","API28","#120","#126","Draft","approvedForProduction=false","stableReleaseAllowed=false","29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"]) assert.ok(doc.includes(x),x);
});

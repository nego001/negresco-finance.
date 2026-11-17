import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const wf=readFileSync('.github/workflows/guardiao-v5-api28-footer-sibling-cold-stress.yml','utf8');
const py=readFileSync('tooling/android/guardiao_v5_api28_footer_sibling_cold_stress_lab.py','utf8');

test('four independent Android9 scoped four-PDF stress jobs reuse exact v5 APK bytes',()=>{
 for(const term of ['lab/p01-guardiao-v5-api28-footer-sibling-cold-stress-v1','api: [28]','trial: [1, 2, 3, 4]',
  'fail-fast: false','run-id: 43789332636','CN=Android Debug',
  '0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4',
  'sha256sum --check --strict','api-level: ${{ matrix.api }}',
  'script: python3 tooling/android/guardiao_v5_api28_footer_sibling_cold_stress_lab.py','contents: read','actions: read',
  'persist-credentials: false','build_receiving_apk.sh','pdftotext']){
  assert.ok(wf.includes(term),term);
 }
 assert.doesNotMatch(wf,/contents: write|continue-on-error: true|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch:|pull_request:|schedule:|eas update|secrets\./i);
});

test('footer diagnostic only annotates already existing snapshot and returns original detail',()=>{
 for(const term of ['original_detail = home.safe_initial_home_detail',
  'return original_detail(nodes, width, height)',
  'home.safe_initial_home_detail = read_only_detail',
  'home.safe_initial_home_detail = original_detail','prior.run()',
  'category = classify_footer_labels(nodes, width, height)',
  'geometry.BASE.PACKAGE','home.safe_bounds_shape(raw, width, height)',
  'BLOCK (LAB): API28 footer-only sibling diagnostic incomplete']){
  assert.ok(py.includes(term),term);
 }
 const start=py.indexOf('def classify_footer_labels(');
 const end=py.indexOf('\ndef run()',start);
 assert.ok(start>=0&&end>start);
 assert.doesNotMatch(py.slice(start,end),/\.adb\(|\.xml_nodes\(|input", "tap"|input", "swipe"|print\(|sleep\(|force-stop/);
 assert.doesNotMatch(py,/print\(nodes\)|print\(raw\)|print\(width\)|print\(height\)|print\(original_detail/);
});

test('synthetic exact labels separate extra Pix shortcut from footer duplicates without granting PASS',()=>{
 const source=[
  'import sys',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_v5_api28_footer_sibling_cold_stress_lab as x',
  'pkg=x.geometry.BASE.PACKAGE',
  'def n(t,a,b,c,d): return dict(package=pkg,**{"class":"android.widget.TextView","enabled":"true","text":t,"bounds":f"[{a},{b}][{c},{d}]"})',
  'a=[n("Início",10,620,100,670),n("Pix",140,620,240,670),n("Negresco",270,620,390,670)]',
  'assert x.classify_footer_labels(a,400,800)=="footer-candidates-unique-no-extras"',
  'assert x.classify_footer_labels(a+[n("Pix",10,100,120,150)],400,800)=="footer-candidates-unique-pix-extra"',
  'assert x.classify_footer_labels(a+[n("Pix",140,620,240,670)],400,800)=="footer-candidates-not-unique"',
  'assert x.classify_footer_labels(a[:2],400,800)=="footer-candidates-not-unique"',
  'assert x.classify_footer_labels(a,0,800)=="snapshot-unconfirmed"',
  'assert x.classify_footer_labels([object()],400,800)=="snapshot-unconfirmed"',
  'print("PASS (LAB): exact synthetic footer classification, no navigation approval")'
 ].join('\n');
 const p=spawnSync('python3',['-c',source],{encoding:'utf8',timeout:20000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS \(LAB\): exact synthetic footer classification, no navigation approval/);
 assert.doesNotMatch(p.stdout,/file:\/\/|\/data\/user\/|\d{48}/);
});
test('runtime parameter cannot alter SHA or enable original APK',()=>{
 const p=spawnSync('python3',['tooling/android/guardiao_v5_api28_footer_sibling_cold_stress_lab.py','override'],{encoding:'utf8',timeout:15000});
 assert.equal(p.status,1,p.stderr);
 assert.ok(p.stderr.includes('BLOCK (LAB): API28 footer-only sibling diagnostic incomplete'));
 assert.doesNotMatch(p.stdout+p.stderr,/file:\/\/|\/data\/user\/|\d{48}/);
});

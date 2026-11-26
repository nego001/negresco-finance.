import {historicalAppPath} from './helpers/guardiao_historical_app_m144.mjs';
import {originalManifest} from './helpers/guardiao_dependency_state_m143.mjs';
historicalAppPath();
originalManifest();
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-first-analyze-m115.yml','utf8');
const cur=readFileSync('.github/workflows/guardiao-integration-candidate-m117.yml','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_INTEGRATION_CANDIDATE_M117.md','utf8');
test('M117 exact one-tap workflow with reviewable candidate patch',()=>{
 let expected=old;for(const [a,b] of [["Guardiao Android 9 Debug first Analyze M115","Guardiao Android 9 integration candidate M117"],["lab/p01-guardiao-debug-first-analyze-m115-v1","lab/p01-guardiao-integration-candidate-m117-v1"],["guardiao-debug-first-analyze-m115-","guardiao-integration-candidate-m117-"],["M115 first Analyze tap and two synthetic PDFs API28","M117 consolidated candidate two synthetic PDFs API28"],["Apply exact M114 app and scoped first Analyze tap control","Apply reviewed candidate patch and unchanged one-tap PDF gate"],["guardiao_debug_first_analyze_m115.py apply","guardiao_integration_candidate_m117.py apply"]]){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 assert.equal(cur,expected);
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, os, tempfile',
 'from pathlib import Path',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_integration_candidate_m117 as m',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M117 real git apply in private temp tree equals functional M111 and M116 delta',()=>run([
 'app=__import__("pathlib").Path("tooling/android/fixtures/m139-historical-baseline/App.tsx").read_text(encoding="utf-8"); package=__import__("pathlib").Path("tooling/android/fixtures/m139-historical-baseline/package.json").read_text(encoding="utf-8")',
 'expected=m.expected(app,package)',
 'assert "NEGRESCO_LAB_M116_ANALYZE_" not in expected[0]',
 'assert "keyboardShouldPersistTaps=" in expected[0]',
 'with tempfile.TemporaryDirectory() as d:',
 ' root=Path(d); a=root/m.APP; p=root/m.PACKAGE',
 ' a.parent.mkdir(parents=True); a.write_text(app,encoding="utf-8"); p.write_text(package,encoding="utf-8")',
 ' m.apply_patch(root,m.PATCH)',
 ' assert (a.read_text(encoding="utf-8"),p.read_text(encoding="utf-8"))==expected',
 ' assert sorted(str(x.relative_to(root)) for x in root.rglob("*") if x.is_file())==sorted([str(m.APP),str(m.PACKAGE)])'
]));
test('M117 scope rejects main and preserves one-tap gate',()=>run([
 'os.environ.update(GITHUB_ACTIONS="true",GITHUB_REF="refs/heads/main")',
 'assert not m.scope()',
 'try: m.apply(); raise AssertionError("must reject")',
 'except RuntimeError: pass',
 'base=m.m115.transform(m.m115.BASE.read_text(encoding="utf-8"))',
 'assert "after text-center retry" not in base and "analysis result was never observed; do not export PDF" in base'
]));
test('M117 records evidence and production gates',()=>{for(const x of ["M116","1,862/1,862","2/2 PDFs","2/2 first Analyze","same PID","API28","no PDF upload","#120","#126","Draft","approvedForProduction=false","stableReleaseAllowed=false"])assert.ok(doc.includes(x),x);});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-safe-insets-pdf-m114.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-first-analyze-m115.yml','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_FIRST_ANALYZE_M115.md','utf8');
const apply=(s,pairs)=>{for(const [a,b] of pairs){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}return s;};
test('M115 exact M114 PDF workflow except scoped first Analyze control',()=>{
 assert.equal(current,apply(old,[["Guardiao Android 9 Debug safe insets PDF M114","Guardiao Android 9 Debug first Analyze M115"],["lab/p01-guardiao-debug-safe-insets-pdf-m114-v1","lab/p01-guardiao-debug-first-analyze-m115-v1"],["guardiao-debug-safe-insets-pdf-m114-","guardiao-debug-first-analyze-m115-"],["M114 two synthetic PDFs with M111 safe insets API28","M115 first Analyze tap and two synthetic PDFs API28"],["      - name: Apply exact M111 app and package only in disposable Debug workspace","      - name: Apply exact M114 app and scoped first Analyze tap control"],["python3 tooling/android/guardiao_debug_safe_insets_pdf_m114.py apply","python3 tooling/android/guardiao_debug_first_analyze_m115.py apply"]]));
 assert.ok(current.includes('api-level: 28'));
 assert.ok(current.includes('guardiao_debug_pdf_two_same_pid_lab.py'));
 assert.ok(!current.includes('assembleRelease'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, os, tempfile',
 "from pathlib import Path",
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_first_analyze_m115 as m',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M115 exactly one Analyze label-center tap and no retry, original PDF gate retained',()=>run([
 's=m.BASE.read_text(encoding="utf-8"); out=m.transform(s)',
 'expected=s',
 'for a,b in m.PAIRS: expected=expected.replace(a,b,1)',
 'assert out==expected',
 'assert out.count(\'tap_node(wait_visible("Analisar estrutura", retries=12, enabled=True, scroll=True), prefer_label=True)\')==1',
 'assert "after text-center retry" not in out',
 'assert \'raise RuntimeError("analysis result was never observed; do not export PDF")\' in out',
 'assert out.index("analysis result was never observed; do not export PDF")<out.index("M115 analysis result observed")<out.index("pdf_button = wait_export_button()")',
 'compile(out,"m115 temporary base","exec")',
 'try: m.transform(out); raise AssertionError("must reject repeated transformation")',
 'except RuntimeError: pass'
]));
test('M115 scope and exact M114 delegate without modifying tracked files',()=>run([
 'original=m.m114.LAB_REF; calls=[]',
 'm.m114.apply=lambda:calls.append(m.m114.LAB_REF)',
 's=m.BASE.read_text(encoding="utf-8")',
 'with tempfile.TemporaryDirectory() as d:',
 ' m.BASE=Path(d)/"base.py"; m.BASE.write_text(s,encoding="utf-8")',
 ' os.environ.update(GITHUB_ACTIONS="true",GITHUB_REF="refs/heads/main")',
 ' try: m.apply(); raise AssertionError("must reject")',
 ' except RuntimeError: pass',
 ' assert calls==[] and m.BASE.read_text(encoding="utf-8")==s',
 ' os.environ["GITHUB_REF"]=m.LAB_REF; m.apply()',
 ' assert calls==[m.LAB_REF] and m.m114.LAB_REF==original',
 ' assert m.BASE.read_text(encoding="utf-8")==m.transform(s)'
]));
test('M115 preserves M114 evidence and production gates',()=>{
 for(const x of ["M114","1,854/1,854","2/2 PDFs","same PID","under-5s","API28","no PDF upload","#120","#126","Draft","approvedForProduction=false","stableReleaseAllowed=false","29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"]) assert.ok(doc.includes(x),x);
});

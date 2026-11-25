import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-first-analyze-m115.yml','utf8');
const cur=readFileSync('.github/workflows/guardiao-debug-analyze-keyboard-m116.yml','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_ANALYZE_KEYBOARD_M116.md','utf8');
test('M116 exact M115 workflow and scoped keyboard experiment',()=>{
 let expected=old;for(const [a,b] of [["Guardiao Android 9 Debug first Analyze M115","Guardiao Android 9 Debug Analyze keyboard M116"],["lab/p01-guardiao-debug-first-analyze-m115-v1","lab/p01-guardiao-debug-analyze-keyboard-m116-v1"],["guardiao-debug-first-analyze-m115-","guardiao-debug-analyze-keyboard-m116-"],["M115 first Analyze tap and two synthetic PDFs API28","M116 handled keyboard taps and two synthetic PDFs API28"],["Apply exact M114 app and scoped first Analyze tap control","Apply M115 one-tap control with scoped Guardiao keyboard handling"],["guardiao_debug_first_analyze_m115.py apply","guardiao_debug_analyze_keyboard_m116.py apply"]]){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 assert.equal(cur,expected);
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, os',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_analyze_keyboard_m116 as m',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M116 exact temporary app and runner delta, no repeat Analyze',()=>run([
 's=m.m115.m114.app_transform(m.APP.read_text(encoding="utf-8"))',
 'a=m.transform(s,m.APP_PAIRS)',
 'assert a.count("keyboardShouldPersistTaps=")==1',
 'assert a.count("NEGRESCO_LAB_M116_ANALYZE_IN")==1 and a.count("NEGRESCO_LAB_M116_ANALYZE_CALL")==1',
 'b=m.m115.transform(m.m115.BASE.read_text(encoding="utf-8"))',
 'out=m.transform(b,m.BASE_PAIRS)',
 'assert out.count("m116_before = sample()")==1 and out.count("report(m116_before)")==1',
 'assert "after text-center retry" not in out',
 'assert out.index("report(m116_before)")<out.index("analysis result was never observed; do not export PDF")<out.index("pdf_button = wait_export_button()")',
 'compile(out,"M116", "exec")'
]));
test('M116 bounded callback categories and strict scope',()=>run([
 'p="123"; raw="I/ReactNativeJS( 123): NEGRESCO_LAB_M116_ANALYZE_IN\\nI/ReactNativeJS( 123): NEGRESCO_LAB_M116_ANALYZE_CALL\\nI/ReactNativeJS( 456): NEGRESCO_LAB_M116_ANALYZE_CALL"',
 'assert m.counts(raw,p)==(1,1)',
 'assert m.counts("x"*150001,p) is None',
 'assert m.classify((p,(0,0)),(p,(1,1)))=="press-in-and-call-observed"',
 'assert m.classify((p,(1,1)),(p,(2,1)))=="press-in-only-observed"',
 'assert m.classify((p,(1,1)),(p,(1,1)))=="no-new-marker-observed"',
 'assert m.classify((p,(1,1)),("456",(2,2)))=="callback-evidence-unconfirmed"',
 'os.environ.update(GITHUB_ACTIONS="true",GITHUB_REF="refs/heads/main")',
 'assert not m.scope() and m.sample() is None',
 'try: m.apply(); raise AssertionError("must reject")',
 'except RuntimeError: pass'
]));
test('M116 records M115 block and preserves production gates',()=>{for(const x of ["M115","1,858/1,858","no PDF attempted","keyboardShouldPersistTaps","handled","one tap","#120","#126","Draft","approvedForProduction=false","stableReleaseAllowed=false"])assert.ok(doc.includes(x),x);});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-integration-candidate-m117.yml','utf8');
const cur=readFileSync('.github/workflows/guardiao-post-receipt-focus-m118.yml','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_POST_RECEIPT_FOCUS_M118.md','utf8');
test('M118 exact M117 workflow with guarded final screen recovery',()=>{
 let expected=old;for(const [a,b] of [["Guardiao Android 9 integration candidate M117","Guardiao Android 9 post receipt focus M118"],["lab/p01-guardiao-integration-candidate-m117-v1","lab/p01-guardiao-post-receipt-focus-m118-v1"],["guardiao-integration-candidate-m117-","guardiao-post-receipt-focus-m118-"],["M117 consolidated candidate two synthetic PDFs API28","M118 two PDFs and final foreground recovery API28"],["Apply reviewed candidate patch and unchanged one-tap PDF gate","Apply exact M117 patch and guarded final screen recovery"],["guardiao_integration_candidate_m117.py apply","guardiao_post_receipt_focus_m118.py apply"]]){assert.equal(expected.split(a).length,2,a);expected=expected.replace(a,b);}
 assert.equal(cur,expected);
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, os',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_post_receipt_focus_m118 as m',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M118 final marker gate and final guarded Home',()=>run([
 'out=m.metro_transform(m.METRO.read_text(encoding="utf-8"))',
 'assert "M118 final exact share marker unconfirmed" in out',
 'assert out.index("M118 final exact share marker unconfirmed")<out.index("if after_verified_debug_pdf is not None:")',
 'assert "Debug after receiver Back" not in out',
 't=m.two_transform(m.TWO.read_text(encoding="utf-8"))',
 'assert "debug.run(after_verified_debug_pdf=final_home)" in t',
 'assert t.count("nav.navigate_after_verified_pdf(baseline_pid)")==2',
 'compile(out,"M118 metro","exec"); compile(t,"M118 pair","exec")'
]));
test('M118 focus category, unknown blocks, owned marker and scope',()=>run([
 'from types import SimpleNamespace',
 'os.environ.update(GITHUB_ACTIONS="true",GITHUB_REF=m.LAB_REF)',
 'app="com.negresco.finance"; receiver="com.negresco.pdfreceiver.lab"',
 'def raw(p): return "mCurrentFocus=Window{a u0 "+p+"/.MainActivity}"',
 'assert m.classify_focus(raw(app),app,receiver)=="app"',
 'assert m.classify_focus(raw(receiver),app,receiver)=="receiver"',
 'assert m.classify_focus(raw(app+".evil"),app,receiver)=="unconfirmed"',
 'calls=[]; m.identity.observed_single_app_pid=lambda:"123"',
 'b=SimpleNamespace(PACKAGE=app,RECEIVER_PACKAGE=receiver,adb=lambda *a,**k:calls.append(a) or "",xml_nodes=lambda:[{"package":app}],scroll_forward_precise=lambda:calls.append("forward"),scroll_backward=lambda:calls.append("backward"))',
 'm.focus_category=lambda b:"unconfirmed"',
 'assert not m.recover_exact_share(b,bool) and calls==[]',
 'm.focus_category=lambda b:"app"',
 'assert m.recover_exact_share(b,bool) and calls==[]',
 'os.environ["GITHUB_REF"]="refs/heads/main"',
 'assert not m.recover_exact_share(b,bool)',
 'try: m.apply(); raise AssertionError("must reject")',
 'except RuntimeError: pass'
]));
test('M118 records evidence without claiming complete success',()=>{for(const x of ["1,866/1,866","2/2 PDFs","same PID","no Back","exact app-owned","#120","#126","Draft","approvedForProduction=false","stableReleaseAllowed=false"])assert.ok(doc.includes(x),x);});

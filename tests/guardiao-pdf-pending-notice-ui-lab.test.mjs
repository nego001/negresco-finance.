import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const source=readFileSync('tooling/android/guardiao_pdf_pending_notice_ui_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-pdf-pending-notice-ui-lab.yml','utf8');
const app=readFileSync('apps/mobile/App.tsx','utf8');

test('real API28 pending warning lab uses only disposable source and no production capabilities',()=>{
 assert.match(source,/NEGRESCO_PENDING_NOTICE_LAB/);
 assert.match(source,/os\.environ\.get\("CI"\) != "true"/);
 assert.match(source,/new Promise<\{uri:string\}>\(\(\)=>\{\}\)/);
 assert.match(source,/strict_notice\(BASE\.xml_nodes\(\)\)/);
 assert.match(source,/original_chooser\(\)/);
 assert.match(source,/BASE\.receiver_receipt\(\) is not None/);
 assert.match(source,/identity\.observed_single_app_pid\(\)/);
 assert.match(source,/def strict_synthetic_field\(/);
 assert.match(source,/len\(fields\) != 1/);
 assert.match(source,/fields\[0\]\.get\("text"\) != BASE\.FIXTURE/);
 assert.match(source,/notice_scrolls < 5/);
 assert.match(source,/BASE\.scroll_forward_precise\(\)/);
 assert.match(source,/BASE\.wait_visible = original_wait/);
 assert.doesNotMatch(app,/CI-only synthetic Debug hang/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/assembleDebug/);
 assert.match(workflow,/persist-credentials: false/);
 assert.doesNotMatch(workflow,/assembleRelease|upload-artifact|workflow_dispatch|secrets\.|eas update|contents: write/i);
});

test('temporary CI patch and exact accessibility warning fail closed on duplicates',()=>{
 const py=[
 'import sys',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_pdf_pending_notice_ui_lab as x',
 "src=open('apps/mobile/App.tsx',encoding='utf8').read()",
 'patched=x.patch_source(src)',
 'assert patched.count(x.PATCH)==1 and patched.count(x.ANCHOR)==0',
 'for text in (patched,"unexpected source"):',
 ' try:x.patch_source(text)',
 ' except RuntimeError:pass',
 ' else:raise AssertionError("unsafe source accepted")',
 'n={"class":"android.widget.TextView","content-desc":x.LABEL,"text":x.TEXT_A+" "+x.TEXT_B}',
 'assert x.strict_notice([n])',
 'for invalid in ([],[n,n],[dict(n,**{"class":"android.widget.Button"})],[dict(n,**{"content-desc":"other"})],[dict(n,**{"text":"incomplete"})]):',
 ' assert not x.strict_notice(invalid)',
 'print("PASS: isolated real UI pending notice fixture gates fail closed")'
 ].join('\n');
 const p=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:20000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS: isolated real UI pending notice fixture gates fail closed/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const runner=readFileSync('tooling/android/guardiao_pdf_ui_emulator_smoke.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-android-collection48-pdf-text-lab.yml','utf8');

test('synthetic PDF stall categories are fixed and cannot echo input',()=>{
  const python="import importlib.util\nspec=importlib.util.spec_from_file_location('lab','tooling/android/guardiao_pdf_ui_emulator_smoke.py')\nlab=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(lab)\ncases=[\n ({'Gerando PDF local...':True},{'appProcessAlive':True,'foregroundCategory':'negresco-app'},'ui-loading-app-foreground'),\n ({'Gerando PDF local...':True},{'appProcessAlive':True,'foregroundCategory':'other-or-unknown'},'ui-loading-focus-uncertain'),\n ({'Gerando PDF local...':True},{'appProcessAlive':False,'foregroundCategory':'negresco-app'},'app-not-running'),\n ({},{'appProcessAlive':True,'foregroundCategory':'system-chooser'},'chooser-focus-unverified'),\n ({'Falha ao gerar o PDF local.':True},{'appProcessAlive':True,'foregroundCategory':'negresco-app'},'visible-failure-no-chooser'),\n ({},{'appProcessAlive':True,'foregroundCategory':'negresco-app'},'unclassified'),\n ({'Gerando PDF local...':True},{'appProcessAlive':'true','foregroundCategory':'negresco-app'},'unclassified'),\n ({'Gerando PDF local...':True},{'appProcessAlive':True,'foregroundCategory':'private-package-name'},'unclassified'),\n (None,{'appProcessAlive':True,'foregroundCategory':'negresco-app'},'unclassified')\n]\nfor vis,env,expected in cases: assert lab.pdf_timeout_category(vis,env)==expected\nassert lab.pdf_timeout_category({'secret':'123456','Gerando PDF local...':True},{'appProcessAlive':True,'foregroundCategory':'negresco-app','secret':'TOKEN'})=='ui-loading-app-foreground'\nprint('PASS synthetic fixed categories')";
  const result=spawnSync('python3',['-c',python],{encoding:'utf8',timeout:15000});
  assert.equal(result.status,0,result.stderr || 'synthetic diagnostics failed');
  assert.match(result.stdout,/PASS synthetic fixed categories/);
  assert.doesNotMatch(result.stdout,/123456|TOKEN/);
});

test('timeout remains BLOCK and lab branch never publishes real files',()=>{
  assert.match(runner,/def pdf_timeout_category\(/);
  assert.match(runner,/pdf_timeout_category\(final_visible, final_environment\)/);
  assert.match(runner,/BLOCK STAGE \(LAB\): PDF timeout category=/);
  assert.match(runner,/raise RuntimeError\("PDF share chooser not observed after synthetic user action"\)/);
  assert.doesNotMatch(runner,/print\(final_visible\)|print\(final_environment\)|adb logcat|screencap/);
  assert.match(workflow,/lab\/p01-guardiao-api28-timeout-categories-v1/);
  assert.match(workflow,/permissions:\s*\n  contents: read\s*\n  actions: read/);
  assert.doesNotMatch(workflow,/workflow_dispatch|contents: write|secrets\.|eas update|expo publish|gh release/);
});

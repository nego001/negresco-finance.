import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const app=readFileSync('apps/mobile/App.tsx','utf8');
const runner=readFileSync('tooling/android/guardiao_debug_same_pid_pix_home_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-debug-same-pid-pix-home-lab.yml','utf8');

test('Pix preview round-trip is Debug-only and cannot trigger money or PDF',()=>{
 assert.match(app,/__DEV__&&Platform\.OS==='android'&&\{paddingBottom:/);
 assert.match(app,/accessibilityRole="tab"/);
 assert.match(app,/Nenhuma transferência, cobrança ou QR Code real é gerado/);
 assert.match(workflow,/lab\/p01-guardiao-debug-same-pid-pix-home-v1/);
 assert.match(workflow,/script: python3 tooling\/android\/guardiao_debug_same_pid_pix_home_lab\.py/);
 assert.match(workflow,/assembleDebug/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/contents: read/);
 assert.match(workflow,/persist-credentials: false/);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch|upload-artifact|contents: write|eas update|secrets\./);
 assert.match(runner,/MAX_GESTURES = 2/);
 assert.match(runner,/\("home","pix","Pix do seu jeito\."\)/);
 assert.match(runner,/\("pix","home","Seu universo"\)/);
 assert.match(runner,/preview-process-or-focus-unconfirmed/);
 assert.match(runner,/preview-gesture-budget-exhausted/);
 assert.match(runner,/preview-navigation-geometry-unconfirmed/);
 assert.match(runner,/preview-navigation-state-unconfirmed/);
 assert.doesNotMatch(runner,/print\(raw\)|screencap|pm", "clear"|force-stop|upload|call.*payment/);
});
test('native safe target rejects overlapping, duplicate, thin, unselected, wrong package and other clickable',()=>{
 const script=[
 'import sys',"sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_same_pid_pix_home_lab as x',
 'ids=["home","pix","negresco"]',
 'bs=["[10,805][290,865]","[365,805][645,865]","[720,805][1000,865]"]',
 'def nodes(current="home"):',
 ' return [{"resource-id":"pkg:id/negresco-lab-tab-"+n+"-yoga-regular-bottom-regular-placement-inside-root-window-regular-in-viewport-rootframe-inside-root-edge-not-below","bounds":b,"package":"pkg","clickable":"true","enabled":"true","selected":("true" if n==current else "false")} for n,b in zip(ids,bs)]',
 'good=nodes()',
 'assert x.safe_tab_point(good,1080,960,"pkg","home","pix")==((365+645)//2,(805+865)//2)',
 'assert x.safe_tab_point(good,1080,960,"pkg","pix","home") is None',
 'assert x.safe_tab_point(good,1080,960,"pkg","home","home") is None',
 'assert x.safe_tab_point(good[:2],1080,960,"pkg","home","pix") is None',
 'assert x.safe_tab_point(good+[good[0]],1080,960,"pkg","home","pix") is None',
 'assert x.safe_tab_point([dict(v,**{"package":"other"}) if i==1 else v for i,v in enumerate(good)],1080,960,"pkg","home","pix") is None',
 'assert x.safe_tab_point([dict(v,**{"selected":"true"}) for v in good],1080,960,"pkg","home","pix") is None',
 'assert x.safe_tab_point([dict(v,**{"bounds":"[365,805][645,812]"}) if i==1 else v for i,v in enumerate(good)],1080,960,"pkg","home","pix") is None',
 'assert x.safe_tab_point([dict(v,**{"bounds":bs[0]}) if i==1 else v for i,v in enumerate(good)],1080,960,"pkg","home","pix") is None',
 'over=dict(good[1]);over["resource-id"]="pkg:id/other-target"',
 'assert x.safe_tab_point(good+[over],1080,960,"pkg","home","pix") is None',
 'assert x.safe_tab_point(nodes("pix"),1080,960,"pkg","pix","home") is not None',
 'print("PASS: only unique, safe, selected Preview targets")'
 ].join('\n');
 const r=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS: only unique, safe, selected Preview targets/);
});

test('navigation reports only allowlisted phase, block and target categories',()=>{
 assert.match(runner,/NAV_PHASES = frozenset/);
 assert.match(runner,/safe_navigation_block_reason/);
 assert.match(runner,/safe_tab_preflight_category/);
 assert.match(runner,/target-selected-attribute-missing/);
 assert.match(runner,/target-selected-state-mismatch/);
 assert.match(runner,/other-clickable-covers-target/);
 assert.match(runner,/phase="\+phase\+/);
 assert.match(runner,/reason="\+reason/);
 assert.match(runner,/mark_navigation_phase\("before-gesture"\)/);
 assert.match(runner,/mark_navigation_phase\("post-gesture-state"\)/);
 assert.doesNotMatch(runner,/print\(exc\)|str\(exc\).*print|print\((?:nodes_first|nodes_second|before|first|second)\)/);
});
test('preflight categories are fixed and mirror the original strict target gates',()=>{
 const script=[
 'import sys',"sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_same_pid_pix_home_lab as x',
 'names=["home","pix","negresco"]',
 'bounds=["[10,805][290,865]","[365,805][645,865]","[720,805][1000,865]"]',
 'def nodes(current="home"):',
 ' return [{"resource-id":"pkg:id/negresco-lab-tab-"+n+"-yoga-regular-bottom-regular-placement-inside-root-window-regular-in-viewport-rootframe-inside-root-edge-not-below","bounds":b,"package":"pkg","clickable":"true","enabled":"true","selected":("true" if n==current else "false")} for n,b in zip(names,bounds)]',
 'def cat(v):return x.safe_tab_preflight_category(v,1080,960,"pkg","home","pix")',
 'assert cat(nodes())=="target-preflight-eligible"',
 'v=nodes();del v[0]["selected"]',
 'assert cat(v)=="target-selected-attribute-missing"',
 'assert cat(nodes("pix"))=="target-selected-state-mismatch"',
 'v=nodes();v[1]["bounds"]="[365,805][645,808]"',
 'assert cat(v)=="target-geometry-not-eligible"',
 'v=nodes();v[2]["package"]="other"',
 'assert cat(v)=="target-package-or-clickability"',
 'v=nodes();v.append(v[1])',
 'assert cat(v)=="target-ids-unconfirmed"',
 'v=nodes();v.append(dict(v[1],**{"resource-id":"pkg:id/clickable-other"}))',
 'assert cat(v)=="other-clickable-covers-target"',
 'assert x.safe_navigation_block_reason(RuntimeError("preview-process-or-focus-unconfirmed"))=="process-or-focus-unconfirmed"',
 'assert x.safe_navigation_block_reason(RuntimeError("PRIVATE_ACCOUNT_VALUE"))=="other-or-unconfirmed"',
 'assert x.safe_navigation_block_reason(ValueError("PRIVATE_ACCOUNT_VALUE"))=="other-or-unconfirmed"',
 'print("PASS: sanitised navigation categories")'
 ].join('\n');
 const res=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:15000});
 assert.equal(res.status,0,res.stderr);
 assert.match(res.stdout,/PASS: sanitised navigation categories/);
});

test('Android 9 navigation build requires exact NDK integrity before Gradle',()=>{
 const preflight=workflow.indexOf('Validate pinned Android NDK before Gradle without fallback');
 const build=workflow.indexOf('Bound Gradle resources and assemble Android Debug, not Release');
 assert.ok(preflight>0 && build>preflight);
 assert.match(workflow,/version=27\.1\.12297006/);
 assert.match(workflow,/sdkmanager --install "ndk;\$\{version\}"/);
 assert.match(workflow,/Pkg\\\.Revision/);
 assert.match(workflow,/valid_ndk/);
 assert.match(workflow,/toolchains\/llvm\/prebuilt\/linux-x86_64\/bin\/clang/);
 assert.match(workflow,/if ! valid_ndk; then/);
 assert.match(workflow,/BLOCK \(LAB\): pinned Android NDK unavailable or invalid/);
 assert.match(workflow,/attempt in 1 2/);
 assert.match(workflow,/timeout 540 sdkmanager/);
 assert.doesNotMatch(workflow,/ndkVersion.*(?:latest|30\.|26\.)|assembleRelease|workflow_dispatch|upload-artifact/);
});

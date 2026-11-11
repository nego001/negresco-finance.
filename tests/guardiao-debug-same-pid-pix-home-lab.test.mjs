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

test('pinned NDK preflight preserves valid workflow step order and exact package',()=>{
 const preflight=workflow.indexOf('      - name: Validate pinned Android NDK before Gradle without fallback');
 const build=workflow.indexOf('      - name: Bound Gradle resources and assemble Android Debug, not Release');
 const apk=workflow.indexOf('      - name: Validate unsigned-for-production debug APK');
 assert.ok(preflight>0 && build>preflight && apk>build);
 assert.equal(workflow.split('      - name: Bound Gradle resources').length,2);
 const section=workflow.slice(preflight,build);
 assert.match(section,/version=27\.1\.12297006/);
 assert.match(section,/grep -Eq '\^Pkg\\\.Revision/);
 assert.match(section,/source\.properties" &&/);
 assert.match(section,/sdkmanager --install "ndk;\$\{version\}"/);
 assert.match(section,/for attempt in 1 2/);
 assert.match(section,/timeout 540 sdkmanager/);
 assert.match(section,/if ! valid_ndk; then/);
 assert.match(section,/toolchains\/llvm\/prebuilt\/linux-x86_64\/bin\/clang/);
 assert.doesNotMatch(section,/working-directory: apps\/mobile|Bound Gradle resources/);
 assert.match(workflow.slice(build,apk),/working-directory: apps\/mobile[\s\S]*\.\/gradlew :app:assembleDebug --no-daemon/);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch|upload-artifact|secrets\./);
});

test('post-gesture diagnostic distinguishes screen navigation, selection and geometry safely',()=>{
 assert.match(runner,/def safe_postgesture_category/);
 assert.match(runner,/post-source-screen-retained/);
 assert.match(runner,/post-expected-screen-unconfirmed/);
 assert.match(runner,/post-screen-visible-selection-attribute-missing/);
 assert.match(runner,/post-screen-visible-selection-mismatch/);
 assert.match(runner,/post-screen-selected-bounds-unconfirmed/);
 assert.match(runner,/post-screen-selected-geometry-consistent/);
 assert.match(runner,/Pix post-gesture screen category=/);
 assert.match(runner,/Pix post-gesture native bounds=/);
 assert.match(runner,/raise RuntimeError\("preview-navigation-state-unconfirmed"\)/);
 assert.doesNotMatch(runner,/print\(terminal_nodes\)|print\(banner\)|print\(exc\)|print\(raw\)|screencap/);
});
test('post-gesture category handles absent text, changed screen, selected and bounds without raw data',()=>{
 const script=[
 'import sys',"sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_same_pid_pix_home_lab as x',
 'x.BASE.PACKAGE="pkg"',
 'ids=["home","pix","negresco"]',
 'def nodes(screen="pix",selection="pix",missing=False):',
 ' a=[{"resource-id":"pkg:id/negresco-lab-tab-"+name+"-yoga-regular-bottom-regular-placement-inside-root-window-regular-in-viewport-rootframe-inside-root-edge-not-below","package":"pkg","clickable":"true","enabled":"true","selected":("true" if name==selection else "false")} for name in ids]',
 ' if missing:del a[1]["selected"]',
 ' title="Pix do seu jeito." if screen=="pix" else ("Seu universo" if screen=="home" else "nonmatching")',
 ' a.append({"package":"pkg","enabled":"true","text":title})',
 ' return a',
 'safe="testid-three-targets-bounded-readonly"',
 'def cat(ns, native=safe):return x.safe_postgesture_category(ns,"home","pix","Pix do seu jeito.",native)',
 'assert cat(nodes())=="post-screen-selected-geometry-consistent"',
 'assert cat(nodes(screen="home",selection="home"))=="post-source-screen-retained"',
 'assert cat(nodes(screen="unknown"))=="post-expected-screen-unconfirmed"',
 'assert cat(nodes(selection="home"))=="post-screen-visible-selection-mismatch"',
 'assert cat(nodes(missing=True))=="post-screen-visible-selection-attribute-missing"',
 'assert cat(nodes(), "testid-three-targets-thin")=="post-screen-selected-bounds-unconfirmed"',
 'assert cat(nodes()[:2])=="post-screen-visible-target-ids-unconfirmed"',
 'assert cat(nodes()+[nodes()[1]])=="post-screen-visible-target-ids-unconfirmed"',
 'assert x.safe_postgesture_category(nodes(),"pix","home","Pix do seu jeito.",safe)=="post-snapshot-unconfirmed"',
 'assert x.safe_postgesture_category(nodes("home","home"),"pix","home","Seu universo",safe)=="post-screen-selected-geometry-consistent"',
 'print("PASS: fixed Pix post-gesture categories")',
 ].join('\n');
 const res=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:15000});
 assert.equal(res.status,0,res.stderr);
 assert.match(res.stdout,/PASS: fixed Pix post-gesture categories/);
});

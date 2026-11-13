import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const app=readFileSync('apps/mobile/App.tsx','utf8');
const runner=readFileSync('tooling/android/guardiao_debug_touch_delivery_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-debug-touch-delivery-lab.yml','utf8');
const dispatch=readFileSync('tooling/android/guardiao_debug_native_dispatch_probe.py','utf8');

test('all marker generation is __DEV__ only and release navigation unchanged',()=>{
 assert.match(app,/onPressIn=\{__DEV__\?\(\)=>\{if\(x\.name==='Pix'\)\{setLabPixPressIn\(true\);console\.log\('NEGRESCO_LAB_NAV_TOUCHIN_PIX'\)/);
 assert.match(app,/onPress=\{\(\)=>nav\(x\.name as Page\)\}/);
 assert.match(app,/if\(__DEV__&&\(p==='Pix'\|\|p==='Início'\)\)/);
 assert.match(app,/console\.log\('NEGRESCO_LAB_NAV_CALL_'/);
 assert.match(app,/console\.log\('NEGRESCO_LAB_NAV_PAGE_'/);
 assert.match(app,/setLabPixNavCall\(true\)/);
 assert.match(app,/onTouchStart=\{__DEV__\?\(\)=>\{setLabBottomTouchStart\(true\);console\.log\('NEGRESCO_LAB_NAV_BOTTOM_TOUCH_START'\)/);
 assert.match(app,/onTouchStart=\{__DEV__\?\(\)=>setLabRootTouchStart\(true\)/);
 assert.match(app,/'-rootstart-'\+\(labRootTouchStart\?'yes':'no'\)/);
 assert.match(app,/'-bottomstart-'\+\(labBottomTouchStart\?'yes':'no'\)/);
 assert.doesNotMatch(app,/onTouchStart=\{__DEV__\?\(\)=>\{if\(x\.name==='Pix'/);
 assert.match(app,/collapsable=\{__DEV__\?false:undefined\} testID=\{__DEV__\?\('negresco-lab-rn-page-'/);
 assert.match(app,/accessibilityRole="tab"/);
 assert.match(app,/__DEV__&&Platform\.OS==='android'&&\{paddingBottom:/);
 assert.doesNotMatch(app,/NEGRESCO_LAB_NAV_.+\$\{.*account/);
});
test('Android 9 emits only allowlisted categories and does not expand touch budget',()=>{
 assert.match(workflow,/lab\/p01-guardiao-debug-touch-delivery-v1/);
 assert.match(workflow,/script: python3 tooling\/android\/guardiao_debug_touch_delivery_lab.py/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/assembleDebug/);
 assert.match(workflow,/Validate pinned Android NDK before Gradle without fallback/);
 assert.match(workflow,/Install fixed native Activity input dispatch probe in disposable Debug project/);
 assert.match(workflow,/guardiao_debug_native_dispatch_probe\.py install apps\/mobile\/android\/app\/src\/main/);
 assert.match(runner,/Pix native Activity dispatch preflight=/);
 assert.match(runner,/Pix native Activity dispatch after gesture=/);
 assert.match(dispatch,/override fun dispatchTouchEvent\(event: android\.view\.MotionEvent\)/);
 assert.match(dispatch,/override fun onResume\(\)/);
 assert.match(dispatch,/negrescoLabReactRootHitCategory/);
 assert.match(dispatch,/rn-unconfirmed/);
 assert.match(dispatch,/activity-down-consumed-rn-hit/);
 assert.match(dispatch,/getLocationOnScreen/);
 assert.match(dispatch,/negrescoLabScrollCoverage/);
 assert.match(dispatch,/scroll-ready/);
 assert.match(dispatch,/scroll-hit/);
 assert.match(dispatch,/scroll-clear/);
 assert.match(dispatch,/negrescoLabPixTargetHit/);
 assert.match(dispatch,/react_test_id/);
 assert.match(dispatch,/negresco-lab-tab-pix-/);
 assert.match(dispatch,/pix-ready/);
 assert.match(dispatch,/pix-hit/);
 assert.match(dispatch,/pix-miss/);
 assert.match(dispatch,/gesture-down-up-consumed/);
 assert.match(dispatch,/gesture-down-up-unconsumed/);
 assert.match(dispatch,/gesture-sequence-invalid/);
 assert.match(dispatch,/ACTION_CANCEL/);
 assert.match(dispatch,/negrescoLabGestureActive/);
 assert.match(dispatch,/negrescoLabPixSiblingCategory/);
 assert.match(dispatch,/sibling-overlap/);
 assert.match(dispatch,/sibling-clear/);
 assert.match(dispatch,/sibling-front-candidate/);
 assert.match(dispatch,/sibling-behind-only/);
 assert.match(dispatch,/sibling-mixed-order/);
 assert.match(dispatch,/sibling-front-direct/);
 assert.match(dispatch,/sibling-front-parent/);
 assert.match(dispatch,/sibling-front-ancestor/);
 assert.match(dispatch,/sibling-front-multilevel/);
 assert.match(dispatch,/sibling-front-root-level/);
 assert.match(dispatch,/sibling-front-inner-level/);
 assert.match(dispatch,/sibling-front-root-and-inner/);
 assert.match(dispatch,/frontAtReactRoot/);
 assert.match(dispatch,/frontBelowReactRoot/);
 assert.match(dispatch,/negrescoLabPixRootPeerCategory/);
 assert.match(dispatch,/root-peer-devsupport/);
 assert.match(dispatch,/root-peer-expo/);
 assert.match(dispatch,/root-peer-react/);
 assert.match(dispatch,/root-peer-platform/);
 assert.match(dispatch,/root-peer-mixed/);
 assert.match(dispatch,/negrescoLabPixRootPointerCategory/);
 assert.match(dispatch,/getPointerEvents/);
 assert.match(dispatch,/root-pointer-auto/);
 assert.match(dispatch,/root-pointer-none/);
 assert.match(dispatch,/root-pointer-box-only/);
 assert.match(dispatch,/root-pointer-box-none/);
 assert.match(dispatch,/root-pointer-unconfirmed/);
 assert.match(dispatch,/root-pointer-mixed-self-eligible/);
 assert.match(dispatch,/root-pointer-mixed-self-unconfirmed/);
 assert.match(dispatch,/root-pointer-mixed-child-eligible/);
 assert.match(dispatch,/root-pointer-mixed-child-unconfirmed/);
 assert.match(dispatch,/root-pointer-mixed-none-unconfirmed/);
 assert.match(dispatch,/selfEligible/);
 assert.match(dispatch,/childEligible/);
 assert.match(dispatch,/unknownMode/);
 assert.match(dispatch,/negrescoLabResolvedTargetCategory/);
 assert.match(dispatch,/com\.facebook\.react\.uimanager\.TouchTargetHelper/);
 assert.match(dispatch,/findTargetTagForTouch/);
 assert.match(dispatch,/rn-target-pix-direct/);
 assert.match(dispatch,/rn-target-pix-descendant/);
 assert.match(dispatch,/rn-target-pix-ancestor/);
 assert.match(dispatch,/rn-target-other/);
 assert.match(dispatch,/rn-target-other-root-front/);
 assert.match(dispatch,/rn-target-other-root-behind/);
 assert.match(dispatch,/rn-target-front-branch-auto/);
 assert.match(dispatch,/rn-target-front-branch-none/);
 assert.match(dispatch,/rn-target-front-branch-box-only/);
 assert.match(dispatch,/rn-target-front-branch-box-none/);
 assert.match(dispatch,/rn-target-front-branch-no-interface/);
 assert.match(dispatch,/rn-target-front-branch-unconfirmed/);
 assert.match(dispatch,/rn-front-noiface-enabled-direct/);
 assert.match(dispatch,/rn-front-root-clickable/);
 assert.match(dispatch,/rn-front-surface-clickable/);
 assert.match(dispatch,/rn-front-devsupport-clickable/);
 assert.match(dispatch,/rn-front-view-clickable/);
 assert.match(dispatch,/rn-front-reactother-clickable/);
 assert.match(dispatch,/rn-front-expo-clickable/);
 assert.match(dispatch,/rn-front-other-clickable/);
 assert.match(dispatch,/targetRootBranch\.isClickable/);
 assert.match(dispatch,/javaClass\.name/);
 assert.match(dispatch,/rn-front-noiface-enabled-descendant/);
 assert.match(dispatch,/rn-front-noiface-disabled-direct/);
 assert.match(dispatch,/rn-front-noiface-disabled-descendant/);
 assert.match(dispatch,/val branchEnabled = targetRootBranch\.isEnabled/);
 assert.match(dispatch,/val selectedDirectly = node === targetRootBranch/);
 assert.match(dispatch,/ReactPointerEventsView/);
 assert.match(dispatch,/iface\.isInstance\(targetRootBranch\)/);
 assert.doesNotMatch(dispatch,/setPointerEvents\(|\.setPointerEvents\(/);
 assert.match(dispatch,/rn-target-other-same-nav/);
 assert.match(dispatch,/rn-target-other-same-app/);
 assert.match(dispatch,/rn-target-other-order-unconfirmed/);
 assert.match(dispatch,/targetRootBranch/);
 assert.match(dispatch,/pixRootBranch/);
 assert.match(dispatch,/rn-target-root-fallback/);
 assert.match(runner,/Pix RN resolver preflight=/);
 assert.match(runner,/Pix RN resolver after gesture=/);
 assert.match(runner,/Pix native root pointer preflight=/);
 assert.match(runner,/Pix native root pointer after gesture=/);
 assert.match(runner,/Pix native root peer preflight=/);
 assert.match(runner,/Pix native root peer after gesture=/);
 assert.match(dispatch,/minFrontDepth/);
 assert.match(dispatch,/maxFrontDepth/);
 assert.match(dispatch,/parent\.indexOfChild\(child\)/);
 assert.match(dispatch,/other\.z > child\.z/);
 assert.doesNotMatch(dispatch,/setZ\(|setElevation\(|bringToFront\(/);
 assert.match(runner,/Pix native sibling overlap preflight=/);
 assert.match(runner,/Pix native sibling overlap after gesture=/);
 assert.match(runner,/Pix native gesture lifecycle preflight=/);
 assert.match(runner,/Pix native gesture lifecycle after gesture=/);
 assert.match(runner,/Pix native testID hit preflight=/);
 assert.match(runner,/Pix native testID hit after gesture=/);
 assert.match(runner,/Pix native scroll coverage preflight=/);
 assert.match(runner,/Pix native scroll coverage after gesture=/);
 assert.match(dispatch,/BuildConfig\.DEBUG/);
 assert.doesNotMatch(dispatch,/event\.x|event\.y|event\.rawX|event\.rawY/);
 assert.match(workflow,/contents: read/);
 assert.match(workflow,/persist-credentials: false/);
 assert.doesNotMatch(workflow,/assembleRelease|workflow_dispatch|upload-artifact|contents: write|eas update|secrets\./);
 assert.match(runner,/MAX_GESTURES = 2/);
 assert.match(runner,/def classify_pix_touch_delivery/);
 assert.match(runner,/def prepare_pix_touch_telemetry/);
 assert.match(runner,/def classify_nav_native_state/);
 assert.match(runner,/def classify_native_touch_route/);
 assert.match(runner,/route-native-root-no-bottom-no/);
 assert.match(runner,/Pix RN native root\/bottom route=/);
 assert.match(runner,/def observed_pix_logcat_category/);
 assert.match(runner,/def classify_pix_touch_path/);
 assert.match(runner,/Pix RN touch route=/);
 assert.match(runner,/native-page-home-pressin-no-call-no/);
 assert.match(runner,/native-page-pix-pressin-yes-call-yes/);
 assert.match(runner,/preview-telemetry-unconfirmed/);
 assert.match(runner,/BASE\.adb\("logcat","-c"/);
 assert.match(runner,/classify_pix_touch_delivery\(safe_lab_logcat\(\)\)/);
 assert.doesNotMatch(runner,/print\(raw\)|print\(exc\)|screencap|force-stop|pm", "clear"/);
});
test('event categories distinguish input dispatch, onPress and page render, never expose log contents',()=>{
 const script=[
 'import sys',"sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_touch_delivery_lab as x',
 'def cat(s):return x.classify_pix_touch_delivery(s)',
 'assert cat(None)=="delivery-telemetry-unconfirmed"',
 'assert cat("no lab events")=="delivery-no-pressin-or-handler-observed"',
 'assert cat("NEGRESCO_LAB_NAV_TOUCHIN_PIX")=="delivery-pressin-without-handler"',
 'assert cat("NEGRESCO_LAB_NAV_CALL_PIX")=="delivery-handler-without-pix-render"',
 'assert cat("NEGRESCO_LAB_NAV_TOUCHIN_PIX NEGRESCO_LAB_NAV_CALL_PIX")=="delivery-handler-without-pix-render"',
 'assert cat("NEGRESCO_LAB_NAV_PAGE_PIX")=="delivery-pix-render-without-call"',
 'assert cat("NEGRESCO_LAB_NAV_CALL_PIX NEGRESCO_LAB_NAV_PAGE_PIX")=="delivery-call-and-pix-render-without-pressin"',
 'assert cat("NEGRESCO_LAB_NAV_TOUCHIN_PIX NEGRESCO_LAB_NAV_CALL_PIX NEGRESCO_LAB_NAV_PAGE_PIX")=="delivery-pressin-call-and-pix-render"',
 'assert cat("SECRET_PRIVATE_VALUE")=="delivery-no-pressin-or-handler-observed"',
 'assert x.safe_navigation_block_reason(RuntimeError("preview-telemetry-unconfirmed"))=="telemetry-unconfirmed"',
 'print("PASS: fixed non-sensitive Debug touch delivery categories")',
 ].join('\n');
 const r=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS: fixed non-sensitive Debug touch delivery categories/);
});

test('native read-only JS delivery markers require one exact package-bound node',()=>{
 const script=[
  'import sys',"sys.path.insert(0,'tooling/android')",
  'import guardiao_debug_touch_delivery_lab as x',
  'def node(marker,package=None):return {"resource-id":"com.negresco:id/"+marker,"package":x.BASE.PACKAGE if package is None else package}',
  'home="negresco-lab-rn-page-home-pressin-no-call-no-rootstart-no-bottomstart-no"',
  'pix="negresco-lab-rn-page-pix-pressin-yes-call-yes-rootstart-yes-bottomstart-yes"',
  'press="negresco-lab-rn-page-home-pressin-yes-call-no-rootstart-yes-bottomstart-yes"',
  'assert x.classify_nav_native_state([node(home)])=="native-page-home-pressin-no-call-no"',
  'assert x.classify_nav_native_state([node(press)])=="native-page-home-pressin-yes-call-no"',
  'assert x.classify_native_touch_route([node(home)])=="route-native-root-no-bottom-no"',
  'assert x.classify_native_touch_route([node(pix)])=="route-native-root-yes-bottom-yes"',
  'assert x.classify_native_touch_route([node(press)])=="route-native-root-yes-bottom-yes"',
  'assert x.classify_native_touch_route([node("negresco-lab-rn-page-home-pressin-no-call-no-rootstart-yes-bottomstart-no")])=="route-native-root-yes-bottom-no"',
  'assert x.classify_native_touch_route([node("negresco-lab-rn-page-home-pressin-no-call-no-rootstart-no-bottomstart-yes")])=="route-native-root-no-bottom-yes"',
  'assert x.classify_native_touch_route([node("negresco-lab-rn-page-home-pressin-no-call-no-rootstart-x-bottomstart-no")])=="route-native-unconfirmed"',
  'assert x.classify_native_touch_route([node(home),node(home)])=="route-native-unconfirmed"',
  'assert x.classify_native_touch_route([node(home,"other.app")])=="route-native-unconfirmed"',
  'assert x.classify_nav_native_state([node(pix)])=="native-page-pix-pressin-yes-call-yes"',
  'assert x.classify_nav_native_state([])=="native-state-unconfirmed"',
  'assert x.classify_nav_native_state([node(home),node(home)])=="native-state-unconfirmed"',
  'assert x.classify_nav_native_state([node(home,"other.app")])=="native-state-unconfirmed"',
  'assert x.classify_nav_native_state([node(home+"-private")])=="native-state-unconfirmed"',
  'assert x.classify_nav_native_state([node("payment-details")])=="native-state-unconfirmed"',
  'assert x.observed_pix_logcat_category(False)=="delivery-telemetry-unconfirmed"'
 ].join('\n');
 const r=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout,'');
});

test('RN logcat bottom touch-start marker remains advisory, including no signal',()=>{
 const script=[
  'import sys',"sys.path.insert(0,'tooling/android')",
  'import guardiao_debug_touch_delivery_lab as x',
  'f=x.classify_pix_touch_path',
  'assert f(None)=="route-telemetry-unconfirmed"',
  'assert f("no app events")=="route-no-rn-touch-observed"',
  'assert f("NEGRESCO_LAB_NAV_BOTTOM_TOUCH_START")=="route-bottom-touch-observed"',
  'assert f("NEGRESCO_LAB_NAV_PIX_TOUCH_START")=="route-no-rn-touch-observed"',
  'assert f("NEGRESCO_LAB_NAV_BOTTOM_TOUCH_START NEGRESCO_LAB_NAV_PIX_TOUCH_START")=="route-bottom-touch-observed"',
  'assert f("NEGRESCO_LAB_NAV_BOTTOM_TOUCH_START-not-trusted")=="route-no-rn-touch-observed"',
  'assert f("SECRET_PRIVATE_FINANCIAL_VALUE")=="route-no-rn-touch-observed"'
 ].join('\n');
 const r=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout,'');
});

test('native Activity fixed-category dispatch probe installs only into disposable prebuild',()=>{
 const script=[
  'import sys,tempfile,pathlib',
  "sys.path.insert(0,'tooling/android')",
  'import guardiao_debug_native_dispatch_probe as x',
  'from pathlib import Path',
  'assert x.classify_native_state("activity-ready")=="activity-ready"',
  'assert x.classify_native_state("activity-down-consumed")=="activity-down-consumed"',
  'assert x.classify_native_state("activity-down-unconsumed")=="activity-down-unconsumed"',
  'assert x.classify_native_state("activity-down")=="activity-down"',
  'assert x.classify_native_state("activity-down-consumed-rn-hit")=="activity-down-consumed-rn-hit"',
  'assert x.classify_native_state("activity-down-consumed-rn-miss")=="activity-down-consumed-rn-miss"',
  'assert x.classify_native_state("activity-down-consumed-rn-unconfirmed")=="activity-down-consumed-rn-unconfirmed"',
  'assert x.classify_native_state("activity-down-unconsumed-rn-hit")=="activity-down-unconsumed-rn-hit"',
  'assert x.classify_native_state("activity-down-unconsumed-rn-miss")=="activity-down-unconsumed-rn-miss"',
  'assert x.classify_native_state("activity-down-consumed-rn-hit-secret")=="activity-state-unconfirmed"',
  'assert x.classify_scroll_state("scroll-ready")=="scroll-ready"',
  'assert x.classify_scroll_state("scroll-hit")=="scroll-hit"',
  'assert x.classify_scroll_state("scroll-clear")=="scroll-clear"',
  'assert x.classify_scroll_state("scroll-unconfirmed")=="scroll-unconfirmed"',
  'assert x.classify_scroll_state("scroll-hit-secret")=="scroll-unconfirmed"',
  'assert x.classify_scroll_state(None)=="scroll-unconfirmed"',
  'assert x.classify_pix_native_state("pix-ready")=="pix-ready"',
  'assert x.classify_pix_native_state("pix-hit")=="pix-hit"',
  'assert x.classify_pix_native_state("pix-miss")=="pix-miss"',
  'assert x.classify_pix_native_state("pix-unconfirmed")=="pix-unconfirmed"',
  'assert x.classify_pix_native_state("pix-hit-private")=="pix-unconfirmed"',
  'assert x.classify_pix_native_state(None)=="pix-unconfirmed"',
  'assert x.classify_gesture_state("gesture-ready")=="gesture-ready"',
  'assert x.classify_gesture_state("gesture-down")=="gesture-down"',
  'assert x.classify_gesture_state("gesture-down-up-consumed")=="gesture-down-up-consumed"',
  'assert x.classify_gesture_state("gesture-down-up-unconsumed")=="gesture-down-up-unconsumed"',
  'assert x.classify_gesture_state("gesture-down-cancelled")=="gesture-down-cancelled"',
  'assert x.classify_gesture_state("gesture-down-cancelled-unconsumed")=="gesture-down-cancelled-unconsumed"',
  'assert x.classify_gesture_state("gesture-up-without-down")=="gesture-up-without-down"',
  'assert x.classify_gesture_state("gesture-sequence-invalid")=="gesture-sequence-invalid"',
  'assert x.classify_gesture_state("gesture-down-up-consumed-secret")=="gesture-unconfirmed"',
  'assert x.classify_gesture_state(None)=="gesture-unconfirmed"',
  'assert x.classify_sibling_state("sibling-ready")=="sibling-ready"',
  'assert x.classify_sibling_state("sibling-overlap")=="sibling-overlap"',
  'assert x.classify_sibling_state("sibling-front-candidate")=="sibling-front-candidate"',
  'assert x.classify_sibling_state("sibling-behind-only")=="sibling-behind-only"',
  'assert x.classify_sibling_state("sibling-mixed-order")=="sibling-mixed-order"',
  'assert x.classify_sibling_state("sibling-front-direct")=="sibling-front-direct"',
  'assert x.classify_sibling_state("sibling-front-parent")=="sibling-front-parent"',
  'assert x.classify_sibling_state("sibling-front-ancestor")=="sibling-front-ancestor"',
  'assert x.classify_sibling_state("sibling-front-multilevel")=="sibling-front-multilevel"',
  'assert x.classify_sibling_state("sibling-front-root-level")=="sibling-front-root-level"',
  'assert x.classify_sibling_state("sibling-front-inner-level")=="sibling-front-inner-level"',
  'assert x.classify_sibling_state("sibling-front-root-and-inner")=="sibling-front-root-and-inner"',
  'assert x.classify_sibling_state("sibling-front-root-level-secret")=="sibling-unconfirmed"',
  'assert x.classify_sibling_state("sibling-front-deep-private")=="sibling-unconfirmed"',
  'assert x.classify_sibling_state("sibling-front-candidate-private")=="sibling-unconfirmed"',
  'assert x.classify_sibling_state("sibling-clear")=="sibling-clear"',
  'assert x.classify_sibling_state("sibling-unconfirmed")=="sibling-unconfirmed"',
  'assert x.classify_sibling_state("sibling-overlap-private")=="sibling-unconfirmed"',
  'assert x.classify_sibling_state(None)=="sibling-unconfirmed"',
  'assert x.classify_root_peer_state("root-peer-ready")=="root-peer-ready"',
  'assert x.classify_root_peer_state("root-peer-clear")=="root-peer-clear"',
  'assert x.classify_root_peer_state("root-peer-devsupport")=="root-peer-devsupport"',
  'assert x.classify_root_peer_state("root-peer-expo")=="root-peer-expo"',
  'assert x.classify_root_peer_state("root-peer-react")=="root-peer-react"',
  'assert x.classify_root_peer_state("root-peer-platform")=="root-peer-platform"',
  'assert x.classify_root_peer_state("root-peer-other")=="root-peer-other"',
  'assert x.classify_root_peer_state("root-peer-mixed")=="root-peer-mixed"',
  'assert x.classify_root_peer_state("root-peer-react-secret")=="root-peer-unconfirmed"',
  'assert x.classify_root_peer_state(None)=="root-peer-unconfirmed"',
  'assert x.classify_root_pointer_state("root-pointer-ready")=="root-pointer-ready"',
  'assert x.classify_root_pointer_state("root-pointer-clear")=="root-pointer-clear"',
  'assert x.classify_root_pointer_state("root-pointer-auto")=="root-pointer-auto"',
  'assert x.classify_root_pointer_state("root-pointer-none")=="root-pointer-none"',
  'assert x.classify_root_pointer_state("root-pointer-box-only")=="root-pointer-box-only"',
  'assert x.classify_root_pointer_state("root-pointer-box-none")=="root-pointer-box-none"',
  'assert x.classify_root_pointer_state("root-pointer-mixed")=="root-pointer-mixed"',
  'assert x.classify_root_pointer_state("root-pointer-mixed-self-eligible")=="root-pointer-mixed-self-eligible"',
  'assert x.classify_root_pointer_state("root-pointer-mixed-self-unconfirmed")=="root-pointer-mixed-self-unconfirmed"',
  'assert x.classify_root_pointer_state("root-pointer-mixed-child-eligible")=="root-pointer-mixed-child-eligible"',
  'assert x.classify_root_pointer_state("root-pointer-mixed-child-unconfirmed")=="root-pointer-mixed-child-unconfirmed"',
  'assert x.classify_root_pointer_state("root-pointer-mixed-none-unconfirmed")=="root-pointer-mixed-none-unconfirmed"',
  'assert x.classify_root_pointer_state("root-pointer-mixed-self-eligible-private")=="root-pointer-unconfirmed"',
  'assert x.classify_root_pointer_state("root-pointer-auto-hidden")=="root-pointer-unconfirmed"',
  'assert x.classify_root_pointer_state(None)=="root-pointer-unconfirmed"',
  'assert x.classify_resolved_target_state("rn-target-ready")=="rn-target-ready"',
  'assert x.classify_resolved_target_state("rn-target-pix-direct")=="rn-target-pix-direct"',
  'assert x.classify_resolved_target_state("rn-target-pix-descendant")=="rn-target-pix-descendant"',
  'assert x.classify_resolved_target_state("rn-target-pix-ancestor")=="rn-target-pix-ancestor"',
  'assert x.classify_resolved_target_state("rn-target-other")=="rn-target-other"',
  'assert x.classify_resolved_target_state("rn-target-other-root-front")=="rn-target-other-root-front"',
  'assert x.classify_resolved_target_state("rn-target-front-branch-auto")=="rn-target-front-branch-auto"',
  'assert x.classify_resolved_target_state("rn-target-front-branch-none")=="rn-target-front-branch-none"',
  'assert x.classify_resolved_target_state("rn-target-front-branch-box-only")=="rn-target-front-branch-box-only"',
  'assert x.classify_resolved_target_state("rn-target-front-branch-box-none")=="rn-target-front-branch-box-none"',
  'assert x.classify_resolved_target_state("rn-target-front-branch-no-interface")=="rn-target-front-branch-no-interface"',
  'assert x.classify_resolved_target_state("rn-front-noiface-enabled-direct")=="rn-front-noiface-enabled-direct"',
  'assert x.classify_resolved_target_state("rn-front-root-clickable")=="rn-front-root-clickable"',
  'assert x.classify_resolved_target_state("rn-front-root-passive")=="rn-front-root-passive"',
  'assert x.classify_resolved_target_state("rn-front-surface-clickable")=="rn-front-surface-clickable"',
  'assert x.classify_resolved_target_state("rn-front-surface-passive")=="rn-front-surface-passive"',
  'assert x.classify_resolved_target_state("rn-front-devsupport-clickable")=="rn-front-devsupport-clickable"',
  'assert x.classify_resolved_target_state("rn-front-devsupport-passive")=="rn-front-devsupport-passive"',
  'assert x.classify_resolved_target_state("rn-front-view-clickable")=="rn-front-view-clickable"',
  'assert x.classify_resolved_target_state("rn-front-view-passive")=="rn-front-view-passive"',
  'assert x.classify_resolved_target_state("rn-front-reactother-clickable")=="rn-front-reactother-clickable"',
  'assert x.classify_resolved_target_state("rn-front-reactother-passive")=="rn-front-reactother-passive"',
  'assert x.classify_resolved_target_state("rn-front-expo-clickable")=="rn-front-expo-clickable"',
  'assert x.classify_resolved_target_state("rn-front-expo-passive")=="rn-front-expo-passive"',
  'assert x.classify_resolved_target_state("rn-front-other-clickable")=="rn-front-other-clickable"',
  'assert x.classify_resolved_target_state("rn-front-other-passive")=="rn-front-other-passive"',
  'assert x.classify_resolved_target_state("rn-front-root-clickable-leak")=="rn-target-unconfirmed"',
  'assert x.classify_resolved_target_state("rn-front-noiface-enabled-descendant")=="rn-front-noiface-enabled-descendant"',
  'assert x.classify_resolved_target_state("rn-front-noiface-disabled-direct")=="rn-front-noiface-disabled-direct"',
  'assert x.classify_resolved_target_state("rn-front-noiface-disabled-descendant")=="rn-front-noiface-disabled-descendant"',
  'assert x.classify_resolved_target_state("rn-front-noiface-enabled-direct-private")=="rn-target-unconfirmed"',
  'assert x.classify_resolved_target_state("rn-target-front-branch-unconfirmed")=="rn-target-front-branch-unconfirmed"',
  'assert x.classify_resolved_target_state("rn-target-front-branch-auto-private")=="rn-target-unconfirmed"',
  'assert x.classify_resolved_target_state("rn-target-other-root-behind")=="rn-target-other-root-behind"',
  'assert x.classify_resolved_target_state("rn-target-other-same-nav")=="rn-target-other-same-nav"',
  'assert x.classify_resolved_target_state("rn-target-other-same-app")=="rn-target-other-same-app"',
  'assert x.classify_resolved_target_state("rn-target-other-order-unconfirmed")=="rn-target-other-order-unconfirmed"',
  'assert x.classify_resolved_target_state("rn-target-other-root-front-private")=="rn-target-unconfirmed"',
  'assert x.classify_resolved_target_state("rn-target-root-fallback")=="rn-target-root-fallback"',
  'assert x.classify_resolved_target_state("rn-target-virtual-unconfirmed")=="rn-target-virtual-unconfirmed"',
  'assert x.classify_resolved_target_state("rn-target-pix-direct-private")=="rn-target-unconfirmed"',
  'assert x.classify_resolved_target_state(None)=="rn-target-unconfirmed"',
  'assert x.classify_native_state("private-financial-content")=="activity-state-unconfirmed"',
  'assert x.classify_native_state("activity-ready\\nprivate")=="activity-state-unconfirmed"',
  'assert x.classify_native_state(None)=="activity-state-unconfirmed"',
  'with tempfile.TemporaryDirectory() as d:',
  ' root=Path(d)',
  ' f=root/"com"/"negresco"/"finance"/"MainActivity.kt"',
  ' f.parent.mkdir(parents=True)',
  ' f.write_text("package com.negresco.finance\\nclass MainActivity : ReactActivity() {\\n}\\n")',
  ' assert x.install(root)=="activity-dispatch-debug-probe-installed"',
  ' assert "override fun dispatchTouchEvent" in f.read_text()',
  ' assert x.install(root)=="activity-dispatch-debug-probe-installed"',
  ' f.write_text(f.read_text().replace("class MainActivity : ReactActivity() {","class OtherActivity : ReactActivity() {"))',
  ' try: x.install(root); assert False',
  ' except RuntimeError: pass',
  'print("PASS: synthetic native Activity dispatch probe")'
 ].join('\n');
 const r=spawnSync('python3',['-c',script],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS: synthetic native Activity dispatch probe/);
});

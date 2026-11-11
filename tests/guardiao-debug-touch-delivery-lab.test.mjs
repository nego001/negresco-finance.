import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const app=readFileSync('apps/mobile/App.tsx','utf8');
const runner=readFileSync('tooling/android/guardiao_debug_touch_delivery_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-debug-touch-delivery-lab.yml','utf8');

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

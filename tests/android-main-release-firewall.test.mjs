import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const workflow=readFileSync(resolve('.github/workflows/android-apk.yml'),'utf8');
test('main candidate Android build cannot publish GitHub Release automatically',()=>{
  assert.match(workflow,/permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(workflow,/contents: write|GH_TOKEN|gh release (?:create|edit|upload|view)/);
  assert.match(workflow,/uses: actions\/upload-artifact@v4/);
});
test('unreviewed stable signing is blocked before npm install and secrets',()=>{
  const i=workflow.indexOf('      - name: Fail closed on unreviewed stable signing');
  assert.ok(i!==-1);
  assert.ok(i<workflow.indexOf('      - name: Install JS dependencies'));
  const guard=workflow.slice(i,workflow.indexOf('      - name: Install JS dependencies'));
  assert.match(guard,/if: \${{ inputs\.stable_signing }}/);
  assert.match(guard,/exit 1/);
  assert.match(guard,/security audit/);
});
test('candidate build cannot receive production credentials even if earlier gate is removed',()=>{
  assert.doesNotMatch(workflow,/secrets\.|configure-release-signing\.cjs|NEGRESCO_RELEASE_(?:KEYSTORE|STORE|KEY)|NEGRESCO_EXPECTED_CERT_SHA256/);
  const begin=workflow.indexOf('      - name: Build standalone test APK (Debug certificate only)');
  const end=workflow.indexOf('      - name: Delete ephemeral signing material');
  const step=workflow.slice(begin,end);
  assert.ok(begin>=0&&end>begin);
  assert.match(step,/NEGRESCO_USE_STABLE_SIGNING: 'false'/);
  assert.match(step,/NEGRESCO_STABLE_REQUESTED:/);
  assert.match(step,/Stable signing is disabled/);
  assert.ok(step.indexOf('exit 1')<step.indexOf('./gradlew assembleRelease'));
});
test('actual signing check accepts Debug certificate only',()=>{
  const begin=workflow.indexOf('      - name: Verify APK structure and Debug signature only');
  const end=workflow.indexOf('      - name: Upload standalone APK');
  const step=workflow.slice(begin,end);
  assert.ok(begin>=0&&end>begin);
  assert.match(step,/grep -q 'CN=Android Debug'/);
  assert.doesNotMatch(step,/NEGRESCO_USE_STABLE_SIGNING|NEGRESCO_EXPECTED_CERT_SHA256/);
});
test('manual GitHub workflow exposes no stable-signing choice',()=>{
  const trigger=workflow.slice(workflow.indexOf('on:\n'),workflow.indexOf('concurrency:'));
  assert.match(trigger,/workflow_dispatch:\s*\n\s*push:/);
  assert.doesNotMatch(trigger,/stable_signing:|inputs:|release_key|keystore|publish_release/);
  assert.match(workflow,/NEGRESCO_USE_STABLE_SIGNING: 'false'/);
  assert.match(workflow,/Debug certificate/);
  assert.doesNotMatch(workflow,/publish_release:|permissions:\s*\n\s*contents: write/);
});

const otaPreview=readFileSync(resolve('.github/workflows/ota-preview.yml'),'utf8');
test('manual preview OTA must fail closed before credentials or unreviewed tooling',()=>{
  assert.match(otaPreview,/workflow_dispatch:/);
  assert.match(otaPreview,/permissions:\s*\n\s*contents: read/);
  assert.match(otaPreview,/Block preview OTA until security approval[\s\S]*?exit 1/);
  assert.doesNotMatch(otaPreview,/secrets\.|EXPO_TOKEN|eas-cli|eas update|expo export|npm install|npm ci|npx|contents: write/);
});
test('OTA policy modifications trigger candidate security checks',()=>{
  assert.match(workflow,/\.github\/workflows\/ota-preview\.yml/);
  assert.match(workflow,/tests\/android-main-release-firewall\.test\.mjs/);
  assert.doesNotMatch(otaPreview,/actions\/checkout|upload-artifact/);
});

function executableRunBlock(yaml, startStep, endStep, stopAt) {
  const start=yaml.indexOf('      - name: '+startStep);
  const end=yaml.indexOf('      - name: '+endStep,start+1);
  assert.ok(start>=0&&end>start,'expected adjacent workflow steps');
  const part=yaml.slice(start,end);
  const mark='        run: |\n';
  const pos=part.indexOf(mark);
  assert.ok(pos>=0,'expected Bash block');
  let script=part.slice(pos+mark.length);
  if(stopAt){
    const stop=script.indexOf(stopAt);
    assert.ok(stop>0,'script termination marker missing');
    script=script.slice(0,stop);
  }
  return script.split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
}
function bashSnippet(script, input) {
  const env={...process.env};
  if(input===null)delete env.NEGRESCO_STABLE_REQUESTED;
  else env.NEGRESCO_STABLE_REQUESTED=input;
  return spawnSync('bash',['-c',script],{env,encoding:'utf8',timeout:10000});
}
test('actual pre-build shell guard denies stable signing without invoking Gradle or secrets',()=>{
  const script=executableRunBlock(workflow,
    'Build standalone test APK (Debug certificate only)',
    'Delete ephemeral signing material',
    '          chmod +x android/gradlew');
  assert.doesNotMatch(script,/gradlew|secrets\.|NEGRESCO_RELEASE_KEY/);
  for(const value of ['true','TRUE','1','yes','',null]){
    const result=bashSnippet(script,value);
    assert.equal(result.status,1,'input '+String(value)+' must fail closed: '+result.stderr);
    assert.match(result.stdout,/Stable signing is disabled/);
  }
  const allowed=bashSnippet(script,'false');
  assert.equal(allowed.status,0,allowed.stderr);
  assert.match(allowed.stdout,/Debug certificate only/);
});
test('actual early manual-release step exits before dependency installation',()=>{
  const first=executableRunBlock(workflow,
    'Fail closed on unreviewed stable signing',
    'Install JS dependencies');
  const result=bashSnippet(first,'true');
  assert.equal(result.status,1);
  assert.match(result.stdout,/Stable signing blocked/);
  assert.doesNotMatch(first,/npm install|gradlew|secrets\.|configure-release-signing/);
});
test('OTA preview shell exits nonzero before any update, even in manual workflow',()=>{
  const mark='      - name: Block preview OTA until security approval';
  const i=otaPreview.indexOf(mark);
  assert.ok(i>=0);
  const snippet=otaPreview.slice(i).split('\n').filter(x=>x.startsWith('          ')).map(x=>x.slice(10)).join('\n');
  const r=bashSnippet(snippet,'false');
  assert.equal(r.status,1);
  assert.match(r.stdout,/P0 security hold/);
  assert.doesNotMatch(snippet,/EXPO_TOKEN|npm install|eas-cli/);
});

const require = createRequire(import.meta.url);
const {forceEmbeddedOnly} = require('../tooling/android/force_embedded_only_qa.cjs');
const sourceExpoConfig=JSON.parse(readFileSync(resolve('apps/mobile/app.json'),'utf8'));
test('only disposable QA APK gets embedded code and OTA is disabled before prebuild',()=>{
  const source=sourceExpoConfig;
  const result=forceEmbeddedOnly(source);
  assert.equal(source.expo.updates.enabled,true,'original app.json remains unchanged');
  assert.equal(result.expo.updates.enabled,false);
  assert.equal(result.expo.updates.checkAutomatically,'NEVER');
  assert.equal(result.expo.updates.useEmbeddedUpdate,true);
  assert.equal(result.expo.updates.url,source.expo.updates.url);
  assert.equal(result.expo.android.package,source.expo.android.package);
  assert.notStrictEqual(result,source);
});
test('malformed, changed or already-disabled OTA source policy aborts safely',()=>{
  for(const update of [
    x=>{x.expo.updates.enabled=false;},
    x=>{x.expo.updates.url='https://host.invalid';},
    x=>{x.expo.updates.requestHeaders['expo-channel-name']='stable';},
    x=>{x.expo.extra.eas.projectId='unexpected';},
    x=>{delete x.expo.runtimeVersion;}
  ]){
    const sample=structuredClone(sourceExpoConfig);
    update(sample);
    assert.throws(()=>forceEmbeddedOnly(sample),/BLOCK:/);
  }
});
test('workflow mutates only the throwaway Expo config before prebuild and audits both manifests',()=>{
  const i=workflow.indexOf('      - name: Disable remote Expo OTA in disposable QA APK only');
  const j=workflow.indexOf('      - name: Generate native Android project');
  assert.ok(i>0&&j>i);
  assert.match(workflow.slice(i,j),/force_embedded_only_qa\.cjs app\.json/);
  assert.match(workflow,/u\.enabled!==false/);
  assert.match(workflow,/native AndroidManifest explicitly disables OTA/);
  assert.match(workflow,/compiled APK Expo Updates ENABLED=false/);
  assert.match(workflow,/aapt" "\$APK"/);
});

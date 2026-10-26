import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=(path)=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const mobile=load('apps/mobile/package.json');
const config=load('apps/mobile/app.json').expo;
test('mobile is a private Expo application',()=>{
 assert.equal(mobile.private,true);
 assert.match(mobile.main,/expo\/AppEntry\.js$/);
 assert.ok(mobile.dependencies.expo);
 assert.ok(mobile.dependencies['react-native']);
});
test('Android package identifier is stable',()=>{
 assert.equal(config.android.package,'com.negresco.finance');
 assert.equal(config.slug,'negresco-finance');
 assert.equal(config.userInterfaceStyle,'dark');
});
test('P0 has a TypeScript configuration',()=>{
 const ts=load('apps/mobile/tsconfig.json');
 assert.equal(ts.compilerOptions.strict,true);
});
test('P0 source has a React Native entrypoint',()=>{
 const app=readFileSync(new URL('../apps/mobile/App.tsx',import.meta.url),'utf8');
 assert.match(app,/export default function App\(/);
});
test('P0 build produces a standalone APK artifact',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
 assert.match(workflow,/assembleRelease/);
 assert.match(workflow,/app-release\.apk/);
 assert.match(workflow,/upload-artifact@v4/);
});

test('V3.1 uses a separate OTA runtime from builds with older native modules',()=>{
 assert.equal(config.version,'3.1.2');
 assert.equal(mobile.version,config.version);
 assert.equal(config.android.versionCode,33);
 assert.equal(config.android.allowBackup,false,'Android Auto Backup must remain disabled for sensitive prototype data');
 assert.ok(mobile.dependencies['expo-local-authentication'],'native biometric module must be bundled');
 assert.equal(mobile.dependencies['expo-screen-capture'],'~8.0.9','Android privacy guard needs SDK54-native package');
 assert.equal(config.plugins[0][0],'expo-local-authentication');
 assert.equal(config.runtimeVersion.policy,'appVersion');
 assert.equal(config.updates.requestHeaders['expo-channel-name'],'preview');
});

test('Android candidate remains downloadable only as temporary Actions artifact',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
 assert.match(workflow,/Preserve full release bundle as Actions artifact/);
 assert.match(workflow,/negresco-finance-v31-distribution/);
 assert.match(workflow,/apps\/mobile\/APK-SIGNATURE\.txt/);
 assert.match(workflow,/apps\/mobile\/Negresco-Finance-V3\.1-candidate\.apk/);
 assert.match(workflow,/cancel-in-progress: true/);
 assert.match(workflow,/permissions:\s*\n\s*contents: read/);
 assert.doesNotMatch(workflow,/Publish APK first, ZIP second in GitHub Releases|gh release/);
});

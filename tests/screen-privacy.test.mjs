import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Guardião stays protected even when biometric opt-in is off',()=>{
 const source=read('apps/mobile/components/ProtectedScreenCapture.tsx');
 assert.match(source,/page==='Guardião'/);
 assert.match(source,/lockStatus!=='off'/);
 assert.match(source,/usePreventScreenCapture\('negresco-private-screen'\)/);
 assert.doesNotMatch(source,/requestPermissions|READ_MEDIA_IMAGES|addScreenshotListener/);
});
test('a single capture guard is mounted outside page content',()=>{
 const app=read('apps/mobile/App.tsx');
 assert.match(app,/shouldProtectScreenCapture\(page,localLock\.status\)&&<ProtectedScreenCapture\/>/);
 assert.match(app,/ProtectedScreenCapture/);
});
test('capture protection requires a separate native runtime and is documented',()=>{
 const cfg=JSON.parse(read('apps/mobile/app.json')).expo;
 const packageJson=JSON.parse(read('apps/mobile/package.json'));
 assert.equal(cfg.version,'3.1.3');
 assert.equal(cfg.android.versionCode,34);
 assert.equal(packageJson.version,cfg.version);
 assert.equal(packageJson.dependencies['expo-screen-capture'],'~8.0.9');
 assert.match(read('docs/ANDROID_QA_V3.1.md'),/QA-35/);
 assert.match(read('docs/ANDROID_QA_V3.1.md'),/QA-36/);
});

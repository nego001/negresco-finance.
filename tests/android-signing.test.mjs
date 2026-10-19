import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {patchGradleForStableSigning,decodeKeystoreBase64,configureFromEnvironment}=
 require('../tooling/android/configure-release-signing.cjs');

const fixture=[
 'android {',
 '  signingConfigs {',
 '    debug {',
 "      storeFile file('debug.keystore')",
 "      storePassword 'android'",
 '    }',
 '  }',
 '  buildTypes {',
 '    debug {',
 '      signingConfig signingConfigs.debug',
 '    }',
 '    release {',
 '      signingConfig signingConfigs.debug',
 '      minifyEnabled false',
 '    }',
 '  }',
 '}'
].join('\n');

test('only release signing is changed; debug and secrets remain untouched',()=>{
 const result=patchGradleForStableSigning(fixture);
 assert.match(result,/release\s*\{\s*signingConfig signingConfigs\.negrescoStableRelease/);
 assert.match(result,/debug\s*\{\s*signingConfig signingConfigs\.debug/);
 assert.match(result,/System\.getenv\('NEGRESCO_RELEASE_STORE_PASSWORD'\)/);
 assert.equal((result.match(/signingConfigs\.negrescoStableRelease/g)||[]).length,1);
});

test('unknown Gradle templates and double patching fail closed',()=>{
 assert.throws(()=>patchGradleForStableSigning('plugins {}'),/not recognized/);
 assert.throws(()=>patchGradleForStableSigning(fixture.replace(
   'release {\n      signingConfig signingConfigs.debug',
   'release {\n      signingConfig signingConfigs.another'
 )),/not found/);
 assert.throws(()=>patchGradleForStableSigning(patchGradleForStableSigning(fixture)),/already patched/);
});

test('strict base64 decoding rejects malformed or incomplete keystores',()=>{
 assert.throws(()=>decodeKeystoreBase64('bad'),/Invalid/);
 assert.throws(()=>decodeKeystoreBase64('YQ=='),/Invalid|too small/i);
 const candidate=Buffer.alloc(96,42);
 assert.deepEqual(decodeKeystoreBase64(candidate.toString('base64')),candidate);
});
test('keystore is never created if credentials are incomplete',()=>{
 assert.throws(()=>configureFromEnvironment({},'/tmp/never-write'),/missing/);
});
test('workflow requires explicit manual opt in and checks the certificate fingerprint',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
 assert.match(workflow,/stable_signing/);
 assert.match(workflow,/configure-release-signing\.cjs/);
 assert.match(workflow,/NEGRESCO_RELEASE_KEYSTORE_B64/);
 assert.match(workflow,/NEGRESCO_EXPECTED_CERT_SHA256/);
 assert.match(workflow,/CN=Android Debug/);
 assert.match(workflow,/apksigner/);
});

test('feature branch pushes cannot publish GitHub releases without explicit main dispatch',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
 assert.match(workflow,/publish_release:\s*\n\s*description:[^\n]*\n\s*required: true\s*\n\s*default: false\s*\n\s*type: boolean/);
 const releaseStep=workflow.match(/- name: Publish APK first, ZIP second in GitHub Releases[\s\S]*?\n\s*env:/)?.[0];
 assert.ok(releaseStep,'release step must exist');
 assert.match(releaseStep,/if: \$\{\{ github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.publish_release \}\}/);
 assert.match(workflow,/name: Preserve full release bundle as Actions artifact/);
});

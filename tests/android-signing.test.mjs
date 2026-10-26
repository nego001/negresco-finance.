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
test('candidate workflow denies stable signing without importing private credentials',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
 const trigger=workflow.slice(workflow.indexOf('on:\n'),workflow.indexOf('concurrency:'));
 assert.match(trigger,/workflow_dispatch:\s*\n\s*push:/);
 assert.doesNotMatch(trigger,/stable_signing:|inputs:/);
 assert.match(workflow,/Fail closed on unreviewed stable signing/);
 assert.match(workflow,/NEGRESCO_USE_STABLE_SIGNING: 'false'/);
 assert.doesNotMatch(workflow,/configure-release-signing\.cjs|secrets\.|NEGRESCO_RELEASE_KEYSTORE_B64|NEGRESCO_EXPECTED_CERT_SHA256/);
 assert.match(workflow,/grep -q 'CN=Android Debug'/);
 assert.match(workflow,/apksigner/);
});

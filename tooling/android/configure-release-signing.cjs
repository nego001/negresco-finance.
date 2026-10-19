'use strict';
// Optional Android release signing, never on by default. Passwords only via env.
// Native Gradle files contain references to env vars, never literal secrets.
// Not a production approval: device upgrade/migration still requires QA.
const fs=require('node:fs');
const path=require('node:path');
const MARKER='// negresco-stable-release-signing-v1';

function patchGradleForStableSigning(content) {
  if(typeof content!=='string'||content.includes(MARKER))throw Error('Signing already patched or input invalid.');
  const androidPos=content.search(/\bandroid\s*\{/);
  const buildPos=content.search(/\bbuildTypes\s*\{/);
  if(androidPos<0||buildPos<androidPos)throw Error('Expo Groovy buildTypes template not recognized.');
  const before=content.slice(0,buildPos);
  const body=content.slice(buildPos);
  const release=/(\brelease\s*\{[\s\S]*?\bsigningConfig\s+)signingConfigs\.debug\b/;
  if(!release.test(body))throw Error('Expected release signingConfig.debug not found.');
  const block=[
    MARKER,
    'signingConfigs {',
    '  negrescoStableRelease {',
    "    storeFile file(System.getenv('NEGRESCO_SIGNING_STORE_FILE'))",
    "    storePassword System.getenv('NEGRESCO_RELEASE_STORE_PASSWORD')",
    "    keyAlias System.getenv('NEGRESCO_RELEASE_KEY_ALIAS')",
    "    keyPassword System.getenv('NEGRESCO_RELEASE_KEY_PASSWORD')",
    '  }',
    '}',
    ''
  ].join('\n');
  const updated=before+block+body.replace(release,'$1signingConfigs.negrescoStableRelease');
  if((updated.match(/signingConfigs\.negrescoStableRelease/g)||[]).length!==1)throw Error('Unexpected release signing match count.');
  return updated;
}
function decodeKeystoreBase64(value) {
  if(typeof value!=='string'||value.length<16||value.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw Error('Invalid base64 keystore format.');
  const decoded=Buffer.from(value,'base64');
  if(decoded.length<64||decoded.toString('base64')!==value)throw Error('Keystore too small or noncanonical base64.');
  return decoded;
}
function configureFromEnvironment(env=process.env,root=process.cwd()){
  const needed=['NEGRESCO_RELEASE_KEYSTORE_B64','NEGRESCO_RELEASE_STORE_PASSWORD',
    'NEGRESCO_RELEASE_KEY_ALIAS','NEGRESCO_RELEASE_KEY_PASSWORD','NEGRESCO_SIGNING_STORE_FILE'];
  if(needed.some(key=>!env[key]||!String(env[key]).trim()))
    throw Error('Stable signing requested but required GitHub secrets are missing.');
  const target=path.resolve(env.NEGRESCO_SIGNING_STORE_FILE);
  const allowedDir=path.resolve(root,'android/app');
  if(path.dirname(target)!==allowedDir||path.basename(target)!=='negresco-ci-release.jks')
    throw Error('Keystore path must be a fixed temporary Android build path.');
  const gradlePath=path.join(allowedDir,'build.gradle');
  const replacement=patchGradleForStableSigning(fs.readFileSync(gradlePath,'utf8'));
  const buffer=decodeKeystoreBase64(env.NEGRESCO_RELEASE_KEYSTORE_B64);
  fs.writeFileSync(target,buffer,{flag:'wx',mode:0o600});
  try{fs.writeFileSync(gradlePath,replacement);}
  catch(error){fs.rmSync(target,{force:true});throw error;}
  return 'Opt-in stable signing prepared; no secrets written to Gradle.';
}
if(require.main===module){
  try{console.log(configureFromEnvironment());}
  catch(error){console.error('Stable signing setup failed: '+error.message);process.exitCode=1;}
}
module.exports={patchGradleForStableSigning,decodeKeystoreBase64,configureFromEnvironment};

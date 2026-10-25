#!/usr/bin/env node
'use strict';

// Manual stable-release gate only. OTA preview behavior remains unchanged.
// If Expo OTA updates are enabled, a trusted X.509 *public certificate*
// must be configured so downloaded JS updates require code signatures.
// Private signing keys must never be committed or read by this verifier.
const fs=require('node:fs');
const path=require('node:path');
const {X509Certificate}=require('node:crypto');

function block(message){
  throw new Error('BLOCK: unsigned Expo OTA stable release: '+message);
}
function verify(projectFile, now=new Date()){
  const file=path.resolve(projectFile);
  const root=path.dirname(file);
  let app;
  try{
    app=JSON.parse(fs.readFileSync(file,'utf8'));
  }catch{
    block('app.json missing or invalid');
  }
  const updates=app?.expo?.updates;
  if(!updates||typeof updates!=='object'||Array.isArray(updates))
    block('Expo updates configuration must be explicit');
  if(updates.enabled===false){
    // Expo documentation: false disables downloading OTA code entirely.
    if(updates.codeSigningCertificate||updates.codeSigningMetadata)
      block('disabled OTA must not retain contradictory code-signing settings');
    return {mode:'embedded-only'};
  }
  if(updates.enabled!==true)
    block('updates.enabled must explicitly be true or false');
  if(typeof updates.url!=='string'||!/^https:\/\//.test(updates.url))
    block('enabled OTA requires a trusted HTTPS endpoint');
  if(typeof updates.codeSigningCertificate!=='string'||
     !updates.codeSigningCertificate.trim())
    block('enabled OTA must declare codeSigningCertificate');
  const meta=updates.codeSigningMetadata;
  if(!meta||typeof meta!=='object'||Array.isArray(meta)||
     Object.keys(meta).sort().join(',')!=='alg,keyid'||
     meta.alg!=='rsa-v1_5-sha256'||
     typeof meta.keyid!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(meta.keyid))
    block('enabled OTA requires pinned RSA signature metadata and keyid');
  const requested=updates.codeSigningCertificate;
  if(path.isAbsolute(requested))
    block('certificate path must be relative to app.json');
  const certPath=path.resolve(root,requested);
  const relative=path.relative(root,certPath);
  if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||
      path.isAbsolute(relative))
    block('certificate path escapes the app project');
  // A symlink in *any* path segment is unsafe, including parent directories.
  let cursor=root;
  for(const part of relative.split(path.sep)){
    cursor=path.join(cursor,part);
    const st=fs.lstatSync(cursor,{throwIfNoEntry:false});
    if(!st||st.isSymbolicLink())
      block('certificate path is missing or symlinked');
  }
  const stat=fs.statSync(certPath);
  if(!stat.isFile()||!stat.size||stat.size>32768)
    block('certificate must be a bounded, nonempty regular file');
  const pem=fs.readFileSync(certPath,'utf8');
  if(!/^-----BEGIN CERTIFICATE-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END CERTIFICATE-----\r?\n?$/.test(pem))
    block('certificate file must contain one PEM public certificate only');
  let cert;
  try{cert=new X509Certificate(pem);}
  catch{block('invalid X.509 signing certificate');}
  if(cert.publicKey.asymmetricKeyType!=='rsa'||
     (cert.publicKey.asymmetricKeyDetails?.modulusLength??0)<2048)
    block('signing certificate requires at least RSA-2048');
  const t=now.getTime();
  if(!Number.isFinite(t)||Date.parse(cert.validFrom)>t||
     Date.parse(cert.validTo)<t+30*24*60*60*1000)
    block('signing certificate is not valid for at least 30 more days');
  return {mode:'signed-ota',keyid:meta.keyid,certificateFingerprint:cert.fingerprint256};
}
if(require.main===module){
  try{
    const result=verify(process.argv[2]??'apps/mobile/app.json');
    console.log('PASS: stable-release OTA policy '+result.mode);
  }catch(err){
    console.error(err instanceof Error?err.message:String(err));
    process.exitCode=1;
  }
}
module.exports={verify};

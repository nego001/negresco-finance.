'use strict';

// Release hardening: no HTTP cleartext, per-domain exceptions, user-added CAs,
// or debug certificate overrides. Applies during Expo Android prebuild.
const fs = require('node:fs');
const path = require('node:path');
const {withAndroidManifest,withDangerousMod} = require('expo/config-plugins');

const FILE = 'negresco_network_security.xml';
const XML = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<network-security-config>',
  '  <base-config cleartextTrafficPermitted="false">',
  '    <trust-anchors>',
  '      <certificates src="system"/>',
  '    </trust-anchors>',
  '  </base-config>',
  '</network-security-config>',
  ''
].join('\n');

function withNegrescoNetworkPolicy(config) {
  config=withAndroidManifest(config,current=>{
    const apps=current.modResults?.manifest?.application;
    if(!Array.isArray(apps)||apps.length!==1||!apps[0]||!apps[0].$)
      throw new Error('BLOCK: Android network policy requires one application');
    const attrs=apps[0].$;
    const expected='@xml/negresco_network_security';
    if(attrs['android:networkSecurityConfig'] &&
       attrs['android:networkSecurityConfig']!==expected)
      throw new Error('BLOCK: competing Android network security configuration');
    attrs['android:networkSecurityConfig']=expected;
    attrs['android:usesCleartextTraffic']='false';
    return current;
  });
  return withDangerousMod(config,['android',async current=>{
    const dir=path.join(current.modRequest.platformProjectRoot,'app','src','main','res','xml');
    fs.mkdirSync(dir,{recursive:true});
    const file=path.join(dir,FILE);
    if(fs.existsSync(file)){
      const stat=fs.lstatSync(file);
      if(!stat.isFile()||stat.isSymbolicLink()||
         fs.readFileSync(file,'utf8')!==XML)
        throw new Error('BLOCK: generated Android network policy changed or linked');
    } else {
      fs.writeFileSync(file,XML,{flag:'wx'});
    }
    return current;
  }]);
}
module.exports=withNegrescoNetworkPolicy;
module.exports.NETWORK_SECURITY_XML=XML;
module.exports.NETWORK_SECURITY_FILE=FILE;

'use strict';

// Expo SDK 54 stores OTA runtimeVersion in an ordinary Android string.
// Keep it non-translatable: a locale-specific replacement can silently
// switch OTA compatibility at runtime despite a correctly signed APK.
const {withStringsXml} = require('expo/config-plugins');

const RESOURCE_NAME='expo_runtime_version';
function checkVersion(config) {
  const version=config?.version;
  if(config?.runtimeVersion?.policy!=='appVersion' ||
      typeof version!=='string' ||
      !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(version))
    throw new Error('BLOCK: OTA runtime resource requires explicit appVersion policy and semver');
  return version;
}
function lockRuntimeStrings(modResults, version) {
  if(!modResults || !modResults.resources ||
     (modResults.resources.string!==undefined &&
      !Array.isArray(modResults.resources.string)))
    throw new Error('BLOCK: malformed Android strings.xml resource tree');
  const entries=modResults.resources.string??[];
  const found=entries.filter(x=>x?.$?.name===RESOURCE_NAME);
  if(found.length>1)
    throw new Error('BLOCK: duplicate Android OTA runtime resource');
  if(found.length===1){
    const entry=found[0];
    if(typeof entry._!=='string'||entry._!==version)
      throw new Error('BLOCK: Expo generated OTA runtime differs from appVersion');
    if(entry.$.translatable!==undefined && entry.$.translatable!=='false')
      throw new Error('BLOCK: competing OTA runtime translatable policy');
    entry.$.translatable='false';
  }else{
    entries.push({$:{name:RESOURCE_NAME,translatable:'false'},_:version});
  }
  modResults.resources.string=entries;
  return modResults;
}
function withNegrescoOtaRuntimeLock(config){
  const version=checkVersion(config);
  return withStringsXml(config,current=>{
    current.modResults=lockRuntimeStrings(current.modResults,version);
    return current;
  });
}
module.exports=withNegrescoOtaRuntimeLock;
module.exports.lockRuntimeStrings=lockRuntimeStrings;
module.exports.checkVersion=checkVersion;
module.exports.RESOURCE_NAME=RESOURCE_NAME;

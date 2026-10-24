'use strict';

// Supply-chain policy: generated Expo native Android project must not
// silently re-enable transfer of the app's private financial records.
// This plugin has no effect on an already-installed application.
const fs = require('node:fs');
const path = require('node:path');
const {withAndroidManifest, withDangerousMod} = require('expo/config-plugins');

const RESOURCE_ROOT = 'negresco_no_data_extraction';
const DOMAINS = Object.freeze([
  'root', 'file', 'database', 'sharedpref', 'external',
  'device_root', 'device_file', 'device_database', 'device_sharedpref'
]);

function exclusions(indent) {
  return DOMAINS.map(domain => indent + '<exclude domain="' + domain + '" path="."/>').join('\n');
}

const DATA_EXTRACTION_XML = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<data-extraction-rules>',
  '  <cloud-backup disableIfNoEncryptionCapabilities="true">',
  exclusions('    '),
  '  </cloud-backup>',
  '  <device-transfer>',
  exclusions('    '),
  '  </device-transfer>',
  '</data-extraction-rules>',
  ''
].join('\n');

const LEGACY_FULL_BACKUP_XML = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<full-backup-content>',
  exclusions('  '),
  '</full-backup-content>',
  ''
].join('\n');

function ensureExactFile(file, content) {
  if (fs.existsSync(file)) {
    const info = fs.lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink() ||
        fs.readFileSync(file, 'utf8') !== content) {
      throw new Error('BLOCK: backup policy resource was replaced or changed: ' + file);
    }
    return;
  }
  fs.writeFileSync(file, content, {flag:'wx'});
}

function withNegrescoNoDataExtraction(config) {
  config = withAndroidManifest(config, current => {
    const apps = current.modResults.manifest.application;
    if (!Array.isArray(apps) || apps.length !== 1 || !apps[0] || !apps[0].$) {
      throw new Error('BLOCK: generated AndroidManifest must contain exactly one application');
    }
    const attrs = apps[0].$;
    attrs['android:allowBackup'] = 'false';
    attrs['android:dataExtractionRules'] = '@xml/' + RESOURCE_ROOT;
    attrs['android:fullBackupContent'] = '@xml/negresco_legacy_no_backup';
    return current;
  });
  return withDangerousMod(config, ['android', async current => {
    const xmlDir=path.join(current.modRequest.platformProjectRoot,
      'app','src','main','res','xml');
    fs.mkdirSync(xmlDir, {recursive:true});
    ensureExactFile(path.join(xmlDir,RESOURCE_ROOT+'.xml'),DATA_EXTRACTION_XML);
    ensureExactFile(path.join(xmlDir,'negresco_legacy_no_backup.xml'),LEGACY_FULL_BACKUP_XML);
    return current;
  }]);
}

module.exports=withNegrescoNoDataExtraction;
module.exports.DATA_EXTRACTION_XML=DATA_EXTRACTION_XML;
module.exports.LEGACY_FULL_BACKUP_XML=LEGACY_FULL_BACKUP_XML;
module.exports.DOMAINS=DOMAINS;

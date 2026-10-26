'use strict';
// This file changes ONLY the disposable CI working copy of apps/mobile/app.json.
// It does not affect checked-in app configuration or previously installed APKs.
const fs = require('node:fs');
const path = require('node:path');
const EXPECTED_URL = 'https://u.expo.dev/a506611f-a159-4341-bed7-28dcbd47bf95';
const EXPECTED_ID = 'a506611f-a159-4341-bed7-28dcbd47bf95';

function forceEmbeddedOnly(input) {
  if (!input || typeof input !== 'object' || !input.expo || typeof input.expo !== 'object') {
    throw new Error('BLOCK: invalid Expo app config');
  }
  const e = input.expo;
  const u = e.updates;
  if (!u || u.enabled !== true || u.checkAutomatically !== 'ON_LOAD' ||
      u.url !== EXPECTED_URL ||
      u.requestHeaders?.['expo-channel-name'] !== 'preview' ||
      e.extra?.eas?.projectId !== EXPECTED_ID ||
      e.runtimeVersion?.policy !== 'appVersion') {
    throw new Error('BLOCK: unrecognized source OTA policy; inspect before modifying');
  }
  const copy = structuredClone(input);
  copy.expo.updates.enabled = false;
  copy.expo.updates.checkAutomatically = 'NEVER';
  copy.expo.updates.useEmbeddedUpdate = true;
  return copy;
}

function main(args) {
  if (args.length !== 1 || args[0] !== 'app.json') {
    throw new Error('BLOCK: only the disposable apps/mobile/app.json is supported');
  }
  const file = path.resolve(process.cwd(), args[0]);
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 65536 || info.size < 60) {
    throw new Error('BLOCK: unsafe Expo app config');
  }
  const modified = forceEmbeddedOnly(JSON.parse(fs.readFileSync(file, 'utf8')));
  fs.writeFileSync(file, JSON.stringify(modified, null, 2) + '\n', {encoding: 'utf8', flag: 'w'});
  console.log('PASS (LAB): disposable Android APK forced to embedded-only, OTA disabled');
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}

module.exports = {forceEmbeddedOnly, main};

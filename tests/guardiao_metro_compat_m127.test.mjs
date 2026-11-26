import test from 'node:test';
import assert from 'node:assert/strict';
import {transform} from '../tooling/android/guardiao_metro_compat_m127.mjs';
const original='const isImageInput = assetInfo.files[0].includes(".zip/") ? _fs.default.readFileSync(assetInfo.files[0]) : assetInfo.files[0];\nconst dimensions = isImage ? (0, _imageSize.default)(isImageInput) : null;';
test('M127 only replaces path selection with image-gated buffer read',()=>{const out=transform(original);assert.ok(out.includes('const isImageInput = isImage ? _fs.default.readFileSync(assetInfo.files[0]) : null;'));assert.ok(out.includes('const dimensions = isImage ? (0, _imageSize.default)(isImageInput) : null;'))});
test('M127 refuses missing, duplicate or already patched anchors',()=>{assert.throws(()=>transform('no source'));assert.throws(()=>transform(original+'\n'+original));assert.throws(()=>transform(transform(original)))});

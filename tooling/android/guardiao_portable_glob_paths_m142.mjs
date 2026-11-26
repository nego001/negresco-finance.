import assert from 'node:assert/strict';
export function verifySyntheticGlob(paths,platform=process.platform){
 assert.ok(Array.isArray(paths));
 // Only normalize the native separator on Windows, never strip or resolve paths.
 const actual=paths.map(p=>{assert.equal(typeof p,'string');return platform==='win32'?p.replaceAll('\\','/'):p});
 assert.deepEqual(actual,['assets/sample.txt']);
}

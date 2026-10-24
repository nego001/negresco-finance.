import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const wf=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
const begin=wf.indexOf('          # Resource packaging can remap XML paths');
const scriptStart=wf.indexOf("          node <<'NODE'\n",begin);
const scriptEnd=wf.indexOf('\n          NODE',scriptStart);
assert.ok(begin>=0&&scriptStart>begin&&scriptEnd>scriptStart);
const code=wf.slice(scriptStart+"          node <<'NODE'\n".length,scriptEnd).split('\n')
  .map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
const required=[
  "      A: android:dataExtractionRules(0x0101062e)=@0x7f140001",
  "      A: android:fullBackupContent(0x010104eb)=@0x7f140002"
];
const manifest=attrs=>[
  'N: android=http://schemas.android.com/apk/res/android',
  '  E: manifest (line=1)',
  '    E: application (line=7)',
  ...attrs,
  '      E: activity (line=10)'
].join('\n')+'\n';

function run(t,text) {
  const dir=mkdtempSync(join(tmpdir(),'negresco-compiled-backup-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'verified-apk-backup-manifest.txt'),text);
  return spawnSync(process.execPath,['-e',code],{cwd:dir,encoding:'utf8',timeout:10000});
}

test('APK CI checks compiled AndroidManifest resource IDs, not fragile res/xml paths',()=>{
  assert.match(wf,/aapt" dump xmltree "\$APK" AndroidManifest\.xml/);
  assert.doesNotMatch(wf,/aapt" dump xmltree "\$APK" res\/xml\/negresco_/);
  assert.match(wf,/BLOCK: compiled Android backup policy/);
  assert.match(wf,/tests\/android-apk-backup-resource-pins\.test\.mjs/);
});

test('compiled manifest with exactly two valid policy resource IDs passes',t=>{
  const result=run(t,manifest(required));
  assert.equal(result.status,0,result.stderr+result.stdout);
  assert.match(result.stdout,/references modern and legacy backup exclusion resources/);
});

for(const [name,contents,reason] of [
  ['missing modern rules',manifest(required.slice(1)),/dataExtractionRules/],
  ['missing legacy rules',manifest(required.slice(0,1)),/fullBackupContent/],
  ['duplicate modern rules',manifest([required[0],required[0],required[1]]),/dataExtractionRules/],
  ['literal instead of compiled resource ID',manifest([
    "      A: android:dataExtractionRules(0x0101062e)=\"@xml/foo\"",required[1]]),/dataExtractionRules/],
  ['stray rule on nested activity',manifest([required[1]])+required[0]+'\n',/dataExtractionRules/],
  ['two application nodes',manifest(required)+"    E: application (line=100)\n",/exactly one application element/],
  ['no application',manifest(required).replace('E: application','E: activity'),/exactly one application element/],
  ['resource ID missing',manifest([required[0].replace('@0x7f140001','null'),required[1]]),/dataExtractionRules/]
]){
  test('compiled manifest reference mismatch blocks: '+name,t=>{
    const result=run(t,contents);
    assert.notEqual(result.status,0,name);
    assert.match(result.stderr+result.stdout,reason);
  });
}

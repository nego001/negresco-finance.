import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, writeFileSync, readFileSync, unlinkSync, mkdirSync, symlinkSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const workflow=readFileSync(new URL('../.github/workflows/android-apk.yml',import.meta.url),'utf8');
const start=workflow.indexOf('      - name: Verify downloaded candidate contents before publication\n');
const end=workflow.indexOf('      - name: Reverify downloaded release certificate and ZIP identity\n',start);
const publish=workflow.slice(workflow.indexOf('  publish-test-prerelease:'));
const section=workflow.slice(start,end);
const script=section.split('        run: |\n')[1]?.split('\n')
  .map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
const names=['Negresco-Finance-V3.1.3-preview.apk',
  'Negresco-Finance-V3.1.3-preview.zip','APK-SIGNATURE.txt'];
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');

function run(t,mode='valid'){
  assert.ok(start>=0&&end>start&&script,'privileged manifest gate exists');
  const dir=mkdtempSync(join(tmpdir(),'negresco-checksum-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const data=new Map(names.map(name=>[name,Buffer.from('DETERMINISTIC-TEST-NOT-APK-'+name)]));
  for(const [name,bytes] of data)writeFileSync(join(dir,name),bytes);
  writeFileSync(join(dir,'RELEASE_NOTES.md'),'Notes for a synthetic release only');
  let rows=names.map(name=>sha(data.get(name))+'  '+name);
  const alter=(i,value)=>{rows[i]=value;};
  switch(mode){
    case 'duplicate':alter(1,rows[0]);break;
    case 'traversal':alter(1,sha(data.get(names[1]))+'  ../../sensitive');break;
    case 'absolute':alter(1,sha(data.get(names[1]))+'  /etc/passwd');break;
    case 'wrong_filename':alter(1,sha(data.get(names[1]))+'  other.zip');break;
    case 'reordered':rows=[rows[1],rows[0],rows[2]];break;
    case 'star_binary':alter(1,sha(data.get(names[1]))+' *'+names[1]);break;
    case 'uppercase':alter(1,sha(data.get(names[1])).toUpperCase()+'  '+names[1]);break;
    case 'bad_digest':alter(1,'0'.repeat(64)+'  '+names[1]);break;
    case 'additional_checksum':rows.push(rows[0]);break;
    case 'only_two':rows.pop();break;
  }
  let contents=rows.join('\n')+'\n';
  if(mode==='no_newline')contents=contents.slice(0,-1);
  if(mode==='crlf')contents=contents.replaceAll('\n','\r\n');
  if(mode==='embedded_nul')contents=contents.replace('  '+names[0],'  '+names[0]+'\0');
  if(mode==='huge')contents+='x'.repeat(5000);
  writeFileSync(join(dir,'SHA256-release.txt'),contents);
  if(mode==='extra_file')writeFileSync(join(dir,'unexpected.bin'),'unwanted');
  if(mode==='hidden_file')writeFileSync(join(dir,'.hidden'),'unwanted');
  if(mode==='missing_zip')unlinkSync(join(dir,names[1]));
  if(mode==='empty_notes')writeFileSync(join(dir,'RELEASE_NOTES.md'),'');
  if(mode==='linked_apk'){
    unlinkSync(join(dir,names[0]));
    symlinkSync(names[1],join(dir,names[0]));
  }
  if(mode==='folder_instead_of_notes'){
    unlinkSync(join(dir,'RELEASE_NOTES.md'));
    mkdirSync(join(dir,'RELEASE_NOTES.md'));
  }
  if(mode==='changed_apk_after_manifest')writeFileSync(join(dir,names[0]),'tampered');
  const result=spawnSync('bash',['-e','-c',script],{
    cwd:dir,encoding:'utf8',timeout:10000,env:process.env
  });
  return result;
}

test('checksum manifest verification runs in the privileged job before signature verification and mutation',()=>{
  assert.ok(start>=0&&end>start);
  assert.ok(publish.indexOf('Verify downloaded candidate contents before publication')>=0);
  assert.ok(publish.indexOf('sha256sum --strict --check SHA256-release.txt') <
    publish.indexOf('Reverify downloaded release certificate'));
  assert.ok(publish.indexOf('sha256sum --strict --check SHA256-release.txt') <
    publish.indexOf('gh release create "$TAG"'));
  assert.match(section,/exactly three newline-terminated entries/);
  assert.match(section,/missing, empty, linked or nonregular artifact/);
  assert.doesNotMatch(publish,/actions\/checkout/);
  assert.match(workflow,/tests\/android-strict-sha256-manifest\.test\.mjs/);
});

test('exactly three valid named checksums are accepted',t=>{
  const result=run(t);
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/exactly the approved files/);
  assert.match(result.stdout,/OK/);
});

for(const [mode,reason] of [
  ['duplicate',/unsafe checksum path/],
  ['traversal',/unsafe checksum path/],
  ['absolute',/unsafe checksum path/],
  ['wrong_filename',/unsafe checksum path/],
  ['reordered',/unsafe checksum path/],
  ['star_binary',/unsafe checksum path/],
  ['uppercase',/unsafe checksum path/],
  ['additional_checksum',/exactly three/],
  ['only_two',/exactly three/],
  ['no_newline',/exactly three/],
  ['crlf',/NUL\/CR/],
  ['embedded_nul',/NUL\/CR/],
  ['huge',/too large/],
  ['extra_file',/unexpected, hidden or missing/],
  ['hidden_file',/unexpected, hidden or missing/],
  ['missing_zip',/unexpected, hidden or missing/],
  ['empty_notes',/empty, linked or nonregular/],
  ['linked_apk',/empty, linked or nonregular/],
  ['folder_instead_of_notes',/empty, linked or nonregular/],
  ['changed_apk_after_manifest',/FAILED/]
]){
  test('checksum/payload tampering fails closed: '+mode,t=>{
    const result=run(t,mode);
    assert.notEqual(result.status,0,mode);
    assert.match(result.stdout+result.stderr,reason);
  });
}

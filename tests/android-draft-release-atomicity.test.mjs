import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const workflow = readFileSync(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8');
const head = '      - name: Stage private draft and publish only after complete verified upload\n';
const start = workflow.indexOf(head);
const publish = workflow.slice(workflow.indexOf('  publish-test-prerelease:'));
const body = workflow.slice(start).split('        run: |\n')[1];
const script = body?.split('\n').map(
  line => line.startsWith('          ') ? line.slice(10) : line
).join('\n');
const files = [
  'Negresco-Finance-V3.1.3-preview.apk',
  'Negresco-Finance-V3.1.3-preview.zip',
  'SHA256-release.txt',
  'APK-SIGNATURE.txt'
];

const fakeGh = String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const mode = process.env.FAKE_MODE || 'ok';
const dir = process.env.FAKE_STATE_DIR;
const state = path.join(dir, 'draft.json');
const logs = path.join(dir, 'gh-commands.txt');
fs.appendFileSync(logs, JSON.stringify(args) + '\n');
if (args[0] !== 'release') process.exit(2);
if (args[1] === 'view') {
  if (!args.includes('--json')) process.exit(mode === 'existing' || fs.existsSync(state) ? 0 : 1);
  if (!fs.existsSync(state)) process.exit(3);
  const files = ['Negresco-Finance-V3.1.3-preview.apk',
    'Negresco-Finance-V3.1.3-preview.zip','SHA256-release.txt','APK-SIGNATURE.txt'];
  let assets = files.map(name => ({name,size:fs.statSync(name).size}));
  if (mode === 'remote_missing') assets.pop();
  if (mode === 'remote_extra') assets.push({name:'unexpected.txt',size:12});
  if (mode === 'remote_size') assets[0].size++;
  if (mode === 'remote_duplicate') assets[3] = {...assets[0]};
  process.stdout.write(JSON.stringify({isDraft:mode !== 'remote_public',assets}));
  process.exit(0);
}
if (args[1] === 'create') {
  if (!args.includes('--draft') || !args.includes('--prerelease')) process.exit(4);
  fs.writeFileSync(state, JSON.stringify({draft:true}));
  process.exit(0);
}
if (args[1] === 'upload') process.exit(mode === 'upload_fail' ? 5 : 0);
if (args[1] === 'edit') {
  if (mode === 'edit_fail') process.exit(6);
  if (!args.includes('--draft=false')) process.exit(7);
  fs.writeFileSync(state, JSON.stringify({draft:false}));
  process.exit(0);
}
process.exit(8);
`;

function run(t,mode='ok') {
  assert.ok(start >= 0 && script, 'publication block must exist');
  const dir = mkdtempSync(join(tmpdir(),'negresco-draft-gate-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  writeFileSync(join(dir,'gh'),fakeGh,{mode:0o755});
  for(const file of files) writeFileSync(join(dir,file),'fixture ' + file);
  writeFileSync(join(dir,'RELEASE_NOTES.md'),'DRAFT TEST');
  const result = spawnSync('bash',['-e','-c',script],{
    cwd:dir,encoding:'utf8',timeout:15000,
    env:{...process.env,PATH:dir+':'+process.env.PATH,
      GITHUB_SHA:'aabbccddeeff00112233445566778899',
      FAKE_MODE:mode,FAKE_STATE_DIR:dir}
  });
  const path = join(dir,'gh-commands.txt');
  const log = existsSync(path) ? readFileSync(path,'utf8')
    .trim().split('\n').map(x=>JSON.parse(x)) : [];
  const statePath = join(dir,'draft.json');
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath,'utf8')) : null;
  return {result,log,state};
}

test('privileged release stays restricted to manual main, stable signer and no checkout',()=>{
  assert.match(publish,/if: \$\{\{ github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.publish_release && inputs\.stable_signing \}\}/);
  assert.doesNotMatch(publish,/actions\/checkout/);
  assert.match(publish,/contents: write/);
  assert.match(workflow,/tests\/android-draft-release-atomicity\.test\.mjs/);
  assert.ok(publish.indexOf('Reverify downloaded release certificate') <
    publish.indexOf('Stage private draft and publish'));
  assert.doesNotMatch(script,/--clobber/);
});

test('successful staged upload is checked before publication',t=>{
  const {result,log,state}=run(t);
  assert.equal(result.status,0,result.stderr+result.stdout);
  assert.equal(state?.draft,false);
  assert.deepEqual(log.map(x=>x[1]),['view','create','upload','view','edit']);
  assert.ok(log[1].includes('--draft'));
  assert.ok(log[1].includes('--prerelease'));
  assert.ok(log[4].includes('--draft=false'));
  assert.equal(log[2].filter(x=>files.includes(x)).length,files.length);
});

test('failed artifact upload leaves private draft without publishing',t=>{
  const {result,log,state}=run(t,'upload_fail');
  assert.notEqual(result.status,0);
  assert.equal(state?.draft,true);
  assert.equal(log.some(x=>x[1]==='edit'),false);
  assert.match(result.stderr+result.stdout,/incomplete release remains a draft/);
});

test('existing release cannot be overwritten, edited or clobbered',t=>{
  const {result,log,state}=run(t,'existing');
  assert.notEqual(result.status,0);
  assert.equal(state,null);
  assert.deepEqual(log.map(x=>x[1]),['view']);
  assert.match(result.stderr+result.stdout,/already exists/);
});

for (const [mode,why] of [
  ['remote_missing',/asset count differs/],
  ['remote_extra',/asset count differs/],
  ['remote_duplicate',/duplicate or incomplete/],
  ['remote_size',/duplicate or incomplete/],
  ['remote_public',/not a draft/]
]) {
  test('wrong remote assets or release visibility block publication: '+mode,t=>{
    const {result,log,state}=run(t,mode);
    assert.notEqual(result.status,0);
    assert.equal(state?.draft,true);
    assert.equal(log.some(x=>x[1]==='edit'),false);
    assert.match(result.stderr+result.stdout,why);
  });
}

test('failed final visibility transition returns error, not success',t=>{
  const {result,log,state}=run(t,'edit_fail');
  assert.notEqual(result.status,0);
  assert.equal(state?.draft,true);
  assert.equal(log.at(-1)?.[1],'edit');
});

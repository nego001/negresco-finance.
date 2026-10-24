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
const crypto = require('node:crypto');
const args = process.argv.slice(2);
const mode = process.env.FAKE_MODE || 'ok';
const dir = process.env.FAKE_STATE_DIR;
const state = path.join(dir, 'draft.json');
const logs = path.join(dir, 'gh-commands.txt');
fs.appendFileSync(logs, JSON.stringify(args) + '\n');
const tagFile = path.join(dir, 'tag.json');
const readsFile = path.join(dir, 'tag-reads.txt');
if (args[0] === 'api') {
  if (args.some(x => x.includes('/releases?per_page=100'))) {
    if (process.env.GH_TOKEN !== 'fixture-publishing-token') process.exit(47);
    if (mode === 'release_list_fail') process.exit(13);
    if (mode === 'release_list_bad_json') { process.stdout.write('garbage'); process.exit(0); }
    if (mode === 'release_list_bad_shape') { process.stdout.write('{}'); process.exit(0); }
    if (mode === 'release_list_empty_shape') { process.stdout.write('[]'); process.exit(0); }
    if (mode === 'release_list_partial_page') { process.stdout.write('[{}]'); process.exit(0); }
    if (mode === 'release_list_bad_release') { process.stdout.write('[[{}]]'); process.exit(0); }
    const tag='v3.1.3-preview-' + process.env.GITHUB_SHA.slice(0,7);
    const rec={tag_name:tag,draft:mode==='existing_draft' || mode==='existing_second_page'};
    const pages=mode==='existing' || mode==='existing_draft' ? [[rec]] :
      mode==='existing_second_page' ? [[{tag_name:'unrelated',draft:false}],[rec]] :
      [[{tag_name:'unrelated',draft:true}],[]];
    process.stdout.write(JSON.stringify(pages));
    process.exit(0);
  }
  if (args.some(x => x.endsWith('/immutable-releases'))) {
    if (process.env.GH_TOKEN !== 'fixture-policy-read-only') process.exit(46);
    const readCounter=path.join(dir,'policy-reads.txt');
    const reads=Number(fs.existsSync(readCounter)?fs.readFileSync(readCounter,'utf8'):0)+1;
    fs.writeFileSync(readCounter,String(reads));
    if (['immutable_missing','immutable_forbidden','immutable_api_down'].includes(mode) ||
        (mode === 'immutable_flip_api_down' && reads === 2))
      process.exit(mode === 'immutable_missing' ? 44 : mode === 'immutable_forbidden' ? 43 : 50);
    if (mode === 'immutable_bad_json') { process.stdout.write('not json'); process.exit(0); }
    if (mode === 'immutable_empty') { process.stdout.write(''); process.exit(0); }
    process.stdout.write(JSON.stringify({
      enabled:!['immutable_disabled'].includes(mode) &&
        !(mode === 'immutable_flip_disabled' && reads === 2),
      enforced_by_owner:false
    }));
    process.exit(0);
  }
  if (args.some(x => /\/releases\/123$/.test(x))) {
    if (mode === 'draft_rest_api_down') process.exit(80);
    if (mode === 'draft_rest_bad_json') {process.stdout.write('oops');process.exit(0);}
    const existing=fs.existsSync(state)?JSON.parse(fs.readFileSync(state,'utf8')):null;
    if (!existing || !existing.draft) process.exit(81);
    const items=['Negresco-Finance-V3.1.3-preview.apk',
      'Negresco-Finance-V3.1.3-preview.zip','SHA256-release.txt','APK-SIGNATURE.txt'];
    const assets=items.map(name=>({
      name,size:fs.statSync(name).size,state:'uploaded',
      digest:'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex')
    }));
    if (mode === 'draft_rest_digest' || mode === 'remote_digest') assets[0].digest='sha256:'+'0'.repeat(64);
    if ((mode === 'draft_rest_no_digest' || mode === 'remote_no_digest')) delete assets[0].digest;
    if ((mode === 'draft_rest_wrong_size' || mode === 'remote_size')) assets[0].size++;
    if ((mode === 'draft_rest_wrong_state' || mode === 'remote_state')) assets[0].state='starter';
    if ((mode === 'draft_rest_missing' || mode === 'remote_missing')) assets.pop();
    if ((mode === 'draft_rest_duplicate' || mode === 'remote_duplicate')) assets[3]={...assets[0]};
    if ((mode === 'draft_rest_extra' || mode === 'remote_extra')) assets.push({name:'surprise',size:1});
    process.stdout.write(JSON.stringify({
      id:mode === 'draft_rest_wrong_id' ? 456 : 123,
      tag_name:mode === 'draft_rest_wrong_tag' ? 'other' :
        'v3.1.3-preview-' + process.env.GITHUB_SHA.slice(0,7),
      draft:mode !== 'draft_rest_public',
      prerelease:mode !== 'draft_rest_stable',
      assets
    }));
    process.exit(0);
  }
  if (args.some(x => x.includes('/releases/tags/'))) {
    if (mode === 'published_api_down') process.exit(70);
    const existing=fs.existsSync(state) ? JSON.parse(fs.readFileSync(state,'utf8')) : null;
    if (!existing || existing.draft) process.exit(71);
    const items=['Negresco-Finance-V3.1.3-preview.apk',
      'Negresco-Finance-V3.1.3-preview.zip','SHA256-release.txt','APK-SIGNATURE.txt'];
    let assets=items.map(name=>({
      name,size:fs.statSync(name).size,state:'uploaded',
      digest:'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex')
    }));
    if (mode === 'published_missing') assets.pop();
    if (mode === 'published_extra') assets.push({name:'extra.bin',size:10});
    if (mode === 'published_digest') assets[0].digest='sha256:' + '0'.repeat(64);
    if (mode === 'published_wrong_size') assets[0].size++;
    if (mode === 'published_wrong_state') assets[0].state='starter';
    if (mode === 'published_duplicate') assets[3]={...assets[0]};
    process.stdout.write(JSON.stringify({
      id:mode === 'published_wrong_id' ? 124 : 123,
      tag_name:mode === 'published_wrong_tag' ? 'unexpected-tag' :
        'v3.1.3-preview-' + process.env.GITHUB_SHA.slice(0,7),
      draft:mode === 'published_draft',
      prerelease:mode !== 'published_not_prerelease',
      immutable:mode !== 'published_not_immutable',
      assets
    }));
    process.exit(0);
  }
  if (args.includes('--include')) {
    if (mode === 'tag_exists') {
      process.stdout.write('HTTP/2.0 200 OK\n');
      process.exit(0);
    }
    if (mode === 'tag_api_down') {
      process.stderr.write('HTTP/2.0 503 Service Unavailable\n');
      process.exit(1);
    }
    process.stdout.write('HTTP/2.0 404 Not Found\n');
    process.exit(1);
  }
  if (args.includes('POST')) {
    if (mode === 'tag_create_fail') process.exit(9);
    const sha = args.find(x => x.startsWith('sha='))?.slice(4);
    const ref = args.find(x => x.startsWith('ref='))?.slice(4);
    const response = {ref,object:{type:'commit',sha}};
    fs.writeFileSync(tagFile,JSON.stringify(response));
    if (mode === 'tag_create_wrong_response') response.object.sha = 'b'.repeat(40);
    process.stdout.write(JSON.stringify(response));
    process.exit(0);
  }
  if (!fs.existsSync(tagFile) || mode === 'tag_get_missing') process.exit(10);
  const response=JSON.parse(fs.readFileSync(tagFile,'utf8'));
  const reads=Number(fs.existsSync(readsFile)?fs.readFileSync(readsFile,'utf8'):0)+1;
  fs.writeFileSync(readsFile,String(reads));
  if (mode === 'tag_get_wrong_sha' || (mode === 'tag_drift' && reads === 2) ||
      (mode === 'published_tag_drift' && reads === 3))
    response.object.sha = 'b'.repeat(40);
  if (mode === 'tag_get_annotated') response.object.type = 'tag';
  process.stdout.write(JSON.stringify(response));
  process.exit(0);
}
if (args[0] !== 'release') process.exit(2);
if (args[1] === 'view') {
  if (!args.includes('--json')) process.exit(mode === 'existing' || fs.existsSync(state) ? 0 : 1);
  if (!fs.existsSync(state)) process.exit(3);
  const files = ['Negresco-Finance-V3.1.3-preview.apk',
    'Negresco-Finance-V3.1.3-preview.zip','SHA256-release.txt','APK-SIGNATURE.txt'];
  let assets = files.map(name => ({
    name, size:fs.statSync(name).size,
    state:'uploaded',
    digest:'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex')
  }));
  if (mode === 'remote_digest') assets[0].digest = 'sha256:' + '0'.repeat(64);
  if (mode === 'remote_no_digest') delete assets[0].digest;
  if (mode === 'remote_state') assets[0].state = 'starter';
  if (mode === 'remote_missing') assets.pop();
  if (mode === 'remote_extra') assets.push({name:'unexpected.txt',size:12});
  if (mode === 'remote_size') assets[0].size++;
  if (mode === 'remote_duplicate') assets[3] = {...assets[0]};
  process.stdout.write(JSON.stringify({
    databaseId: mode === 'draft_no_id' ? null : mode === 'draft_wrong_id' ? 'not-an-id' : 123,
    isDraft:mode !== 'remote_public',
    isPrerelease:mode !== 'not_prerelease',
    targetCommitish: mode === 'wrong_target' ? 'b'.repeat(40) : process.env.GITHUB_SHA,
    tagName:mode === 'wrong_tag' ? 'v-malicious' : 'v3.1.3-preview-' + process.env.GITHUB_SHA.slice(0,7),
    ...(mode === 'cli_assets_unavailable' ? {} : {assets})
  }));
  process.exit(0);
}
if (args[1] === 'create') {
  if (!args.includes('--draft') || !args.includes('--prerelease') || !args.includes('--verify-tag') || !fs.existsSync(tagFile)) process.exit(4);
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
      GITHUB_SHA:mode==='bad_sha' ? 'not-a-commit' : 'aabbccddeeff00112233445566778899aabbccdd',
      FAKE_MODE:mode,FAKE_STATE_DIR:dir,GH_REPO:'fixture/negresco-finance',
      GH_TOKEN:'fixture-publishing-token',
      RELEASE_POLICY_READ_TOKEN:
        mode==='immutable_token_missing' ? '' :
        mode==='immutable_token_shared' ? 'fixture-publishing-token' :
        'fixture-policy-read-only'}
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
  assert.deepEqual(log.map(x=>x[0] === 'api' ? 'api' : x[1]),['api','api','api','api','api','create','upload','view','api','api','api','edit','api','api']);
  assert.ok(log[5].includes('--draft'));
  assert.ok(log[5].includes('--prerelease'));
  assert.ok(log[11].includes('--draft=false'));
  assert.equal(log[13].some(x=>x.includes('/releases/tags/')),true);
  assert.equal(log[8].some(x=>x.includes('/releases/123')),true);
  assert.equal(log[6].filter(x=>files.includes(x)).length,files.length);
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
  assert.deepEqual(log.map(x=>x[0] === 'api' ? 'api' : x[1]),['api','api']);
  assert.match(result.stderr+result.stdout,/already exists/);
});

for (const [mode,why] of [
  ['remote_missing',/REST draft asset count differs/],
  ['remote_extra',/REST draft asset count differs/],
  ['remote_duplicate',/REST draft asset SHA256 or metadata differs/],
  ['remote_size',/REST draft asset SHA256 or metadata differs/],
  ['remote_public',/draft release identity/],
  ['draft_no_id',/draft release identity/],
  ['draft_wrong_id',/draft release identity/],
  ['remote_digest',/REST draft asset SHA256 or metadata differs/],
  ['remote_no_digest',/REST draft asset SHA256 or metadata differs/],
  ['remote_state',/REST draft asset SHA256 or metadata differs/],
  ['tag_drift',/git tag does not resolve/],
  ['wrong_tag',/draft release identity/],
  ['not_prerelease',/draft release identity/]
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

test('existing bare git tag cannot be silently rebound by release target',t=>{
  const {result,log,state}=run(t,'tag_exists');
  assert.notEqual(result.status,0);
  assert.equal(state,null);
  assert.deepEqual(log.map(x=>x[0] === 'api' ? 'api' : x[1]),['api','api','api']);
  assert.match(result.stderr+result.stdout,/Git tag already exists/);
});

test('git ref lookup failure blocks rather than treating 503 as a missing tag',t=>{
  const {result,log,state}=run(t,'tag_api_down');
  assert.notEqual(result.status,0);
  assert.equal(state,null);
  assert.deepEqual(log.map(x=>x[0] === 'api' ? 'api' : x[1]),['api','api','api']);
  assert.match(result.stderr+result.stdout,/Cannot prove git tag is absent/);
});

test('git tag creation must be checked before a release draft is created',t=>{
  for(const mode of ['tag_create_fail','tag_create_wrong_response','tag_get_wrong_sha','tag_get_annotated','tag_get_missing']){
    const {result,log,state}=run(t,mode);
    assert.notEqual(result.status,0,mode);
    assert.equal(state,null,mode);
    assert.equal(log.some(x=>x[1]==='create'),false,mode);
  }
});

test('a tag mutated after the draft upload cannot be promoted to a public release',t=>{
  const {result,log,state}=run(t,'tag_drift');
  assert.notEqual(result.status,0);
  assert.equal(state?.draft,true);
  assert.equal(log.some(x=>x[1]==='edit'),false);
  assert.match(result.stderr+result.stdout,/git tag does not resolve/);
});

test('malformed workflow SHA cannot create a tag or release',t=>{
  const {result,log,state}=run(t,'bad_sha');
  assert.notEqual(result.status,0);
  assert.equal(state,null);
  assert.equal(log.length,0);
  assert.match(result.stderr+result.stdout,/Invalid GitHub commit SHA/);
});

for (const [mode,expected] of [
  ['immutable_disabled',/immutable releases must be enabled/],
  ['immutable_missing',/Cannot verify enabled GitHub immutable releases/],
  ['immutable_forbidden',/Cannot verify enabled GitHub immutable releases/],
  ['immutable_api_down',/Cannot verify enabled GitHub immutable releases/],
  ['immutable_bad_json',/invalid JSON/],
  ['immutable_empty',/invalid JSON/]
]) {
  test('immutable GitHub release policy failure blocks tag and draft: '+mode,t=>{
    const {result,log,state}=run(t,mode);
    assert.notEqual(result.status,0);
    assert.equal(state,null);
    assert.deepEqual(log.map(x=>x[0]),['api']);
    assert.match(result.stderr+result.stdout,expected);
  });
}

for(const [mode,expected] of [
  ['immutable_token_missing',/Read-only release policy token is missing/],
  ['immutable_token_shared',/must not reuse the publishing token/]
]){
  test('incorrect release policy credential blocks any GitHub call: '+mode,t=>{
    const {result,log,state}=run(t,mode);
    assert.notEqual(result.status,0);
    assert.equal(state,null);
    assert.equal(log.length,0);
    assert.match(result.stderr+result.stdout,expected);
  });
}
for(const [mode,expected] of [
  ['immutable_flip_disabled',/immutable releases must be enabled/],
  ['immutable_flip_api_down',/Cannot verify enabled GitHub immutable releases/]
]){
  test('policy disabled or unavailable after upload leaves private draft: '+mode,t=>{
    const {result,log,state}=run(t,mode);
    assert.notEqual(result.status,0);
    assert.equal(state?.draft,true);
    assert.equal(log.some(x=>x[1]==='edit'),false);
    assert.deepEqual(log.filter(x=>x[0]==='api' && x.some(a=>a.endsWith('/immutable-releases'))).length,2);
    assert.match(result.stderr+result.stdout,expected);
  });
}

for(const [mode,why] of [
  ['existing_draft',/release already exists/],
  ['existing_second_page',/release already exists/],
  ['release_list_fail',/Cannot enumerate existing/],
  ['release_list_bad_json',/not valid JSON/],
  ['release_list_bad_shape',/incomplete or malformed/],
  ['release_list_empty_shape',/incomplete or malformed/],
  ['release_list_partial_page',/incomplete or malformed/],
  ['release_list_bad_release',/incomplete or malformed/]
]){
  test('public/private release collision preflight fails closed: '+mode,t=>{
    const {result,log,state}=run(t,mode);
    assert.notEqual(result.status,0);
    assert.equal(state,null);
    assert.deepEqual(log.map(x=>x[0]),['api','api']);
    assert.match(result.stderr+result.stdout,why);
  });
}

for(const [mode,expected] of [
  ['published_not_immutable',/published release identity or immutable state differs/],
  ['published_wrong_id',/published release identity or immutable state differs/],
  ['published_wrong_tag',/published release identity or immutable state differs/],
  ['published_draft',/published release identity or immutable state differs/],
  ['published_not_prerelease',/published release identity or immutable state differs/],
  ['published_missing',/published asset count differs/],
  ['published_extra',/published asset count differs/],
  ['published_digest',/published asset digest differs/],
  ['published_wrong_size',/published asset digest differs/],
  ['published_wrong_state',/published asset digest differs/],
  ['published_duplicate',/published asset digest differs/],
  ['published_api_down',null],
  ['published_tag_drift',/git tag does not resolve/]
]){
  test('postpublication audit must fail on a changed released object: '+mode,t=>{
    const {result,log,state}=run(t,mode);
    assert.notEqual(result.status,0,mode);
    assert.equal(state?.draft,false,mode);
    assert.equal(log.filter(x=>x[1]==='edit').length,1,mode);
    if(expected) assert.match(result.stderr+result.stdout,expected);
  });
}

for(const [mode,why] of [
  ['draft_rest_api_down',null],
  ['draft_rest_bad_json',null],
  ['draft_rest_wrong_id',/REST draft release identity differs/],
  ['draft_rest_wrong_tag',/REST draft release identity differs/],
  ['draft_rest_public',/REST draft release identity differs/],
  ['draft_rest_stable',/REST draft release identity differs/],
  ['draft_rest_digest',/REST draft asset SHA256 or metadata differs/],
  ['draft_rest_no_digest',/REST draft asset SHA256 or metadata differs/],
  ['draft_rest_wrong_size',/REST draft asset SHA256 or metadata differs/],
  ['draft_rest_wrong_state',/REST draft asset SHA256 or metadata differs/],
  ['draft_rest_missing',/REST draft asset count differs/],
  ['draft_rest_duplicate',/REST draft asset SHA256 or metadata differs/],
  ['draft_rest_extra',/REST draft asset count differs/]
]){
  test('private draft REST crosscheck refuses publication: '+mode,t=>{
    const {result,log,state}=run(t,mode);
    assert.notEqual(result.status,0,mode);
    assert.equal(state?.draft,true,mode);
    assert.equal(log.some(x=>x[1]==='edit'),false,mode);
    if(why) assert.match(result.stderr+result.stdout,why);
  });
}

test('CLI may omit all nested asset fields when REST independently validates the uploaded bytes',t=>{
  const {result,log,state}=run(t,'cli_assets_unavailable');
  assert.equal(result.status,0,result.stderr+result.stdout);
  assert.equal(state?.draft,false);
  assert.equal(log.filter(x=>x[0]==='api'&&x.some(a=>a.includes('/releases/123'))).length,1);
  assert.equal(log.filter(x=>x[1]==='edit').length,1);
});

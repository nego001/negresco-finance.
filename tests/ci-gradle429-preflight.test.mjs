import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
const helper = new URL('../tooling/ci/gradle-metadata-429-preflight.sh',import.meta.url).pathname;
const job = workflow.slice(workflow.indexOf('  authority-postgres-lab:'));

const fakeGradle = `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$FAKE_STATE_DIR/arguments"
count=0
if [[ -f "$FAKE_STATE_DIR/count" ]]; then count="$(cat "$FAKE_STATE_DIR/count")"; fi
count=$((count + 1))
printf '%s' "$count" > "$FAKE_STATE_DIR/count"
case "$FAKE_MODE" in
  success) exit 0 ;;
  once) if [[ "$count" -gt 1 ]]; then exit 0; fi ;;
  twice) if [[ "$count" -gt 2 ]]; then exit 0; fi ;;
  non_429) echo 'FAILURE: Kotlin source compiler error' >&2; exit 19 ;;
  unrelated_number) echo 'Task no. 429 failed: assertion mismatch' >&2; exit 12 ;;
esac
echo "Could not GET https://repo.maven.apache.org/maven2/bom.pom. Received status code 429 from server: Too Many Requests" >&2
exit 1
`;
const fakeSleep = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$FAKE_STATE_DIR/sleeps"
`;

function run(t, mode='success', projectExists=true) {
  const dir=mkdtempSync(join(tmpdir(),'negresco-ci-429-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  if(projectExists) {
    mkdirSync(join(dir,'proj'));
    writeFileSync(join(dir,'proj','build.gradle.kts'), 'plugins {}\n');
  }
  writeFileSync(join(dir,'gradle'),fakeGradle,{mode:0o755});
  writeFileSync(join(dir,'sleep'),fakeSleep,{mode:0o755});
  const result=spawnSync('bash',[helper,'proj'],{
    cwd:dir,encoding:'utf8',timeout:10000,
    env:{...process.env, PATH:dir+':'+process.env.PATH,
      FAKE_STATE_DIR:dir,FAKE_MODE:mode}
  });
  const calls=existsSync(join(dir,'arguments'))
    ? readFileSync(join(dir,'arguments'),'utf8').trim().split('\n') : [];
  const sleeps=existsSync(join(dir,'sleeps'))
    ? readFileSync(join(dir,'sleeps'),'utf8').trim().split('\n') : [];
  return {result,calls,sleeps};
}

test('PostgreSQL and Kotlin assertions execute only once, after preflight',()=>{
  const pre=job.indexOf('bash tooling/ci/gradle-metadata-429-preflight.sh tooling/native-lock-spike');
  const actual=job.indexOf('gradle -p tooling/native-lock-spike pgBoundProofCheck pgRekeyCasCheck --no-daemon');
  const sql=job.indexOf('002_sec05c_schema_smoke.sql');
  assert.ok(sql>=0&&pre>sql&&actual>pre);
  assert.equal(job.split('pgBoundProofCheck pgRekeyCasCheck').length-1,1);
  assert.doesNotMatch(job,/continue-on-error:\s*true/);
});

test('successful plugin resolution runs exactly once with non-test Gradle help',t=>{
  const {result,calls,sleeps}=run(t,'success');
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(calls,['-p proj help --no-daemon']);
  assert.deepEqual(sleeps,[]);
});
test('single HTTP 429 retries only metadata and then succeeds',t=>{
  const {result,calls,sleeps}=run(t,'once');
  assert.equal(result.status,0,result.stderr);
  assert.equal(calls.length,2);
  assert.deepEqual(sleeps,['3']);
});
test('two HTTP 429 responses are retried with bounded delay',t=>{
  const {result,calls,sleeps}=run(t,'twice');
  assert.equal(result.status,0,result.stderr);
  assert.equal(calls.length,3);
  assert.deepEqual(sleeps,['3','6']);
});
test('continued HTTP 429 fails after exactly three tries',t=>{
  const {result,calls,sleeps}=run(t,'always_429');
  assert.notEqual(result.status,0);
  assert.equal(calls.length,3);
  assert.deepEqual(sleeps,['3','6']);
  assert.match(result.stderr,/still returns HTTP 429/);
});
test('compiler failure or unrelated status number is NOT retryable',t=>{
  for(const mode of ['non_429','unrelated_number']){
    const {result,calls,sleeps}=run(t,mode);
    assert.notEqual(result.status,0);
    assert.equal(calls.length,1,mode);
    assert.deepEqual(sleeps,[],mode);
    assert.match(result.stderr,/not a retryable dependency HTTP 429/);
  }
});
test('missing project fails before running Gradle',t=>{
  const {result,calls}=run(t,'success',false);
  assert.notEqual(result.status,0);
  assert.deepEqual(calls,[]);
  assert.match(result.stderr,/Gradle project does not exist/);
});

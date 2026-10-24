import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const auditor = join(root, 'tooling/sec05_android_junit_audit.py');
const kotlin = readFileSync(join(root,
  'apps/mobile/modules/negresco-finance-security/android/src/androidTest/java/com/negresco/finance/security/SyntheticJournalActualProcessDeathTest.kt'), 'utf8');
const caseNames = [...kotlin.matchAll(/@Test fun ([A-Za-z0-9_]+)\s*\(/g)].map(m => m[1]);
const secClass = 'com.negresco.finance.security.SyntheticJournalActualProcessDeathTest';
const bioClass = 'com.negresco.finance.security.SyntheticBiometricManualQaOptInTest';
const debugSqlcipherBiometric = 'com.negresco.finance.security.SyntheticBiometricSqlcipherManualQaOptInTest';
const isolationClass = 'com.negresco.finance.security.SyntheticBiometricSqlcipherQaIsolationTest';
const isolationCase = 'debugSqlcipherActivityLaunchCannotProvisionKeyOrSyntheticDatabase';
const required = 'ownerReplacedWithSameUuidAfterWitnessCannotCommitJournal';
const sliceClass = 'com.negresco.finance.security.SyntheticKeystoreSqlcipherLifecycleBoundaryTest';
const sliceMethods = [
  'foregroundRevocationDeniesProtectedFixtureReadBeforeKeyRelease',
  'revocationBetweenPreflightAndKeystoreLookupMustHold',
  'revocationAfterSqlcipherReadCannotReportSuccess',
  'missingKeystoreAliasDoesNotRecreateOrEraseNativeCiphertext',
];
const preflightClass = 'com.negresco.finance.security.SyntheticFinancialOperationPreflightTest';
const preflightMethods = [
  'revokedLifecycleAlwaysDeniesRegardlessOfForgedSignals',
  'unavailableCryptoAndStorageDenyBeforeNativeAuthority',
  'forgedAllTrueSignalsStillCannotAuthorizeAnything',
];
const permittedHardlinks = new Set([
  'hardlinkedJournalNewCannotRedirectWrite',
  'hardlinkedOwnerMarkerCannotAuthorizeWorkerWrite',
  'hardlinkedWitnessNewCannotRedirectWrite',
  'lateHardlinkAliasAfterWitnessCannotCommitJournal',
]);

function baseline() {
  assert.equal(caseNames.length, 26, 'fixture must track real Android test count');
  assert.ok(caseNames.includes(required));
  return [
    ...caseNames.map(name => ({classname: secClass, name, skipped: permittedHardlinks.has(name)})),
    {classname: bioClass, name: 'realStrongBiometricRequiresExplicitPhysicalDeviceConsent', skipped: true},
    {classname: debugSqlcipherBiometric,
      name: 'realBiometricTwiceThenSyntheticSqlcipherReopensWithNoJsAccess', skipped: true},
    {classname: isolationClass, name: isolationCase, skipped: false},
    ...sliceMethods.map(name => ({classname: sliceClass, name, skipped: false})),
    ...preflightMethods.map(name => ({classname: preflightClass, name, skipped: false})),
  ];
}

function run(cases, {xml = true, malformed = false} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sec05-junit-'));
  try {
    const reports = join(dir, 'connected');
    mkdirSync(reports);
    const summary = join(dir, 'summary.md');
    if (xml) {
      const content = malformed ? '<testsuite><testcase' : '<testsuite>\n' + cases.map(c =>
        '  <testcase classname="' + c.classname + '" name="' + c.name + '">' +
        (c.skipped ? '<skipped />' : '') +
        (c.failed ? '<failure>synthetic</failure>' : '') +
        '</testcase>'
      ).join('\n') + '\n</testsuite>\n';
      writeFileSync(join(reports, 'TEST-synthetic.xml'), content);
    }
    const python = process.platform === 'win32' ? 'python' : 'python3';
    const output = spawnSync(python, [auditor, reports], {
      encoding: 'utf8', timeout: 10000,
      env: {...process.env, GITHUB_STEP_SUMMARY: summary},
    });
    return {
      status: output.status, stdout: output.stdout, stderr: output.stderr,
      summary: existsSync(summary) ? readFileSync(summary, 'utf8') : '',
    };
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

// All fixtures are synthetic XML; no APK, device, credentials, or real account.
test('26 SEC-05 cases with four expected hardlink skips pass and report missing coverage', () => {
  const r = run(baseline());
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.summary, /SEC-05 process-death cases present: \*\*26\/26\*\*/);
  assert.match(r.summary, /SEC-05 source method inventory matches JUnit: \*\*True\*\*/);
  assert.match(r.summary, /Synthetic native cipher lifecycle methods: \*\*4\/4\*\*/);
  assert.match(r.summary, /DEBUG SQLCipher biometric isolation case: \*\*executed\*\*/);
  assert.match(r.summary, /skipped: \*\*6\*\*/);
  assert.match(r.summary, /Required same-UUID inode replacement case: \*\*executed\*\*/);
});
test('missing XML fails closed', () => {
  const r = run(baseline(), {xml: false});
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Missing Android instrumentation JUnit XML/);
});
test('malformed XML fails closed', () => {
  const r = run(baseline(), {malformed: true});
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /SEC-05 JUnit audit failed/);
});
test('duplicate testcase identity fails closed', () => {
  const cs = baseline(); cs.push({...cs[0]});
  const r = run(cs);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /duplicate/);
});
test('missing mandatory SEC-05 case fails closed', () => {
  const r = run(baseline().filter(c => c.name !== required));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /expected 26 SEC-05 tests, found 25/);
});
test('replacing a different SEC-05 method with a fabricated name but keeping count fails closed', () => {
  const cs = baseline();
  const original = cs.find(c => c.name === 'ownerRemovedAfterWitnessCannotCommitJournal');
  assert.ok(original);
  original.name = 'ownerRemovedAfterWitnessFAKE';
  const r = run(cs);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /SEC-05 method inventory mismatch/);
  assert.match(r.stderr, /ownerRemovedAfterWitnessCannotCommitJournal/);
  assert.match(r.stderr, /ownerRemovedAfterWitnessFAKE/);
});
test('skipping required same-UUID test fails closed', () => {
  const cs = baseline(); cs.find(c => c.name === required).skipped = true;
  const r = run(cs);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /required SEC-05 test missing or skipped/);
});
test('an unexpected skip fails closed', () => {
  const cs = baseline(); cs.find(c => c.name === 'ownerRemovedAfterWitnessCannotCommitJournal').skipped = true;
  const r = run(cs);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /unexpected SKIPPED tests/);
});
test('a foreign class cannot impersonate an allowed hardlink skip', () => {
  const cs = baseline();
  cs.push({classname: 'com.negresco.finance.security.UnrelatedSyntheticTest',
    name: 'hardlinkedJournalNewCannotRedirectWrite', skipped: true});
  const r = run(cs);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /unexpected SKIPPED tests/);
});
test('JUnit failure entry fails closed', () => {
  const cs = baseline(); cs.find(c => c.name === required).failed = true;
  const r = run(cs);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /failing\/error test cases/);
});


test('missing synthetic Keystore SQLCipher lifecycle method fails the JUnit gate', () => {
  const r = run(baseline().filter(c =>
    !(c.classname === sliceClass && c.name === sliceMethods[0])));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /native synthetic cipher slice inventory mismatch/);
});
test('skipped synthetic Keystore SQLCipher lifecycle method fails the JUnit gate', () => {
  const cs = baseline();
  cs.find(c => c.classname === sliceClass && c.name === sliceMethods[1]).skipped = true;
  const r = run(cs);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /native synthetic cipher slice has SKIPPED tests/);
});


test('replacing lifecycle slice method with a fake at same count fails', () => {
  const cases = baseline();
  cases.find(c => c.classname === sliceClass &&
    c.name === sliceMethods[1]).name = 'fakeLifecycleCheckpoint';
  const result = run(cases);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /native synthetic cipher slice inventory mismatch/);
  assert.match(result.stderr, /revocationBetweenPreflightAndKeystoreLookupMustHold/);
});

test('P0-1 preflight: all three instrumented methods appear in JUnit evidence', () => {
  const r = run(baseline());
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.summary, /P0-1 native preflight methods: \*\*3\/3\*\*/);
});
test('P0-1 preflight: a missing required testcase fails closed', () => {
  const r = run(baseline().filter(c =>
    !(c.classname === preflightClass && c.name === preflightMethods[0])));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /P0-1 native preflight inventory mismatch/);
});
test('P0-1 preflight: a SKIPPED required testcase fails closed', () => {
  const cs = baseline();
  cs.find(c => c.classname === preflightClass && c.name === preflightMethods[1]).skipped = true;
  const r = run(cs);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /P0-1 native preflight has SKIPPED tests/);
});
test('P0-1 preflight: a forged method with the same count fails closed', () => {
  const cs = baseline();
  cs.find(c => c.classname === preflightClass && c.name === preflightMethods[2]).name =
    'fakeNativeGrantPassed';
  const r = run(cs);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /P0-1 native preflight inventory mismatch/);
  assert.match(r.stderr, /forgedAllTrueSignalsStillCannotAuthorizeAnything/);
});

test('DEBUG SQLCipher isolation is neither missing, skipped nor forged', () => {
  const missing = run(baseline().filter(c => c.classname !== isolationClass));
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /DEBUG SQLCipher QA isolation test missing/);
  const skipped = baseline();
  skipped.find(c => c.classname === isolationClass).skipped = true;
  const result = run(skipped);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DEBUG SQLCipher QA isolation test missing/);
  const fake = baseline();
  fake.find(c => c.classname === isolationClass).name = 'fakeDebugIsolationCase';
  const forged = run(fake);
  assert.notEqual(forged.status, 0);
  assert.match(forged.stderr, /DEBUG SQLCipher QA isolation test missing/);
});

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
const attemptClass = 'com.negresco.finance.security.SyntheticOperationAttemptFenceTest';
const attemptMethods = [
  'attemptWithoutForegroundCannotRun',
  'repeatedIntentInSameForegroundEpochAlwaysDenies',
  'backgroundAndDestroyRevokeSyntheticOperationEpoch',
  'forgedStrongCryptoAndStorageRemainDeniedForBothIntents'
];
const callbackClass = 'com.negresco.finance.security.SyntheticCallbackDenialFenceTest';
const callbackMethods = [
  'callbackWithoutPendingAttemptIsDenied',
  'forgedSuccessWithMatchingIntentAndReceiptCannotAuthorize',
  'wrongIntentBurnsAttemptAndCorrectedReplayIsDenied',
  'staleReceiptAfterBackgroundCannotConsumeNewEpoch',
  'cancelledClaimAndPreflightFailureCannotTurnIntoApproval',
  'destructionAndDuplicateForegroundNeverResurrectReceipt'
];
const stressClass = 'com.negresco.finance.security.SyntheticCallbackAdversarialSequencesTest';
const stressMethods = [
  'hundredsOfForgedSuccessCallbacksNeverAuthorize',
  'crossIntentInjectionConsumesAttemptBeforeCorrection',
  'invalidatedForegroundAndDestroyedSessionsAlwaysRejectLateCallbacks',
  'randomizedClaimsNeverProduceAReceiptAfterDeniedPreflight',
];
const cleanupClass = 'com.negresco.finance.security.SyntheticDebugQaCleanupLedgerTest';
const cleanupMethods = [
  'failingAliasRevocationRetainsAliasAndBlocksCleanState',
  'failingDirectoryDeletionRetainsPathAndBlocksCleanState',
  'retryCannotReportCleanUntilAllResiduesAreRemoved',
  'thrownRevocationAndDeletionCannotBeMisreportedAsPass',
];
const orphanClass = 'com.negresco.finance.security.SyntheticDebugQaOrphanResidueGateTest';
const orphanMethods = [
  'noResidualKeysOrFoldersPermitsOnlyPreparingManualQa',
  'survivingKeystoreAliasAfterProcessDeathBlocksNewQa',
  'survivingSqlcipherCacheFolderAfterProcessDeathBlocksNewQa',
  'unrelatedKeysDoNotMaskAnySyntheticQaResidue',
];
const orphanActivityClass = 'com.negresco.finance.security.SyntheticDebugQaOrphanActivityBoundaryTest';
const orphanActivityMethods = [
  'orphanedFixtureFolderBlocksActivityBeforeBiometricPromptOrKeyCreation',
  'unrelatedCacheEntryCannotTriggerOrphanResidueDecision',
];
const inspectionClass = 'com.negresco.finance.security.SyntheticDebugQaOrphanInspectionTest';
const inspectionMethods = [
  'missingCacheListingCannotBeTreatedAsEmptyStorage',
  'thrownAndroidKeystoreEnumerationNeverProceedsToQa',
  'thrownCacheEnumerationNeverProceedsToQa',
  'suspectAliasOrFolderAlwaysBlocksNextDebugQa',
  'cleanNamesPermitOnlyManualDebugPreparationNotFinancialAccess',
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
    ...attemptMethods.map(name => ({classname: attemptClass, name, skipped: false})),
    ...callbackMethods.map(name => ({classname: callbackClass, name, skipped: false})),
    ...stressMethods.map(name => ({classname: stressClass, name, skipped: false})),
    ...cleanupMethods.map(name => ({classname: cleanupClass, name, skipped: false})),
    ...orphanMethods.map(name => ({classname: orphanClass, name, skipped: false})),
    ...orphanActivityMethods.map(name => ({classname: orphanActivityClass, name, skipped: false})),
    ...inspectionMethods.map(name => ({classname: inspectionClass, name, skipped: false})),
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
  assert.match(r.summary, /Physical biometric consent-only cases kept SKIPPED: \*\*2\/2\*\*/);
  assert.match(r.summary, /P0-1 native untrusted callback deny methods: \*\*6\/6\*\*/);
  assert.match(r.summary, /P0-1 native adversarial callback stress methods: \*\*4\/4\*\*/);
  assert.match(r.summary, /P0-1 Debug cleanup fault-injection methods: \*\*4\/4\*\*/);
  assert.match(r.summary, /P0-1 Debug orphan residue methods: \*\*4\/4\*\*/);
  assert.match(r.summary, /P0-1 Debug live orphan Activity methods: \*\*2\/2\*\*/);
  assert.match(r.summary, /P0-1 Debug orphan inspection fault methods: \*\*5\/5\*\*/);
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
  assert.match(r.summary, /P0-1 native synthetic operation attempt methods: \*\*4\/4\*\*/);
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

const physicalCases = [
  {classname: bioClass, name: 'realStrongBiometricRequiresExplicitPhysicalDeviceConsent'},
  {classname: debugSqlcipherBiometric,
    name: 'realBiometricTwiceThenSyntheticSqlcipherReopensWithNoJsAccess'},
];

test('physical biometric QA cannot be forged as CI PASS even if all other tests pass', () => {
  for (const physical of physicalCases) {
    const cases = baseline();
    cases.find(c => c.classname === physical.classname && c.name === physical.name).skipped = false;
    const r = run(cases);
    assert.notEqual(r.status, 0, physical.name);
    assert.match(r.stderr, /physical-only biometric QA must be SKIPPED in unattended CI/);
    assert.match(r.stderr, /non_skipped=/);
  }
});

test('missing or renamed physical biometric QA cannot vanish from CI evidence', () => {
  for (const physical of physicalCases) {
    const without = run(baseline().filter(c =>
      !(c.classname === physical.classname && c.name === physical.name)));
    assert.notEqual(without.status, 0, physical.name);
    assert.match(without.stderr, /physical-only biometric QA must be SKIPPED in unattended CI/);
    assert.match(without.stderr, /missing=/);

    const forged = baseline();
    forged.find(c => c.classname === physical.classname && c.name === physical.name).name += 'Fake';
    const r = run(forged);
    assert.notEqual(r.status, 0, physical.name);
    assert.match(r.stderr, /physical-only biometric QA must be SKIPPED in unattended CI/);
  }
});

test('P0-1: missing synthetic operation attempt method fails JUnit evidence', () => {
  const r = run(baseline().filter(c =>
    !(c.classname === attemptClass && c.name === attemptMethods[0])));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /synthetic operation attempt inventory mismatch/);
});
test('P0-1: skipped synthetic operation attempt method fails JUnit evidence', () => {
  const cases = baseline();
  cases.find(c => c.classname === attemptClass && c.name === attemptMethods[1]).skipped = true;
  const r = run(cases);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /synthetic operation attempt has SKIPPED tests/);
});
test('P0-1: forged synthetic operation attempt method at same count fails', () => {
  const cases = baseline();
  cases.find(c => c.classname === attemptClass && c.name === attemptMethods[2]).name =
    'fakeNativeOperationAuthorized';
  const r = run(cases);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /synthetic operation attempt inventory mismatch/);
  assert.match(r.stderr, /backgroundAndDestroyRevokeSyntheticOperationEpoch/);
});

test('P0-1 callbacks: missing nominal case fails evidence audit', () => {
  const r = run(baseline().filter(c =>
    !(c.classname === callbackClass && c.name === callbackMethods[0])));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /synthetic callback inventory mismatch/);
});
test('P0-1 callbacks: SKIPPED nominal case fails evidence audit', () => {
  const cases = baseline();
  cases.find(c => c.classname === callbackClass && c.name === callbackMethods[1]).skipped = true;
  const r = run(cases);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /synthetic callback has SKIPPED tests/);
});
test('P0-1 callbacks: fake method with same count cannot impersonate a required case', () => {
  const cases = baseline();
  cases.find(c => c.classname === callbackClass && c.name === callbackMethods[2]).name =
    'fakeCallbackAuthorizedFinancialTransaction';
  const r = run(cases);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /synthetic callback inventory mismatch/);
  assert.match(r.stderr, /wrongIntentBurnsAttemptAndCorrectedReplayIsDenied/);
});

test('P0-1 callback stress evidence must contain all four nominal tests', () => {
  const r = run(baseline().filter(c =>
    !(c.classname === stressClass && c.name === stressMethods[0])));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /synthetic callback stress inventory mismatch/);
});
test('P0-1 callback stress evidence cannot mark any required test SKIPPED', () => {
  const cases = baseline();
  cases.find(c => c.classname === stressClass && c.name === stressMethods[1]).skipped = true;
  const r = run(cases);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /synthetic callback stress has SKIPPED tests/);
});
test('P0-1 callback stress evidence rejects a same-count forged test name', () => {
  const cases = baseline();
  cases.find(c => c.classname === stressClass && c.name === stressMethods[2]).name =
    'fakeStressTestClaimsAuthorizationPassed';
  const r = run(cases);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /synthetic callback stress inventory mismatch/);
  assert.match(r.stderr, /invalidatedForegroundAndDestroyedSessionsAlwaysRejectLateCallbacks/);
});

test('P0-1 Debug cleanup evidence fails if a fault-injection method is absent', () => {
  const r = run(baseline().filter(c =>
    !(c.classname === cleanupClass && c.name === cleanupMethods[0])));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Debug cleanup fault injection inventory mismatch/);
});

test('P0-1 Debug cleanup evidence rejects SKIPPED injected failure tests', () => {
  const cases = baseline();
  cases.find(c => c.classname === cleanupClass && c.name === cleanupMethods[1]).skipped = true;
  const r = run(cases);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Debug cleanup fault injection has SKIPPED tests/);
});

test('P0-1 Debug cleanup evidence rejects a fake same-count test name', () => {
  const cases = baseline();
  cases.find(c => c.classname === cleanupClass && c.name === cleanupMethods[2]).name =
    'fakeCleanupGrantApproved';
  const r = run(cases);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Debug cleanup fault injection inventory mismatch/);
  assert.match(r.stderr, /retryCannotReportCleanUntilAllResiduesAreRemoved/);
});

test('P0-1 Debug orphan residue: missing nominal test blocks JUnit evidence', () => {
  const r = run(baseline().filter(c =>
    !(c.classname === orphanClass && c.name === orphanMethods[0])));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Debug orphan QA inventory mismatch/);
});
test('P0-1 Debug orphan residue: skipped nominal test blocks JUnit evidence', () => {
  const cases = baseline();
  cases.find(c => c.classname === orphanClass && c.name === orphanMethods[1]).skipped = true;
  const r = run(cases);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Debug orphan QA has SKIPPED tests/);
});
test('P0-1 Debug orphan residue: forged name cannot impersonate a required case', () => {
  const cases = baseline();
  cases.find(c => c.classname === orphanClass && c.name === orphanMethods[2]).name =
    'fakePhysicalBiometricsPassed';
  const r = run(cases);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Debug orphan QA inventory mismatch/);
  assert.match(r.stderr, /survivingSqlcipherCacheFolderAfterProcessDeathBlocksNewQa/);
});

test('P0-1 live orphan Activity evidence requires every negative method', () => {
  const r = run(baseline().filter(c =>
    !(c.classname === orphanActivityClass && c.name === orphanActivityMethods[0])));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Debug orphan Activity inventory mismatch/);
});
test('P0-1 live orphan Activity evidence never accepts a skipped case', () => {
  const cases = baseline();
  cases.find(c => c.classname === orphanActivityClass && c.name === orphanActivityMethods[0]).skipped = true;
  const r = run(cases);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Debug orphan Activity has SKIPPED tests/);
});
test('P0-1 live orphan Activity evidence rejects fabricated method names', () => {
  const cases = baseline();
  cases.find(c => c.classname === orphanActivityClass && c.name === orphanActivityMethods[1]).name =
    'fakeBiometricApprovedViaSyntheticFolder';
  const r = run(cases);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Debug orphan Activity inventory mismatch/);
});

test('P0-1 unavailable Debug inventory: missing JUnit case blocks audit', () => {
  const r = run(baseline().filter(c =>
    !(c.classname === inspectionClass && c.name === inspectionMethods[0])));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Debug inspection fault inventory mismatch/);
});
test('P0-1 unavailable Debug inventory: SKIPPED case blocks audit', () => {
  const cases = baseline();
  cases.find(c => c.classname === inspectionClass && c.name === inspectionMethods[1]).skipped = true;
  const r = run(cases);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Debug inspection fault has SKIPPED tests/);
});
test('P0-1 unavailable Debug inventory: renamed same-count method blocks audit', () => {
  const cases = baseline();
  cases.find(c => c.classname === inspectionClass && c.name === inspectionMethods[2]).name =
    'fakeInspectionReturnedApproved';
  const r = run(cases);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Debug inspection fault inventory mismatch/);
});

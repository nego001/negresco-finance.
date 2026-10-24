#!/usr/bin/env python3
"""Audit Debug-only Android JUnit XML, fail if SEC-05 evidence is missing.

This checks synthetic test metadata only; no APK, secrets or financial data.
"""
import os
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SEC05_CLASS = 'com.negresco.finance.security.SyntheticJournalActualProcessDeathTest'
EXPECTED_SEC05_CASES = 26
SEC05_SOURCE = (Path(__file__).resolve().parent.parent /
    'apps/mobile/modules/negresco-finance-security/android/src/androidTest/java/'
    'com/negresco/finance/security/SyntheticJournalActualProcessDeathTest.kt')
REQUIRED_CASE = 'ownerReplacedWithSameUuidAfterWitnessCannotCommitJournal'
ISOLATION_CLASS = 'com.negresco.finance.security.SyntheticBiometricSqlcipherQaIsolationTest'
ISOLATION_CASE = 'debugSqlcipherActivityLaunchCannotProvisionKeyOrSyntheticDatabase'
SLICE_CLASS = 'com.negresco.finance.security.SyntheticKeystoreSqlcipherLifecycleBoundaryTest'
SLICE_REQUIRED_CASES = frozenset({
    'foregroundRevocationDeniesProtectedFixtureReadBeforeKeyRelease',
    'revocationBetweenPreflightAndKeystoreLookupMustHold',
    'revocationAfterSqlcipherReadCannotReportSuccess',
    'missingKeystoreAliasDoesNotRecreateOrEraseNativeCiphertext',
})
PREFLIGHT_CLASS = 'com.negresco.finance.security.SyntheticFinancialOperationPreflightTest'
PREFLIGHT_REQUIRED_CASES = frozenset({
    'revokedLifecycleAlwaysDeniesRegardlessOfForgedSignals',
    'unavailableCryptoAndStorageDenyBeforeNativeAuthority',
    'forgedAllTrueSignalsStillCannotAuthorizeAnything',
})
PREFLIGHT_SOURCE = (Path(__file__).resolve().parent.parent /
    'apps/mobile/modules/negresco-finance-security/android/src/androidTest/java/'
    'com/negresco/finance/security/SyntheticFinancialOperationPreflightTest.kt')

ATTEMPT_CLASS = 'com.negresco.finance.security.SyntheticOperationAttemptFenceTest'
ATTEMPT_REQUIRED_CASES = frozenset({
    'attemptWithoutForegroundCannotRun',
    'repeatedIntentInSameForegroundEpochAlwaysDenies',
    'backgroundAndDestroyRevokeSyntheticOperationEpoch',
    'forgedStrongCryptoAndStorageRemainDeniedForBothIntents',
})
ATTEMPT_SOURCE = (Path(__file__).resolve().parent.parent /
    'apps/mobile/modules/negresco-finance-security/android/src/androidTest/java/'
    'com/negresco/finance/security/SyntheticOperationAttemptFenceTest.kt')

CALLBACK_CLASS = 'com.negresco.finance.security.SyntheticCallbackDenialFenceTest'
CALLBACK_REQUIRED_CASES = frozenset({
    'callbackWithoutPendingAttemptIsDenied',
    'forgedSuccessWithMatchingIntentAndReceiptCannotAuthorize',
    'wrongIntentBurnsAttemptAndCorrectedReplayIsDenied',
    'staleReceiptAfterBackgroundCannotConsumeNewEpoch',
    'cancelledClaimAndPreflightFailureCannotTurnIntoApproval',
    'destructionAndDuplicateForegroundNeverResurrectReceipt',
})
CALLBACK_SOURCE = (Path(__file__).resolve().parent.parent /
    'apps/mobile/modules/negresco-finance-security/android/src/androidTest/java/'
    'com/negresco/finance/security/SyntheticCallbackDenialFenceTest.kt')

# CI is unattended: genuine user consent must never be reported as PASS by
# emulator/fixture evidence. Physical positive QA has its own human gate.
PHYSICAL_ONLY_CASES = frozenset({
    ('com.negresco.finance.security.SyntheticBiometricManualQaOptInTest',
     'realStrongBiometricRequiresExplicitPhysicalDeviceConsent'),
    ('com.negresco.finance.security.SyntheticBiometricSqlcipherManualQaOptInTest',
     'realBiometricTwiceThenSyntheticSqlcipherReopensWithNoJsAccess'),
})
# Whitelist exact class+method. All physical-only cases MUST be SKIPPED.
# Other skips remain whitelist-only, and cannot impersonate physical consent.
ALLOWED_SKIPS = set(PHYSICAL_ONLY_CASES) | {
    (SEC05_CLASS, 'hardlinkedJournalNewCannotRedirectWrite'),
    (SEC05_CLASS, 'hardlinkedOwnerMarkerCannotAuthorizeWorkerWrite'),
    (SEC05_CLASS, 'hardlinkedWitnessNewCannotRedirectWrite'),
    (SEC05_CLASS, 'lateHardlinkAliasAfterWitnessCannotCommitJournal'),
}


def expected_sec05_methods():
    # Compare against the exact Android class checked out by this CI run,
    # not merely a count (a same-count replacement must fail closed).
    source = SEC05_SOURCE.read_text(encoding='utf-8')
    names = re.findall(r'@Test\s+fun\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(', source)
    if len(names) != EXPECTED_SEC05_CASES or len(set(names)) != len(names):
        raise ValueError(
            f'SEC-05 source inventory must have {EXPECTED_SEC05_CASES} unique methods; '
            f'found {len(names)}')
    return set(names)


def expected_preflight_methods():
    # Pin the source inventory AND the JUnit XML, not merely an arbitrary count.
    source = PREFLIGHT_SOURCE.read_text(encoding='utf-8')
    names = re.findall(r'@Test\s+fun\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(', source)
    if len(names) != len(PREFLIGHT_REQUIRED_CASES) or set(names) != PREFLIGHT_REQUIRED_CASES:
        raise ValueError(
            f'P0-1 preflight source inventory mismatch: found={sorted(names)}; '
            f'required={sorted(PREFLIGHT_REQUIRED_CASES)}')
    return set(names)


def expected_attempt_methods():
    # This is source+JUnit inventory, never a simulated biometric approval.
    source = ATTEMPT_SOURCE.read_text(encoding='utf-8')
    names = re.findall(r'@Test\s+fun\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(', source)
    if len(names) != len(ATTEMPT_REQUIRED_CASES) or set(names) != ATTEMPT_REQUIRED_CASES:
        raise ValueError(
            f'P0-1 synthetic operation attempt source inventory mismatch: {sorted(names)}')
    return set(names)


def expected_callback_methods():
    source = CALLBACK_SOURCE.read_text(encoding='utf-8')
    names = re.findall(r'@Test\s+fun\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(', source)
    if len(names) != len(CALLBACK_REQUIRED_CASES) or set(names) != CALLBACK_REQUIRED_CASES:
        raise ValueError(
            'P0-1 synthetic callback source inventory mismatch: '
            f'{sorted(names)}')
    return set(names)


def audit(report_dir: Path):
    expected_methods = expected_sec05_methods()
    paths = sorted(report_dir.rglob('TEST-*.xml')) if report_dir.is_dir() else []
    if not paths:
        raise ValueError(f'Missing Android instrumentation JUnit XML: {report_dir}')
    cases = []
    for path in paths:
        cases.extend(ET.parse(path).getroot().iter('testcase'))
    if not cases:
        raise ValueError('JUnit XML has zero testcases')
    case_ids = [(case.get('classname'), case.get('name')) for case in cases]
    if len(case_ids) != len(set(case_ids)):
        raise ValueError('JUnit XML contains duplicate (classname, testcase) entries')
    errors = [c for c in cases if c.find('failure') is not None or c.find('error') is not None]
    skipped = [c for c in cases if c.find('skipped') is not None]
    unexpected = [(c.get('classname'), c.get('name')) for c in skipped
                  if (c.get('classname'), c.get('name')) not in ALLOWED_SKIPS]
    sec05 = [c for c in cases if c.get('classname') == SEC05_CLASS]
    required = [c for c in sec05 if c.get('name') == REQUIRED_CASE]
    qa_isolation = [c for c in cases if c.get('classname') == ISOLATION_CLASS]
    slice_cases = [c for c in cases if c.get('classname') == SLICE_CLASS]
    slice_methods = {c.get('name') for c in slice_cases}
    missing_slice = sorted(SLICE_REQUIRED_CASES - slice_methods)
    extra_slice = sorted(slice_methods - SLICE_REQUIRED_CASES)
    reasons = []
    # Mandatory opposite gates: automated negative tests must run, while
    # physical-positive biometric tests must be present but strictly SKIPPED.
    case_by_id = dict(zip(case_ids, cases))
    physical_missing = sorted(PHYSICAL_ONLY_CASES - set(case_ids))
    physical_false_pass = sorted(
        case_id for case_id in PHYSICAL_ONLY_CASES
        if case_id in case_by_id and case_by_id[case_id].find('skipped') is None
    )
    if physical_missing or physical_false_pass:
        reasons.append(
            'physical-only biometric QA must be SKIPPED in unattended CI: '
            f'missing={physical_missing}, non_skipped={physical_false_pass}')
    physical_skipped_count = sum(
        case_id in case_by_id and case_by_id[case_id].find('skipped') is not None
        for case_id in PHYSICAL_ONLY_CASES
    )
    if errors:
        reasons.append(f'{len(errors)} failing/error test cases')
    if unexpected:
        reasons.append(f'unexpected SKIPPED tests: {unexpected}')
    if len(sec05) != EXPECTED_SEC05_CASES:
        reasons.append(f'expected {EXPECTED_SEC05_CASES} SEC-05 tests, found {len(sec05)}')
    actual_methods = {c.get('name') for c in sec05}
    missing_methods = sorted(expected_methods - actual_methods)
    unknown_methods = sorted(actual_methods - expected_methods)
    if missing_methods or unknown_methods:
        reasons.append(
            f'SEC-05 method inventory mismatch: missing={missing_methods}; '
            f'unexpected={unknown_methods}')
    if len(required) != 1 or required[0].find('skipped') is not None:
        reasons.append(f'required SEC-05 test missing or skipped: {REQUIRED_CASE}')
    if len(slice_cases) != len(SLICE_REQUIRED_CASES) or missing_slice or extra_slice:
        reasons.append(
            f'native synthetic cipher slice inventory mismatch: '
            f'missing={missing_slice}, unexpected={extra_slice}, count={len(slice_cases)}')
    if any(c.find('skipped') is not None for c in slice_cases):
        reasons.append('native synthetic cipher slice has SKIPPED tests')
    if (len(qa_isolation) != 1 or qa_isolation[0].get('name') != ISOLATION_CASE
            or qa_isolation[0].find('skipped') is not None):
        reasons.append('DEBUG SQLCipher QA isolation test missing, unexpected or SKIPPED')
    preflight_expected = expected_preflight_methods()
    preflight_cases = [c for c in cases if c.get('classname') == PREFLIGHT_CLASS]
    preflight_methods = {c.get('name') for c in preflight_cases}
    missing_preflight = sorted(preflight_expected - preflight_methods)
    extra_preflight = sorted(preflight_methods - preflight_expected)
    if (len(preflight_cases) != len(preflight_expected)
            or missing_preflight or extra_preflight):
        reasons.append(
            f'P0-1 native preflight inventory mismatch: '
            f'missing={missing_preflight}, unexpected={extra_preflight}, '
            f'count={len(preflight_cases)}')
    if any(c.find('skipped') is not None for c in preflight_cases):
        reasons.append('P0-1 native preflight has SKIPPED tests')
    attempt_expected = expected_attempt_methods()
    attempt_cases = [c for c in cases if c.get('classname') == ATTEMPT_CLASS]
    attempt_actual = {c.get('name') for c in attempt_cases}
    attempt_missing = sorted(attempt_expected - attempt_actual)
    attempt_extra = sorted(attempt_actual - attempt_expected)
    if (len(attempt_cases) != len(attempt_expected)
            or attempt_missing or attempt_extra):
        reasons.append(
            'P0-1 synthetic operation attempt inventory mismatch: '
            f'missing={attempt_missing}, unexpected={attempt_extra}, '
            f'count={len(attempt_cases)}')
    if any(c.find('skipped') is not None for c in attempt_cases):
        reasons.append('P0-1 synthetic operation attempt has SKIPPED tests')
    callback_expected = expected_callback_methods()
    callback_cases = [c for c in cases if c.get('classname') == CALLBACK_CLASS]
    callback_actual = {c.get('name') for c in callback_cases}
    callback_missing = sorted(callback_expected - callback_actual)
    callback_extra = sorted(callback_actual - callback_expected)
    if (len(callback_cases) != len(callback_expected) or callback_missing or callback_extra):
        reasons.append(
            'P0-1 synthetic callback inventory mismatch: '
            f'missing={callback_missing}, unexpected={callback_extra}, '
            f'count={len(callback_cases)}')
    if any(c.find('skipped') is not None for c in callback_cases):
        reasons.append('P0-1 synthetic callback has SKIPPED tests')
    status = 'PASS' if not reasons else 'FAIL'
    summary = [
        '### SEC-05 Android JUnit evidence',
        f'- Audit: **{status}**',
        f'- JUnit files: **{len(paths)}**',
        f'- Test cases: **{len(cases)}**; passed: **{len(cases)-len(errors)-len(skipped)}**; failed/errors: **{len(errors)}**; skipped: **{len(skipped)}**',
        f'- SEC-05 process-death cases present: **{len(sec05)}/{EXPECTED_SEC05_CASES}**',
        f'- SEC-05 source method inventory matches JUnit: **{not missing_methods and not unknown_methods}**',
        f'- DEBUG SQLCipher biometric isolation case: **{("executed" if len(qa_isolation) == 1 and qa_isolation[0].get("name") == ISOLATION_CASE and qa_isolation[0].find("skipped") is None else "missing/skipped")}**',
        f'- Synthetic native cipher lifecycle methods: **{len(slice_cases)}/4** (zero skips required)',
        f'- P0-1 native preflight methods: **{len(preflight_cases)}/{len(preflight_expected)}** (zero skips required)',
        f'- P0-1 native synthetic operation attempt methods: **{len(attempt_cases)}/{len(attempt_expected)}** (zero skips required)',
        f'- P0-1 native untrusted callback deny methods: **{len(callback_cases)}/{len(callback_expected)}** (zero skips required)',
        f'- Physical biometric consent-only cases kept SKIPPED: **{physical_skipped_count}/{len(PHYSICAL_ONLY_CASES)}** (never a CI pass)',
        f'- Required same-UUID inode replacement case: **{("executed" if len(required) == 1 and required[0].find("skipped") is None else "missing/skipped")}**',
    ]
    for case in skipped:
        summary.append(f'- SKIPPED (not a positive security check): {case.get("name")}')
    summary.extend(f'- ERROR: {reason}' for reason in reasons)
    report = '\n'.join(summary) + '\n'
    print(report, end='')
    summary_file = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary_file:
        with open(summary_file, 'a', encoding='utf-8') as out:
            out.write(report)
    if reasons:
        raise ValueError('; '.join(reasons))


if __name__ == '__main__':
    try:
        if len(sys.argv) != 2:
            raise ValueError('Usage: sec05_android_junit_audit.py PATH_TO_CONNECTED_REPORTS')
        audit(Path(sys.argv[1]))
    except (ValueError, ET.ParseError, OSError) as error:
        print(f'SEC-05 JUnit audit failed: {error}', file=sys.stderr)
        sys.exit(1)

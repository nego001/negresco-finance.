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
SLICE_CLASS = 'com.negresco.finance.security.SyntheticKeystoreSqlcipherLifecycleBoundaryTest'
SLICE_REQUIRED_CASES = frozenset({
    'foregroundRevocationDeniesProtectedFixtureReadBeforeKeyRelease',
    'revocationBetweenPreflightAndKeystoreLookupMustHold',
    'revocationAfterSqlcipherReadCannotReportSuccess',
    'missingKeystoreAliasDoesNotRecreateOrEraseNativeCiphertext',
})
# Whitelist the exact class and method. A similarly named testcase from
# an unrelated class must not inherit SEC-05 permission to be SKIPPED.
ALLOWED_SKIPS = {
    ('com.negresco.finance.security.SyntheticBiometricManualQaOptInTest',
     'realStrongBiometricRequiresExplicitPhysicalDeviceConsent'),
    ('com.negresco.finance.security.SyntheticBiometricSqlcipherManualQaOptInTest',
     'realBiometricTwiceThenSyntheticSqlcipherReopensWithNoJsAccess'),
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
    slice_cases = [c for c in cases if c.get('classname') == SLICE_CLASS]
    slice_methods = {c.get('name') for c in slice_cases}
    missing_slice = sorted(SLICE_REQUIRED_CASES - slice_methods)
    extra_slice = sorted(slice_methods - SLICE_REQUIRED_CASES)
    reasons = []
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
    status = 'PASS' if not reasons else 'FAIL'
    summary = [
        '### SEC-05 Android JUnit evidence',
        f'- Audit: **{status}**',
        f'- JUnit files: **{len(paths)}**',
        f'- Test cases: **{len(cases)}**; passed: **{len(cases)-len(errors)-len(skipped)}**; failed/errors: **{len(errors)}**; skipped: **{len(skipped)}**',
        f'- SEC-05 process-death cases present: **{len(sec05)}/{EXPECTED_SEC05_CASES}**',
        f'- SEC-05 source method inventory matches JUnit: **{not missing_methods and not unknown_methods}**',
        f'- Synthetic native cipher lifecycle methods: **{len(slice_cases)}/4** (zero skips required)',
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

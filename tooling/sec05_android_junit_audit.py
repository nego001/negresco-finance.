#!/usr/bin/env python3
"""Audit Debug-only Android JUnit XML, fail if SEC-05 evidence is missing.

This checks synthetic test metadata only; no APK, secrets or financial data.
"""
import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SEC05_CLASS = 'com.negresco.finance.security.SyntheticJournalActualProcessDeathTest'
EXPECTED_SEC05_CASES = 26
REQUIRED_CASE = 'ownerReplacedWithSameUuidAfterWitnessCannotCommitJournal'
ALLOWED_SKIPS = {
    'realStrongBiometricRequiresExplicitPhysicalDeviceConsent',
    'hardlinkedJournalNewCannotRedirectWrite',
    'hardlinkedOwnerMarkerCannotAuthorizeWorkerWrite',
    'hardlinkedWitnessNewCannotRedirectWrite',
    'lateHardlinkAliasAfterWitnessCannotCommitJournal',
}


def audit(report_dir: Path):
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
    unexpected = [c.get('name') for c in skipped if c.get('name') not in ALLOWED_SKIPS]
    sec05 = [c for c in cases if c.get('classname') == SEC05_CLASS]
    required = [c for c in sec05 if c.get('name') == REQUIRED_CASE]
    reasons = []
    if errors:
        reasons.append(f'{len(errors)} failing/error test cases')
    if unexpected:
        reasons.append(f'unexpected SKIPPED tests: {unexpected}')
    if len(sec05) != EXPECTED_SEC05_CASES:
        reasons.append(f'expected {EXPECTED_SEC05_CASES} SEC-05 tests, found {len(sec05)}')
    if len(required) != 1 or required[0].find('skipped') is not None:
        reasons.append(f'required SEC-05 test missing or skipped: {REQUIRED_CASE}')
    status = 'PASS' if not reasons else 'FAIL'
    summary = [
        '### SEC-05 Android JUnit evidence',
        f'- Audit: **{status}**',
        f'- JUnit files: **{len(paths)}**',
        f'- Test cases: **{len(cases)}**; passed: **{len(cases)-len(errors)-len(skipped)}**; failed/errors: **{len(errors)}**; skipped: **{len(skipped)}**',
        f'- SEC-05 process-death cases present: **{len(sec05)}/{EXPECTED_SEC05_CASES}**',
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

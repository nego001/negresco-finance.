#!/usr/bin/env python3
"""OFFLINE P0 forensic status reconciliation, never an app or PDF certification.

Input is a manually curated *non-sensitive* status ledger derived from GitHub
run 40808040078 attempts 1-6. This script cannot verify untrusted GitHub logs,
restore expired APK bytes, diagnose Android native Print internals or approve
production. It rejects malformed, missing or contradictory status combinations.
No network, file writes, PDF parsing, system calls or private data output.
"""
from __future__ import annotations

import json
import stat
import sys
from pathlib import Path

RUN_ID = 40808040078
HEAD_SHA = "767ceb17a6c7b0c188bb039062edb16a4840067e"
ORIGINAL_SHA = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"
START_API26 = "2026-10-29T02:43:32Z"
MAX_FILE = 8192
FIELDS = {
    "schemaVersion", "runId", "headSha", "originalApkSha256",
    "api26FirstExecutionStartedAt", "purpose", "attempts"
}
ATTEMPT_FIELDS = {
    "attempt", "api28JobId", "api28", "api26",
    "pair", "pairJobId", "downloadedArtifactApis"
}
# Exact archived GitHub job IDs (read-only observation), preventing an
# accidentally appended/new run being treated as a seventh historical attempt.
JOBS = (
    (1, 123231576126, 123233137735),
    (2, 123235275913, 123236714745),
    (3, 124604520513, 124605657880),
    (4, 125537592012, 125540178974),
    (5, 125544912704, 125546912566),
    (6, 125591880603, 125594024444),
)
BLOCK = "BLOCK (LAB): original six-attempt evidence ledger unverified"


def unique_keys(items: list[tuple[str, object]]) -> dict:
    output = {}
    for key, val in items:
        if key in output:
            raise ValueError("duplicate key")
        output[key] = val
    return output


def classify(ledger: object) -> tuple[str, ...]:
    if type(ledger) is not dict or set(ledger) != FIELDS:
        raise ValueError("invalid ledger schema")
    if (type(ledger["schemaVersion"]) is not int or ledger["schemaVersion"] != 1
            or type(ledger["runId"]) is not int or ledger["runId"] != RUN_ID
            or ledger["headSha"] != HEAD_SHA or ledger["originalApkSha256"] != ORIGINAL_SHA
            or ledger["api26FirstExecutionStartedAt"] != START_API26
            or ledger["purpose"] != "offline-historical-job-outcome-categories-only"):
        raise ValueError("not the known immutable historical run")
    attempts = ledger["attempts"]
    if type(attempts) is not list or len(attempts) != 6:
        raise ValueError("historical attempts incomplete")
    verdicts = []
    for row, (expected_attempt, pdf_job, pair_job) in zip(attempts, JOBS):
        if type(row) is not dict or set(row) != ATTEMPT_FIELDS:
            raise ValueError("attempt schema mismatch")
        if (type(row["attempt"]) is not int or row["attempt"] != expected_attempt
                or type(row["api28JobId"]) is not int or row["api28JobId"] != pdf_job
                or type(row["pairJobId"]) is not int or row["pairJobId"] != pair_job
                or row["api26"] != "success"):
            raise ValueError("historical job identity/status mismatch")
        pdf, pair, artifacts = row["api28"], row["pair"], row["downloadedArtifactApis"]
        if pdf == "failure" and pair == "skipped" and artifacts is None:
            verdicts.append("pdf-receipt-unverified")
        elif pdf == "success" and pair == "success" and artifacts == [26, 28]:
            verdicts.append("pdf-and-pair-verified")
        elif pdf == "success" and pair == "failure" and artifacts == [28]:
            verdicts.append("pdf-verified-api26-artifact-missing")
        else:
            raise ValueError("contradictory original report vs artifact-pair status")
    if (verdicts.count("pdf-receipt-unverified") != 3
            or verdicts.count("pdf-and-pair-verified") != 1
            or verdicts.count("pdf-verified-api26-artifact-missing") != 2):
        raise ValueError("historical categories differ from observed six runs")
    return tuple(verdicts)


def load(path: Path) -> tuple[str, ...]:
    if not isinstance(path, Path) or path.is_symlink() or path.suffix.lower() != ".json":
        raise ValueError("unsafe source file")
    before = path.stat()
    if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or not 1 <= before.st_size <= MAX_FILE:
        raise ValueError("unsafe ledger bytes")
    with path.open("rb") as stream:
        contents = stream.read(MAX_FILE + 1)
    after = path.stat()
    if (len(contents) != before.st_size or
            any(getattr(before, k) != getattr(after, k)
                for k in ("st_ino", "st_dev", "st_size", "st_mtime_ns", "st_ctime_ns"))):
        raise ValueError("ledger changed while reading")
    value = json.loads(contents.decode("utf8"), object_pairs_hook=unique_keys,
                       parse_constant=lambda _: (_ for _ in ()).throw(ValueError("invalid number")))
    return classify(value)


def main(args: list[str]) -> int:
    if len(args) != 1:
        print(BLOCK)
        return 2
    try:
        verdicts = load(Path(args[0]))
    except (OSError, UnicodeError, ValueError, TypeError):
        print(BLOCK)
        return 1
    for i, result in enumerate(verdicts, start=1):
        print("EVIDENCE (LAB): original-api28-attempt-" + str(i) + "=" + result)
    print("EVIDENCE (LAB): original-api28-3-receipts-verified-3-unverified")
    print("EVIDENCE (LAB): original-cross-api-1-pair-verified-2-missing-api26-artifact")
    print("EVIDENCE (LAB): historical-categories-only-native-root-cause-unknown")
    print("BLOCK (PRODUCTION): original Release not approved")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

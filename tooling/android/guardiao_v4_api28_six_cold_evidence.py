#!/usr/bin/env python3
"""Read-only offline custody of manually reviewed GitHub Actions outcome categories.

This verifies a curated snapshot's shape and internal consistency, NOT the
authenticity of remote GitHub log bytes or actual Android behavior. Never promote
the historical original APK based on candidate tests. No network or file writes.
"""
from __future__ import annotations

import json
import os
import stat
import sys
from pathlib import Path

HEAD = "c096d0a13ff0b4cee293446731ad9558717e6c83"
CANDIDATE = "3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6"
ORIGINAL = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"
JOBS = (133033094942, 133033094756, 133033094698,
        133033094434, 133033094788, 133033094728)
BANDS = ("5-to-15s", "5-to-15s", "5-to-15s", "under-5s", "under-5s", "under-5s")
FIELDS = frozenset(("schemaVersion", "scope", "workflowRunId", "ciRunId",
                    "workflowConclusion", "ciConclusion", "ciContractsPassed",
                    "headSha", "candidateApkSha256", "historicalReleaseSha256",
                    "releaseSigning", "approvedForProduction", "stableReleaseAllowed",
                    "trials"))
TRIAL_FIELDS = frozenset(("trial", "jobId", "api", "jobConclusion",
                         "chooserObservationBand", "receiverRendered",
                         "semanticTextVerified", "cacheCleared", "originalReleaseTested"))
MAX_BYTES = 8192
BLOCK = "BLOCK (LAB): six-cold evidence snapshot cannot be verified"


def unique_keys(items: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in items:
        if key in result:
            raise ValueError("duplicate JSON key")
        result[key] = value
    return result


def verify(value: object) -> tuple[int, int, int]:
    if type(value) is not dict or set(value) != FIELDS:
        raise ValueError("wrong evidence schema")
    fixed = {
        "schemaVersion": 1,
        "scope": "SYNTHETIC_CANDIDATE_V4_SIX_COLD_API28_EVIDENCE_SNAPSHOT",
        "workflowRunId": 43785823881,
        "ciRunId": 43785823825,
        "workflowConclusion": "success",
        "ciConclusion": "success",
        "ciContractsPassed": 1467,
        "headSha": HEAD,
        "candidateApkSha256": CANDIDATE,
        "historicalReleaseSha256": ORIGINAL,
        "releaseSigning": "Android Debug (test-only)",
        "approvedForProduction": False,
        "stableReleaseAllowed": False,
    }
    for key, expected in fixed.items():
        if type(value[key]) is not type(expected) or value[key] != expected:
            raise ValueError("fixed identity, safety, or CI evidence mutated")
    rows = value["trials"]
    if type(rows) is not list or len(rows) != 6:
        raise ValueError("all six cold Android trials required")
    for index, (row, job, band) in enumerate(zip(rows, JOBS, BANDS), 1):
        if type(row) is not dict or set(row) != TRIAL_FIELDS:
            raise ValueError("unexpected trial schema")
        expected = {
            "trial": index,
            "jobId": job,
            "api": 28,
            "jobConclusion": "success",
            "chooserObservationBand": band,
            "receiverRendered": True,
            "semanticTextVerified": True,
            "cacheCleared": True,
            "originalReleaseTested": False,
        }
        for key, val in expected.items():
            if type(row[key]) is not type(val) or row[key] != val:
                raise ValueError("cold trial evidence incomplete or changed")
    return 6, 3, 3


def load(path: Path) -> tuple[int, int, int]:
    if not isinstance(path, Path) or path.suffix.lower() != ".json" or path.is_symlink():
        raise ValueError("unsafe snapshot path")
    # Descriptor gate, not traversal: user must supply one known .json path.
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        if (not stat.S_ISREG(before.st_mode) or before.st_nlink != 1
                or not 1 <= before.st_size <= MAX_BYTES):
            raise ValueError("unsafe snapshot file")
        contents = bytearray()
        while len(contents) <= MAX_BYTES:
            chunk = os.read(fd, min(4096, MAX_BYTES + 1 - len(contents)))
            if not chunk:
                break
            contents.extend(chunk)
        after = os.fstat(fd)
        attrs = ("st_dev", "st_ino", "st_size", "st_mode", "st_nlink",
                 "st_mtime_ns", "st_ctime_ns")
        if len(contents) != before.st_size or any(
                getattr(before, x) != getattr(after, x) for x in attrs):
            raise ValueError("snapshot identity changed during read")
        return verify(json.loads(contents.decode("utf8"), object_pairs_hook=unique_keys,
                                 parse_constant=lambda _: (_ for _ in ()).throw(ValueError("invalid number"))))
    finally:
        os.close(fd)


def main(args: list[str]) -> int:
    if len(args) != 1:
        print(BLOCK)
        return 2
    try:
        verified, short, medium = load(Path(args[0]))
    except (OSError, UnicodeError, ValueError, TypeError):
        print(BLOCK)
        return 1
    print("PASS (LAB): candidate API28 cold first PDF evidence snapshot for " + str(verified) + " trials")
    print("EVIDENCE (LAB): chooser-under-5s=" + str(short) + " chooser-5-to-15s=" + str(medium))
    print("EVIDENCE (LAB): six verified receivers semantics cache; no historical APK tested")
    print("BLOCK (PRODUCTION): approvedForProduction=false stableReleaseAllowed=false")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

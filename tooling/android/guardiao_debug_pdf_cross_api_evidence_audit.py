#!/usr/bin/env python3
"""Offline, category-only audit for disposable Guardiao Debug PDF job logs.

This checks the order of synthetic PDF semantic receipts and safe Home returns
in locally supplied CI text. GitHub workflow SUCCESS is an independent
requirement; this tool cannot authenticate job origin, prove PDF bytes or
license use of the original Release APK.
"""
from __future__ import annotations

import re
import stat
import sys
from pathlib import Path

MAX_BYTES = 2_000_000
MAX_LINES = 16_000
SEMANTIC = "PASS (LAB): Android app PDF semantics verified with synthetic input, cache and capture cleared"
HOME = "PASS (LAB): one bounded Debug Home return in same process"
API26_FINAL = "PASS (LAB): three independent synthetic PDFs in unchanged API26 Debug PID"
API28_FINAL = "PASS (LAB): ten independent synthetic PDFs in unchanged Debug PID"
CYCLE = re.compile(r"PASS \(LAB\): same-PID synthetic PDF receipt cycle ([a-z]) verified\Z")
TIMED = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d+Z (.*)\Z")
ALLOWED = {26: ("abc", API26_FINAL), 28: ("abcdefghij", API28_FINAL)}
BLOCKED = "debug-pdf-evidence-order-blocked"
ORDERED = "debug-pdf-evidence-markers-ordered-only"


def evidence(log: object, api: int) -> tuple[str, int, int]:
    if type(log) is not str or type(api) is not int or api not in ALLOWED:
        return BLOCKED, 0, 0
    cycles, end = ALLOWED[api]
    if len(log.encode("utf8")) > MAX_BYTES or len(log.splitlines()) > MAX_LINES:
        return BLOCKED, 0, 0
    recognized: list[tuple[str, str]] = []
    for line in log.splitlines():
        m = TIMED.fullmatch(line)
        if m is None:
            continue
        marker = m.group(1)
        if marker.startswith("BLOCK (LAB):") or marker.startswith("##[error]"):
            return BLOCKED, 0, 0
        if marker == SEMANTIC:
            recognized.append(("semantics", ""))
        elif marker == HOME:
            recognized.append(("home", ""))
        elif marker in (API26_FINAL, API28_FINAL):
            recognized.append(("final", marker))
        else:
            receipt = CYCLE.fullmatch(marker)
            if receipt:
                recognized.append(("receipt", receipt.group(1)))
    expected: list[tuple[str, str]] = []
    for index, cycle in enumerate(cycles):
        if index:
            expected.append(("home", ""))
        expected.extend((("semantics", ""), ("receipt", cycle)))
    expected.append(("final", end))
    if recognized != expected:
        return BLOCKED, 0, 0
    return ORDERED, len(cycles), len(cycles) - 1


def audit_file(path: Path, api: int) -> tuple[str, int, int]:
    try:
        if path.is_symlink() or not path.is_file():
            return BLOCKED, 0, 0
        stat_result = path.stat()
        if not stat.S_ISREG(stat_result.st_mode) or not 1 <= stat_result.st_size <= MAX_BYTES:
            return BLOCKED, 0, 0
        return evidence(path.read_text(encoding="utf8"), api)
    except (OSError, UnicodeError, ValueError):
        return BLOCKED, 0, 0


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[1] not in ("26", "28"):
        print("DEBUG_CROSS_API_EVIDENCE (LAB): " + BLOCKED)
        return 1
    result, receipts, homes = audit_file(Path(sys.argv[2]), int(sys.argv[1]))
    print("DEBUG_CROSS_API_EVIDENCE (LAB): " + result)
    print(f"DEBUG_CROSS_API_COUNTS (LAB): receipts={receipts} home_returns={homes}")
    print("RELEASE_PRODUCTION_GATES (LAB): approvedForProduction=false stableReleaseAllowed=false")
    return 0 if result == ORDERED else 1


if __name__ == "__main__":
    raise SystemExit(main())

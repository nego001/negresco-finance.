#!/usr/bin/env python3
"""Offline historical Release PDF stage classifier: LOG EVIDENCE ONLY.

Reads bounded locally supplied GitHub job text, outputs fixed categories
and bounded durations. Does not authenticate an APK, inspect PDFs, fetch
URLs, report private log lines or grant production readiness.
"""
from __future__ import annotations
from datetime import datetime
from pathlib import Path
import re
import stat
import sys

MAX_BYTES = 500_000
MAX_LINES = 5_000
STAMP = re.compile(r"^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d+Z) (.*)$")
TAP = "STAGE (LAB): one bounded PDF export tap dispatched"
CHOOSER = "STAGE (LAB): real chooser observed; selecting isolated PDF receiver"
SEMANTIC = ("PASS (LAB): Android app PDF semantics verified "
            "with synthetic input, cache and capture cleared")
RECEIPT = "PASS (LAB): bounded synthetic Android receipt metadata verified"
TIMEOUT = "BLOCK STAGE (LAB): PDF timeout category=ui-loading-app-foreground"
BLOCK = "BLOCK (LAB): immutable Release paired replay incomplete"
ALIVE = ('ENV (LAB): {"appProcessAlive": true, '
         '"foregroundCategory": "negresco-app", '
         '"webViewProvider": "provider-reported"}')
SUCCESS = "release-verified-receiver-stages-log-only"
STUCK = "release-chooser-timeout-app-foreground-log-only"
UNKNOWN = "release-pdf-boundary-unconfirmed"

def classify(log: object, api: object) -> tuple[str, str]:
    if type(log) is not str or type(api) is not int or api not in (26, 28):
        return UNKNOWN, "unconfirmed"
    if len(log.encode("utf8")) > MAX_BYTES:
        return UNKNOWN, "unconfirmed"
    lines = log.splitlines()
    if not 1 <= len(lines) <= MAX_LINES:
        return UNKNOWN, "unconfirmed"
    receiver = (f"PASS (LAB): Android API {api} receiver read actual PDF, "
                "rendered every nonblank page and deleted cache")
    labels = {TAP:"tap", CHOOSER:"chooser", receiver:"receiver",
              SEMANTIC:"semantic", RECEIPT:"receipt",
              TIMEOUT:"timeout", BLOCK:"block", ALIVE:"alive"}
    events: list[tuple[str, datetime]] = []
    for line in lines:
        match = STAMP.fullmatch(line)
        if not match:
            continue
        raw_stamp, message = match.groups()
        if (message.startswith(("BLOCK (LAB):", "BLOCK STAGE (LAB):"))
                and message not in (BLOCK, TIMEOUT)):
            return UNKNOWN, "unconfirmed"
        kind = labels.get(message)
        if kind:
            try:
                when = datetime.fromisoformat(raw_stamp[:-1] + "+00:00")
            except ValueError:
                return UNKNOWN, "unconfirmed"
            events.append((kind, when))
    stage = [(kind, when) for kind, when in events if kind != "alive"]
    sequence = [kind for kind, _ in stage]
    if sequence == ["tap", "chooser", "receiver", "semantic", "receipt"]:
        result, endpoint = SUCCESS, stage[1][1]
        if any(kind == "alive" and not stage[0][1] <= t <= endpoint
               for kind, t in events):
            return UNKNOWN, "unconfirmed"
    elif api == 28 and sequence == ["tap", "timeout", "block"]:
        alive = [t for kind, t in events if kind == "alive"]
        if len(alive) < 2 or any(not stage[0][1] <= t <= stage[1][1]
                                for t in alive):
            return UNKNOWN, "unconfirmed"
        result, endpoint = STUCK, stage[1][1]
    else:
        return UNKNOWN, "unconfirmed"
    if any(stage[i][1] > stage[i + 1][1] for i in range(len(stage) - 1)):
        return UNKNOWN, "unconfirmed"
    seconds = (endpoint - stage[0][1]).total_seconds()
    if not 0 < seconds <= 120:
        return UNKNOWN, "unconfirmed"
    return result, f"{seconds:.2f}"

def classify_file(path: Path, api: int) -> tuple[str, str]:
    try:
        if path.is_symlink() or not path.is_file():
            return UNKNOWN, "unconfirmed"
        info = path.stat()
        if not stat.S_ISREG(info.st_mode) or not 1 <= info.st_size <= MAX_BYTES:
            return UNKNOWN, "unconfirmed"
        return classify(path.read_text(encoding="utf8"), api)
    except (OSError, ValueError, UnicodeError):
        return UNKNOWN, "unconfirmed"

def main(argv: list[str]) -> int:
    if len(argv) != 3 or argv[1] not in ("26", "28"):
        print("RELEASE_PDF_BOUNDARY (LAB): " + UNKNOWN)
        return 1
    category, elapsed = classify_file(Path(argv[2]), int(argv[1]))
    print("RELEASE_PDF_BOUNDARY (LAB): " + category)
    print("RELEASE_PDF_ELAPSED_SECONDS (LAB): " + elapsed)
    print("RELEASE_PRODUCTION_GATES (LAB): approvedForProduction=false stableReleaseAllowed=false")
    return 0 if category != UNKNOWN else 1

if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

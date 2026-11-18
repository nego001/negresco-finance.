#!/usr/bin/env python3
"""Read only an OFFLINE GitHub Releases inventory; metadata is never APK proof."""
from __future__ import annotations
import json
import os
import re
import stat
import sys
from pathlib import Path

ORIGINAL_SHA = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"
DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")
MAX_FILE = 3_000_000
MAX_RELEASES = 150
MAX_ASSETS = 1200
NOT_LISTED = "original-apk-not-in-release-asset-metadata"
CANDIDATE = "candidate-asset-metadata-only-bytes-unverified"
BLOCK = "release-asset-inventory-unconfirmed"


def classify(releases: object) -> str:
    if type(releases) is not list or not (1 <= len(releases) <= MAX_RELEASES):
        return BLOCK
    total, matching = 0, 0
    for release in releases:
        if type(release) is not dict or type(release.get("assets")) is not list:
            return BLOCK
        for asset in release["assets"]:
            total += 1
            if total > MAX_ASSETS or type(asset) is not dict:
                return BLOCK
            name = asset.get("name")
            if type(name) is not str or not (1 <= len(name) <= 240):
                return BLOCK
            if not name.lower().endswith(".apk"):
                continue
            digest = asset.get("digest")
            if type(digest) is not str or not DIGEST.fullmatch(digest):
                return BLOCK
            if digest == "sha256:" + ORIGINAL_SHA:
                matching += 1
    if total == 0 or matching > 1:
        return BLOCK
    return CANDIDATE if matching == 1 else NOT_LISTED


def inspect_file(path: Path) -> str:
    try:
        before = path.lstat()
        if (not stat.S_ISREG(before.st_mode) or before.st_nlink != 1
                or not (1 <= before.st_size <= MAX_FILE)
                or not hasattr(os, "O_NOFOLLOW")):
            return BLOCK
        with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW), "rb") as inp:
            opened = os.fstat(inp.fileno())
            if (opened.st_ino != before.st_ino or opened.st_dev != before.st_dev
                    or opened.st_size != before.st_size):
                return BLOCK
            raw = inp.read(MAX_FILE + 1)
            if len(raw) != opened.st_size:
                return BLOCK
        return classify(json.loads(raw))
    except (OSError, ValueError, UnicodeError, TypeError):
        return BLOCK


def main(argv: list[str]) -> int:
    verdict = inspect_file(Path(argv[1])) if len(argv) == 2 else BLOCK
    if verdict == BLOCK:
        print("BLOCK (LAB): " + verdict)
        return 1
    print("STATUS (LAB): " + verdict)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

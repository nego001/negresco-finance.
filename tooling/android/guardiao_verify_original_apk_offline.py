#!/usr/bin/env python3
"""Offline, read-only identity gate for a recovered ORIGINAL V3.1.3 APK.

This gate does not download, install, rebuild, sign or publish any binary.
A PASS means local byte identity only; it does not approve production.
"""
from __future__ import annotations

import hashlib
import os
import stat
import sys
import zipfile
from pathlib import Path

ORIGINAL_APK_SHA256 = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"
MIN_BYTES = 1024 * 1024
MAX_BYTES = 256 * 1024 * 1024
MAX_ZIP_ENTRIES = 100_000
READ_CHUNK = 1024 * 1024
REQUIRED_APK_PARTS = frozenset(("AndroidManifest.xml", "classes.dex"))


def classify_candidate(path: Path, expected_sha: str = ORIGINAL_APK_SHA256) -> str:
    """Purely local, bounded check. Never emits path, data or a digest."""
    if path.suffix.lower() != ".apk":
        return "original-apk-extension-unconfirmed"
    try:
        before = path.lstat()
        if (not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or
                before.st_size < MIN_BYTES or before.st_size > MAX_BYTES):
            return "original-apk-file-unconfirmed"
        # O_NOFOLLOW rejects symlinks; matching inode/device rejects replacement
        # between metadata inspection and opening the local candidate.
        if not hasattr(os, "O_NOFOLLOW"):
            return "original-apk-nofollow-unavailable"
        flags = os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)
        fd = os.open(path, flags)
        with os.fdopen(fd, "rb") as stream:
            opened = os.fstat(stream.fileno())
            if (not stat.S_ISREG(opened.st_mode) or opened.st_dev != before.st_dev
                    or opened.st_ino != before.st_ino
                    or opened.st_size != before.st_size):
                return "original-apk-file-changed"
            digest = hashlib.sha256()
            count = 0
            while True:
                chunk = stream.read(READ_CHUNK)
                if not chunk:
                    break
                count += len(chunk)
                if count > MAX_BYTES:
                    return "original-apk-file-unconfirmed"
                digest.update(chunk)
            if count != opened.st_size or digest.hexdigest() != expected_sha:
                return "original-apk-sha256-mismatch"
            stream.seek(0)
            with zipfile.ZipFile(stream, "r") as archive:
                names = archive.namelist()
                if (len(names) > MAX_ZIP_ENTRIES or
                        len(names) != len(set(names)) or
                        not REQUIRED_APK_PARTS.issubset(set(names))):
                    return "original-apk-structure-unconfirmed"
            after = path.lstat()
            if (not stat.S_ISREG(after.st_mode) or after.st_dev != opened.st_dev
                    or after.st_ino != opened.st_ino or
                    after.st_size != opened.st_size):
                return "original-apk-file-changed"
    except (OSError, ValueError, zipfile.BadZipFile, zipfile.LargeZipFile):
        return "original-apk-inspection-unavailable"
    return "original-apk-exact-bytes-verified-for-lab-only"


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("BLOCK (LAB): original-apk-path-required", file=sys.stderr)
        return 2
    result = classify_candidate(Path(argv[1]))
    if result != "original-apk-exact-bytes-verified-for-lab-only":
        print("BLOCK (LAB): " + result, file=sys.stderr)
        return 1
    print("PASS (LAB): original-apk-exact-bytes-verified-for-lab-only")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

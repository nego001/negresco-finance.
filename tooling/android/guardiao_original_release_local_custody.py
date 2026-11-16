#!/usr/bin/env python3
"""Offline-only SHA-256 evidence gate for a USER-SUPPLIED original Release APK.

No recursive scanning, network traffic, uploads, installation or file writes.
Only fixed non-private verdicts. Never disclose paths, metadata, hashes or errors.
This tool does NOT demonstrate app behavior or authorize a Release.
"""
from __future__ import annotations

import hashlib
import os
import stat
import sys
from pathlib import Path

ORIGINAL_SHA256 = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"
MIN_APK_BYTES = 25_000_000
MAX_APK_BYTES = 200 * 1024 * 1024
MATCH = "MATCH_ORIGINAL_SHA"
DIFFERENT = "DIFFERENT_SHA"
REFUSED = "REFUSED_UNSAFE"
UNAVAILABLE = "UNAVAILABLE"


def inspect(path: Path, expected: str = ORIGINAL_SHA256,
            minimum: int = MIN_APK_BYTES,
            maximum: int = MAX_APK_BYTES) -> str:
    """Hashes a single non-symlink regular file with descriptor-stable identity."""
    if (not isinstance(path, Path) or type(expected) is not str or
            len(expected) != 64 or
            any(char not in "0123456789abcdef" for char in expected) or
            type(minimum) is not int or type(maximum) is not int or
            minimum < 1 or maximum < minimum):
        return REFUSED
    if path.suffix.lower() != ".apk":
        return REFUSED
    fd = None
    try:
        # O_NOFOLLOW stops replacement of the final file by a symlink.
        # O_NONBLOCK prevents a FIFO or device from blocking open before fstat.
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        before = os.fstat(fd)
        if (not stat.S_ISREG(before.st_mode) or before.st_nlink != 1
                or not minimum <= before.st_size <= maximum):
            return REFUSED
        digest = hashlib.sha256()
        length = 0
        while True:
            part = os.read(fd, min(1024 * 1024, maximum - length + 1))
            if not part:
                break
            length += len(part)
            if length > maximum:
                return REFUSED
            digest.update(part)
        after = os.fstat(fd)
        identity = ("st_dev", "st_ino", "st_size", "st_mtime_ns",
                    "st_ctime_ns", "st_nlink", "st_mode")
        if (length != before.st_size or
                any(getattr(before, field) != getattr(after, field)
                    for field in identity)):
            return REFUSED
        return MATCH if digest.hexdigest() == expected else DIFFERENT
    except FileNotFoundError:
        return UNAVAILABLE
    except (OSError, ValueError):
        return REFUSED
    finally:
        if fd is not None:
            try:
                os.close(fd)
            except OSError:
                pass


def main() -> int:
    if len(sys.argv) != 2:
        print(REFUSED)
        return 3
    verdict = inspect(Path(sys.argv[1]))
    print(verdict)
    return {MATCH: 0, DIFFERENT: 2, REFUSED: 3, UNAVAILABLE: 4}[verdict]


if __name__ == "__main__":
    raise SystemExit(main())

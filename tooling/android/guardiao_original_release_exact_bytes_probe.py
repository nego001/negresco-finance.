#!/usr/bin/env python3
"""Read-only identity gate for a *recovered original* Guardiao Release APK.

No rebuild, reinstall, package signing, network or production approval.
Only a byte-for-byte local SHA-256 comparison with the already pinned hash.
Never prints names, paths, binary content, digests or manifest data.
"""
from __future__ import annotations

import hashlib
import os
import stat
import sys
import zipfile
from pathlib import Path

EXPECTED_SHA256 = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"
MIN_APK_BYTES = 25_000_000
MAX_APK_BYTES = 200_000_000
MAX_ZIP_ENTRIES = 30_000
BLOCK = "release-exact-byte-identity-blocked"
MATCH = "local-exact-sha256-match-not-runtime-homologation"


def _unchanged(before: os.stat_result, after: os.stat_result) -> bool:
    return (before.st_dev, before.st_ino, before.st_size,
            before.st_mtime_ns, before.st_ctime_ns) == (
            after.st_dev, after.st_ino, after.st_size,
            after.st_mtime_ns, after.st_ctime_ns)


def probe(path: Path) -> str:
    """Read only one regular standalone file, reject swap, edits and bad ZIPs."""
    descriptor: int | None = None
    try:
        on_path = path.lstat()
        if (not stat.S_ISREG(on_path.st_mode) or on_path.st_nlink != 1
                or not MIN_APK_BYTES <= on_path.st_size <= MAX_APK_BYTES):
            return BLOCK
        flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
        descriptor = os.open(path, flags)
        with os.fdopen(descriptor, "rb", closefd=True) as apk:
            descriptor = None
            before = os.fstat(apk.fileno())
            if (not _unchanged(on_path, before)
                    or not stat.S_ISREG(before.st_mode)
                    or before.st_nlink != 1):
                return BLOCK
            if apk.read(4) != b"PK\\x03\\x04":
                return BLOCK
            apk.seek(0)
            with zipfile.ZipFile(apk) as archive:
                entries = archive.infolist()
                names = [entry.filename for entry in entries]
                if (not 1 <= len(names) <= MAX_ZIP_ENTRIES
                        or len(set(names)) != len(names)
                        or "AndroidManifest.xml" not in names
                        or "classes.dex" not in names):
                    return BLOCK
            apk.seek(0)
            digest = hashlib.sha256()
            count = 0
            for chunk in iter(lambda: apk.read(1024 * 1024), b""):
                count += len(chunk)
                if count > MAX_APK_BYTES:
                    return BLOCK
                digest.update(chunk)
            after = os.fstat(apk.fileno())
            try:
                final_path = path.lstat()
            except OSError:
                return BLOCK
            if (count != before.st_size
                    or not _unchanged(before, after)
                    or not _unchanged(before, final_path)
                    or not stat.S_ISREG(final_path.st_mode)
                    or final_path.st_nlink != 1):
                return BLOCK
            return MATCH if digest.hexdigest() == EXPECTED_SHA256 else BLOCK
    except (OSError, ValueError, RuntimeError, zipfile.BadZipFile, zipfile.LargeZipFile):
        return BLOCK
    finally:
        if descriptor is not None:
            os.close(descriptor)


def main() -> int:
    if len(sys.argv) != 2:
        print("RELEASE_EXACT_BYTES (LAB): " + BLOCK)
        print("RELEASE_PRODUCTION_GATES (LAB): approvedForProduction=false stableReleaseAllowed=false")
        return 1
    verdict = probe(Path(sys.argv[1]))
    print("RELEASE_EXACT_BYTES (LAB): " + verdict)
    print("RELEASE_PRODUCTION_GATES (LAB): approvedForProduction=false stableReleaseAllowed=false")
    return 0 if verdict == MATCH else 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Laboratory boundary: no explicit Guardiao debug-only UI labels in a Release APK.

This is a narrow byte-level negative check, NOT a claim about all UI paths,
bundler obfuscation, signed release security or runtime behavior.
"""
from __future__ import annotations

import os
import stat
import sys
import zipfile
from pathlib import Path

BUNDLE = "assets/index.android.bundle"
MAX_APK = 256 * 1024 * 1024
MAX_BUNDLE = 64 * 1024 * 1024
# Check the complete debug marker, not ordinary production loading text.
FORBIDDEN = (b"[LAB:", "[LAB:".encode("utf-16le"))


def reject(message: str) -> None:
    raise ValueError(message)


def check_apk(path: Path) -> None:
    if path.is_symlink() or not path.is_file():
        reject("APK path is missing, linked or not a regular file")
    info = path.stat()
    if not (100 <= info.st_size <= MAX_APK):
        reject("APK size outside bounded laboratory policy")
    with zipfile.ZipFile(path, "r") as apk:
        entries = [entry for entry in apk.infolist() if entry.filename == BUNDLE]
        if len(entries) != 1:
            reject("APK requires exactly one Android JS bundle")
        entry = entries[0]
        if (entry.is_dir() or entry.flag_bits & 1 or
                not 1 <= entry.file_size <= MAX_BUNDLE or
                entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)):
            reject("unacceptable Android JS bundle metadata")
        # Do not extract. Bound the decompressed read even if ZIP metadata lies.
        with apk.open(entry) as handle:
            data = handle.read(MAX_BUNDLE + 1)
        if len(data) != entry.file_size:
            reject("Android JS bundle size mismatch")
        if any(marker in data for marker in FORBIDDEN):
            reject("debug-only Guardiao LAB marker reached packaged Release bundle")


def main() -> int:
    if len(sys.argv) != 2:
        print("BLOCK (LAB): supply exactly one APK path", file=sys.stderr)
        return 2
    try:
        check_apk(Path(sys.argv[1]))
    except (ValueError, OSError, zipfile.BadZipFile, EOFError,
            RuntimeError, NotImplementedError):
        # No extracted JS, native exceptions, file paths or personal data.
        print("BLOCK (LAB): Release APK debug-label policy failed", file=sys.stderr)
        return 1
    print("PASS (LAB): Release APK has no literal Guardiao debug LAB marker")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

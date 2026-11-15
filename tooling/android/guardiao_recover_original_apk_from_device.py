#!/usr/bin/env python3
"""Opt-in, read-only Android package recovery for an immutable old APK.

Runs only when the owner supplies an ADB serial and a NEW local output path.
Reads installed package code only, never private app data. A copy is kept
only after the pinned SHA-256 and APK structure checks pass twice.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import guardiao_verify_original_apk_offline as verify

PACKAGE = "com.negresco.finance"
PASS_CODE = "original-apk-exact-bytes-verified-for-lab-only"
SERIAL_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\Z")
CODE_PATH_PATTERN = re.compile(
    r"/data/app/(?:[A-Za-z0-9._~+=:-]+/)+base\.apk\Z"
)


def classify_installed_code_path(raw: str) -> tuple[str, str | None]:
    """Reject split packages, output noise, root paths and traversal."""
    if not isinstance(raw, str) or len(raw) > 8192:
        return ("device-package-path-unconfirmed", None)
    lines = raw.splitlines()
    if len(lines) != 1 or not lines[0].startswith("package:"):
        return ("device-apk-single-code-path-unconfirmed", None)
    path = lines[0][len("package:"):]
    if (not CODE_PATH_PATTERN.fullmatch(path) or
            ".." in path.split("/") or "//" in path):
        return ("device-package-path-unconfirmed", None)
    return ("device-apk-single-code-path-confirmed", path)


def run_adb(args: list[str], *, timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args, stdin=subprocess.DEVNULL, capture_output=True, text=True,
        timeout=timeout, check=False,
    )


def recover_original_apk(
    serial: str,
    output: Path,
    *,
    command=run_adb,
    identity_check=verify.classify_candidate,
) -> str:
    """The production CLI fixes identity_check to the pinned offline verifier."""
    if not SERIAL_PATTERN.fullmatch(serial):
        return "device-serial-unconfirmed"
    if output.suffix.lower() != ".apk" or output.exists() or output.is_symlink():
        return "destination-must-be-new-apk"
    if not output.parent.is_dir():
        return "destination-parent-unavailable"
    try:
        result = command(
            ["adb", "-s", serial, "shell", "pm", "path", PACKAGE], timeout=20
        )
        if result.returncode != 0:
            return "device-package-query-unavailable"
        category, installed_path = classify_installed_code_path(result.stdout)
        if not installed_path:
            return category

        with tempfile.TemporaryDirectory(prefix="negresco-original-apk-lab-") as temp:
            ephemeral = Path(temp) / "candidate.apk"
            pulled = command(
                ["adb", "-s", serial, "pull", installed_path, str(ephemeral)],
                timeout=120,
            )
            if pulled.returncode != 0:
                return "device-apk-read-unavailable"
            # Neither adb metadata nor a filename is sufficient: hash real bytes.
            status = identity_check(ephemeral)
            if status != PASS_CODE:
                return "installed-app-is-not-exact-original"
            created = False
            success = False
            try:
                flags = (os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                         getattr(os, "O_NOFOLLOW", 0) |
                         getattr(os, "O_CLOEXEC", 0))
                descriptor = os.open(output, flags, 0o600)
                created = True
                with os.fdopen(descriptor, "wb") as destination:
                    with ephemeral.open("rb") as source:
                        shutil.copyfileobj(source, destination, length=1024 * 1024)
                    destination.flush()
                    os.fsync(destination.fileno())
                # Re-run hash/structure after copying; refuse a partial backup.
                if identity_check(output) != PASS_CODE:
                    return "recovered-apk-copy-unconfirmed"
                success = True
                return "exact-original-apk-recovered-to-user-selected-path"
            finally:
                if created and not success:
                    output.unlink(missing_ok=True)
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return "device-recovery-unavailable"


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("BLOCK (LAB): adb-serial-and-new-output-required", file=sys.stderr)
        return 2
    outcome = recover_original_apk(argv[1], Path(argv[2]))
    if outcome != "exact-original-apk-recovered-to-user-selected-path":
        print("BLOCK (LAB): " + outcome, file=sys.stderr)
        return 1
    print("PASS (LAB): exact-original-apk-recovered-to-user-selected-path")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

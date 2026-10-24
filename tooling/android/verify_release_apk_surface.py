#!/usr/bin/env python3
"""Fail-closed Release APK smoke gate against Debug-only QA leakage.

Read-only; no signing, installation, upload or publication. Passing is NOT
a claim of financial, biometric, or supply-chain assurance.
"""
from __future__ import annotations

import re
import sys
import zipfile
from pathlib import Path

FORBIDDEN = (
    "SyntheticBiometricManualQaActivity",
    "SyntheticBiometricSqlcipherManualQaActivity",
    "SyntheticBiometricManualQaOptInTest",
    "SyntheticBiometricSqlcipherManualQaOptInTest",
    "SyntheticDebugQaCleanupLedger",
    "SyntheticDebugQaCleanupLedgerTest",
    "SyntheticDebugQaOrphanResidueGate",
    "SyntheticDebugQaOrphanResidueGateTest",
    "SyntheticDebugQaOrphanActivityBoundaryTest",
    "SyntheticDebugQaOrphanInspection",
    "SyntheticDebugQaOrphanInspectionTest",
    "SyntheticJournalCrashWorkerService",
)
DEX_NAME = re.compile(r"classes(?:[2-9][0-9]*)?\.dex\Z")
MAX_ENTRY_BYTES = 256 * 1024 * 1024


def audit_apk(apk: Path) -> None:
    if not apk.is_file() or not apk.stat().st_size:
        raise ValueError("Release APK missing or empty")
    with zipfile.ZipFile(apk) as archive:
        names = set(archive.namelist())
        dex = sorted(n for n in names if DEX_NAME.fullmatch(n))
        if not dex:
            raise ValueError("Release APK is missing classes.dex")
        if "AndroidManifest.xml" not in names:
            raise ValueError("Release APK is missing AndroidManifest.xml")
        selected = dex + ["AndroidManifest.xml"]
        if "resources.arsc" in names:
            selected.append("resources.arsc")
        for name in selected:
            if archive.getinfo(name).file_size > MAX_ENTRY_BYTES:
                raise ValueError(f"APK inspection limit exceeded: {name}")
            data = archive.read(name)
            for forbidden in FORBIDDEN:
                if forbidden.encode("utf-8") in data or forbidden.encode("utf-16le") in data:
                    raise ValueError(f"Debug-only QA component {forbidden} present in {name}")
    print("PASS: assembled Release APK excludes known Debug-only QA components")


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: verify_release_apk_surface.py <release.apk>", file=sys.stderr)
        return 2
    try:
        audit_apk(Path(argv[1]))
    except (OSError, ValueError, zipfile.BadZipFile, RuntimeError) as exc:
        print(f"SEC05 BLOCK: Release APK packaging verification: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

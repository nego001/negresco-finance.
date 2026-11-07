#!/usr/bin/env python3
"""Disposable Debug Metro PDF phase comparison with retained app data (API28).

Three fully verified synthetic PDFs, same emulator, same Debug APK, with a
force-stop of the app between cycles but NO pm clear. Native print event logs
are cleared between cycles to prevent old success phases from masking failure.
This does NOT instrument or replace the immutable original Release APK.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import guardiao_pdf_debug_metro_lab as debug
import guardiao_pdf_native_phase_lab as native
import guardiao_debug_native_boot_categories as boot
import guardiao_android_export_pdf_text_emulator_smoke as semantic

CYCLES = ("a", "b", "c")
MAX_RECEIPT_BYTES = 16_000
EXPECTED_FIXTURE = "synthetic-48-collection-reference-invalid"


def verify_synthetic_debug_receipt(path: Path, digest: str) -> None:
    """Metadata-only, bounded, no PDF or UI bytes are read or published."""
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_RECEIPT_BYTES:
        raise RuntimeError("Debug retained-state PDF receipt unsafe")
    result = json.loads(path.read_text(encoding="utf8"))
    required_true = ("syntheticInput", "realAndroidApkPdf",
                     "nativePdfSemanticTextVerified", "receiverCacheClean",
                     "privateCaptureDeleted", "systemChooserObserved",
                     "receiverPdfRead", "allPagesRendered")
    if (type(result) is not dict
            or result.get("api") != 28
            or result.get("apkSha256") != digest
            or result.get("sourceFixture") != EXPECTED_FIXTURE
            or result.get("approvedForProduction") is not False
            or result.get("stableReleaseAllowed") is not False
            or any(result.get(flag) is not True for flag in required_true)):
        raise RuntimeError("Debug retained-state PDF receipt unverified")


def retained_debug_cycles() -> None:
    """Run original Debug PDF flow three times while preserving only app's local data."""
    if len(sys.argv) != 1 or semantic.REPORT.exists():
        raise RuntimeError("unsafe or stale Debug three-cycle lab")
    original = semantic.run_lab
    receipts_verified = 0

    def paired_replay() -> None:
        nonlocal receipts_verified
        for index, cycle in enumerate(CYCLES):
            if semantic.REPORT.exists():
                raise RuntimeError("stale Debug PDF evidence before cycle")
            if index:
                # Only the disposable app is stopped. Neither persistent
                # preferences nor APK are wiped, modified or uploaded.
                stopped = debug.base.adb("shell", "am", "force-stop",
                                         debug.base.PACKAGE, timeout=25)
                if debug.base.adb("shell", "pidof", debug.base.PACKAGE,
                                  timeout=10, check=False).strip():
                    raise RuntimeError("Debug retained-state app process still live")
                boot.reset_native_window()
                # No old successful print phase may count as next-cycle evidence.
                if native.collect_last_phase() != "native-phase-unconfirmed":
                    raise RuntimeError("Debug native phases not cleared after reset")
                if native.verify_diagnostic_channel() != "native-logcat-probe-confirmed":
                    raise RuntimeError("Debug native log channel unconfirmed after reset")
                print("STAGE (LAB): Debug local state retained after app force-stop",
                      flush=True)
            semantic.observed = None
            print("STAGE (LAB): Debug retained-state PDF cycle " + cycle,
                  flush=True)
            try:
                original()
                verify_synthetic_debug_receipt(semantic.REPORT, debug.debug_digest())
                print("ENV (LAB): Debug retained-state native print phase cycle " +
                      cycle + " " + native.collect_last_phase(), flush=True)
                print("ENV (LAB): Debug retained-state renderer exit cycle " +
                      cycle + " " + native.collect_renderer_exit_category(), flush=True)
                receipts_verified += 1
                # Every later cycle must generate a fresh verified receipt.
                if index < len(CYCLES) - 1:
                    semantic.REPORT.unlink()
                print("PASS (LAB): Debug retained-state PDF receipt cycle " +
                      cycle + " verified", flush=True)
            except Exception:
                # Failure may be before export. Observe only the fixed tag
                # without printing native errors, logcat, HTML or PDFs.
                print("ENV (LAB): Debug retained-state native phase on BLOCK " +
                      cycle + " " + native.collect_last_phase(), flush=True)
                print("ENV (LAB): Debug retained-state phase progress on BLOCK " +
                      cycle + " " + native.collect_native_phase_progress(),
                      flush=True)
                print("ENV (LAB): Debug retained-state renderer exit on BLOCK " +
                      cycle + " " + native.collect_renderer_exit_category(),
                      flush=True)
                # A missing native phase is not proof that printToFileAsync
                # did not enter Android unless the bounded logcat canary
                # succeeds at the time of the failure, too.
                print("ENV (LAB): Debug retained-state native diagnostic channel on BLOCK " +
                      cycle + " " + native.verify_diagnostic_channel(),
                      flush=True)
                raise
        if receipts_verified != len(CYCLES) or not semantic.REPORT.is_file():
            raise RuntimeError("Debug retained-state receipt triple incomplete")

    semantic.run_lab = paired_replay
    try:
        debug.run()  # Existing isolation, Metro, exact input and PDF checks.
    finally:
        semantic.run_lab = original
        semantic.REPORT.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        retained_debug_cycles()
    except Exception:
        print("BLOCK (LAB): Debug retained-state three-cycle PDF unverified",
              file=sys.stderr)
        raise SystemExit(1)

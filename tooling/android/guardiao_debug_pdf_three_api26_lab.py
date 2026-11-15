#!/usr/bin/env python3
"""Three synthetic Guardiao PDFs on API26 in one continuously live Debug app PID.

Lab only. The original SHA-pinned Release APK, payment paths and app sources
are unchanged. Reuse only the already installed Debug app on cycles B and C;
retain strict receipt, native-channel and safe Home navigation gates.
"""
from __future__ import annotations

import json
import re
import sys

import guardiao_pdf_debug_metro_lab as debug
import guardiao_android_export_pdf_text_emulator_smoke as semantic
import guardiao_debug_same_process_nav_lab as nav
import guardiao_original_release_same_process_lab as identity
import guardiao_pdf_debug_retained_state_lab as retained
import guardiao_pdf_native_phase_lab as native
import guardiao_debug_native_boot_categories as boot

CYCLES = tuple("abc")


def require_api26() -> None:
    """Require the actual emulator SDK to be Android 8 / API 26."""
    try:
        sdk = debug.base.adb(
            "shell", "getprop", "ro.build.version.sdk",
            timeout=15
        ).strip()
    except Exception:
        raise RuntimeError("three-pdf-api26-device-unconfirmed") from None
    if sdk != "26":
        raise RuntimeError("three-pdf-api26-device-unconfirmed")


def verify_api26_synthetic_receipt(path, digest: str) -> None:
    """Same strict receiver and cleanup gates, but explicitly API26."""
    failure = "three-pdf-api26-receipt-unverified"
    try:
        if (path.is_symlink() or not path.is_file()
                or not 0 < path.stat().st_size <= retained.MAX_RECEIPT_BYTES):
            raise RuntimeError(failure)
        record = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError):
        raise RuntimeError(failure) from None
    required_true = (
        "syntheticInput", "realAndroidApkPdf", "nativePdfSemanticTextVerified",
        "receiverCacheClean", "privateCaptureDeleted", "systemChooserObserved",
        "receiverPdfRead", "allPagesRendered",
    )
    if (type(record) is not dict or type(record.get("api")) is not int
            or record["api"] != 26
            or record.get("apkSha256") != digest
            or record.get("sourceFixture") != retained.EXPECTED_FIXTURE
            or record.get("approvedForProduction") is not False
            or record.get("stableReleaseAllowed") is not False
            or any(record.get(key) is not True for key in required_true)):
        raise RuntimeError(failure)


def verify_extended_semantic_receipt(path) -> None:
    """Check independent PDF metadata agreement without reading document bytes.

    This is an additional contract after the existing receiver and semantic
    proof. Equal SHA hashes across identical synthetic PDFs are allowed; never
    treat a changed hash alone as proof of a new document.
    """
    failure = "same-pid-ten-pdf-semantic-metadata-unverified"
    try:
        if (path.is_symlink() or not path.is_file()
                or not 0 < path.stat().st_size <= retained.MAX_RECEIPT_BYTES):
            raise RuntimeError(failure)
        record = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError):
        raise RuntimeError(failure) from None
    if type(record) is not dict:
        raise RuntimeError(failure)
    pages = record.get("pdfPages")
    size = record.get("pdfSizeBytes")
    digest = record.get("receivedPdfSha256")
    if (type(record.get("schemaVersion")) is not int
            or record.get("schemaVersion") != 2
            or record.get("scope") != "SHA_PINNED_ANDROID_APP_SYNTHETIC_PDF_TEXT"
            or record.get("chromeReferenceUsed") is not False
            or type(pages) is not int or not 1 <= pages <= 8
            or type(record.get("textPagesVerified")) is not int
            or record["textPagesVerified"] != pages
            or type(record.get("pdfPageCount")) is not int
            or record["pdfPageCount"] != pages
            or type(record.get("nonblankPages")) is not int
            or record["nonblankPages"] != pages
            or type(size) is not int or not 200 < size <= 8 * 1024 * 1024
            or type(digest) is not str
            or re.fullmatch(r"[0-9a-f]{64}", digest) is None):
        raise RuntimeError(failure)


def require_pid(expected: str | None) -> None:
    if not expected or identity.observed_single_app_pid() != expected:
        raise RuntimeError("same-pid-ten-pdf-process-identity-unconfirmed")


def run() -> None:
    if len(sys.argv) != 1 or semantic.REPORT.exists():
        raise RuntimeError("three-pdf-api26-unsafe-or-stale-lab")
    require_api26()
    original_run = semantic.run_lab
    original_home_probe = debug.observe_debug_home_geometry
    baseline_pid: str | None = None
    receipts_verified = 0

    def observe_home_pid() -> None:
        nonlocal baseline_pid
        original_home_probe()
        now = identity.observed_single_app_pid()
        if not now or (baseline_pid is not None and now != baseline_pid):
            raise RuntimeError("same-pid-ten-pdf-home-identity-unconfirmed")
        baseline_pid = now

    def ten_synthetic_pdfs() -> None:
        nonlocal receipts_verified
        for index, cycle in enumerate(CYCLES):
            if semantic.REPORT.exists():
                raise RuntimeError("same-pid-ten-pdf-stale-receipt")
            if index:
                require_pid(baseline_pid)
                # An existing fail-closed gate: one validated Home tab target,
                # two stable reads, unchanged PID; no BACK or blind tapping.
                nav.navigate_after_verified_pdf(baseline_pid)
                require_pid(baseline_pid)
                # A previous successful callback must not count for PDFs B through J.
                boot.reset_native_window()
                if native.collect_last_phase() != "native-phase-unconfirmed":
                    raise RuntimeError("same-pid-ten-pdf-stale-native-phase")
                if native.verify_diagnostic_channel() != "native-logcat-probe-confirmed":
                    raise RuntimeError("same-pid-ten-pdf-native-channel-unconfirmed")
            semantic.observed = None
            previous_adb = debug.base.adb
            skipped_app_install = 0

            def reuse_existing_debug_app(*args, **kwargs):
                nonlocal skipped_app_install
                if args == ("install", "-r", str(debug.base.APK)):
                    # Only this exact later-cycle app installation may be
                    # skipped; receiver install, fresh gate and receipts stay.
                    if skipped_app_install or index == 0:
                        raise RuntimeError("same-pid-ten-pdf-install-scope-invalid")
                    require_pid(baseline_pid)
                    skipped_app_install += 1
                    return ""
                return previous_adb(*args, **kwargs)

            if index:
                debug.base.adb = reuse_existing_debug_app
            try:
                original_run()
            except Exception:
                # Read-only, bounded categorical diagnostics. Never expose
                # native records, error strings, personal data or document.
                print("ENV (LAB): ten-PDF native progress on BLOCK " +
                      native.collect_native_phase_progress(), flush=True)
                print("ENV (LAB): ten-PDF layout-write order on BLOCK " +
                      native.collect_layout_write_order(), flush=True)
                print("ENV (LAB): ten-PDF diagnostic channel on BLOCK " +
                      native.verify_diagnostic_channel(), flush=True)
                raise
            finally:
                if index:
                    debug.base.adb = previous_adb
            if index and skipped_app_install != 1:
                raise RuntimeError("same-pid-ten-pdf-reuse-not-confirmed")
            require_pid(baseline_pid)
            verify_api26_synthetic_receipt(
                semantic.REPORT, debug.debug_digest())
            verify_extended_semantic_receipt(semantic.REPORT)
            receipts_verified += 1
            print("PASS (LAB): same-PID synthetic PDF receipt cycle " +
                  cycle + " verified", flush=True)
            if index < len(CYCLES) - 1:
                semantic.REPORT.unlink()
        if receipts_verified != len(CYCLES) or not semantic.REPORT.is_file():
            raise RuntimeError("same-pid-ten-pdf-ten-cycle-incomplete")

    debug.observe_debug_home_geometry = observe_home_pid
    semantic.run_lab = ten_synthetic_pdfs
    try:
        debug.run(expected_api=26)
        if receipts_verified != len(CYCLES):
            raise RuntimeError("same-pid-ten-pdf-receipt-count-unconfirmed")
        print("PASS (LAB): three independent synthetic PDFs in unchanged API26 Debug PID",
              flush=True)
    finally:
        semantic.run_lab = original_run
        debug.observe_debug_home_geometry = original_home_probe
        semantic.REPORT.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print("BLOCK (LAB): same-PID Debug API26 three-PDF proof unverified",
              file=sys.stderr)
        raise SystemExit(1)

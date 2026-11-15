#!/usr/bin/env python3
"""Three synthetic Guardiao PDFs on API28 in one continuously live Debug app PID.

Lab only. The original SHA-pinned Release APK, payment paths and app sources
are unchanged. Reuse only the already installed Debug app on cycles B and C;
retain strict receipt, native-channel and safe Home navigation gates.
"""
from __future__ import annotations

import sys

import guardiao_pdf_debug_metro_lab as debug
import guardiao_android_export_pdf_text_emulator_smoke as semantic
import guardiao_debug_same_process_nav_lab as nav
import guardiao_original_release_same_process_lab as identity
import guardiao_pdf_debug_retained_state_lab as retained
import guardiao_pdf_native_phase_lab as native
import guardiao_debug_native_boot_categories as boot

CYCLES = ("a", "b", "c")


def require_pid(expected: str | None) -> None:
    if not expected or identity.observed_single_app_pid() != expected:
        raise RuntimeError("same-pid-three-pdf-process-identity-unconfirmed")


def run() -> None:
    if len(sys.argv) != 1 or semantic.REPORT.exists():
        raise RuntimeError("same-pid-three-pdf-unsafe-or-stale-lab")
    original_run = semantic.run_lab
    original_home_probe = debug.observe_debug_home_geometry
    baseline_pid: str | None = None
    receipts_verified = 0

    def observe_home_pid() -> None:
        nonlocal baseline_pid
        original_home_probe()
        now = identity.observed_single_app_pid()
        if not now or (baseline_pid is not None and now != baseline_pid):
            raise RuntimeError("same-pid-three-pdf-home-identity-unconfirmed")
        baseline_pid = now

    def three_synthetic_pdfs() -> None:
        nonlocal receipts_verified
        for index, cycle in enumerate(CYCLES):
            if semantic.REPORT.exists():
                raise RuntimeError("same-pid-three-pdf-stale-receipt")
            if index:
                require_pid(baseline_pid)
                # An existing fail-closed gate: one validated Home tab target,
                # two stable reads, unchanged PID; no BACK or blind tapping.
                nav.navigate_after_verified_pdf(baseline_pid)
                require_pid(baseline_pid)
                # A previous successful callback must not count for PDFs B or C.
                boot.reset_native_window()
                if native.collect_last_phase() != "native-phase-unconfirmed":
                    raise RuntimeError("same-pid-three-pdf-stale-native-phase")
                if native.verify_diagnostic_channel() != "native-logcat-probe-confirmed":
                    raise RuntimeError("same-pid-three-pdf-native-channel-unconfirmed")
            semantic.observed = None
            previous_adb = debug.base.adb
            skipped_app_install = 0

            def reuse_existing_debug_app(*args, **kwargs):
                nonlocal skipped_app_install
                if args == ("install", "-r", str(debug.base.APK)):
                    # Only this exact later-cycle app installation may be
                    # skipped; receiver install, fresh gate and receipts stay.
                    if skipped_app_install or index == 0:
                        raise RuntimeError("same-pid-three-pdf-install-scope-invalid")
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
                print("ENV (LAB): three-PDF native progress on BLOCK " +
                      native.collect_native_phase_progress(), flush=True)
                print("ENV (LAB): three-PDF layout-write order on BLOCK " +
                      native.collect_layout_write_order(), flush=True)
                print("ENV (LAB): three-PDF diagnostic channel on BLOCK " +
                      native.verify_diagnostic_channel(), flush=True)
                raise
            finally:
                if index:
                    debug.base.adb = previous_adb
            if index and skipped_app_install != 1:
                raise RuntimeError("same-pid-three-pdf-reuse-not-confirmed")
            require_pid(baseline_pid)
            retained.verify_synthetic_debug_receipt(
                semantic.REPORT, debug.debug_digest())
            receipts_verified += 1
            print("PASS (LAB): same-PID synthetic PDF receipt cycle " +
                  cycle + " verified", flush=True)
            if index < len(CYCLES) - 1:
                semantic.REPORT.unlink()
        if receipts_verified != len(CYCLES) or not semantic.REPORT.is_file():
            raise RuntimeError("same-pid-three-pdf-triple-incomplete")

    debug.observe_debug_home_geometry = observe_home_pid
    semantic.run_lab = three_synthetic_pdfs
    try:
        debug.run()
        if receipts_verified != len(CYCLES):
            raise RuntimeError("same-pid-three-pdf-receipt-count-unconfirmed")
        print("PASS (LAB): three independent synthetic PDFs in unchanged Debug PID",
              flush=True)
    finally:
        semantic.run_lab = original_run
        debug.observe_debug_home_geometry = original_home_probe
        semantic.REPORT.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print("BLOCK (LAB): same-PID Debug three-PDF proof unverified",
              file=sys.stderr)
        raise SystemExit(1)

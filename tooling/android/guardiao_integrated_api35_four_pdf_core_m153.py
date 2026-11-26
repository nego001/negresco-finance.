#!/usr/bin/env python3
"""Four synthetic PDF receipts in the same API35 candidate Release-mode PID.

The candidate is DEBUG-SIGNED, NOT the historical immutable Release. Reuses
the exact previously verified candidate bytes and strict receiver semantics.
After each completed PDF, verify the live PID, return via one bounded Home
tab and replay without reinstalling the finance APK or clearing app data.
A failed Home, PID, PDF, semantic or cache gate blocks; no pseudo-success.
Never records PIN, PDF, UI XML, PID, generated URI or customer information.
"""
from __future__ import annotations

import sys
from pathlib import Path
import guardiao_candidate_release_root_v4_api28_pdf_lab as candidate
import guardiao_integrated_api35_single_pdf_m153 as api35
import guardiao_original_release_same_process_lab as home
import guardiao_android_export_pdf_text_emulator_smoke as semantic

BASE = candidate.BASE
CYCLES = ("a", "b", "c", "d")
BLOCK = "candidate API35 repeated PDF same-process proof incomplete"


def run() -> None:
    if (len(sys.argv) != 1 or
            not candidate.candidate_identity(candidate.APK) or
            semantic.REPORT.exists() or
            candidate.PINNED_CANDIDATE == candidate.ORIGINAL_IMMUTABLE):
        raise RuntimeError("candidate-only replay preflight rejected")
    if BASE.adb("shell", "getprop", "ro.build.version.sdk", timeout=15).strip() != "35":
        raise RuntimeError("API35 required for same-process candidate test")
    # The candidate's normal entrypoint sets the checked app path/hash and
    # validates complete PDF receipt fields; it deletes temporary receipt.
    baseline_pid: str | None = None
    for index, cycle in enumerate(CYCLES):
        semantic.observed = None
        if semantic.REPORT.exists():
            raise RuntimeError("stale synthetic report prevents replay")
        print("STAGE (LAB): candidate API35 same-PID cycle " + cycle, flush=True)
        if index == 0:
            api35.run()
            baseline_pid = home.observed_single_app_pid()
            if not baseline_pid:
                raise RuntimeError("candidate baseline PID unconfirmed")
        else:
            if baseline_pid is None or home.observed_single_app_pid() != baseline_pid:
                raise RuntimeError("same-PID pre-replay identity unconfirmed")
            real_adb = BASE.adb
            real_wait = BASE.wait_visible
            skipped = False
            home_verified = False

            def reuse_verified_install(*args, **kwargs):
                nonlocal skipped
                if args == ("install", "-r", str(candidate.APK)):
                    if skipped or home.observed_single_app_pid() != baseline_pid:
                        raise RuntimeError("one and only one candidate reinstall skip rejected")
                    skipped = True
                    print("STAGE (LAB): candidate app reused without reinstall", flush=True)
                    return ""
                return real_adb(*args, **kwargs)

            def confirm_home_before_replay(needle: str, retries: int = 25, *,
                                           scroll: bool = False,
                                           enabled: bool = False):
                nonlocal home_verified
                if needle == "Seu universo" and not home_verified:
                    home.restore_home_tab_in_same_process(baseline_pid)
                    home_verified = True
                    print("STAGE (LAB): bounded same-PID home navigation verified",
                          flush=True)
                return real_wait(needle, retries=retries, scroll=scroll,
                                 enabled=enabled)

            BASE.adb = reuse_verified_install
            BASE.wait_visible = confirm_home_before_replay
            try:
                api35.run()
            finally:
                BASE.adb = real_adb
                BASE.wait_visible = real_wait
            if not skipped or not home_verified:
                raise RuntimeError("candidate reinstall/home gate not exercised")
            if home.observed_single_app_pid() != baseline_pid:
                raise RuntimeError("candidate app PID changed after PDF replay")
        if home.observed_single_app_pid() != baseline_pid:
            raise RuntimeError("candidate app PID changed during PDF replay")
        # api35.run() has already required the independent receiver and
        # semantic PDF receipt, and deleted its private temporary metadata.
        if semantic.REPORT.exists() or BASE.REPORT.exists():
            raise RuntimeError("candidate temporary synthetic receipt remains")
        semantic.ensure_absent()
        print("PASS (LAB): candidate API35 same-PID PDF cycle " + cycle +
              " independently verified", flush=True)

    print("PASS (LAB): four consecutive root-bottom-inset Release-mode PDFs in unchanged API35 PID",
          flush=True)
    print("PASS (LAB): three bounded Home returns with tested Android root bottom-inset, no APK reinstall",
          flush=True)
    print("PASS (LAB): candidate is test-only; original Release P0 remains blocked",
          flush=True)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print("BLOCK (LAB): " + BLOCK, file=sys.stderr)
        raise SystemExit(1)

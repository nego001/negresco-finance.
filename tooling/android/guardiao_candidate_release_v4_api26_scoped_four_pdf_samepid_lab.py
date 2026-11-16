#!/usr/bin/env python3
"""Apply strict passive three-tab attestation to v4 four-PDF same-PID replay.

Wraps the previously successful, separately tested v4 replay. No app changes,
no new gestures, no fallback/back/swipe, no private UI or PDF logs. Fails closed.
"""
from __future__ import annotations

import sys

import guardiao_candidate_release_v4_api26_four_pdf_samepid_core_lab as repeated
import guardiao_candidate_release_root_v4_api28_pdf_lab as candidate
import guardiao_candidate_release_v4_scoped_triplet_api28_lab as scoped
import guardiao_original_release_same_process_lab as home
import guardiao_android_export_pdf_text_emulator_smoke as semantic

BASE = candidate.BASE


def attest_triplet(expected_pid: str, stage: str) -> None:
    if stage not in ("initial", "pre-return", "post-return"):
        raise RuntimeError("invalid attestation stage")
    if not expected_pid or home.observed_single_app_pid() != expected_pid:
        raise RuntimeError("single app PID not confirmed")
    width, height = BASE.screen_size()
    first = scoped.scoped_triplet_category(BASE.xml_nodes(), width, height)
    second = scoped.scoped_triplet_category(BASE.xml_nodes(), width, height)
    if (home.observed_single_app_pid() != expected_pid
            or first != scoped.PASS or second != scoped.PASS):
        raise RuntimeError("scoped three-tab geometry was not twice verified")
    print("PASS (LAB): scoped three-tab geometry verified at " + stage,
          flush=True)


def run() -> None:
    if (len(sys.argv) != 1
            or candidate.PINNED_CANDIDATE == candidate.ORIGINAL_IMMUTABLE
            or not candidate.candidate_identity(candidate.APK)
            or semantic.REPORT.exists() or BASE.REPORT.exists()):
        raise RuntimeError("untrusted four-PDF replay preflight")
    if BASE.adb("shell", "getprop", "ro.build.version.sdk", timeout=15).strip() != "26":
        raise RuntimeError("Android API26 required")

    original_restore = home.restore_home_tab_in_same_process
    original_wait = BASE.wait_visible
    initial_count = 0
    return_count = 0

    def bounded_restore(pid: str) -> None:
        nonlocal return_count
        if return_count >= 3:
            raise RuntimeError("unexpected additional Home return")
        # No touch until both complete accessibility snapshots pass.
        attest_triplet(pid, "pre-return")
        original_restore(pid)  # Already audited: one bounded Home gesture.
        attest_triplet(pid, "post-return")
        return_count += 1

    def observed_home_entry(needle: str, retries: int = 25, *,
                            scroll: bool = False, enabled: bool = False):
        nonlocal initial_count
        # Preserve the original wait/visibility gate, no short-circuit.
        result = original_wait(needle, retries=retries, scroll=scroll,
                               enabled=enabled)
        if needle == "Seu universo" and initial_count == 0:
            pid = home.observed_single_app_pid()
            if not pid:
                raise RuntimeError("initial app PID unconfirmed")
            attest_triplet(pid, "initial")
            initial_count += 1
        return result

    # Every wrapper is restored even on failed geometry or failed PDF.
    home.restore_home_tab_in_same_process = bounded_restore
    BASE.wait_visible = observed_home_entry
    try:
        repeated.run()  # Existing A/B/C/D receiver, semantics, cache and PID gates.
    finally:
        home.restore_home_tab_in_same_process = original_restore
        BASE.wait_visible = original_wait

    if initial_count != 1 or return_count != 3:
        raise RuntimeError("initial or pre/post Home attestation sequence incomplete")
    print("PASS (LAB): v4 API26 scoped Home x1 plus three safe returns and four PDFs in one PID",
          flush=True)
    print("PASS (LAB): test-only; original Release PDF P0 still unapproved",
          flush=True)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print("BLOCK (LAB): v4 API26 scoped four-PDF same-PID proof incomplete",
              file=sys.stderr)
        raise SystemExit(1)

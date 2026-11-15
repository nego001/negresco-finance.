#!/usr/bin/env python3
"""Read-only API28 before/after geometry stages for a Release-mode candidate.

Wraps the already strict four-PDF same-PID runner without changing app actions,
APK, code, receiver, test fixture, expected SHA, PDF checks or navigation
boundaries. Failing existing gates must still FAIL this workflow.
Never logs raw Android XML, coordinates, financial fields, keyboard dumps,
PIDs, exceptions or PDF content. Every output value is allowlisted.
"""
from __future__ import annotations

import sys

import guardiao_candidate_release_nav_v2_api28_same_pid_lab as same
import guardiao_original_release_same_process_lab as home

BASE = same.BASE
SHAPES = frozenset((
    "point-only", "zero-area", "offscreen", "onscreen-other-band",
    "on-bottom-band", "reversed", "unconfirmed", "viewport-unconfirmed",
))
LAYOUTS = frozenset((
    "home-label-unconfirmed", "home-bounds-unconfirmed",
    "three-tabs-thin", "home-label-bounded", "home-layout-unconfirmed",
))
ANCESTORS = frozenset((
    "height-too-small", "geometry-eligible", "width-too-small", "width-too-large",
    "bounds-degenerate", "bounds-offscreen", "top-outside-bottom-tab",
    "bottom-too-low", "height-too-large", "viewport-unconfirmed",
    "bounds-unconfirmed",
))
IME = frozenset((
    "both-shown", "both-hidden", "input-only-shown", "view-only-shown",
    "ime-flags-conflicting", "ime-flags-missing", "ime-flags-unconfirmed",
))
STAGES = frozenset(("initial-home", "pre-export", "after-receiver", "before-home-b"))


def fixed(value: object, allowed: frozenset[str]) -> str:
    return value if type(value) is str and value in allowed else "unconfirmed"


def observe(stage: str) -> None:
    if stage not in STAGES:
        raise RuntimeError("unexpected candidate geometry stage")
    layout = label = ancestor = "unconfirmed"
    ime = "unconfirmed"
    try:
        width, height = BASE.screen_size()
        nodes = BASE.xml_nodes()
        layout = fixed(home.safe_home_layout_snapshot_category(
            nodes, width, height), LAYOUTS)
        first, second, _ = home.safe_initial_home_detail(nodes, width, height)
        label = fixed(first, SHAPES)
        ancestor = fixed(second, ANCESTORS)
    except Exception:
        pass
    try:
        raw = BASE.adb("shell", "dumpsys", "input_method",
                       timeout=8, check=False)
        if type(raw) is str and len(raw) <= 250000:
            ime = fixed(home.safe_ime_flag_pair(raw), IME)
    except Exception:
        pass
    # Fixed categories only, never any raw log/UI/string from Android.
    print("ENV (LAB): candidate-home-stage=" + stage
          + " layout=" + layout
          + " label=" + label
          + " ancestor=" + ancestor
          + " ime=" + ime, flush=True)


def run() -> None:
    if len(sys.argv) != 1:
        raise RuntimeError("no runtime arguments allowed")
    original_candidate_run = same.candidate.run
    first_cycle = True
    probes: list[str] = []

    def instrumented_candidate_run() -> None:
        nonlocal first_cycle
        prior_wait = BASE.wait_visible
        prior_pdf_button = BASE.wait_export_button
        first_wait_seen = False
        export_seen = False

        def inspect_initial_before_wait(needle: str, retries: int = 25, *,
                                        scroll: bool = False,
                                        enabled: bool = False):
            nonlocal first_wait_seen
            if needle == "Seu universo" and not first_wait_seen:
                first_wait_seen = True
                stage = "initial-home" if first_cycle else "before-home-b"
                observe(stage)
                probes.append(stage)
            return prior_wait(needle, retries=retries, scroll=scroll,
                              enabled=enabled)

        def inspect_export_after_bounded_visibility():
            nonlocal export_seen
            result = prior_pdf_button()
            if not export_seen and first_cycle:
                export_seen = True
                observe("pre-export")
                probes.append("pre-export")
            return result

        BASE.wait_visible = inspect_initial_before_wait
        BASE.wait_export_button = inspect_export_after_bounded_visibility
        try:
            original_candidate_run()
            if first_cycle:
                # The share receiver may still be foreground; a missing tab
                # must be reported as unconfirmed, NOT falsely called hidden.
                observe("after-receiver")
                probes.append("after-receiver")
                first_cycle = False
        finally:
            BASE.wait_visible = prior_wait
            BASE.wait_export_button = prior_pdf_button

    same.candidate.run = instrumented_candidate_run
    try:
        same.run()
    finally:
        same.candidate.run = original_candidate_run
        if not all(stage in probes for stage in
                   ("initial-home", "pre-export", "after-receiver")):
            print("BLOCK (LAB): required read-only phase geometry missing",
                  file=sys.stderr)
    # No label upgrades any result: only same.run() verifies PDF and Home.


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print("BLOCK (LAB): candidate Home geometry investigation remains unverified",
              file=sys.stderr)
        raise SystemExit(1)

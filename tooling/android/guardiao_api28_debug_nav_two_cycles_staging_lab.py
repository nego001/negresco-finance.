#!/usr/bin/env python3
"""M74 STAGING ONLY: two consecutive guarded demo Home-Pix-Home cycles in one PID.

No Android workflow points to this file in this branch. The only runtime
effects, if separately authorized in a later reviewed disposable Debug lab,
come from the unchanged existing M72 guarded navigation runner. No PDF,
financial entry, screenshot, arbitrary input, retry or state recovery.
"""
from __future__ import annotations

import sys

import guardiao_api28_debug_external_a11y_readonly_lab as observer
import guardiao_api28_debug_nav_preview_two_step_lab as navigation
from guardiao_api28_debug_nav_stage_ledger import CHECKPOINTS, StageLedger

CYCLES: tuple[str, str] = ("first", "second")
ACTIVE = "not-started"
LAST_COMPLETE = "none"


def twice_same_process() -> None:
    """Require exact two complete sequential navigation rounds, not retries."""
    global ACTIVE, LAST_COMPLETE

    baseline_pid = observer.debug_pid()
    if not baseline_pid or not observer.debug_focus():
        raise RuntimeError("Debug initial process not attested")

    for label in CYCLES:
        ACTIVE = label
        if observer.debug_pid() != baseline_pid or not observer.debug_focus():
            raise RuntimeError("Debug process changed between cycles")

        # Each planned cycle starts at the only initial state allowed by
        # the reused M72 script and has its own monotone stage evidence.
        navigation.STAGE = StageLedger()
        navigation.run_two_step_navigation()  # existing strictly guarded flow

        if navigation.STAGE.category != "sequence-complete":
            raise RuntimeError("one full preview cycle unconfirmed")
        if observer.debug_pid() != baseline_pid or not observer.debug_focus():
            raise RuntimeError("Debug process changed after cycle")
        LAST_COMPLETE = label

    if LAST_COMPLETE != "second":
        raise RuntimeError("two planned cycles incomplete")
    print("PASS (LAB): two guarded Home-Pix-Home Debug preview cycles, one PID",
          flush=True)


if __name__ == "__main__":
    try:
        if len(sys.argv) != 1:
            raise RuntimeError("unexpected M74 arguments")
        observer.run(after_verified_observation=twice_same_process)
    except Exception:
        # The original runtime error is never exposed to output or artifacts.
        cycle = ACTIVE if ACTIVE in ("first", "second") else "not-started"
        complete = LAST_COMPLETE if LAST_COMPLETE in ("first", "second") else "none"
        checkpoint = navigation.STAGE.category
        # Only fixed literals from the pure ledger may appear in output.
        if checkpoint not in CHECKPOINTS:
            checkpoint = "preflight-pending"
        print("ENV (LAB): debug-nav-active-cycle=" + cycle, flush=True)
        print("ENV (LAB): debug-nav-last-complete-cycle=" + complete, flush=True)
        print("ENV (LAB): debug-nav-last-checkpoint=" + checkpoint, flush=True)
        print("BLOCK (LAB): two complete Debug preview nav cycles not attested",
              file=sys.stderr)
        raise SystemExit(1)

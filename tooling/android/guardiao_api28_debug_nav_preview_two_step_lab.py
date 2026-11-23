#!/usr/bin/env python3
"""M69: exactly two geometry-gated preview navigation taps on disposable API28 Debug.

Home -> Pix (demo only) -> Home. No financial input, PDF, BACK, swipes,
screenshots, retry, raw XML/logcat, coordinates/PIDs in logs or artifacts.
"""
from __future__ import annotations

import sys
import time

import guardiao_api28_debug_external_a11y_readonly_lab as observer
import guardiao_api28_debug_home_readiness_census_lab as home
import guardiao_api28_debug_targetid_presence_lab as counts
import guardiao_api28_debug_nav_preview_guard as gate
import guardiao_api28_debug_return_diagnostic_lab as return_diag
from guardiao_api28_debug_nav_stage_ledger import StageLedger

BASE = observer.debug.base
PIX_TEXTS = ("TRANSFERÊNCIAS", "Pix do seu jeito.")
APP = observer.DEBUG_PACKAGE
RESULT = "BLOCK (LAB): guarded Debug Home-Pix-Home navigation not attested"
STAGE = StageLedger()  # fixed-category evidence only, no UI or device access
PRE_PIX_DIAGNOSTIC = "not-started"  # allowlisted only; no UI/PID/coordinates
RETURN_DIAGNOSTIC = "not-started"  # categorical, never content/coords/PID
SNAPSHOT_DIAGNOSTIC = "not-started"  # fixed phase only; reset per cycle


def private_snapshot() -> tuple[list[dict[str, str]], int, int]:
    """Same one ephemeral UIAutomator read, mandatory deletion; M80 phase only."""
    global SNAPSHOT_DIAGNOSTIC
    SNAPSHOT_DIAGNOSTIC = "snapshot-screen-size-unconfirmed"
    try:
        width, height = BASE.screen_size()
        SNAPSHOT_DIAGNOSTIC = "snapshot-ui-tree-unconfirmed"
        nodes = BASE.xml_nodes()
        SNAPSHOT_DIAGNOSTIC = "snapshot-shape-unconfirmed"
        if not isinstance(nodes, list) or width <= 0 or height <= 0:
            raise RuntimeError("unsafe private snapshot")
        SNAPSHOT_DIAGNOSTIC = "snapshot-cleanup-unconfirmed"
        return nodes, width, height
    finally:
        # Always delete exactly as before, even if either read fails.
        try:
            BASE.adb("shell", "rm", "-f", "/sdcard/negresco_ui.xml", timeout=15)
        except Exception:
            SNAPSHOT_DIAGNOSTIC = "snapshot-cleanup-unconfirmed"
            raise
        else:
            if SNAPSHOT_DIAGNOSTIC == "snapshot-cleanup-unconfirmed":
                SNAPSHOT_DIAGNOSTIC = "snapshot-attested"


def pix_static_proven(nodes: object) -> bool:
    """Two exact public demo-page constants, no arbitrary text exported."""
    if type(nodes) is not list or not all(type(n) is dict for n in nodes):
        return False
    return all(
        sum(1 for n in nodes
            if n.get("package") == APP
            and n.get("class") == "android.widget.TextView"
            and n.get("text") == marker) == 1
        for marker in PIX_TEXTS
    )


def stable_app(expected_pid: str) -> None:
    if observer.debug_pid() != expected_pid or not observer.debug_focus():
        raise RuntimeError("Debug PID or foreground changed")


def guarded_preview_tap(point: tuple[int, int]) -> None:
    """Caller already proved this center using the pure M68 guard."""
    if (type(point) is not tuple or len(point) != 2
            or not all(type(v) is int and v > 0 for v in point)):
        raise RuntimeError("candidate invalid")
    BASE.adb("shell", "input", "tap", str(point[0]), str(point[1]), timeout=10)


def run_two_step_navigation() -> None:
    global RETURN_DIAGNOSTIC, PRE_PIX_DIAGNOSTIC, SNAPSHOT_DIAGNOSTIC
    RETURN_DIAGNOSTIC = "not-started"
    PRE_PIX_DIAGNOSTIC = "not-started"
    SNAPSHOT_DIAGNOSTIC = "not-started"
    # M64 Home census must pass first; it checks one snapshot, removes XML,
    # requires three bound targets and the three exact static Home markers.
    home.passive_home_census()
    STAGE.advance("home-attested")
    # M78: classify only the already-required pre-Pix gates.
    # No additional observation, input, timeout, recovery or raw value.
    try:
        pid = observer.debug_pid()
        stable_app(pid)
    except Exception:
        PRE_PIX_DIAGNOSTIC = "pre-pix-process-or-focus-unconfirmed"
        raise

    # 1st distinct snapshot: authorize ONLY the Pix preview target.
    try:
        nodes, width, height = private_snapshot()
    except Exception:
        PRE_PIX_DIAGNOSTIC = "pre-pix-snapshot-unconfirmed"
        raise
    try:
        category, pix_center = gate.select_preview_target(
            nodes, width, height, "home", "pix"
        )
    except Exception:
        PRE_PIX_DIAGNOSTIC = "pre-pix-classifier-unconfirmed"
        raise
    if category != gate.ELIGIBLE or pix_center is None:
        PRE_PIX_DIAGNOSTIC = "pre-pix-target-unconfirmed"
        raise RuntimeError("unsafe Pix candidate")
    PRE_PIX_DIAGNOSTIC = "pre-pix-target-attested"
    STAGE.advance("pix-candidate-attested")
    stable_app(pid)
    guarded_preview_tap(pix_center)  # precisely one Pix preview tap
    STAGE.advance("pix-input-command-returned")
    time.sleep(2.0)  # fixed settle, NOT a retry after failed evidence
    stable_app(pid)

    # 2nd distinct snapshot: require actual Pix preview page and strictly
    # authorize only the Home target before the second and final tap.
    nodes, width, height = private_snapshot()
    if not pix_static_proven(nodes):
        raise RuntimeError("Pix preview content not attested")
    STAGE.advance("pix-preview-content-attested")
    category, home_center = gate.select_preview_target(
        nodes, width, height, "pix", "home"
    )
    if category != gate.ELIGIBLE or home_center is None:
        raise RuntimeError("unsafe Home candidate")
    STAGE.advance("home-candidate-attested")
    stable_app(pid)
    guarded_preview_tap(home_center)  # precisely one Home return tap
    STAGE.advance("home-input-command-returned")
    RETURN_DIAGNOSTIC = "home-input-command-returned"
    time.sleep(2.0)  # same fixed wait as M75; never retry a failed observation
    try:
        stable_app(pid)
    except Exception:
        RETURN_DIAGNOSTIC = "post-home-process-or-focus-unconfirmed"
        raise

    # The SAME third and final snapshot, not a new or repeated UI read.
    try:
        nodes, width, height = private_snapshot()
    except Exception:
        RETURN_DIAGNOSTIC = "post-home-snapshot-unconfirmed"
        raise
    try:
        category, _ = gate.select_preview_target(
            nodes, width, height, "home", "pix"
        )
        nav, marker = counts.classify_snapshot(nodes, width, height)
        static, structure, _ = home.classify_readiness(nodes)
        RETURN_DIAGNOSTIC = return_diag.classify(
            nav, marker, static, structure, category
        )
    except Exception:
        RETURN_DIAGNOSTIC = "post-home-classifier-unconfirmed"
        raise
    if RETURN_DIAGNOSTIC != "post-home-attested":
        raise RuntimeError("final Home preview not attested")
    STAGE.advance("home-return-content-attested")
    try:
        stable_app(pid)
    except Exception:
        RETURN_DIAGNOSTIC = "post-home-process-or-focus-unconfirmed"
        raise
    STAGE.advance("sequence-complete")
    print("PASS (LAB): exactly two bounded preview taps Home-Pix-Home, same Debug PID",
          flush=True)


if __name__ == "__main__":
    try:
        if len(sys.argv) != 1:
            raise RuntimeError("unexpected M69 arguments")
        observer.run(after_verified_observation=run_two_step_navigation)
    except Exception:
        print("ENV (LAB): debug-nav-last-checkpoint=" + STAGE.category,
              flush=True)
        print(RESULT, file=sys.stderr)
        raise SystemExit(1)

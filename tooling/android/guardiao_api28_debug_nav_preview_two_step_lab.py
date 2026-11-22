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
from guardiao_api28_debug_nav_stage_ledger import StageLedger

BASE = observer.debug.base
PIX_TEXTS = ("TRANSFERÊNCIAS", "Pix do seu jeito.")
APP = observer.DEBUG_PACKAGE
RESULT = "BLOCK (LAB): guarded Debug Home-Pix-Home navigation not attested"
STAGE = StageLedger()  # fixed-category evidence only, no UI or device access


def private_snapshot() -> tuple[list[dict[str, str]], int, int]:
    """Exactly one ephemeral UIAutomator read, with deletion even on failure."""
    try:
        width, height = BASE.screen_size()
        nodes = BASE.xml_nodes()
        if not isinstance(nodes, list) or width <= 0 or height <= 0:
            raise RuntimeError("unsafe private snapshot")
        return nodes, width, height
    finally:
        BASE.adb("shell", "rm", "-f", "/sdcard/negresco_ui.xml", timeout=15)


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
    # M64 Home census must pass first; it checks one snapshot, removes XML,
    # requires three bound targets and the three exact static Home markers.
    home.passive_home_census()
    STAGE.advance("home-attested")
    pid = observer.debug_pid()
    stable_app(pid)

    # 1st distinct snapshot: authorize ONLY the Pix preview target.
    nodes, width, height = private_snapshot()
    category, pix_center = gate.select_preview_target(
        nodes, width, height, "home", "pix"
    )
    if category != gate.ELIGIBLE or pix_center is None:
        raise RuntimeError("unsafe Pix candidate")
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
    time.sleep(2.0)
    stable_app(pid)

    # 3rd and FINAL snapshot: Home returned with three eligible targets.
    nodes, width, height = private_snapshot()
    category, _ = gate.select_preview_target(
        nodes, width, height, "home", "pix"
    )
    nav, marker = counts.classify_snapshot(nodes, width, height)
    static, structure, _ = home.classify_readiness(nodes)
    if (category != gate.ELIGIBLE or nav != "tabs-present-bounded"
            or marker != "home-marker-unique"
            or static != "home-static-all"
            or structure != "app-text-and-clickable"):
        raise RuntimeError("final Home preview not attested")
    STAGE.advance("home-return-content-attested")
    stable_app(pid)
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

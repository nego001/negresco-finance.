#!/usr/bin/env python3
"""M63: classify exact Debug-only navigation ID counts after external PPP.

Read one private UIAutomator snapshot, no retries, gestures, PDF or user input.
Do not print raw XML, app text, arbitrary IDs, bounds, coordinates or PIDs.
"""
from __future__ import annotations

import sys
import guardiao_api28_debug_external_a11y_readonly_lab as observer
import guardiao_api28_debug_readonly_nav_geometry_lab as geometry

BASE = observer.debug.base
DEBUG = observer.debug
TARGETS = geometry.TARGETS
HOME_MARKER_PREFIX = "negresco-lab-rn-page-home-"

PRESENCE_CATEGORIES = frozenset((
    "no-debug-package-nodes",
    "tabs-all-missing",
    "tabs-one-missing",
    "tabs-two-missing",
    "tabs-duplicate",
    "tabs-present-bounded",
    "tabs-present-thin",
    "tabs-present-unsafe",
    "snapshot-unconfirmed",
))
HOME_CATEGORIES = frozenset((
    "home-marker-absent", "home-marker-unique", "home-marker-duplicate",
    "home-marker-unconfirmed",
))


def classify_snapshot(nodes: object, width: object, height: object) -> tuple[str, str]:
    """Inspect ONLY exact known testID presence and known package membership."""
    if (type(nodes) is not list or type(width) is not int
            or type(height) is not int or width <= 0 or height <= 0
            or len(nodes) > 20000 or not all(type(n) is dict for n in nodes)):
        return "snapshot-unconfirmed", "home-marker-unconfirmed"

    app_nodes = [
        n for n in nodes if n.get("package") == observer.DEBUG_PACKAGE
    ]
    if not app_nodes:
        return "no-debug-package-nodes", "home-marker-absent"

    # Strict fixed app-owned page-marker prefix, no text or arbitrary ID output.
    home_hits = sum(
        1 for n in app_nodes
        if type(n.get("resource-id", "")) is str
        and n.get("resource-id", "").rsplit("/", 1)[-1].startswith(
            HOME_MARKER_PREFIX
        )
    )
    home = ("home-marker-absent" if home_hits == 0 else
            "home-marker-unique" if home_hits == 1 else
            "home-marker-duplicate")

    counts = [
        sum(1 for n in nodes if DEBUG.safe_testid_matches(n, ident))
        for ident in TARGETS
    ]
    if any(n > 1 for n in counts):
        return "tabs-duplicate", home
    absent = sum(n == 0 for n in counts)
    if absent == 3:
        return "tabs-all-missing", home
    if absent == 2:
        return "tabs-two-missing", home
    if absent == 1:
        return "tabs-one-missing", home

    # Fully present IDs are STILL not approved unless original strict
    # independent geometry gate accepts each actual clickable bottom target.
    category = geometry.classify_three_tabs(nodes, width, height)
    if category == "three-bounded":
        return "tabs-present-bounded", home
    if category == "three-thin":
        return "tabs-present-thin", home
    return "tabs-present-unsafe", home


def passive_presence_diagnosis() -> None:
    state = "snapshot-unconfirmed"
    home = "home-marker-unconfirmed"
    try:
        width, height = BASE.screen_size()
        nodes = BASE.xml_nodes()
        state, home = classify_snapshot(nodes, width, height)
    except Exception:
        state = "snapshot-unconfirmed"
        home = "home-marker-unconfirmed"
    finally:
        # base.xml_nodes uses a temporary on-emulator XML path.
        # Explicit cleanup is mandatory even on snapshot/parse failure.
        try:
            BASE.adb("shell", "rm", "-f", "/sdcard/negresco_ui.xml", timeout=15)
        except Exception:
            state = "snapshot-unconfirmed"
            home = "home-marker-unconfirmed"

    print("ENV (LAB): debug-targetids=" + state, flush=True)
    print("ENV (LAB): debug-home-marker=" + home, flush=True)
    if state != "tabs-present-bounded":
        raise RuntimeError("M63 Debug tab geometry still not proven")
    print("PASS (LAB): three Debug nav targets independently bounded, read-only")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 1:
            raise RuntimeError("Unexpected M63 CLI input")
        observer.run(after_verified_observation=passive_presence_diagnosis)
    except Exception:
        print("BLOCK (LAB): M63 Debug tab target-id evidence incomplete",
              file=sys.stderr)
        raise SystemExit(1)

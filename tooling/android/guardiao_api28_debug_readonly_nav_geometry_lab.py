#!/usr/bin/env python3
"""M62: single read-only API28 Debug Home geometry snapshot after external PPP.

The existing observer must first attest three roots of the disposable Debug app
with a stable PID and focus. This diagnostic never sends gestures, creates PDFs,
retains device XML, prints node text, coordinates, filenames or other app data.
"""
from __future__ import annotations

import sys
import guardiao_api28_debug_external_a11y_readonly_lab as observer

DEBUG = observer.debug
BASE = DEBUG.base
TARGETS = (
    "negresco-lab-tab-home",
    "negresco-lab-tab-pix",
    "negresco-lab-tab-negresco",
)

CATEGORIES = frozenset((
    "three-bounded", "three-thin", "three-unsafe",
    "targets-overlap", "nodes-missing-or-duplicate",
    "package-unconfirmed", "clickability-unconfirmed",
    "geometry-unconfirmed",
))


def classify_three_tabs(nodes: object, width: object, height: object) -> str:
    """Pure categorical decision from ONE in-memory UIAutomator snapshot."""
    if (type(nodes) is not list or type(width) is not int
            or type(height) is not int or width <= 0 or height <= 0
            or len(nodes) > 20000):
        return "geometry-unconfirmed"

    rects: list[tuple[int, int, int, int]] = []
    states: list[str] = []
    for ident in TARGETS:
        matches = [
            n for n in nodes
            if type(n) is dict and DEBUG.safe_testid_matches(n, ident)
        ]
        if len(matches) != 1:
            return "nodes-missing-or-duplicate"
        target = matches[0]
        if target.get("package") != observer.DEBUG_PACKAGE:
            return "package-unconfirmed"
        if target.get("enabled") != "true" or target.get("clickable") != "true":
            return "clickability-unconfirmed"
        raw_bounds = target.get("bounds", "")
        if type(raw_bounds) is not str:
            return "geometry-unconfirmed"
        matched = BASE.BOUNDS.fullmatch(raw_bounds)
        if matched is None:
            return "geometry-unconfirmed"
        coordinates = tuple(map(int, matched.groups()))
        if len(coordinates) != 4:
            return "geometry-unconfirmed"
        rects.append(coordinates)
        states.append(DEBUG.home_geometry.safe_ancestor_constraint_category(
            raw_bounds, width, height
        ))

    if len(set(rects)) != len(TARGETS):
        return "targets-overlap"
    for i, a in enumerate(rects):
        for b in rects[i + 1:]:
            if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]:
                return "targets-overlap"

    if all(s == "geometry-eligible" for s in states):
        return "three-bounded"
    if all(s == "height-too-small" for s in states):
        return "three-thin"
    return "three-unsafe"


def passive_geometry_gate() -> None:
    """One snapshot only, no retry or second observation after unsafe geometry."""
    category = "geometry-unconfirmed"
    try:
        width, height = BASE.screen_size()
        nodes = BASE.xml_nodes()
        category = classify_three_tabs(nodes, width, height)
    except Exception:
        category = "geometry-unconfirmed"
    # No raw XML, coordinates, text, node IDs, paths, failures or PIDs leave memory.
    print("ENV (LAB): debug-nav-geometry=" + category, flush=True)
    if category != "three-bounded":
        raise RuntimeError("Debug navigation geometry not independently attested")
    print("PASS (LAB): three unique bounded clickable Debug tabs, no navigation")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 1:
            raise RuntimeError("unexpected geometry lab command arguments")
        observer.run(after_verified_observation=passive_geometry_gate)
    except Exception:
        print("BLOCK (LAB): Android9 Debug passive tab geometry not attested",
              file=sys.stderr)
        raise SystemExit(1)

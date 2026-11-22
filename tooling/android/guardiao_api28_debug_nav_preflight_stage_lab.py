#!/usr/bin/env python3
"""M70: read-only classification of pre-first-tap Home->Pix candidate on API28.

Never send taps, issue screen actions, print raw XML/text, bounds or PIDs.
Same Debug foreground/root and single-read fail-closed gates as M69.
"""
from __future__ import annotations

import sys
import guardiao_api28_debug_external_a11y_readonly_lab as observer
import guardiao_api28_debug_home_readiness_census_lab as home
import guardiao_api28_debug_nav_preview_guard as guard
import guardiao_api28_debug_nav_preview_two_step_lab as previous

BASE = observer.debug.base
PACKAGE = observer.DEBUG_PACKAGE
FIXED = frozenset((
    "snapshot-unconfirmed", "source-marker-missing-or-duplicate",
    "destination-marker-unexpected", "tab-id-missing-or-duplicate",
    "tab-package-mismatch", "tab-not-clickable-or-enabled",
    "tab-selected-state-mismatch", "tab-bounds-invalid",
    "tab-geometry-unsafe", "tab-targets-overlap",
    "clickable-occluder-or-unknown", "candidate-eligible",
))


def diagnosis(nodes: object, width: object, height: object) -> str:
    """Pure categorical breakdown of the M68 guard, never a tap authorization."""
    if (type(nodes) is not list or len(nodes) > 20000
            or not all(type(n) is dict for n in nodes)
            or type(width) is not int or type(height) is not int
            or width <= 0 or height <= 0):
        return "snapshot-unconfirmed"

    markers = {}
    for key, prefix in guard.PAGE_IDS.items():
        markers[key] = [n for n in nodes
                        if n.get("package") == PACKAGE
                        and type(n.get("resource-id")) is str
                        and n["resource-id"].rsplit("/", 1)[-1].startswith(prefix)]
    if len(markers["home"]) != 1:
        return "source-marker-missing-or-duplicate"
    if markers["pix"]:
        return "destination-marker-unexpected"

    rectangles = []
    for ident in guard.TARGETS:
        hits = [n for n in nodes
                if observer.debug.safe_testid_matches(n, ident)]
        if len(hits) != 1:
            return "tab-id-missing-or-duplicate"
        n = hits[0]
        if n.get("package") != PACKAGE:
            return "tab-package-mismatch"
        if n.get("clickable") != "true" or n.get("enabled") != "true":
            return "tab-not-clickable-or-enabled"
        expected = "true" if ident == guard.TARGET_NAMES["home"] else "false"
        if n.get("selected") != expected:
            return "tab-selected-state-mismatch"
        rect = guard._rectangle(n.get("bounds"))
        if rect is None:
            return "tab-bounds-invalid"
        if (guard.geometry.DEBUG.home_geometry.safe_ancestor_constraint_category(
                n.get("bounds"), width, height) != "geometry-eligible"):
            return "tab-geometry-unsafe"
        rectangles.append(rect)
    if len(set(rectangles)) != len(guard.TARGETS):
        return "tab-targets-overlap"
    for i, a in enumerate(rectangles):
        for b in rectangles[i + 1:]:
            if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]:
                return "tab-targets-overlap"

    # The final, unchanged M68 selector remains the ONLY arbiter. When all
    # preceding proof exists but it rejects, report only an inconclusive
    # clickable occluder / otherwise unsafe candidate category.
    label, center = guard.select_preview_target(
        nodes, width, height, "home", "pix"
    )
    if label != guard.ELIGIBLE or center is None:
        return "clickable-occluder-or-unknown"
    return "candidate-eligible"


def passive_preflight() -> None:
    # Home census enforces original strict, safe Debug bottom geometry and
    # its own temporary UIAutomator XML cleanup before this new snapshot.
    home.passive_home_census()
    pid = observer.debug_pid()
    if not pid or not observer.debug_focus():
        raise RuntimeError("Debug foreground not confirmed")
    state = "snapshot-unconfirmed"
    try:
        # M69 private_snapshot always deletes its on-device XML in finally.
        nodes, width, height = previous.private_snapshot()
        state = diagnosis(nodes, width, height)
    except Exception:
        state = "snapshot-unconfirmed"
    if observer.debug_pid() != pid or not observer.debug_focus():
        state = "snapshot-unconfirmed"

    if state not in FIXED:
        state = "snapshot-unconfirmed"
    print("ENV (LAB): debug-nav-first-candidate=" + state, flush=True)
    if state != "candidate-eligible":
        raise RuntimeError("initial Pix preview candidate not independently proven")
    print("PASS (LAB): Debug Pix target candidate eligible without gesture",
          flush=True)


if __name__ == "__main__":
    try:
        if len(sys.argv) != 1:
            raise RuntimeError("unexpected M70 argument")
        observer.run(after_verified_observation=passive_preflight)
    except Exception:
        print("BLOCK (LAB): M70 read-only Pix preflight not attested",
              file=sys.stderr)
        raise SystemExit(1)

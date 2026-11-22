#!/usr/bin/env python3
"""M68 staging: PURE read-only authorization guard for eventual Debug Home<->Pix.

There are no ADB, navigation, touch, XML snapshot, or logging functions here.
An eligible classification is an IN-MEMORY candidate, never proof of a tap.
"""
from __future__ import annotations

import guardiao_api28_debug_external_a11y_readonly_lab as observer
import guardiao_api28_debug_readonly_nav_geometry_lab as geometry

PACKAGE = observer.DEBUG_PACKAGE
TARGETS = geometry.TARGETS
HOME_ID = "negresco-lab-rn-page-home-pressin-"
PIX_ID = "negresco-lab-rn-page-pix-pressin-"
PAGE_IDS = {"home": HOME_ID, "pix": PIX_ID}
TARGET_NAMES = {"home": TARGETS[0], "pix": TARGETS[1]}
BOUNDS = observer.debug.base.BOUNDS
ELIGIBLE = "eligible-candidate-only"
BLOCK = "blocked-ambiguous-or-unsafe"


def _rectangle(raw: object) -> tuple[int, int, int, int] | None:
    if type(raw) is not str:
        return None
    matched = BOUNDS.fullmatch(raw)
    if not matched:
        return None
    rect = tuple(int(v) for v in matched.groups())
    return rect if len(rect) == 4 else None


def select_preview_target(
    nodes: object, width: object, height: object, source: str, target: str
) -> tuple[str, tuple[int, int] | None]:
    """Require exactly three valid native targets and unambiguous RN page state.

    This function does not touch the screen. The returned center exists only
    in the private caller's memory. NEVER log, save or send coordinates.
    """
    reject = (BLOCK, None)
    if (type(nodes) is not list or not all(type(x) is dict for x in nodes)
            or len(nodes) > 20000
            or not all(type(n.get('resource-id','')) is str for n in nodes)
            or type(width) is not int
            or type(height) is not int or width <= 0 or height <= 0
            or type(source) is not str or type(target) is not str
            or source not in PAGE_IDS or target not in PAGE_IDS
            or source == target):
        return reject

    # Identify the app-owned source page by a fixed source-defined testID,
    # ignoring all arbitrary text and content descriptions.
    page_hits = {
        name: [n for n in nodes
               if n.get("package") == PACKAGE
               and type(n.get("resource-id")) is str
               and n["resource-id"].rsplit("/", 1)[-1].startswith(prefix)]
        for name, prefix in PAGE_IDS.items()
    }
    if len(page_hits[source]) != 1 or page_hits[target]:
        return reject

    actual = {}
    rects = {}
    for key in TARGETS:
        matching = [n for n in nodes
                    if observer.debug.safe_testid_matches(n, key)]
        if len(matching) != 1:
            return reject
        n = matching[0]
        if (n.get("package") != PACKAGE or n.get("enabled") != "true"
                or n.get("clickable") != "true"):
            return reject
        expected_selection = "true" if key == TARGET_NAMES[source] else "false"
        if n.get("selected") != expected_selection:
            return reject
        raw = n.get("bounds")
        if geometry.DEBUG.home_geometry.safe_ancestor_constraint_category(
                raw, width, height) != "geometry-eligible":
            return reject
        r = _rectangle(raw)
        if r is None:
            return reject
        actual[key], rects[key] = n, r

    if len(set(rects.values())) != len(TARGETS):
        return reject
    for i, a in enumerate(rects.values()):
        for b in list(rects.values())[i + 1:]:
            if (a[0] < b[2] and b[0] < a[2]
                    and a[1] < b[3] and b[1] < a[3]):
                return reject

    desired = TARGET_NAMES[target]
    x1, y1, x2, y2 = rects[desired]
    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    # Fail closed for any other enabled clickable node covering this point.
    # This is not a complete z-order proof, merely a conservative rejection.
    for node in nodes:
        if node is actual[desired]:
            continue
        if node.get("enabled") != "true" or node.get("clickable") != "true":
            continue
        other = _rectangle(node.get("bounds"))
        if other is None:
            return reject
        if other[0] <= cx <= other[2] and other[1] <= cy <= other[3]:
            return reject
    return (ELIGIBLE, (cx, cy))

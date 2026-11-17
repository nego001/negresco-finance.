#!/usr/bin/env python3
"""Passive shape categories for framework-owned nodes on Android 9.

Runs on the SAME previously captured accessibility nodes. Outputs fixed
categories only, never UI XML, data, resource IDs, node counts or coordinates.
Original double-snapshot acceptance remains the only navigation authority.
"""
from __future__ import annotations
import sys
import guardiao_v5_api28_foreign_surface_snapshots_lab as prior

SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
BLOCK = "BLOCK (LAB): Android9 framework geometry incomplete"
UNKNOWN = ("unconfirmed",) * 7


def presence(flag: bool) -> str:
    return "present" if flag else "absent"


def classify(nodes: object, width: object, height: object) -> tuple[str, ...]:
    """Summarize Android framework node structure, never infer window identity.

    Output order: framework presence, framework TextView, button, clickable,
    focused, resource-id, and coarse maximal visible rectangle.
    """
    if (type(nodes) is not list or len(nodes) > 2500
            or type(width) is not int or type(height) is not int
            or not (200 <= width <= 5000 and 200 <= height <= 5000)):
        return UNKNOWN
    if any(type(n) is not dict for n in nodes):
        return UNKNOWN
    subset = [n for n in nodes if n.get("package") == "android"]
    if not subset:
        return ("absent",) * 7
    text = button = clickable = focused = rid = valid_rect = large_rect = False
    matcher = prior.scope.existing.scoped.BASE.BOUNDS
    for n in subset:
        clazz = n.get("class")
        text = text or clazz == "android.widget.TextView"
        button = button or clazz in ("android.widget.Button", "android.widget.ImageButton")
        clickable = clickable or n.get("clickable") == "true"
        focused = focused or n.get("focused") == "true"
        resource = n.get("resource-id")
        rid = rid or (type(resource) is str and
            (resource.startswith("android:id/") or
             resource.startswith("com.android.internal:id/")))
        bound = n.get("bounds")
        if type(bound) is not str or len(bound) > 96:
            continue
        rect = matcher.fullmatch(bound)
        if rect is None:
            continue
        x1, y1, x2, y2 = map(int, rect.groups())
        if not (0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height):
            continue
        valid_rect = True
        if (x2 - x1) * (y2 - y1) * 5 >= (width * height * 3):
            large_rect = True
    area = "large-node-present" if large_rect else (
        "bounded-nodes-only" if valid_rect else "bounds-unconfirmed")
    return ("present", presence(text), presence(button), presence(clickable),
            presence(focused), presence(rid), area)


def run() -> None:
    if len(sys.argv) != 1 or prior.SHA != SHA:
        raise RuntimeError("candidate hash rejected")
    original = prior.classify

    def observe_existing_nodes(nodes, width, height):
        a, b, c, d, e, f, g = classify(nodes, width, height)
        print("ENV (LAB): framework-nodes=" + a +
              " framework-text=" + b +
              " framework-buttons=" + c +
              " framework-clickable=" + d +
              " framework-focused=" + e +
              " framework-resource=" + f +
              " framework-area=" + g, flush=True)
        return original(nodes, width, height)

    prior.classify = observe_existing_nodes
    try:
        prior.run()
    finally:
        prior.classify = original


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print(BLOCK, file=sys.stderr, flush=True)
        raise SystemExit(1)

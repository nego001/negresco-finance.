#!/usr/bin/env python3
"""Observe fixed framework resource hints in existing Android 9 UI snapshots.

Never interpret a hint as proof of a foreground chooser. Does not read any
additional UI, change timing or gestures, or alter the original verifier.
"""
from __future__ import annotations

import sys
import guardiao_v5_api28_framework_node_shapes_lab as previous

SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
BLOCK = "BLOCK (LAB): Android9 framework resource signals not verified"
UNKNOWN = ("unconfirmed",) * 6
PREFIXES = ("android:id/", "com.android.internal:id/")
RESOLVER = frozenset(("resolver_list", "resolver_empty", "resolver_empty_state_container",
                      "resolver_tab_divider"))
CHOOSER = frozenset(("chooser_grid", "chooser_header", "chooser_row", "chooser_target",
                     "content_preview_container", "chooser_scrollable_container"))
DIALOG = frozenset(("parentPanel", "contentPanel", "alertTitle",
                    "button1", "button2", "button3"))
LISTS = frozenset(("android.widget.ListView", "android.widget.GridView",
                   "android.widget.AbsListView",
                   "androidx.recyclerview.widget.RecyclerView"))
CHOICES = frozenset(("android.widget.RadioButton", "android.widget.CheckedTextView",
                     "android.widget.CheckBox"))


def resource_key(value: object) -> str:
    if type(value) is not str or len(value) > 160:
        return ""
    return next((value[len(prefix):] for prefix in PREFIXES
                 if value.startswith(prefix)), "")


def flag(value: bool) -> str:
    return "present" if value else "absent"


def classify(nodes: object, width: object, height: object) -> tuple[str, ...]:
    """Fixed-only structural hints; no raw IDs, labels or package output."""
    if (type(nodes) is not list or len(nodes) > 2500
            or type(width) is not int or type(height) is not int
            or not (200 <= width <= 5000 and 200 <= height <= 5000)):
        return UNKNOWN
    if any(type(n) is not dict for n in nodes):
        return UNKNOWN
    framework = [n for n in nodes if n.get("package") == "android"]
    if not framework:
        return ("absent",) * 5 + ("none",)
    resolver = chooser = dialog = listlike = choice = False
    clicks = 0
    for node in framework:
        key = resource_key(node.get("resource-id"))
        kind = node.get("class")
        resolver = resolver or key in RESOLVER
        chooser = chooser or key in CHOOSER
        dialog = dialog or key in DIALOG
        listlike = listlike or kind in LISTS
        choice = choice or kind in CHOICES
        if node.get("clickable") == "true":
            clicks += 1
    return (flag(resolver), flag(chooser), flag(dialog), flag(listlike),
            flag(choice), "none" if clicks == 0 else
            "one" if clicks == 1 else "multiple")


def run() -> None:
    if len(sys.argv) != 1 or previous.SHA != SHA:
        raise RuntimeError("pinned candidate identity rejected")
    original = previous.classify

    def classify_existing(nodes, width, height):
        r, c, d, l, a, t = classify(nodes, width, height)
        print("ENV (LAB): framework-resolver-id=" + r +
              " framework-chooser-id=" + c +
              " framework-dialog-id=" + d +
              " framework-listlike=" + l +
              " framework-choice-control=" + a +
              " framework-click-targets=" + t, flush=True)
        return original(nodes, width, height)

    previous.classify = classify_existing
    try:
        previous.run()
    finally:
        previous.classify = original


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print(BLOCK, file=sys.stderr, flush=True)
        raise SystemExit(1)

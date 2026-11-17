#!/usr/bin/env python3
"""Read-only Android9 accessibility-tree scope diagnosis on pinned v5 APK.

Classifies the SAME in-memory nodes consumed by the cardinality and strict
two-snapshot gates. Does not perform any new adb/UI reads, add waits or gestures,
or change the original acceptance verdict. Outputs fixed categories only.
"""
from __future__ import annotations

import sys
import guardiao_v5_api28_home_cardinality_snapshots_lab as existing

SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
BLOCK = "BLOCK (LAB): Android9 accessibility-tree scope unverified"
UNKNOWN = ("unconfirmed",) * 6


def presence(value: bool) -> str:
    return "present" if value else "absent"


def classify(nodes: object, width: object, height: object) -> tuple[str, ...]:
    """Only bounded booleans: global tree, own app, app labels and other nodes.

    The app-other-text category sees only whether any app TextView has nonempty
    text/description other than the three static navigation labels. No user
    content, coordinates, package names or node counts are ever serialized.
    """
    if (type(nodes) is not list or len(nodes) > 2500
            or type(width) is not int or type(height) is not int
            or not (200 <= width <= 5000 and 200 <= height <= 5000)):
        return UNKNOWN
    if any(type(node) is not dict for node in nodes):
        return UNKNOWN
    if not nodes:
        return ("empty", "absent", "absent", "absent", "absent", "absent")

    app = text = other_text = nonapp = nontext = False
    for node in nodes:
        if node.get("package") != existing.scoped.BASE.PACKAGE:
            nonapp = True
            continue
        app = True
        if node.get("class") == "android.widget.TextView":
            text = True
            label = node.get("text")
            desc = node.get("content-desc")
            if ((type(label) is str and bool(label) and label not in existing.NAMES)
                    or (type(desc) is str and bool(desc) and desc not in existing.NAMES)):
                other_text = True
        else:
            nontext = True
    return ("nonempty", presence(app), presence(text), presence(other_text),
            presence(nonapp), presence(nontext))


def run() -> None:
    if len(sys.argv) != 1 or existing.SHA != SHA:
        raise RuntimeError("candidate identity rejected")
    original = existing.classify

    def describe_read_only(nodes, width, height):
        tree, app, app_text, app_other, nonapp, app_nontext = classify(
            nodes, width, height)
        print("ENV (LAB): tree=" + tree + " app=" + app +
              " app-text=" + app_text + " app-other-text=" + app_other +
              " nonapp=" + nonapp + " app-nontext=" + app_nontext,
              flush=True)
        return original(nodes, width, height)

    existing.classify = describe_read_only
    try:
        existing.run()
    finally:
        existing.classify = original


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print(BLOCK, file=sys.stderr, flush=True)
        raise SystemExit(1)

#!/usr/bin/env python3
"""Read-only foreign-surface ownership classification on existing Android9 nodes.

This wrapper adds no adb/UI read, gesture, delay, reinstallation, retry, or
alternate approval. It does not log package names, raw UI, private data or PDFs.
"""
from __future__ import annotations

import sys
import guardiao_v5_api28_tree_scope_snapshots_lab as scope

SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
BLOCK = "BLOCK (LAB): Android9 foreign-surface ownership not verified"
UNKNOWN = ("unconfirmed",) * 7
RECEIVER = "com.negresco.pdfreceiver.lab"
FRAMEWORK = frozenset(("android",))
SYSTEM_UI = frozenset(("com.android.systemui",))
LAUNCHER = frozenset(("com.android.launcher3", "com.google.android.apps.nexuslauncher"))
IME = frozenset(("com.google.android.inputmethod.latin", "com.android.inputmethod.latin"))
DOCUMENTS = frozenset(("com.google.android.documentsui", "com.android.documentsui"))
CLASSES = ("receiver", "framework", "systemui", "launcher", "ime", "documents", "other")


def classify(nodes: object, width: object, height: object) -> tuple[str, ...]:
    if (type(nodes) is not list or len(nodes) > 2500
            or type(width) is not int or type(height) is not int
            or not (200 <= width <= 5000 and 200 <= height <= 5000)):
        return UNKNOWN
    found = {item: False for item in CLASSES}
    for node in nodes:
        if type(node) is not dict:
            return UNKNOWN
        package = node.get("package")
        if type(package) is not str or not (1 <= len(package) <= 150):
            return UNKNOWN
        if package == scope.existing.scoped.BASE.PACKAGE:
            continue
        if package == RECEIVER:
            found["receiver"] = True
        elif package in FRAMEWORK:
            found["framework"] = True
        elif package in SYSTEM_UI:
            found["systemui"] = True
        elif package in LAUNCHER:
            found["launcher"] = True
        elif package in IME:
            found["ime"] = True
        elif package in DOCUMENTS:
            found["documents"] = True
        else:
            found["other"] = True
    return tuple("present" if found[name] else "absent" for name in CLASSES)


def run() -> None:
    if len(sys.argv) != 1 or scope.SHA != SHA:
        raise RuntimeError("test APK identity rejected")
    original = scope.classify

    def classify_existing_nodes(nodes, width, height):
        values = classify(nodes, width, height)
        print("ENV (LAB): foreign-receiver=" + values[0] +
              " foreign-framework=" + values[1] +
              " foreign-systemui=" + values[2] +
              " foreign-launcher=" + values[3] +
              " foreign-ime=" + values[4] +
              " foreign-documents=" + values[5] +
              " foreign-other=" + values[6], flush=True)
        return original(nodes, width, height)

    scope.classify = classify_existing_nodes
    try:
        scope.run()
    finally:
        scope.classify = original


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print(BLOCK, file=sys.stderr, flush=True)
        raise SystemExit(1)

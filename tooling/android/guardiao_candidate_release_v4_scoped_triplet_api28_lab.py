#!/usr/bin/env python3
"""Read-only, fail-closed three-tab proof for pinned v4 Android 9 candidate.

Exact names and geometric relationships only. Never output UI XML, positions,
process identifiers, finance values, PDF contents, or Android runtime errors.
This script NEVER performs input tap/swipe/BACK/force-stop, even after PASS.
"""
from __future__ import annotations

import sys

import guardiao_candidate_release_root_v4_api28_pdf_lab as candidate
import guardiao_original_release_same_process_lab as home
import guardiao_android_export_pdf_text_emulator_smoke as semantic

BASE = candidate.BASE
PASS = "scoped-three-tabs-verified"
NAMES = ("Início", "Pix", "Negresco")


def scoped_triplet_category(nodes: object, width: object, height: object) -> str:
    if (type(nodes) is not list or len(nodes) > 2500
            or type(width) is not int or type(height) is not int
            or not (200 <= width <= 5000 and 200 <= height <= 5000)):
        return "invalid-input"
    if home.safe_home_layout_snapshot_category(nodes, width, height) != "home-label-bounded":
        return "home-not-bounded"
    package = BASE.PACKAGE
    if type(package) is not str or not package:
        return "package-unconfirmed"
    rectangles: list[tuple[int, int, int, int]] = []

    for name in NAMES:
        choices = []
        for node in nodes:
            if type(node) is not dict:
                return "malformed-node"
            if (node.get("class") != "android.widget.TextView"
                    or node.get("enabled") != "true"
                    or node.get("package") != package
                    or not (node.get("text") == name
                            or node.get("content-desc") == name)):
                continue
            label = BASE.BOUNDS.fullmatch(node.get("bounds", ""))
            if label is None:
                return "label-bounds-unconfirmed"
            bounds = tuple(map(int, label.groups()))
            lx1, ly1, lx2, ly2 = bounds
            if not (0 <= lx1 < lx2 <= width and 0 <= ly1 < ly2 <= height):
                return "label-bounds-invalid"
            if home.safe_bounds_shape(node["bounds"], width, height) != "on-bottom-band":
                # Ignore the distinct Pix shortcut in Home content.
                continue
            choices.append(node)
        # No bypass for duplicate or absent labels in bottom region.
        if len(choices) != 1:
            return "bottom-label-not-unique"
        selected = choices[0]
        raw = selected.get("_tap_bounds", "")
        if home.safe_ancestor_constraint_category(raw, width, height) != "geometry-eligible":
            return "parent-not-eligible"
        parent_bounds = BASE.BOUNDS.fullmatch(raw)
        if parent_bounds is None:
            return "parent-bounds-unconfirmed"
        rect = tuple(map(int, parent_bounds.groups()))
        label_rect = tuple(map(int, BASE.BOUNDS.fullmatch(selected["bounds"]).groups()))
        x1, y1, x2, y2 = rect
        a, b, c, d = label_rect
        if not (x1 <= a < c <= x2 and y1 <= b < d <= y2):
            return "label-not-in-parent"
        parents = [
            item for item in nodes
            if type(item) is dict
            and item.get("bounds") == raw
            and item.get("_tap_bounds") == raw
            and item.get("package") == package
            and item.get("clickable") == "true"
            and item.get("enabled") == "true"
        ]
        if len(parents) != 1:
            return "clickable-parent-not-unique"

        # A second clickable surface over the center makes the target unsafe.
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        for item in nodes:
            if item is parents[0] or type(item) is not dict:
                continue
            if item.get("clickable") != "true":
                continue
            overlap = BASE.BOUNDS.fullmatch(item.get("bounds", ""))
            if overlap is None:
                continue
            ox1, oy1, ox2, oy2 = map(int, overlap.groups())
            if ox1 <= cx <= ox2 and oy1 <= cy <= oy2:
                return "parent-center-overlapped"
        rectangles.append(rect)

    # Ordered horizontal cells, nonoverlapping and aligned in one bottom row.
    if len(set(rectangles)) != 3:
        return "duplicate-parent"
    if not (rectangles[0][2] <= rectangles[1][0]
            and rectangles[1][2] <= rectangles[2][0]):
        return "horizontal-overlap-or-order"
    centers = [(r[1] + r[3]) // 2 for r in rectangles]
    min_height = min(r[3] - r[1] for r in rectangles)
    if max(centers) - min(centers) > min_height // 3:
        return "rows-not-aligned"
    return PASS


def run() -> None:
    if len(sys.argv) != 1 or not candidate.candidate_identity(candidate.APK):
        raise RuntimeError("pinned candidate identity rejected")
    if (BASE.adb("shell", "getprop", "ro.build.version.sdk", timeout=15).strip() != "28"
            or semantic.REPORT.exists() or BASE.REPORT.exists()):
        raise RuntimeError("environment or stale receipt rejected")
    BASE.APK, BASE.EXPECTED_SHA = candidate.APK, candidate.PINNED_CANDIDATE
    BASE.adb("install", "-r", str(candidate.APK), timeout=150)
    result = BASE.adb("shell", "monkey", "-p", BASE.PACKAGE,
                      "-c", "android.intent.category.LAUNCHER", "1", timeout=30)
    if "Events injected: 1" not in result:
        raise RuntimeError("launcher entry rejected")
    BASE.wait_visible("Seu universo", retries=45)
    pid = home.observed_single_app_pid()
    if not pid:
        raise RuntimeError("single process identity unconfirmed")
    width, height = BASE.screen_size()
    first = scoped_triplet_category(BASE.xml_nodes(), width, height)
    second = scoped_triplet_category(BASE.xml_nodes(), width, height)
    print("ENV (LAB): scoped-triplet-first=" + first, flush=True)
    print("ENV (LAB): scoped-triplet-second=" + second, flush=True)
    if home.observed_single_app_pid() != pid:
        raise RuntimeError("process identity changed")
    if first != PASS or second != PASS:
        raise RuntimeError("three-tab scoped bottom geometry unverified")
    if BASE.lookup("Gerar e compartilhar relatório PDF") is not None:
        raise RuntimeError("unexpected PDF screen")
    if home.observed_single_app_pid() != pid:
        raise RuntimeError("process identity changed during passive audit")
    print("PASS (LAB): two independent read-only bottom triplet observations", flush=True)
    print("PASS (LAB): no tap, payment, PDF, old Release swap or production approval", flush=True)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print("BLOCK (LAB): scoped three-tab Android9 candidate proof incomplete",
              file=sys.stderr)
        raise SystemExit(1)

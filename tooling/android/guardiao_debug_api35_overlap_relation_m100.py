#!/usr/bin/env python3
"""M100: private parent links and first existing blocker classification only."""
from __future__ import annotations
import os
from pathlib import Path
import sys
from guardiao_debug_api35_target_guard_m99 import APP, OBSERVER, GUARD, m91_pure, organized_transform, guard_transform

LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-overlap-relation-m100-v1"
BASE = Path("tooling/android/guardiao_pdf_ui_emulator_smoke.py")
OLD_XML = "def xml_nodes() -> list[dict[str, str]]:\n    # Never print or upload raw UI hierarchy. Tap clickable ancestor for text labels.\n    adb(\"shell\", \"uiautomator\", \"dump\", \"/sdcard/negresco_ui.xml\", timeout=35)\n    raw = adb(\"exec-out\", \"cat\", \"/sdcard/negresco_ui.xml\", timeout=12)\n    root = ET.fromstring(raw.lstrip(\"\\ufeff\"))\n    found: list[dict[str, str]] = []\n    def visit(item: ET.Element, nearest_click: dict[str, str] | None = None) -> None:\n        props = dict(item.attrib)\n        if props.get(\"clickable\") == \"true\" and props.get(\"enabled\") == \"true\":\n            nearest_click = props\n        if item.tag == \"node\":\n            props[\"_tap_bounds\"] = (nearest_click or props).get(\"bounds\", \"\")\n            found.append(props)\n        for child in item:\n            visit(child, nearest_click)\n    visit(root)\n    return found"
NEW_XML = "def xml_nodes() -> list[dict[str, str]]:\n    # Never print or upload raw UI hierarchy. Tap clickable ancestor for text labels.\n    adb(\"shell\", \"uiautomator\", \"dump\", \"/sdcard/negresco_ui.xml\", timeout=35)\n    raw = adb(\"exec-out\", \"cat\", \"/sdcard/negresco_ui.xml\", timeout=12)\n    root = ET.fromstring(raw.lstrip(\"\\ufeff\"))\n    found: list[dict[str, str]] = []\n    def visit(item: ET.Element, nearest_click: dict[str, str] | None = None, parent: int = -1) -> None:\n        props = dict(item.attrib)\n        if props.get(\"clickable\") == \"true\" and props.get(\"enabled\") == \"true\":\n            nearest_click = props\n        if item.tag == \"node\":\n            props[\"_tap_bounds\"] = (nearest_click or props).get(\"bounds\", \"\")\n            props['_m100_parent'] = str(parent)\n            parent = len(found)\n            found.append(props)\n        for child in item:\n            visit(child, nearest_click, parent)\n    visit(root)\n    return found"
OLD = "            print(\"ENV (LAB): m99-target-guard=other-clickable-covers-center\", flush=True)\n            return reject"
NEW = "            print(\"ENV (LAB): m99-target-guard=other-clickable-covers-center\", flush=True)\n            _m100_report_overlap(nodes, actual[desired], node, rects[desired], other)\n            return reject"
HELPER = "\ndef _m100_relation(nodes, target, blocker):\n    \"\"\"Read private parent indexes only; reject inconsistent chains.\"\"\"\n    import re\n    positions = {id(n): i for i, n in enumerate(nodes)}\n    if len(positions) != len(nodes):\n        return \"relation-unconfirmed\"\n    def parents(node):\n        chain = set()\n        i = positions.get(id(node), -1)\n        if i < 0:\n            return None\n        while True:\n            raw = nodes[i].get(\"_m100_parent\")\n            if type(raw) is not str or not re.fullmatch(r\"-1|[0-9]{1,5}\", raw):\n                return None\n            parent = int(raw)\n            if parent == -1:\n                return chain\n            if not 0 <= parent < i:\n                return None\n            chain.add(parent)\n            i = parent\n    tp, bp = parents(target), parents(blocker)\n    if tp is None or bp is None:\n        return \"relation-unconfirmed\"\n    if positions[id(blocker)] in tp:\n        return \"blocker-ancestor\"\n    if positions[id(target)] in bp:\n        return \"blocker-descendant\"\n    return \"separate-branch\"\n\ndef _m100_report_overlap(nodes, target, blocker, rect, other):\n    # Diagnostic only, no raw identifiers, bounds or arbitrary class output.\n    try:\n        relation = _m100_relation(nodes, target, blocker)\n        owner = \"app-owned\" if blocker.get(\"package\") == PACKAGE else \"not-app-owned\"\n        kind = blocker.get(\"class\")\n        klass = (\"view\" if kind == \"android.view.View\" else\n                 \"viewgroup\" if kind == \"android.view.ViewGroup\" else\n                 \"scroll\" if kind in (\"android.widget.ScrollView\", \"android.widget.HorizontalScrollView\") else\n                 \"button\" if kind == \"android.widget.Button\" else\n                 \"other-class\")\n        ident = blocker.get(\"resource-id\", \"\").rsplit(\"/\", 1)[-1]\n        identity = (\"source-page-marker\" if any(ident.startswith(p) for p in PAGE_IDS.values()) else\n                    \"known-tab\" if any(observer.debug.safe_testid_matches(blocker, k) for k in TARGETS) else\n                    \"quick-pix\" if ident.startswith(\"negresco-lab-quick-pix-layout-\") else\n                    \"empty-id\" if not ident else \"other-id\")\n        shape = (\"same-rectangle\" if other == rect else\n                 \"contains-target\" if other[0] <= rect[0] and other[1] <= rect[1] and other[2] >= rect[2] and other[3] >= rect[3] else\n                 \"inside-target\" if rect[0] <= other[0] and rect[1] <= other[1] and rect[2] >= other[2] and rect[3] >= other[3] else\n                 \"partial-overlap\")\n        for key, value in ((\"relation\", relation), (\"owner\", owner), (\"class\", klass), (\"identity\", identity), (\"shape\", shape)):\n            print(\"ENV (LAB): m100-overlap-\" + key + \"=\" + value, flush=True)\n    except Exception:\n        print(\"ENV (LAB): m100-overlap-diagnostic=unconfirmed\", flush=True)\n"

def xml_transform(source: str) -> str:
    if source.count(OLD_XML) != 1 or NEW_XML in source:
        raise RuntimeError("original snapshot reader not attested")
    changed = source.replace(OLD_XML, NEW_XML)
    if changed.replace(NEW_XML, OLD_XML) != source:
        raise RuntimeError("nonisolated snapshot metadata")
    return changed

def overlap_transform(source: str) -> str:
    control = guard_transform(source)
    if control.count(OLD) != 1 or NEW in control or HELPER in control:
        raise RuntimeError("original overlap rejection not attested")
    changed = control.replace(OLD, NEW) + HELPER
    if changed.removesuffix(HELPER).replace(NEW, OLD) != control:
        raise RuntimeError("nonisolated overlap diagnostic")
    return changed

def apply(api: str) -> None:
    if api != "35":
        raise RuntimeError("M100 exact API35 required")
    paths = (APP, OBSERVER, GUARD, BASE)
    if any(not p.is_file() or p.is_symlink() for p in paths):
        raise RuntimeError("unexpected source path")
    contents = (m91_pure(APP.read_text(encoding="utf-8")),
                organized_transform(OBSERVER.read_text(encoding="utf-8"), api),
                overlap_transform(GUARD.read_text(encoding="utf-8")),
                xml_transform(BASE.read_text(encoding="utf-8")))
    for path, content in zip(paths, contents):
        path.write_text(content, encoding="utf-8")
        if path.read_text(encoding="utf-8") != content:
            raise RuntimeError("temporary source not attested")

if __name__ == "__main__":
    try:
        if (sys.argv != [sys.argv[0], "apply"]
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != LAB_REF):
            raise RuntimeError("unrecognized M100 branch")
        apply(os.environ.get("M93_EXPECTED_API"))
        print("PASS (LAB): M100 exact M99 control plus private overlap relation", flush=True)
    except Exception:
        print("BLOCK (LAB): M100 scoped overlap diagnostic not attested", file=sys.stderr)
        raise SystemExit(1)

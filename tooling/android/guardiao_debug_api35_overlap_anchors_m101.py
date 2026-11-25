#!/usr/bin/env python3
"""M101: existing source-defined anchor relations, original reject unchanged."""
from __future__ import annotations
import os
import sys
from guardiao_debug_api35_overlap_relation_m100 import APP, OBSERVER, GUARD, BASE, m91_pure, organized_transform, overlap_transform, xml_transform

LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-overlap-anchors-m101-v1"
OLD = "            _m100_report_overlap(nodes, actual[desired], node, rects[desired], other)\n            return reject"
NEW = "            _m100_report_overlap(nodes, actual[desired], node, rects[desired], other)\n            _m101_report_anchors(nodes, actual[desired], node)\n            return reject"
HELPER = "\ndef _m101_anchor_relation(nodes, blocker, hits):\n    if not hits:\n        return \"anchor-absent\"\n    if len(hits) != 1:\n        return \"anchor-ambiguous\"\n    anchor = hits[0]\n    if anchor is blocker:\n        return \"same-node\"\n    return _m100_relation(nodes, anchor, blocker)\n\ndef _m101_report_anchors(nodes, target, blocker):\n    \"\"\"Classify only existing known anchor relations; never infer touch order.\"\"\"\n    try:\n        owned = [n for n in nodes if n.get(\"package\") == PACKAGE]\n        def ident(n):\n            return n.get(\"resource-id\", \"\").rsplit(\"/\", 1)[-1]\n        anchors = (\n            (\"page-header\", [n for n in owned if any(ident(n).startswith(p) for p in PAGE_IDS.values())]),\n            (\"quick-pix\", [n for n in owned if ident(n).startswith(\"negresco-lab-quick-pix-layout-\")]),\n            (\"home-tab\", [n for n in owned if observer.debug.safe_testid_matches(n, TARGETS[0])]),\n            (\"pix-tab\", [n for n in owned if observer.debug.safe_testid_matches(n, TARGETS[1])]),\n            (\"negresco-tab\", [n for n in owned if observer.debug.safe_testid_matches(n, TARGETS[2])]),\n        )\n        for key, hits in anchors:\n            print(\"ENV (LAB): m101-anchor-\" + key + \"=\" + _m101_anchor_relation(nodes, blocker, hits), flush=True)\n        # Distinguish a shared immediate parent from a distinct subtree.\n        # Parent indexes are internal only and must already be validated.\n        relation = _m100_relation(nodes, target, blocker)\n        category = \"parent-relation-unconfirmed\"\n        if relation == \"separate-branch\":\n            a, b = target.get(\"_m100_parent\"), blocker.get(\"_m100_parent\")\n            category = (\"same-immediate-parent\" if a == b and a != \"-1\" else\n                        \"distinct-immediate-parent\" if a != b else \"separate-root\")\n        print(\"ENV (LAB): m101-anchor-parent=\" + category, flush=True)\n    except Exception:\n        print(\"ENV (LAB): m101-anchor-diagnostic=unconfirmed\", flush=True)\n"

def anchors_transform(source: str) -> str:
    control = overlap_transform(source)
    if control.count(OLD) != 1 or NEW in control or HELPER in control:
        raise RuntimeError("original overlap anchor not attested")
    changed = control.replace(OLD, NEW) + HELPER
    if changed.removesuffix(HELPER).replace(NEW, OLD) != control:
        raise RuntimeError("nonisolated anchor diagnostic")
    return changed

def apply(api: str) -> None:
    if api != "35":
        raise RuntimeError("M101 exact API35 required")
    paths = (APP, OBSERVER, GUARD, BASE)
    if any(not p.is_file() or p.is_symlink() for p in paths):
        raise RuntimeError("unexpected source path")
    contents = (m91_pure(APP.read_text(encoding="utf-8")),
                organized_transform(OBSERVER.read_text(encoding="utf-8"), api),
                anchors_transform(GUARD.read_text(encoding="utf-8")),
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
            raise RuntimeError("unrecognized M101 branch")
        apply(os.environ.get("M93_EXPECTED_API"))
        print("PASS (LAB): M101 exact M100 control plus existing anchor relations", flush=True)
    except Exception:
        print("BLOCK (LAB): M101 scoped anchor diagnostic not attested", file=sys.stderr)
        raise SystemExit(1)

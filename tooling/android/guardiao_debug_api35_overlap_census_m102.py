#!/usr/bin/env python3
"""M102: fixed identity and overlap census from exact M101 rejection snapshot."""
from __future__ import annotations
import os
import sys
from guardiao_debug_api35_overlap_anchors_m101 import APP, OBSERVER, GUARD, BASE, m91_pure, organized_transform, anchors_transform, xml_transform

LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-overlap-census-m102-v1"
OLD = "            _m101_report_anchors(nodes, actual[desired], node)\n            return reject"
NEW = "            _m101_report_anchors(nodes, actual[desired], node)\n            _m102_report_census(nodes, actual[desired], node, cx, cy)\n            return reject"
HELPER = "\ndef _m102_identity(node):\n    \"\"\"Only exact source-defined public labels; no arbitrary text returned.\"\"\"\n    if node.get(\"package\") != PACKAGE:\n        return \"foreign\"\n    if any(observer.debug.safe_testid_matches(node, key) for key in TARGETS):\n        return \"known-tab\"\n    label = node.get(\"content-desc\")\n    if type(label) is not str:\n        return \"unknown\"\n    static = {\n        \"Abrir ajustes\": \"settings\",\n        \"Alternar visibilidade do saldo\": \"balance-visibility\",\n        \"Abrir Pix\": \"quick-pix\",\n        \"Abrir Contas\": \"quick-accounts\",\n        \"Abrir Cartões\": \"quick-cards\",\n        \"Abrir Metas\": \"quick-goals\",\n        \"Contas\": \"module-accounts\",\n        \"Pix\": \"module-pix\",\n        \"Cartões\": \"module-cards\",\n        \"Investimentos\": \"module-investments\",\n        \"Metas\": \"module-goals\",\n        \"Negresco\": \"module-assistant\",\n        \"Guardião\": \"module-guardian\",\n    }\n    return static.get(label, \"unknown\")\n\ndef _m102_scroll_ancestry(nodes, node):\n    \"\"\"Classify whether the existing private parent chain has a scroll ancestor.\"\"\"\n    import re\n    positions = {id(n): i for i, n in enumerate(nodes)}\n    if len(positions) != len(nodes):\n        return \"unconfirmed\"\n    i = positions.get(id(node), -1)\n    if i < 0:\n        return \"unconfirmed\"\n    found = False\n    while True:\n        raw = nodes[i].get(\"_m100_parent\")\n        if type(raw) is not str or not re.fullmatch(r\"-1|[0-9]{1,5}\", raw):\n            return \"unconfirmed\"\n        parent = int(raw)\n        if parent == -1:\n            return \"scroll-ancestor\" if found else \"no-scroll-ancestor\"\n        if not 0 <= parent < i:\n            return \"unconfirmed\"\n        ancestor = nodes[parent]\n        if ancestor.get(\"package\") == PACKAGE and ancestor.get(\"class\") in (\"android.widget.ScrollView\", \"android.widget.HorizontalScrollView\"):\n            found = True\n        i = parent\n\ndef _m102_report_census(nodes, target, first, cx, cy):\n    \"\"\"Same snapshot, no new read or change to rejection; no raw output.\"\"\"\n    try:\n        hits = []\n        invalid = False\n        for node in nodes:\n            if node is target or node.get(\"enabled\") != \"true\" or node.get(\"clickable\") != \"true\":\n                continue\n            other = _rectangle(node.get(\"bounds\"))\n            if other is None:\n                invalid = True\n                continue\n            if other[0] <= cx <= other[2] and other[1] <= cy <= other[3]:\n                hits.append(node)\n        if not hits or hits[0] is not first:\n            print(\"ENV (LAB): m102-census=unconfirmed\", flush=True)\n            return\n        identity = _m102_identity(first)\n        scroll = _m102_scroll_ancestry(nodes, first)\n        multiplicity = \"single\" if len(hits) == 1 else \"multiple\"\n        identities = set(_m102_identity(n) for n in hits)\n        coverage = (\"all-known\" if \"unknown\" not in identities and \"foreign\" not in identities else\n                    \"all-unknown\" if identities == {\"unknown\"} else \"mixed-or-foreign\")\n        for key,value in ((\"first-identity\",identity),(\"first-scroll\",scroll),(\"multiplicity\",multiplicity),(\"identity-coverage\",coverage),(\"invalid-other-bounds\",\"present\" if invalid else \"absent\")):\n            print(\"ENV (LAB): m102-\" + key + \"=\" + value, flush=True)\n    except Exception:\n        print(\"ENV (LAB): m102-census=unconfirmed\", flush=True)\n"

def census_transform(source: str) -> str:
    control = anchors_transform(source)
    if control.count(OLD) != 1 or NEW in control or HELPER in control:
        raise RuntimeError("original rejection anchor not attested")
    changed = control.replace(OLD, NEW) + HELPER
    if changed.removesuffix(HELPER).replace(NEW, OLD) != control:
        raise RuntimeError("nonisolated census diagnostic")
    return changed

def apply(api: str) -> None:
    if api != "35":
        raise RuntimeError("M102 exact API35 required")
    paths = (APP, OBSERVER, GUARD, BASE)
    if any(not p.is_file() or p.is_symlink() for p in paths):
        raise RuntimeError("unexpected source path")
    contents = (m91_pure(APP.read_text(encoding="utf-8")),
                organized_transform(OBSERVER.read_text(encoding="utf-8"), api),
                census_transform(GUARD.read_text(encoding="utf-8")),
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
            raise RuntimeError("unrecognized M102 branch")
        apply(os.environ.get("M93_EXPECTED_API"))
        print("PASS (LAB): M102 exact M101 control plus private overlap census", flush=True)
    except Exception:
        print("BLOCK (LAB): M102 scoped census diagnostic not attested", file=sys.stderr)
        raise SystemExit(1)

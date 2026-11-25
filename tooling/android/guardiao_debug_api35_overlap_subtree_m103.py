#!/usr/bin/env python3
"""M103: fixed native subtree categories from existing M102 snapshot."""
from __future__ import annotations
import os
import sys
from guardiao_debug_api35_overlap_census_m102 import APP, OBSERVER, GUARD, BASE, m91_pure, organized_transform, census_transform, xml_transform

LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-overlap-subtree-m103-v1"
OLD = "            _m102_report_census(nodes, actual[desired], node, cx, cy)\n            return reject"
NEW = "            _m102_report_census(nodes, actual[desired], node, cx, cy)\n            _m103_report_subtree(nodes, node)\n            return reject"
HELPER = "\ndef _m103_chain(nodes, i):\n    import re\n    result = []\n    while 0 <= i < len(nodes):\n        result.append(i)\n        raw = nodes[i].get(\"_m100_parent\")\n        if type(raw) is not str or not re.fullmatch(r\"-1|[0-9]{1,5}\", raw):\n            return None\n        parent = int(raw)\n        if parent == -1:\n            return result\n        if not 0 <= parent < i:\n            return None\n        i = parent\n    return None\n\ndef _m103_native_kind(node):\n    if node.get(\"package\") != PACKAGE:\n        return \"not-app-owned\"\n    if node.get(\"resource-id\") == \"android:id/content\":\n        return \"android-content\"\n    return {\n        \"android.widget.FrameLayout\": \"frame\",\n        \"android.widget.LinearLayout\": \"linear\",\n        \"android.widget.RelativeLayout\": \"relative\",\n        \"android.view.ViewGroup\": \"viewgroup\",\n        \"android.view.View\": \"view\",\n        \"android.widget.ScrollView\": \"scroll\",\n        \"android.widget.HorizontalScrollView\": \"scroll\",\n    }.get(node.get(\"class\"), \"other-class\")\n\ndef _m103_report_subtree(nodes, blocker):\n    \"\"\"Minimal common subtree of existing source anchors, not a React root proof.\"\"\"\n    try:\n        positions = {id(n): i for i, n in enumerate(nodes)}\n        if len(positions) != len(nodes) or id(blocker) not in positions:\n            raise ValueError(\"invalid identity\")\n        owned = [n for n in nodes if n.get(\"package\") == PACKAGE]\n        def ident(n):\n            return n.get(\"resource-id\", \"\").rsplit(\"/\", 1)[-1]\n        groups = [\n            [n for n in owned if ident(n).startswith(PAGE_IDS[\"home\"])],\n            [n for n in owned if ident(n).startswith(\"negresco-lab-quick-pix-layout-\")],\n            *[[n for n in owned if observer.debug.safe_testid_matches(n, key)] for key in TARGETS],\n        ]\n        if any(len(g) != 1 for g in groups):\n            raise ValueError(\"ambiguous anchor\")\n        anchors = [positions[id(g[0])] for g in groups]\n        if len(set(anchors)) != 5:\n            raise ValueError(\"duplicate anchor\")\n        chains = [_m103_chain(nodes, i) for i in anchors]\n        blocker_chain = _m103_chain(nodes, positions[id(blocker)])\n        if blocker_chain is None or any(c is None for c in chains):\n            raise ValueError(\"invalid parent chain\")\n        shared = set.intersection(*(set(c) for c in chains))\n        if not shared:\n            raise ValueError(\"no common anchor subtree\")\n        root = next(i for i in chains[0] if i in shared)\n        root_chain = _m103_chain(nodes, root)\n        b = blocker_chain[0]\n        if b == root:\n            relation = \"anchor-subtree-root\"\n        elif root in blocker_chain:\n            relation = \"inside-anchor-subtree\"\n        elif b in root_chain:\n            relation = \"ancestor-of-anchor-subtree\"\n        elif set(root_chain).intersection(blocker_chain):\n            relation = \"outside-anchor-subtree-shared-ancestor\"\n        else:\n            relation = \"outside-anchor-subtree-separate-root\"\n        parent_kind = _m103_native_kind(nodes[blocker_chain[1]]) if len(blocker_chain) > 1 else \"no-parent\"\n        common = next((i for i in blocker_chain if i in root_chain), None)\n        common_kind = _m103_native_kind(nodes[common]) if common is not None else \"no-common-ancestor\"\n        # Distinguish an immediate sibling of the anchor subtree from a deeper branch.\n        branch = \"not-applicable\"\n        if relation == \"outside-anchor-subtree-shared-ancestor\":\n            branch = (\"direct-sibling\" if len(root_chain)>1 and len(blocker_chain)>1 and root_chain[1]==blocker_chain[1]\n                      else \"different-depth-or-parent\")\n        for key,value in ((\"relation\",relation),(\"anchor-root-kind\",_m103_native_kind(nodes[root])),\n                          (\"blocker-parent-kind\",parent_kind),(\"common-kind\",common_kind),(\"branch\",branch)):\n            print(\"ENV (LAB): m103-subtree-\" + key + \"=\" + value, flush=True)\n    except Exception:\n        print(\"ENV (LAB): m103-subtree=unconfirmed\", flush=True)\n"

def subtree_transform(source: str) -> str:
    control = census_transform(source)
    if control.count(OLD) != 1 or NEW in control or HELPER in control:
        raise RuntimeError("original rejection anchor not attested")
    changed = control.replace(OLD, NEW) + HELPER
    if changed.removesuffix(HELPER).replace(NEW, OLD) != control:
        raise RuntimeError("nonisolated subtree diagnostic")
    return changed

def apply(api: str) -> None:
    if api != "35":
        raise RuntimeError("M103 exact API35 required")
    paths = (APP, OBSERVER, GUARD, BASE)
    if any(not p.is_file() or p.is_symlink() for p in paths):
        raise RuntimeError("unexpected source path")
    contents = (m91_pure(APP.read_text(encoding="utf-8")),
                organized_transform(OBSERVER.read_text(encoding="utf-8"), api),
                subtree_transform(GUARD.read_text(encoding="utf-8")),
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
            raise RuntimeError("unrecognized M103 branch")
        apply(os.environ.get("M93_EXPECTED_API"))
        print("PASS (LAB): M103 exact M102 control plus common subtree diagnostic", flush=True)
    except Exception:
        print("BLOCK (LAB): M103 scoped subtree diagnostic not attested", file=sys.stderr)
        raise SystemExit(1)

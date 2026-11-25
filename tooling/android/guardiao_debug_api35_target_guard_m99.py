#!/usr/bin/env python3
"""M99: exact M98 runtime and fixed labels on existing pure guard rejection branches."""
from __future__ import annotations
import os
from pathlib import Path
import sys
from guardiao_debug_api35_organized_display_m98 import APP, OBSERVER, m91_pure, organized_transform

LAB_REF = "refs/heads/lab/p01-guardiao-debug-api35-target-guard-m99-v1"
GUARD = Path("tooling/android/guardiao_api28_debug_nav_preview_guard.py")
EXPECTED_GUARD = "#!/usr/bin/env python3\n\"\"\"M68 staging: PURE read-only authorization guard for eventual Debug Home<->Pix.\n\nThere are no ADB, navigation, touch, XML snapshot, or logging functions here.\nAn eligible classification is an IN-MEMORY candidate, never proof of a tap.\n\"\"\"\nfrom __future__ import annotations\n\nimport guardiao_api28_debug_external_a11y_readonly_lab as observer\nimport guardiao_api28_debug_readonly_nav_geometry_lab as geometry\n\nPACKAGE = observer.DEBUG_PACKAGE\nTARGETS = geometry.TARGETS\nHOME_ID = \"negresco-lab-rn-page-home-pressin-\"\nPIX_ID = \"negresco-lab-rn-page-pix-pressin-\"\nPAGE_IDS = {\"home\": HOME_ID, \"pix\": PIX_ID}\nTARGET_NAMES = {\"home\": TARGETS[0], \"pix\": TARGETS[1]}\nBOUNDS = observer.debug.base.BOUNDS\nELIGIBLE = \"eligible-candidate-only\"\nBLOCK = \"blocked-ambiguous-or-unsafe\"\n\n\ndef _rectangle(raw: object) -> tuple[int, int, int, int] | None:\n    if type(raw) is not str:\n        return None\n    matched = BOUNDS.fullmatch(raw)\n    if not matched:\n        return None\n    rect = tuple(int(v) for v in matched.groups())\n    return rect if len(rect) == 4 else None\n\n\ndef select_preview_target(\n    nodes: object, width: object, height: object, source: str, target: str\n) -> tuple[str, tuple[int, int] | None]:\n    \"\"\"Require exactly three valid native targets and unambiguous RN page state.\n\n    This function does not touch the screen. The returned center exists only\n    in the private caller's memory. NEVER log, save or send coordinates.\n    \"\"\"\n    reject = (BLOCK, None)\n    if (type(nodes) is not list or not all(type(x) is dict for x in nodes)\n            or len(nodes) > 20000\n            or not all(type(n.get('resource-id','')) is str for n in nodes)\n            or type(width) is not int\n            or type(height) is not int or width <= 0 or height <= 0\n            or type(source) is not str or type(target) is not str\n            or source not in PAGE_IDS or target not in PAGE_IDS\n            or source == target):\n        return reject\n\n    # Identify the app-owned source page by a fixed source-defined testID,\n    # ignoring all arbitrary text and content descriptions.\n    page_hits = {\n        name: [n for n in nodes\n               if n.get(\"package\") == PACKAGE\n               and type(n.get(\"resource-id\")) is str\n               and n[\"resource-id\"].rsplit(\"/\", 1)[-1].startswith(prefix)]\n        for name, prefix in PAGE_IDS.items()\n    }\n    if len(page_hits[source]) != 1 or page_hits[target]:\n        return reject\n\n    actual = {}\n    rects = {}\n    for key in TARGETS:\n        matching = [n for n in nodes\n                    if observer.debug.safe_testid_matches(n, key)]\n        if len(matching) != 1:\n            return reject\n        n = matching[0]\n        if (n.get(\"package\") != PACKAGE or n.get(\"enabled\") != \"true\"\n                or n.get(\"clickable\") != \"true\"):\n            return reject\n        expected_selection = \"true\" if key == TARGET_NAMES[source] else \"false\"\n        if n.get(\"selected\") != expected_selection:\n            return reject\n        raw = n.get(\"bounds\")\n        if geometry.DEBUG.home_geometry.safe_ancestor_constraint_category(\n                raw, width, height) != \"geometry-eligible\":\n            return reject\n        r = _rectangle(raw)\n        if r is None:\n            return reject\n        actual[key], rects[key] = n, r\n\n    if len(set(rects.values())) != len(TARGETS):\n        return reject\n    for i, a in enumerate(rects.values()):\n        for b in list(rects.values())[i + 1:]:\n            if (a[0] < b[2] and b[0] < a[2]\n                    and a[1] < b[3] and b[1] < a[3]):\n                return reject\n\n    desired = TARGET_NAMES[target]\n    x1, y1, x2, y2 = rects[desired]\n    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2\n    # Fail closed for any other enabled clickable node covering this point.\n    # This is not a complete z-order proof, merely a conservative rejection.\n    for node in nodes:\n        if node is actual[desired]:\n            continue\n        if node.get(\"enabled\") != \"true\" or node.get(\"clickable\") != \"true\":\n            continue\n        other = _rectangle(node.get(\"bounds\"))\n        if other is None:\n            return reject\n        if other[0] <= cx <= other[2] and other[1] <= cy <= other[3]:\n            return reject\n    return (ELIGIBLE, (cx, cy))\n"
CATEGORIES = ["input-shape","page-state","target-count","target-ownership-or-clickability","target-selection","target-geometry","rectangle-parse","duplicate-rectangles","overlapping-targets","other-clickable-invalid-bounds","other-clickable-covers-center"]

def guard_transform(source: str) -> str:
    if type(source) is not str or source != EXPECTED_GUARD:
        raise RuntimeError("original guard not exactly attested")
    lines = source.splitlines(keepends=True)
    output = []
    index = 0
    for line in lines:
        if line.strip() == "return reject":
            if index >= len(CATEGORIES):
                raise RuntimeError("unexpected rejection")
            indent = line[:len(line)-len(line.lstrip())]
            output.append(indent + 'print("ENV (LAB): m99-target-guard=' + CATEGORIES[index] + '", flush=True)\n')
            index += 1
        output.append(line)
    if index != len(CATEGORIES):
        raise RuntimeError("missing rejection")
    changed = "".join(output)
    if "".join(l for l in changed.splitlines(keepends=True) if 'print("ENV (LAB): m99-target-guard=' not in l) != source:
        raise RuntimeError("nonisolated diagnostic change")
    return changed

def apply(api: str) -> None:
    if api != "35":
        raise RuntimeError("M99 exact API35 required")
    if any(not p.is_file() or p.is_symlink() for p in (APP, OBSERVER, GUARD)):
        raise RuntimeError("unexpected source path")
    app = m91_pure(APP.read_text(encoding="utf-8"))
    observer = organized_transform(OBSERVER.read_text(encoding="utf-8"), api)
    guard = guard_transform(GUARD.read_text(encoding="utf-8"))
    for path, content in ((APP, app), (OBSERVER, observer), (GUARD, guard)):
        path.write_text(content, encoding="utf-8")
        if path.read_text(encoding="utf-8") != content:
            raise RuntimeError("temporary source not attested")

if __name__ == "__main__":
    try:
        if (sys.argv != [sys.argv[0], "apply"]
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != LAB_REF):
            raise RuntimeError("unrecognized M99 branch")
        apply(os.environ.get("M93_EXPECTED_API"))
        print("PASS (LAB): M99 exact M98 control plus fixed target rejection categories", flush=True)
    except Exception:
        print("BLOCK (LAB): M99 scoped target diagnostic not attested", file=sys.stderr)
        raise SystemExit(1)

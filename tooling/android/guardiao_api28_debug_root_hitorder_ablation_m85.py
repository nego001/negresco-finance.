#!/usr/bin/env python3
"""M85 isolated disposable Debug-only ablation of root zIndex/elevation style.

Applies strictly AFTER M84's two-style subtraction in a fresh CI checkout.
No changes to tracked App.tsx, Release, device operations or navigation gates.
"""
from __future__ import annotations
import os
from pathlib import Path
import sys

LAB_REF = "refs/heads/lab/p01-guardiao-api28-debug-root-hitorder-ablation-m85-v1"
ROOT_STYLE = ",Platform.OS==='android'&&s.labAndroidRootHitOrder"
ROOT_SUFFIX = "]} onLayout={__DEV__?e=>recordLabRoot(e.nativeEvent.layout.height):undefined}"
BOTTOM_STYLE = "style={s.bottom}"
NAV_STYLE = "style={[s.nav,page===x.name&&s.navSelected]}"


def transform(content: str) -> str:
    """Remove only one root z-index/elevation reference from prepatched M84 fixture."""
    if type(content) is not str:
        raise RuntimeError("unrecognized source")
    if (
        content.count(ROOT_STYLE) != 1
        or content.count(ROOT_STYLE + ROOT_SUFFIX) != 1
        or content.count(BOTTOM_STYLE) != 1
        or content.count(NAV_STYLE) != 1
        or "style={[s.bottom,s.labBottomBounds]}" in content
        or "style={[s.nav,s.labNavBounds,page===x.name&&s.navSelected]}" in content
    ):
        raise RuntimeError("M84 Debug precondition unconfirmed")
    return content.replace(ROOT_STYLE + ROOT_SUFFIX, ROOT_SUFFIX)


if __name__ == "__main__":
    try:
        if (
            sys.argv != [sys.argv[0], "apply"]
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != LAB_REF
        ):
            raise RuntimeError("wrong CI branch")
        path = Path("apps/mobile/App.tsx")
        if not path.is_file() or path.is_symlink():
            raise RuntimeError("unexpected file")
        before = path.read_text(encoding="utf-8")
        after = transform(before)
        if len(before) - len(after) != len(ROOT_STYLE):
            raise RuntimeError("unexpected edit size")
        path.write_text(after, encoding="utf-8")
        if path.read_text(encoding="utf-8") != after:
            raise RuntimeError("cannot attest temporary edit")
        print("PASS (LAB): root hit-order style removed only in disposable Debug checkout")
    except Exception:
        print("BLOCK (LAB): unsafe Debug root style ablation", file=sys.stderr)
        raise SystemExit(1)

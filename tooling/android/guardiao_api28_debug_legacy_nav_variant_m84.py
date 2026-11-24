#!/usr/bin/env python3
"""M84: apply a two-style-only counterfactual to ONE disposable Android9 Debug workspace.

Never touches committed apps/mobile/App.tsx, main, any existing Release APK,
native geometry guards, input, observer or screenshot capture. Fails closed.
"""
from __future__ import annotations

import os
from pathlib import Path
import sys

LAB_REF = "refs/heads/lab/p01-guardiao-api28-debug-legacy-nav-m84-v1"
REPLACEMENTS = (
    ("style={[s.bottom,s.labBottomBounds]}", "style={s.bottom}"),
    ("style={[s.nav,s.labNavBounds,page===x.name&&s.navSelected]}",
     "style={[s.nav,page===x.name&&s.navSelected]}"),
)


def transform(text: str) -> str:
    """Pure exact transformation; reject absent, ambiguous and premodified source."""
    if type(text) is not str:
        raise RuntimeError("unexpected source")
    output = text
    for old, new in REPLACEMENTS:
        if output.count(old) != 1 or new in output:
            raise RuntimeError("legacy-style comparison not uniquely bounded")
        output = output.replace(old, new)
    return output


if __name__ == "__main__":
    try:
        if (
            sys.argv != [sys.argv[0], "apply"]
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != LAB_REF
        ):
            raise RuntimeError("not a scoped CI Debug-only lab")
        source = Path("apps/mobile/App.tsx")
        if not source.is_file() or source.is_symlink():
            raise RuntimeError("unexpected app source")
        original = source.read_text(encoding="utf-8")
        changed = transform(original)
        source.write_text(changed, encoding="utf-8")
        if source.read_text(encoding="utf-8") != changed:
            raise RuntimeError("unexpected patch result")
        print("PASS (LAB): disposable Debug comparison removes only two nav style overrides", flush=True)
    except Exception:
        print("BLOCK (LAB): Debug-only legacy navigation comparison source not attested", file=sys.stderr)
        raise SystemExit(1)

#!/usr/bin/env python3
"""M88 own-branch guarded restoration control: M84 PURE two-style subtraction.

This preserves the original root labAndroidRootHitOrder zIndex/elevation
modifier and otherwise keeps the same M87 app and observer source.
No production release or app source tracked edits.
"""
from __future__ import annotations

import os
from pathlib import Path
import sys

from guardiao_api28_debug_legacy_nav_variant_m84 import transform as m84_pure

LAB_REF = "refs/heads/lab/p01-guardiao-api28-debug-root-hitorder-restored-m88-v1"
ROOT_STYLE = ",Platform.OS==='android'&&s.labAndroidRootHitOrder"


def transform(source: str) -> str:
    """Exactly the M84 two-size-only removal, retaining one original root style."""
    if type(source) is not str or source.count(ROOT_STYLE) != 1:
        raise RuntimeError("root hit-order control source not uniquely attested")
    edited = m84_pure(source)
    if edited.count(ROOT_STYLE) != 1:
        raise RuntimeError("root hit-order unexpectedly modified")
    return edited


if __name__ == "__main__":
    try:
        if (
            sys.argv != [sys.argv[0], "apply"]
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != LAB_REF
        ):
            raise RuntimeError("unrecognized M88 branch")
        path = Path("apps/mobile/App.tsx")
        if not path.is_file() or path.is_symlink():
            raise RuntimeError("unexpected app source")
        original = path.read_text(encoding="utf-8")
        changed = transform(original)
        if changed == original:
            raise RuntimeError("no scoped change")
        path.write_text(changed, encoding="utf-8")
        if path.read_text(encoding="utf-8") != changed:
            raise RuntimeError("cannot attest temporary style control")
        print("PASS (LAB): M88 two bottom styles removed, root hit-order retained in Debug", flush=True)
    except Exception:
        print("BLOCK (LAB): M88 scoped root hit-order restoration not attested", file=sys.stderr)
        raise SystemExit(1)

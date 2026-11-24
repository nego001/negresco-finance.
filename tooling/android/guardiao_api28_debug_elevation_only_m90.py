#!/usr/bin/env python3
"""M90: exact M88 Debug comparison minus root zIndex."""
from __future__ import annotations
import os
from pathlib import Path
import sys
from guardiao_api28_debug_root_hitorder_restored_m88 import transform as m88_pure, ROOT_STYLE

LAB_REF = "refs/heads/lab/p01-guardiao-api28-debug-elevation-only-m90-v1"
OLD = "labAndroidRootHitOrder:{zIndex:4,elevation:4},"
NEW = "labAndroidRootHitOrder:{elevation:4},"

def transform(source: str) -> str:
    if type(source) is not str or source.count(OLD) != 1 or NEW in source:
        raise RuntimeError("root definition not uniquely attested")
    control = m88_pure(source)
    if control.count(OLD) != 1 or NEW in control:
        raise RuntimeError("M88 control definition not attested")
    changed = control.replace(OLD, NEW)
    if changed.count(NEW) != 1 or OLD in changed or changed.count(ROOT_STYLE) != 1:
        raise RuntimeError("unexpected root definition")
    if changed.replace(NEW, OLD) != control:
        raise RuntimeError("nonisolated root style change")
    return changed

if __name__ == "__main__":
    try:
        if (sys.argv != [sys.argv[0], "apply"]
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != LAB_REF):
            raise RuntimeError("unrecognized M90 branch")
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
        print("PASS (LAB): M90 exact M88 control minus root zIndex; elevation retained", flush=True)
    except Exception:
        print("BLOCK (LAB): M90 scoped elevation-only control not attested", file=sys.stderr)
        raise SystemExit(1)

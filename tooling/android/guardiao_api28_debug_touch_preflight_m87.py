#!/usr/bin/env python3
"""M87 only: call previous PURE transform, not previous wrong-branch CLI."""
from __future__ import annotations
import os
from pathlib import Path
import sys
from guardiao_api28_debug_postpix_preflight_m86b import transform as old_pure_transform

LAB_REF = "refs/heads/lab/p01-guardiao-api28-debug-touch-chain-m87-v1"


def transform(original: str) -> str:
    return old_pure_transform(original)


if __name__ == "__main__":
    try:
        if (sys.argv != [sys.argv[0], "apply"]
                or os.environ.get("GITHUB_ACTIONS") != "true"
                or os.environ.get("GITHUB_REF") != LAB_REF):
            raise RuntimeError("wrong branch")
        path = Path("apps/mobile/App.tsx")
        if not path.is_file() or path.is_symlink():
            raise RuntimeError("unrecognized source file")
        original = path.read_text(encoding="utf-8")
        edited = transform(original)
        if edited == original:
            raise RuntimeError("unexpected no-op")
        path.write_text(edited, encoding="utf-8")
        if path.read_text(encoding="utf-8") != edited:
            raise RuntimeError("unattested temporary transformation")
        print("PASS (LAB): M87 exact prior three-style transform in own Debug branch", flush=True)
    except Exception:
        print("BLOCK (LAB): M87 temporary Debug app source not attested", file=sys.stderr)
        raise SystemExit(1)

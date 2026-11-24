#!/usr/bin/env python3
"""M85b: single branch-scoped atomic Debug-only M84+M85 style subtraction.

M85 failed safely before Android compilation: M84's CLI is explicitly scoped
to the M84 branch. Reuse ONLY its pure exact text transform, never its CLI.
"""
from __future__ import annotations

import os
from pathlib import Path
import sys

from guardiao_api28_debug_legacy_nav_variant_m84 import transform as m84_styles
from guardiao_api28_debug_root_hitorder_ablation_m85 import transform as m85_root

LAB_REF = "refs/heads/lab/p01-guardiao-api28-debug-root-hitorder-ablation-m85b-v1"


def transform(original: str) -> str:
    """All three known source substitutions are checked before any file edit."""
    return m85_root(m84_styles(original))


if __name__ == "__main__":
    try:
        if (
            sys.argv != [sys.argv[0], "apply"]
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != LAB_REF
        ):
            raise RuntimeError("not the isolated M85b Debug branch")
        path = Path("apps/mobile/App.tsx")
        if not path.is_file() or path.is_symlink():
            raise RuntimeError("unexpected app file")
        before = path.read_text(encoding="utf-8")
        after = transform(before)
        if after == before:
            raise RuntimeError("no isolated style change")
        path.write_text(after, encoding="utf-8")
        if path.read_text(encoding="utf-8") != after:
            raise RuntimeError("temporary edit not attested")
        print("PASS (LAB): exact M84 two styles plus M85 root hit-order ablated in one Debug checkout", flush=True)
    except Exception:
        print("BLOCK (LAB): M85b temporary source transformation not attested", file=sys.stderr)
        raise SystemExit(1)

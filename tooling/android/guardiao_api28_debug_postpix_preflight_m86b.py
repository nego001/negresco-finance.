#!/usr/bin/env python3
"""M86b: safely apply M85b's PURE source transform under only this lab branch.

The M86 workflow was blocked before Android, because it called M85b's CLI
with a hardcoded M85b GITHUB_REF. Do not broaden that CLI or its branch scope.
"""
from __future__ import annotations

import os
from pathlib import Path
import sys

from guardiao_api28_debug_root_hitorder_ablation_m85b import transform as m85b_transform

LAB_REF = "refs/heads/lab/p01-guardiao-api28-debug-postpix-classifier-m86b-v1"


def transform(original: str) -> str:
    """Same exactly three reviewed source style substitutions, no alternatives."""
    return m85b_transform(original)


if __name__ == "__main__":
    try:
        if (
            sys.argv != [sys.argv[0], "apply"]
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != LAB_REF
        ):
            raise RuntimeError("M86b restricted to own lab ref")
        source = Path("apps/mobile/App.tsx")
        if not source.is_file() or source.is_symlink():
            raise RuntimeError("unconfirmed app source")
        original = source.read_text(encoding="utf-8")
        changed = transform(original)  # both inherited pure checks before any write
        if changed == original:
            raise RuntimeError("unexpected no-op")
        source.write_text(changed, encoding="utf-8")
        if source.read_text(encoding="utf-8") != changed:
            raise RuntimeError("cannot confirm temporary modification")
        print("PASS (LAB): scoped M86b Debug preflight matches M85b three-style source counterfactual", flush=True)
    except Exception:
        print("BLOCK (LAB): scoped M86b temporary Debug source not attested", file=sys.stderr)
        raise SystemExit(1)

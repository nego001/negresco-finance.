#!/usr/bin/env python3
"""M114: exact M111 app/package delta over the existing API28 two-PDF lab."""
from __future__ import annotations
import os
import sys
from guardiao_debug_safe_insets_m111 import APP, PACKAGE, app_transform, package_transform

LAB_REF = "refs/heads/lab/p01-guardiao-debug-safe-insets-pdf-m114-v1"

def scope():
    return os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("GITHUB_REF") == LAB_REF

def apply():
    if not scope():
        raise RuntimeError("M114 scope required")
    paths = (APP, PACKAGE)
    if any(not p.is_file() or p.is_symlink() for p in paths):
        raise RuntimeError("unexpected source path")
    originals = tuple(p.read_text(encoding="utf-8") for p in paths)
    contents = (app_transform(originals[0]), package_transform(originals[1]))
    if any(a == b for a,b in zip(originals, contents)):
        raise RuntimeError("expected exact M111 delta")
    for path, content in zip(paths, contents):
        path.write_text(content, encoding="utf-8")
        if path.read_text(encoding="utf-8") != content:
            raise RuntimeError("temporary source not attested")

if __name__ == "__main__":
    try:
        if sys.argv != [sys.argv[0], "apply"] or not scope():
            raise RuntimeError("unexpected arguments or scope")
        apply()
        print("PASS (LAB): M114 exact M111 safe-inset app/package in PDF lab", flush=True)
    except Exception:
        print("BLOCK (LAB): M114 scoped PDF control not attested", file=sys.stderr)
        raise SystemExit(1)

#!/usr/bin/env python3
"""M117: apply stored candidate patch only to disposable Debug checkout."""
from __future__ import annotations
import os
from pathlib import Path
import subprocess
import sys
import guardiao_debug_first_analyze_m115 as m115
import guardiao_debug_analyze_keyboard_m116 as m116
from guardiao_debug_safe_insets_m111 import APP, PACKAGE, app_transform, package_transform

LAB_REF = "refs/heads/lab/p01-guardiao-integration-candidate-m117-v1"
PATCH = Path("tooling/android/fixtures/guardiao-safe-insets-keyboard-candidate-m117.patch")

def scope():
    return os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("GITHUB_REF") == LAB_REF

def expected(app, package):
    return (m116.transform(app_transform(app), m116.APP_PAIRS[:1]), package_transform(package))

def apply_patch(root, patch):
    for mode in (["--check"], []):
        p = subprocess.run(["git", "apply", *mode, "--whitespace=nowarn", str(patch.resolve())],
                           cwd=root, capture_output=True, timeout=20)
        if p.returncode != 0:
            raise RuntimeError("candidate patch rejected")

def apply():
    if not scope() or any(not p.is_file() or p.is_symlink() for p in (APP, PACKAGE, PATCH, m115.BASE)):
        raise RuntimeError("M117 scope unconfirmed")
    app, package = expected(APP.read_text(encoding="utf-8"), PACKAGE.read_text(encoding="utf-8"))
    base = m115.transform(m115.BASE.read_text(encoding="utf-8"))
    if "NEGRESCO_LAB_M116_ANALYZE_" in app or "LogBox.ignore" in app:
        raise RuntimeError("unwanted diagnostic delta")
    headers = [line for line in PATCH.read_text(encoding="utf-8").splitlines() if line.startswith("diff --git ")]
    if headers != ["diff --git a/apps/mobile/App.tsx b/apps/mobile/App.tsx", "diff --git a/apps/mobile/package.json b/apps/mobile/package.json"]:
        raise RuntimeError("patch scope invalid")
    apply_patch(Path.cwd(), PATCH)
    if APP.read_text(encoding="utf-8") != app or PACKAGE.read_text(encoding="utf-8") != package:
        raise RuntimeError("candidate patch not identical to validated functional changes")
    m115.BASE.write_text(base, encoding="utf-8")
    if m115.BASE.read_text(encoding="utf-8") != base:
        raise RuntimeError("one-tap gate not attested")

if __name__ == "__main__":
    try:
        if sys.argv != [sys.argv[0], "apply"]:
            raise RuntimeError("unexpected arguments")
        apply()
        print("PASS (LAB): M117 stored candidate patch matches validated functional changes", flush=True)
    except Exception:
        print("BLOCK (LAB): M117 candidate patch not attested", file=sys.stderr)
        raise SystemExit(1)

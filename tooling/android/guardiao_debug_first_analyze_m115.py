#!/usr/bin/env python3
"""M115: isolate first Analyze target selection; preserve M114 application."""
from __future__ import annotations
import os
from pathlib import Path
import sys
import guardiao_debug_safe_insets_pdf_m114 as m114

LAB_REF = "refs/heads/lab/p01-guardiao-debug-first-analyze-m115-v1"
BASE = Path("tooling/android/guardiao_pdf_ui_emulator_smoke.py")
PAIRS = [["    tap_node(wait_visible(\"Analisar estrutura\", retries=12, enabled=True, scroll=True))","    tap_node(wait_visible(\"Analisar estrutura\", retries=12, enabled=True, scroll=True), prefer_label=True)"],["    if not observed:\n        # Exactly one bounded retry, never press unknown controls.\n        for _ in range(7):\n            scroll_backward()\n        button = wait_visible(\"Analisar estrutura\", retries=12, enabled=True, scroll=True)\n        tap_node(button, prefer_label=True)\n        retry = stage_summary(\"after text-center retry\")\n        observed = retry[\"Verificação inconclusiva ou inválida\"]\n        if not observed:\n            try:\n                wait_visible(\"Verificação inconclusiva ou inválida\", retries=6, scroll=False)\n                observed = True\n            except RuntimeError:\n                stage_summary(\"analysis result missing after two bounded taps, no PDF attempted\")\n                raise\n",""],["    print(\"STAGE (LAB): synthetic analysis result visible, next checking PDF export button\")","    print(\"PASS (LAB): M115 analysis result observed after exactly one bounded label-center tap\", flush=True)\n    print(\"STAGE (LAB): synthetic analysis result visible, next checking PDF export button\")"]]

def scope():
    return os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("GITHUB_REF") == LAB_REF

def transform(source):
    out = source
    for before, after in PAIRS:
        if out.count(before) != 1:
            raise RuntimeError("M115 exact anchor unconfirmed")
        out = out.replace(before, after, 1)
    if "after text-center retry" in out or "Exactly one bounded retry, never press unknown controls." in out:
        raise RuntimeError("M115 second Analyze tap remains")
    return out

def apply():
    if not scope() or not BASE.is_file() or BASE.is_symlink():
        raise RuntimeError("M115 scope or source unconfirmed")
    content = transform(BASE.read_text(encoding="utf-8"))
    # Reuse the exact M114 application/package delta; adapt only its branch scope.
    old = m114.LAB_REF
    try:
        m114.LAB_REF = LAB_REF
        m114.apply()
    finally:
        m114.LAB_REF = old
    BASE.write_text(content, encoding="utf-8")
    if BASE.read_text(encoding="utf-8") != content:
        raise RuntimeError("M115 temporary runner unconfirmed")

if __name__ == "__main__":
    try:
        if sys.argv != [sys.argv[0], "apply"]:
            raise RuntimeError("unexpected arguments")
        apply()
        print("PASS (LAB): M115 exact M114 control plus one label-center Analyze tap", flush=True)
    except Exception:
        print("BLOCK (LAB): M115 scoped first Analyze control not attested", file=sys.stderr)
        raise SystemExit(1)

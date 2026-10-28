#!/usr/bin/env python3
"""Isolated Android 8/9 receipt test using only a known-invalid 48-digit collection fixture.

The second 48-digit fixture starts with 8 but has reference digit 0.
It is intentionally mathematically invalid, and has no payable banking data.
"""
from __future__ import annotations

import sys
import guardiao_android_export_pdf_text_emulator_smoke as lab

FIXTURE = "8" + "0" * 47  # 48-digit synthetic collection, reference 0 -> invalid

if __name__ == "__main__":
    if len(sys.argv) != 1 or len(FIXTURE) != 48 or FIXTURE[2] != "0":
        print("BLOCK (LAB): invalid fixed test harness parameters", file=sys.stderr)
        raise SystemExit(1)
    lab.base.FIXTURE = FIXTURE
    try:
        lab.run_lab()
    except Exception:
        # Never emit the input, Android UI dump, PDF, extracted text or system error.
        print("BLOCK (LAB): 48-digit Android synthetic receipt not verified", file=sys.stderr)
        raise SystemExit(1)

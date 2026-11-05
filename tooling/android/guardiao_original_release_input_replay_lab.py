#!/usr/bin/env python3
"""Strict synthetic-only Release APK replay, distinct from Debug instrumentation.

The archived original Release APK stays hash-pinned. A unique native EditText
must be found before input and after injection. UI XML and input text are
processed only in memory; logs contain fixed categories only.
"""
from __future__ import annotations

import sys
import subprocess

import guardiao_android_export_pdf_text_emulator_smoke as lab

FIXTURE = "8" + "0" * 47
LABEL = "Linha digitável do boleto"
CLASS = "android.widget.EditText"


def choose_unique_input(nodes: list[dict[str, str]], *, verify_value: bool) -> dict[str, str]:
    """Select only one exact, accessible EditText, never a TextView label."""
    candidates = [
        n for n in nodes
        if n.get("class") == CLASS
        and n.get("content-desc") == LABEL
    ]
    if not candidates:
        raise ValueError("synthetic-edittext-not-observed")
    if len(candidates) != 1:
        raise ValueError("synthetic-edittext-ambiguous")
    target = candidates[0]
    if verify_value and target.get("text") != FIXTURE:
        raise ValueError("synthetic-edittext-value-unconfirmed")
    return target



def verify_post_injection_snapshots(read_nodes) -> tuple[dict[str, str], str]:
    """Read the existing EditText at most three times; never inject more text.

    An initially incomplete accessibility snapshot may catch a pending UI
    update. Only a unique EXACT synthetic EditText value can ever pass.
    Missing/ambiguous fields fail immediately; a value mismatch fails after
    at most two additional read-only UI snapshots.
    """
    for attempt in range(3):
        try:
            selected = choose_unique_input(read_nodes(), verify_value=True)
            return selected, ("synthetic-value-exact-verified" if attempt == 0
                              else "synthetic-value-exact-after-read-recheck")
        except ValueError as exc:
            if str(exc) != "synthetic-edittext-value-unconfirmed" or attempt == 2:
                raise
    raise RuntimeError("bounded synthetic EditText read failed")


def run() -> None:
    if len(sys.argv) != 1 or len(FIXTURE) != 48 or FIXTURE[2] != "0":
        raise ValueError("invalid synthetic-only replay invocation")
    base = lab.base
    base.FIXTURE = FIXTURE
    original_wait_visible = base.wait_visible

    def strict_wait_visible(needle: str, retries: int = 25, *,
                            scroll: bool = False, enabled: bool = False):
        if needle != LABEL or retries not in (10, 30):
            return original_wait_visible(
                needle, retries=retries, scroll=scroll, enabled=enabled
            )
        # Do not short-circuit the original visibility/timing gate.
        original_wait_visible(
            needle, retries=retries, scroll=scroll, enabled=enabled
        )
        try:
            if retries == 10:
                chosen, category = verify_post_injection_snapshots(base.xml_nodes)
            else:
                chosen = choose_unique_input(base.xml_nodes(), verify_value=False)
                category = "synthetic-edittext-unique-confirmed"
        except ValueError as exc:
            # Exception message comes solely from this module's literals.
            print("ENV (LAB): Release replay synthetic input " + str(exc), flush=True)
            raise
        except (RuntimeError, subprocess.TimeoutExpired):
            print("ENV (LAB): Release replay synthetic input synthetic-view-unconfirmed",
                  flush=True)
            raise
        print("ENV (LAB): Release replay synthetic input " + category, flush=True)
        return chosen

    base.wait_visible = strict_wait_visible
    try:
        lab.run_lab()  # SHA gate, chooser, receipt, PDF semantics and cleanup unchanged.
    finally:
        base.wait_visible = original_wait_visible


if __name__ == "__main__":
    try:
        run()
    except Exception:
        # Never publish UI hierarchy, financial-looking values, PDF or stack.
        print("BLOCK (LAB): immutable Release paired replay incomplete", file=sys.stderr)
        raise SystemExit(1)

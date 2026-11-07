#!/usr/bin/env python3
"""Two strict, same-app-data API28 runs against the SAME SHA-pinned Release APK.

No production release, signing, transactions, screenshots, PDF or raw UI output.
A single failed cycle blocks the whole laboratory experiment. Both receipts
are validated before moving into separate metadata-only directories.
"""
from __future__ import annotations

import sys
from pathlib import Path

import guardiao_original_release_input_replay_lab as replay
import guardiao_android_export_pdf_text_emulator_smoke as semantic
import guardiao_pdf_ui_emulator_smoke as base
import verify_collection48_receipt as receipt

CYCLES = ("a", "b")
OUT = Path("retained-state-receipts")


def run() -> None:
    if len(sys.argv) != 1 or OUT.exists() or semantic.REPORT.exists():
        raise RuntimeError("unsafe or stale repeated Release laboratory")
    if base.EXPECTED_SHA != receipt.APK_SHA or replay.FIXTURE != "8" + "0" * 47:
        raise RuntimeError("unexpected immutable APK or synthetic fixture")
    OUT.mkdir(mode=0o700)

    for index, cycle in enumerate(CYCLES):
        # Cycle b reuses deliberately retained synthetic app data on the SAME
        # disposable API28 emulator; only the app process is stopped.  The
        # original SHA-pinned APK is reinstalled via adb install -r inside
        # replay.run(), without any explicit data wipe or package uninstall.
        # The receiver capture gate and receipt still reset on every cycle.
        if index:
            base.adb("shell", "am", "force-stop", base.PACKAGE, timeout=25)
            if base.adb("shell", "pidof", base.PACKAGE,
                        timeout=10, check=False).strip():
                raise RuntimeError("retained-state process stop unconfirmed")
            print("STAGE (LAB): process stopped without clearing app data",
                  flush=True)
        if semantic.REPORT.exists():
            raise RuntimeError("stale success receipt between cycles")
        semantic.observed = None
        print("STAGE (LAB): immutable API28 fresh cycle " + cycle, flush=True)
        replay.run()  # Full real chooser, independent receiver and semantic proof.
        # Never reuse a previous round's output. This is a metadata consistency
        # gate, not cryptographic attestation of Android execution.
        parsed = receipt.read_receipt(semantic.REPORT)
        receipt.verify(parsed, 28)
        folder = OUT / ("cycle-" + cycle)
        folder.mkdir(mode=0o700)
        semantic.REPORT.replace(folder / receipt.MEMBER)
        print("PASS (LAB): immutable API28 fresh cycle " + cycle +
              " receipt verified", flush=True)

    print("PASS (LAB): two retained-state synthetic Release cycles completed", flush=True)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        # Never echo exception text, app data, private PDF or UI hierarchy.
        print("BLOCK (LAB): immutable API28 retained-state replay incomplete",
              file=sys.stderr)
        raise SystemExit(1)

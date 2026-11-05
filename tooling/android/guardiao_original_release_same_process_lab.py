#!/usr/bin/env python3
"""API28 synthetic Release PDF replay twice while the app PID remains unchanged.

Never changes original Release bytes, deletes application data or exports PDFs.
A failed/unavailable PID comparison BLOCKS, never counts as a PDF regression.
This is a best-effort process identity observation, not proof of process memory.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import guardiao_original_release_input_replay_lab as replay
import guardiao_android_export_pdf_text_emulator_smoke as semantic
import guardiao_pdf_ui_emulator_smoke as base
import verify_collection48_receipt as receipt

OUT = Path("same-process-receipts")
CYCLES = ("a", "b")


def observed_single_app_pid() -> str | None:
    """Keep exact PID private and in memory; never publish a numeric identifier."""
    raw = base.adb("shell", "pidof", base.PACKAGE, timeout=10, check=False).strip()
    return raw if re.fullmatch(r"[1-9][0-9]{0,8}", raw) else None


def run() -> None:
    if len(sys.argv) != 1 or OUT.exists() or semantic.REPORT.exists():
        raise RuntimeError("unsafe or stale same-process laboratory")
    if base.EXPECTED_SHA != receipt.APK_SHA or replay.FIXTURE != "8" + "0" * 47:
        raise RuntimeError("unexpected original APK or synthetic-only fixture")
    OUT.mkdir(mode=0o700)
    baseline_pid: str | None = None

    for cycle in CYCLES:
        if semantic.REPORT.exists():
            raise RuntimeError("previous cycle metadata still present")
        semantic.observed = None
        print("STAGE (LAB): original API28 same-process cycle " + cycle, flush=True)
        if baseline_pid is None:
            replay.run()  # First cycle installs the exact SHA-pinned APK.
            baseline_pid = observed_single_app_pid()
            if baseline_pid is None:
                raise RuntimeError("same-process baseline not confirmed")
            print("ENV (LAB): original app process baseline observed", flush=True)
        else:
            if observed_single_app_pid() != baseline_pid:
                raise RuntimeError("same-process pre-replay identity unconfirmed")

            # This opt-in wrapper skips ONLY the second original APK install.
            # Every other Android command, receiver install, chooser and receipt
            # continues through the existing fail-closed source runner.
            real_adb = base.adb
            skipped = False

            def keep_installed_app(*args, **kwargs):
                nonlocal skipped
                if args == ("install", "-r", str(base.APK)):
                    if skipped or observed_single_app_pid() != baseline_pid:
                        raise RuntimeError("same-process install gate unconfirmed")
                    skipped = True
                    print("STAGE (LAB): original app reused without reinstall",
                          flush=True)
                    return ""
                return real_adb(*args, **kwargs)

            base.adb = keep_installed_app
            try:
                replay.run()
            finally:
                base.adb = real_adb
            if not skipped or observed_single_app_pid() != baseline_pid:
                raise RuntimeError("same-process post-replay identity unconfirmed")
            print("ENV (LAB): original app process identity preserved", flush=True)

        parsed = receipt.read_receipt(semantic.REPORT)
        receipt.verify(parsed, 28)
        folder = OUT / ("cycle-" + cycle)
        folder.mkdir(mode=0o700)
        semantic.REPORT.replace(folder / receipt.MEMBER)
        print("PASS (LAB): original API28 same-process cycle " + cycle +
              " PDF receipt verified", flush=True)

    print("PASS (LAB): two same-process synthetic PDF receipts verified",
          flush=True)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        # No device PID, user input, UI XML, PDFs, logs or exception output.
        print("BLOCK (LAB): API28 same-process replay not confirmed",
              file=sys.stderr)
        raise SystemExit(1)

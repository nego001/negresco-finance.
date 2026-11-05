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



def restore_home_tab_in_same_process(expected_pid: str) -> None:
    """Navigate to home through one exact bottom tab, without resetting app."""
    if observed_single_app_pid() != expected_pid:
        raise RuntimeError("same-process home-navigation PID unconfirmed")
    tabs = [
        n for n in base.xml_nodes()
        if n.get("text") == "Início"
        and n.get("class") == "android.widget.TextView"
        and n.get("enabled") == "true"
    ]
    if len(tabs) != 1:
        raise RuntimeError("same-process exact home tab unavailable")
    bound = base.BOUNDS.fullmatch(tabs[0].get("bounds", ""))
    if bound is None:
        raise RuntimeError("same-process home tab bounds unavailable")
    x1, y1, x2, y2 = map(int, bound.groups())
    width, height = base.screen_size()
    x, y = (x1 + x2) // 2, (y1 + y2) // 2
    if not (x2 > x1 and y2 > y1 and 0 < x < width
            and int(height * .70) < y < int(height * .985)):
        raise RuntimeError("same-process home tab outside bounded bottom bar")
    base.adb("shell", "input", "tap", str(x), str(y), timeout=10)
    for _ in range(8):
        if base.lookup("Seu dinheiro.") is not None:
            if observed_single_app_pid() != expected_pid:
                raise RuntimeError("same-process home-navigation PID changed")
            print("STAGE (LAB): exact home tab and home-only banner verified",
                  flush=True)
            return
        base.scroll_backward()
    raise RuntimeError("same-process home-only banner not observed")


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

            # The tagline is global; reopening the app may resume Guardiao.
            # Require exact return to Início before searching its Guardiao tile.
            original_wait_visible = base.wait_visible
            home_gate_done = False

            def wait_with_home_gate(needle, retries=25, *, scroll=False,
                                    enabled=False):
                nonlocal home_gate_done
                found = original_wait_visible(
                    needle, retries=retries, scroll=scroll, enabled=enabled
                )
                if needle == "Seu universo" and not home_gate_done:
                    restore_home_tab_in_same_process(baseline_pid)
                    home_gate_done = True
                return found

            base.adb = keep_installed_app
            base.wait_visible = wait_with_home_gate
            try:
                replay.run()
            finally:
                base.adb = real_adb
                base.wait_visible = original_wait_visible
            if not skipped or observed_single_app_pid() != baseline_pid:
                raise RuntimeError("same-process post-replay identity unconfirmed")
            if not home_gate_done:
                raise RuntimeError("same-process home navigation not confirmed")
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

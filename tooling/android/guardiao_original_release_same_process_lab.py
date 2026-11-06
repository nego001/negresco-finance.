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



HOME_BLOCK_CODES = {
    "same-process home-navigation PID unconfirmed": "pid-before-home-unconfirmed",
    "same-process exact home tab unavailable": "tab-absent-or-ambiguous",
    "same-process home tab label type unconfirmed": "tab-label-other-class",
    "same-process home tab bounds unavailable": "tab-bounds-unconfirmed",
    "same-process home tab outside bounded bottom bar": "tab-outside-bottom-bar",
    "same-process home-navigation PID changed": "pid-after-home-changed",
    "same-process home-only banner not observed": "home-banner-unconfirmed",
}


def safe_home_block_category(exc: Exception) -> str:
    """Allowlisted literals only. Never print a raw Android or Python error."""
    if type(exc) is not RuntimeError:
        return "other-or-unconfirmed"
    return HOME_BLOCK_CODES.get(str(exc), "other-or-unconfirmed")



def safe_home_tab_band(x: int, y: int, width: int, height: int) -> str:
    """Coarse fixed classification, never emit actual UI coordinates."""
    if width <= 0 or height <= 0 or not (0 < x < width and 0 < y < height):
        return "outside-screen"
    if y < int(height * .40):
        return "upper"
    if y <= int(height * .70):
        return "middle"
    if y < int(height * .985):
        return "lower"
    return "bottom-edge"



def safe_home_axis_category(x: int, y: int, width: int, height: int) -> str:
    """One constant category for which axis rejected the tab location."""
    if width <= 0 or height <= 0:
        return "screen-unconfirmed"
    invalid_x = x <= 0 or x >= width
    invalid_y = y <= 0 or y >= height
    if invalid_x and invalid_y:
        return "both-outside"
    if x <= 0:
        return "x-before"
    if x >= width:
        return "x-after"
    if y <= 0:
        return "y-before"
    if y >= height:
        return "y-after"
    return "within-screen-not-footer"

def safe_ime_category(raw: str) -> str:
    """Read only known IME display flags from unsaved private dumpsys output."""
    flags = re.findall(r"\bm(?:InputShown|IsInputViewShown)\s*=\s*(true|false)\b", raw)
    if not flags:
        return "unconfirmed"
    if all(f == "true" for f in flags):
        return "shown"
    if all(f == "false" for f in flags):
        return "hidden"
    return "ambiguous"


def safe_wm_override_category(raw: str, x: int, y: int) -> str:
    """Classify overrides, never permit a gesture based on this diagnostic."""
    physical = re.search(r"(?m)^Physical size:\s*(\d+)x(\d+)\s*$", raw)
    override = re.search(r"(?m)^Override size:\s*(\d+)x(\d+)\s*$", raw)
    if physical is None:
        return "unconfirmed"
    if override is None:
        return "physical-only"
    if physical.groups() == override.groups():
        return "override-equal"
    width, height = map(int, override.groups())
    if width > 0 and height > 0 and 0 < x < width and (
        int(height * .70) < y < int(height * .985)
    ):
        return "override-would-pass"
    return "override-still-outside"


def emit_home_geometry_diagnostic(x: int, y: int, width: int,
                                  height: int) -> None:
    """Passive categories only, never upload dumpsys, UI XML or exception."""
    band = safe_home_tab_band(x, y, width, height)
    axis = safe_home_axis_category(x, y, width, height)
    ime = "unconfirmed"
    viewport = "unconfirmed"
    try:
        ime = safe_ime_category(base.adb("shell", "dumpsys", "input_method",
                                         timeout=8, check=False))
    except Exception:
        pass
    try:
        viewport = safe_wm_override_category(
            base.adb("shell", "wm", "size", timeout=8, check=False), x, y
        )
    except Exception:
        pass
    print("ENV (LAB): home-position-band=" + band +
          " axis=" + axis + " ime=" + ime +
          " viewport=" + viewport, flush=True)


def restore_home_tab_in_same_process(expected_pid: str) -> None:
    """Navigate to home through one exact bottom tab, without resetting app."""
    if observed_single_app_pid() != expected_pid:
        raise RuntimeError("same-process home-navigation PID unconfirmed")
    # Android UI hierarchy can be briefly stale after reentering the app.
    # Read only; never retry a tap, type text or trust more than one target.
    tabs = []
    other_class_label_seen = False
    for _ in range(5):
        nodes = base.xml_nodes()  # Private in-memory snapshot only.
        matching_label = [
            n for n in nodes
            if n.get("text") == "Início" or n.get("content-desc") == "Início"
        ]
        tabs = [
            n for n in matching_label
            if n.get("class") == "android.widget.TextView"
            and n.get("enabled") == "true"
        ]
        if len(tabs) > 1:
            raise RuntimeError("same-process exact home tab unavailable")
        if tabs:
            break
        if matching_label:
            other_class_label_seen = True
    if len(tabs) != 1:
        raise RuntimeError("same-process home tab label type unconfirmed"
                           if other_class_label_seen
                           else "same-process exact home tab unavailable")
    print("STAGE (LAB): same-process unique home tab verified", flush=True)
    bound = base.BOUNDS.fullmatch(tabs[0].get("bounds", ""))
    if bound is None:
        raise RuntimeError("same-process home tab bounds unavailable")
    x1, y1, x2, y2 = map(int, bound.groups())
    width, height = base.screen_size()
    x, y = (x1 + x2) // 2, (y1 + y2) // 2
    if not (x2 > x1 and y2 > y1 and 0 < x < width
            and int(height * .70) < y < int(height * .985)):
        emit_home_geometry_diagnostic(x, y, width, height)
        raise RuntimeError("same-process home tab outside bounded bottom bar")
    print("STAGE (LAB): same-process home tab target bounded", flush=True)
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
                # The home-only label cannot appear until the existing
                # Guardiao page returns to Início. Restore first, then wait
                # for the actual home-only marker; never claim PDF failure
                # when this navigation gate has not been confirmed.
                if needle == "Seu universo" and not home_gate_done:
                    print("STAGE (LAB): same-process return to home started",
                          flush=True)
                    try:
                        restore_home_tab_in_same_process(baseline_pid)
                    except Exception as error:
                        # Only map exact locally authored error constants to
                        # fixed public categories; never print raw exception.
                        print("BLOCK STAGE (LAB): same-process home return " +
                              safe_home_block_category(error), flush=True)
                        raise
                    home_gate_done = True
                return original_wait_visible(
                    needle, retries=retries, scroll=scroll, enabled=enabled
                )

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

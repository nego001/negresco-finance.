#!/usr/bin/env python3
"""LAB ONLY: one new path per UIAutomator snapshot, fail closed on bad dump ack.

The existing UI/XML reader and two-snapshot gate stay unchanged. No app code
is modified. Created Android files are removed immediately after their reads.
Never print raw XML, Android paths, window text, exception strings or hashes.
"""
from __future__ import annotations
import secrets
import sys
import guardiao_v5_api28_pre_snapshot_focus_lab as prior
import guardiao_pdf_ui_emulator_smoke as base

SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
ORIGINAL_DUMP = ("shell", "uiautomator", "dump", "/sdcard/negresco_ui.xml")
ORIGINAL_READ = ("exec-out", "cat", "/sdcard/negresco_ui.xml")
MAX_CAPTURES = 1800
MAX_XML_CHARS = 2_000_000
BLOCK = "BLOCK (LAB): unique UIAutomator capture not proven"


class CaptureUnconfirmed(Exception):
    """Not swallowed by the legacy wait_visible RuntimeError retry loop."""


def ack_category(output: object, path: str) -> str:
    """A dump success line must refer to the exact freshly selected path."""
    if type(output) is not str or not isinstance(path, str) or len(output) > 4096:
        return "unconfirmed"
    raw = output.strip()
    if raw.startswith("UI hier") and raw.endswith("dumped to: " + path):
        return "reported"
    lower = raw.lower()
    if "could not get idle state" in lower:
        return "idle-state-unavailable"
    if "null root node" in lower:
        return "null-root"
    if "error:" in lower:
        return "other-error"
    return "unconfirmed"


def run() -> None:
    if len(sys.argv) != 1 or prior.SHA != SHA or base is not prior.home.base:
        raise CaptureUnconfirmed("invalid pinned laboratory")
    token = secrets.token_hex(8)  # only local disposable emulator, never logged
    old_adb = base.adb
    pending: str | None = None
    count = 0

    def cleanup(path: str) -> None:
        old_adb("shell", "rm", "-f", path, timeout=10, check=True)

    def capture(*args, **kwargs):
        nonlocal pending, count
        if args == ORIGINAL_DUMP:
            if pending is not None or count >= MAX_CAPTURES:
                raise CaptureUnconfirmed("nested or excessive snapshot")
            count += 1
            path = "/data/local/tmp/ng_ui_" + token + "_" + str(count) + ".xml"
            pending = path
            try:
                output = old_adb("shell", "uiautomator", "dump", path, **kwargs)
                ack = ack_category(output, path)
                print("ENV (LAB): unique-xml-dump-ack=" + ack, flush=True)
                if ack != "reported":
                    raise CaptureUnconfirmed("dump did not confirm unique destination")
                return output
            except Exception:
                pending = None
                cleanup(path)
                raise
        if args == ORIGINAL_READ:
            if pending is None:
                raise CaptureUnconfirmed("read without confirmed unique dump")
            path = pending
            pending = None
            try:
                output = old_adb("exec-out", "cat", path, **kwargs)
                if type(output) is not str or not (0 < len(output) <= MAX_XML_CHARS):
                    raise CaptureUnconfirmed("invalid captured XML size")
                return output
            finally:
                cleanup(path)
        return old_adb(*args, **kwargs)

    base.adb = capture
    try:
        prior.run()  # original strict 2 UI snapshots + PID + real PDF receiver
    finally:
        base.adb = old_adb
        if pending is not None:
            cleanup(pending)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print(BLOCK, file=sys.stderr, flush=True)
        raise SystemExit(1)

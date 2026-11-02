#!/usr/bin/env python3
"""Debug-only native PDF phases in a disposable expo-print installation.

No data, exceptions, URLs, HTML, PDF contents or raw device logs are emitted.
The SHA-pinned Release APK is not changed.
"""
from __future__ import annotations

import re
import secrets
import subprocess
import sys
from pathlib import Path

# The installation step runs with working-directory: apps/mobile.
# Runtime category collection only uses the tag and does not access TARGET.
TARGET = Path("node_modules/expo-print/android/src/main/java/expo/modules/print/PrintPDFRenderTask.kt")
TAG = "NegrescoPdfPhaseLab"
MARKERS = (
    "native-render-entered", "native-webview-created", "native-page-finished",
    "native-layout-requested", "native-layout-finished", "native-layout-failed",
    "native-layout-cancelled", "native-write-requested", "native-write-finished",
    "native-write-failed", "native-write-cancelled", "native-render-completed",
)
# The -v tag format is deterministic. Also accept documented threadtime/brief
# forms to avoid treating a formatting difference as absence of a callback.
MARKER_PATTERN = re.compile(
    r"(?:\bI/NegrescoPdfPhaseLab(?:\(\s*\d+\))?:"
    r"|\bI\s+NegrescoPdfPhaseLab:)\s*(native-[a-z-]+)\s*$"
)
PROBE_TAG = "NegrescoPdfPhaseProbe"
MAX_CAPTURE = 64_000


def mark(event: str) -> str:
    if event not in MARKERS:
        raise ValueError("unknown lab phase")
    return 'android.util.Log.i("' + TAG + '", "' + event + '")'


def instrument_source(content: str) -> str:
    if len(content) > 100_000 or not content.startswith("package expo.modules.print\n"):
        raise ValueError("unexpected Expo native source")
    if TAG in content:
        raise ValueError("native hook already installed")
    layout = (
        "document.onLayout(null, printAttributes, null, object : "
        "PrintDocumentAdapterLayoutCallback() {}, null)"
    )
    expanded_layout = (
        "document.onLayout(null, printAttributes, null, object : "
        "PrintDocumentAdapterLayoutCallback() {\n"
        "        override fun onLayoutFinished(info: android.print.PrintDocumentInfo, "
        "changed: Boolean) {\n"
        "          " + mark("native-layout-finished") + "\n"
        "        }\n"
        "        override fun onLayoutFailed(error: CharSequence?) {\n"
        "          " + mark("native-layout-failed") + "\n"
        "        }\n"
        "        override fun onLayoutCancelled() {\n"
        "          " + mark("native-layout-cancelled") + "\n"
        "        }\n"
        "      }, null)"
    )
    patches = (
        ("    webView = WebView(context)\n",
         "    " + mark("native-render-entered") + "\n"
         "    webView = WebView(context)\n"
         "    " + mark("native-webview-created") + "\n"),
        ("    override fun onPageFinished(view: WebView, url: String) {\n",
         "    override fun onPageFinished(view: WebView, url: String) {\n"
         "      " + mark("native-page-finished") + "\n"),
        ("      " + layout + "\n",
         "      " + mark("native-layout-requested") + "\n"
         "      " + expanded_layout + "\n"),
        ("        document.onWrite(arrayOf(PageRange.ALL_PAGES), fileDescriptor, null, printDocumentWriteCallback)\n",
         "        " + mark("native-write-requested") + "\n"
         "        document.onWrite(arrayOf(PageRange.ALL_PAGES), fileDescriptor, null, printDocumentWriteCallback)\n"),
        ("    override fun onWriteFinished(pages: Array<PageRange>) {\n",
         "    override fun onWriteFinished(pages: Array<PageRange>) {\n"
         "      " + mark("native-write-finished") + "\n"),
        ("    override fun onWriteFailed(error: CharSequence?) {\n",
         "    override fun onWriteFailed(error: CharSequence?) {\n"
         "      " + mark("native-write-failed") + "\n"),
        ("      callbacks.onRenderFinished(document, outputFile, numberOfPages)\n",
         "      " + mark("native-render-completed") + "\n"
         "      callbacks.onRenderFinished(document, outputFile, numberOfPages)\n"),
    )
    updated = content
    for anchor, replacement in patches:
        if updated.count(anchor) != 1:
            raise ValueError("unexpected SDK54 callback anchor")
        updated = updated.replace(anchor, replacement, 1)
    failed_callback = (
        "    override fun onWriteFailed(error: CharSequence?) {\n"
        "      " + mark("native-write-failed") + "\n"
        "      callbacks.onRenderError(PdfWriteException())\n"
        "    }\n"
    )
    if updated.count(failed_callback) != 1:
        raise ValueError("unexpected write error callback")
    updated = updated.replace(
        failed_callback,
        failed_callback + "    override fun onWriteCancelled() {\n"
        "      " + mark("native-write-cancelled") + "\n"
        "    }\n", 1,
    )
    if any(updated.count(mark(phase)) != 1 for phase in MARKERS):
        raise ValueError("missing fixed phase")
    return updated


def install() -> None:
    if not TARGET.is_file() or TARGET.is_symlink():
        raise RuntimeError("generated expo-print source unavailable")
    updated = instrument_source(TARGET.read_text(encoding="utf-8"))
    TARGET.write_text(updated, encoding="utf-8")
    print("PASS (LAB): fixed Debug native print phase hooks installed", flush=True)


def classify_log(raw: str | None) -> str:
    if not isinstance(raw, str) or len(raw) > MAX_CAPTURE:
        return "native-phase-unconfirmed"
    last = None
    for line in raw.splitlines():
        match = MARKER_PATTERN.search(line)
        if match and match.group(1) in MARKERS:
            last = match.group(1)
    return last or "native-phase-unconfirmed"


def collect_last_phase() -> str:
    """Read only the fixed tag, with an explicit format and bounded history."""
    try:
        result = subprocess.run(
            ["adb", "logcat", "-d", "-v", "tag", "-t", "512",
             "-s", TAG + ":I", "*:S"],
            capture_output=True, text=True, timeout=12, check=False,
        )
        if result.returncode != 0:
            return "native-phase-unconfirmed"
        return classify_log(result.stdout)
    except (OSError, subprocess.TimeoutExpired, UnicodeError):
        return "native-phase-unconfirmed"


def verify_diagnostic_channel() -> str:
    """Fixed-tag canary: checks that a known event is readable via adb.

    The nonce is ephemeral and never emitted. This function does NOT say
    whether expo-print executed any callback or where a native hang occurs.
    """
    token = secrets.token_hex(8)
    marker = "lab-probe-" + token
    try:
        written = subprocess.run(
            ["adb", "shell", "log", "-p", "i", "-t", PROBE_TAG, marker],
            capture_output=True, text=True, timeout=12, check=False,
        )
        if written.returncode != 0:
            return "native-logcat-probe-unconfirmed"
        read = subprocess.run(
            ["adb", "logcat", "-d", "-v", "tag", "-t", "512",
             "-s", PROBE_TAG + ":I", "*:S"],
            capture_output=True, text=True, timeout=12, check=False,
        )
        if (read.returncode == 0 and len(read.stdout) <= MAX_CAPTURE
            and ("I/" + PROBE_TAG + ": " + marker) in read.stdout.splitlines()):
            return "native-logcat-probe-confirmed"
    except (OSError, subprocess.TimeoutExpired, UnicodeError):
        pass
    return "native-logcat-probe-unconfirmed"


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] != "install":
        raise SystemExit(2)
    try:
        install()
    except (OSError, RuntimeError, ValueError):
        print("BLOCK (LAB): native phase hooks not installed", flush=True)
        raise SystemExit(1)

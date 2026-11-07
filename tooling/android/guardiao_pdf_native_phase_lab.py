#!/usr/bin/env python3
"""Debug-only native PDF phases in a disposable expo-print installation.

No data, exceptions, URLs, HTML, PDF contents or raw device logs are emitted.
The SHA-pinned Release APK is not changed.
"""
from __future__ import annotations

import json
import re
import secrets
import subprocess
import sys
import zipfile
from pathlib import Path

# The installation step runs with working-directory: apps/mobile.
# Runtime category collection only uses the tag and does not access TARGET.
TARGET = Path("node_modules/expo-print/android/src/main/java/expo/modules/print/PrintPDFRenderTask.kt")
MODULE_TARGET = Path("node_modules/expo-print/android/src/main/java/expo/modules/print/PrintModule.kt")
PACKAGE_JSON = Path("package.json")
TAG = "NegrescoPdfPhaseLab"
RENDER_MARKERS = (
    "native-render-entered", "native-webview-created", "native-page-finished",
    "native-render-process-gone",
    "native-layout-requested", "native-layout-finished", "native-layout-failed",
    "native-layout-cancelled", "native-write-requested", "native-write-finished",
    "native-write-failed", "native-write-cancelled", "native-render-completed",
)
MODULE_MARKERS = (
    "native-module-entered", "native-module-io-ready",
    "native-module-main-entered", "native-module-render-dispatched",
)
MARKERS = RENDER_MARKERS + MODULE_MARKERS
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
         "    override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {\n"
         "      " + mark("native-render-process-gone") + "\n"
         "      return super.onRenderProcessGone(view, detail)\n"
         "    }\n"
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
    if any(updated.count(mark(phase)) != 1 for phase in RENDER_MARKERS):
        raise ValueError("missing fixed render phase")
    return updated


def instrument_module_source(content: str) -> str:
    """Mark bridge-to-module entry and scheduling in disposable SDK54 Debug."""
    if (len(content) > 100_000 or not content.startswith("package expo.modules.print\n")
            or TAG in content):
        raise ValueError("unexpected native print module")
    anchors = (
        ("  private suspend fun printToFile(options: PrintOptions): FilePrintResult? {\n",
         "  private suspend fun printToFile(options: PrintOptions): FilePrintResult? {\n"
         "    " + mark("native-module-entered") + "\n"),
        ("    return withContext(Dispatchers.Main) {\n"
         "      return@withContext suspendCancellableCoroutine { continuation ->\n"
         "        val renderTask = PrintPDFRenderTask(context, options)\n"
         "        renderTask.render(\n",
         "    " + mark("native-module-io-ready") + "\n"
         "    return withContext(Dispatchers.Main) {\n"
         "      " + mark("native-module-main-entered") + "\n"
         "      return@withContext suspendCancellableCoroutine { continuation ->\n"
         "        val renderTask = PrintPDFRenderTask(context, options)\n"
         "        " + mark("native-module-render-dispatched") + "\n"
         "        renderTask.render(\n"),
    )
    updated = content
    for before, after in anchors:
        if updated.count(before) != 1:
            raise ValueError("unexpected SDK54 module anchor")
        updated = updated.replace(before, after, 1)
    if any(updated.count(mark(phase)) != 1 for phase in MODULE_MARKERS):
        raise ValueError("missing fixed module phase")
    return updated


def configure_expo_print_from_source(path: Path = PACKAGE_JSON) -> None:
    """Opt out only expo-print from Android precompiled .aar in this CI copy.

    SDK 54 uses precompiled Expo AARs by default; editing node_modules code
    does not affect prebuilt AARs. This setting remains local to disposable
    workflow checkout and is never changed in tracked mobile package.json.
    """
    if path.is_symlink() or not path.is_file():
        raise ValueError("package metadata unavailable")
    raw = path.read_text(encoding="utf-8")
    if len(raw) > 256_000:
        raise ValueError("unexpected package size")
    data = json.loads(raw)
    if not isinstance(data, dict) or not isinstance(data.get("dependencies"), dict):
        raise ValueError("unexpected mobile dependency metadata")
    if not isinstance(data["dependencies"].get("expo-print"), str):
        raise ValueError("expo-print missing from mobile dependencies")
    expo = data.setdefault("expo", {})
    if not isinstance(expo, dict):
        raise ValueError("unexpected Expo metadata")
    al = expo.setdefault("autolinking", {})
    if not isinstance(al, dict):
        raise ValueError("unexpected Expo autolinking metadata")
    android = al.setdefault("android", {})
    if not isinstance(android, dict):
        raise ValueError("unexpected Android autolinking metadata")
    existing = android.setdefault("buildFromSource", [])
    if not isinstance(existing, list) or any(not isinstance(x, str) for x in existing):
        raise ValueError("unexpected Android build-from-source list")
    # Preserve any existing explicit source builds without broadening to all
    # modules. Expo Autolinking supports exact package names in this list.
    if "expo-print" not in existing:
        existing.append("expo-print")
    if existing.count("expo-print") != 1:
        raise ValueError("duplicate source build selector")
    # Re-read only local checkout; no secrets, no network, no Release build.
    updated = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    path.write_text(updated, encoding="utf-8")
    if "expo-print" not in json.loads(path.read_text(encoding="utf-8"))["expo"]["autolinking"]["android"]["buildFromSource"]:
        raise ValueError("source build setting did not persist")


def install() -> None:
    if (not TARGET.is_file() or TARGET.is_symlink()
            or not MODULE_TARGET.is_file() or MODULE_TARGET.is_symlink()):
        raise RuntimeError("generated expo-print source unavailable")
    # Check both files before writing either: never partially instrument an
    # unexpected SDK. This affects only disposable Debug node_modules.
    render_updated = instrument_source(TARGET.read_text(encoding="utf-8"))
    module_updated = instrument_module_source(MODULE_TARGET.read_text(encoding="utf-8"))
    TARGET.write_text(render_updated, encoding="utf-8")
    MODULE_TARGET.write_text(module_updated, encoding="utf-8")
    print("PASS (LAB): fixed Debug native print phase hooks installed", flush=True)


DEBUG_APK = Path("apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk")
# Android multidex uses classes.dex, classes2.dex ... classes10.dex, etc.
# The old pattern missed classes10+ and could falsely report missing hooks.
DEX_NAMES = re.compile(r"classes(?:[2-9]|[1-9][0-9]+)?\.dex")
MAX_DEX_ENTRY_BYTES = 96 * 1024 * 1024
MAX_DEX_FILES = 24
# Strict literals from the fixed Debug-only Kotlin hooks. Never print DEX data.
DEX_REQUIRED = (
    TAG.encode("ascii"),
    b"native-module-entered",
    b"native-module-io-ready",
    b"native-module-main-entered",
    b"native-module-render-dispatched",
    b"native-render-entered",
    b"native-render-process-gone",
    b"native-page-finished",
    b"native-layout-requested",
    b"native-write-requested",
    b"native-write-finished",
    b"native-render-completed",
)


def classify_debug_apk_dex(path: Path) -> str:
    """Classify a bounded scan of classes*.dex; never return raw bytes/names.

    A successful string scan proves only that compiler-emitted fixed hooks
    are present in DEX, not that the methods were actually executed.
    """
    if not path.is_file() or path.is_symlink():
        return "native-dex-apk-unavailable"
    try:
        with zipfile.ZipFile(path) as archive:
            dex = [i for i in archive.infolist()
                   if DEX_NAMES.fullmatch(i.filename)]
            if not (1 <= len(dex) <= MAX_DEX_FILES):
                return "native-dex-set-unconfirmed"
            if any(i.file_size < 8 or i.file_size > MAX_DEX_ENTRY_BYTES
                   for i in dex):
                return "native-dex-size-unconfirmed"
            found = set()
            for entry in dex:
                with archive.open(entry) as file:
                    data = file.read(MAX_DEX_ENTRY_BYTES + 1)
                if len(data) != entry.file_size or not data.startswith(b"dex\n"):
                    return "native-dex-header-unconfirmed"
                for token in DEX_REQUIRED:
                    if token in data:
                        found.add(token)
            if len(found) == len(DEX_REQUIRED):
                return "native-dex-hooks-present"
            if not found:
                return "native-dex-hooks-not-observed"
            return "native-dex-hooks-partial"
    except (OSError, ValueError, RuntimeError, zipfile.BadZipFile):
        return "native-dex-inspection-unavailable"


def verify_debug_apk_dex(path: Path) -> bool:
    """Fail-closed public gate, preserving existing caller interface."""
    return classify_debug_apk_dex(path) == "native-dex-hooks-present"


def verify_apk_command() -> None:
    result = classify_debug_apk_dex(DEBUG_APK)
    # Only one literal category: never print filenames, classes or DEX data.
    print("ENV (LAB): compiled Debug native phase inventory " + result, flush=True)
    if result != "native-dex-hooks-present":
        print("BLOCK (LAB): compiled Debug APK native phase strings unconfirmed",
              flush=True)
        raise SystemExit(1)
    print("PASS (LAB): compiled Debug APK contains fixed native print phases", flush=True)


def classify_log(raw: str | None) -> str:
    if not isinstance(raw, str) or len(raw) > MAX_CAPTURE:
        return "native-phase-unconfirmed"
    last = None
    for line in raw.splitlines():
        match = MARKER_PATTERN.search(line)
        if match and match.group(1) in MARKERS:
            last = match.group(1)
    return last or "native-phase-unconfirmed"


def classify_renderer_exit_log(raw: str | None) -> str:
    """Report only whether the fixed renderer-exit marker occurs in this window.

    Absence in bounded logcat is *not* evidence that the renderer never exited.
    This is diagnostics only and must not promote a PDF or UI PASS.
    """
    if not isinstance(raw, str) or len(raw) > MAX_CAPTURE:
        return "native-renderer-exit-unconfirmed"
    seen_phase = False
    for line in raw.splitlines():
        match = MARKER_PATTERN.search(line)
        if match and match.group(1) in MARKERS:
            seen_phase = True
            if match.group(1) == "native-render-process-gone":
                return "native-renderer-exit-observed"
    return ("native-renderer-exit-not-observed-in-window" if seen_phase
            else "native-renderer-exit-unconfirmed")


def collect_renderer_exit_category() -> str:
    """Read bounded fixed-tag logcat; never emit or persist raw device logs."""
    try:
        result = subprocess.run(
            ["adb", "logcat", "-d", "-v", "tag", "-t", "512",
             "-s", TAG + ":I", "*:S"],
            capture_output=True, text=True, timeout=12, check=False,
        )
        if result.returncode != 0:
            return "native-renderer-exit-unconfirmed"
        return classify_renderer_exit_log(result.stdout)
    except (OSError, subprocess.TimeoutExpired, UnicodeError):
        return "native-renderer-exit-unconfirmed"


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
    if len(sys.argv) != 2 or sys.argv[1] not in ("install", "verify-debug-apk", "source-build"):
        raise SystemExit(2)
    if sys.argv[1] == "verify-debug-apk":
        verify_apk_command()
    elif sys.argv[1] == "source-build":
        try:
            configure_expo_print_from_source()
            print("PASS (LAB): disposable Android expo-print source build selected", flush=True)
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            print("BLOCK (LAB): expo-print source build setting unconfirmed", flush=True)
            raise SystemExit(1)
    else:
        try:
            install()
        except (OSError, RuntimeError, ValueError):
            print("BLOCK (LAB): native phase hooks not installed", flush=True)
            raise SystemExit(1)

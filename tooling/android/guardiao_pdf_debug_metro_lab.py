#!/usr/bin/env python3
"""Synthetic-only Debug/Metro Guardiao PDF test; no real payment information.

This builds on the existing on-device receiver and text verifier, but uses a
NEW temporary debug APK plus local Metro. The previous SHA-pinned Release lab
and its independently approved receipt files are never changed.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import signal
import socket
import stat
import subprocess
import sys
import time
from pathlib import Path

import guardiao_android_export_pdf_text_emulator_smoke as semantic

base = semantic.base
APK = Path("apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk")
MANIFEST = Path("/tmp/negresco-debug-test-apk.sha256")
BUNDLE_PORT = 8081
MAX_APK_BYTES = 256 * 1024 * 1024
FIXTURE = "8" + "0" * 47
HINTS = {
    "Gerando PDF local... [LAB: impressão pendente]": "lab-print-pending",
    "Gerando PDF local... [LAB: disponibilidade pendente]": "lab-availability-pending",
    "Gerando PDF local... [LAB: compartilhamento pendente]": "lab-share-pending",
}


def debug_digest() -> str:
    if APK.is_symlink() or not APK.is_file():
        raise RuntimeError("non-regular debug test APK")
    info = APK.stat()
    if not stat.S_ISREG(info.st_mode) or not (25_000_000 <= info.st_size <= MAX_APK_BYTES):
        raise RuntimeError("debug test APK size out of safe bounds")
    expected = re.fullmatch(
        r"([0-9a-f]{64})  apps/mobile/android/app/build/outputs/apk/debug/app-debug\.apk\n?",
        MANIFEST.read_text(encoding="ascii"),
    )
    if expected is None:
        raise RuntimeError("debug APK SHA file malformed")
    h = hashlib.sha256()
    with APK.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    digest = h.hexdigest()
    if digest != expected.group(1):
        raise RuntimeError("debug APK differs from independent build-stage SHA")
    return digest


def start_local_metro() -> subprocess.Popen:
    env = dict(os.environ)
    env.update({"CI": "1", "EXPO_NO_TELEMETRY": "1", "EXPO_OFFLINE": "1"})
    # Never print Metro output, JS source, path, host addresses or app data.
    server = subprocess.Popen(
        ["npx", "expo", "start", "--offline", "--localhost", "--port", str(BUNDLE_PORT)],
        cwd="apps/mobile",
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
        env=env,
    )
    for _ in range(90):
        if server.poll() is not None:
            raise RuntimeError("isolated Metro terminated before serving")
        try:
            with socket.create_connection(("127.0.0.1", BUNDLE_PORT), timeout=1):
                print("STAGE (LAB): isolated local Metro port ready", flush=True)
                return server
        except OSError:
            time.sleep(1)
    raise RuntimeError("local Metro readiness not observed in bounded window")


def run() -> None:
    if len(sys.argv) != 1 or len(FIXTURE) != 48 or FIXTURE[2] != "0":
        raise RuntimeError("synthetic fixture policy rejected")
    digest = debug_digest()
    # Explicitly override only the isolated process's Debug APK identity.
    # The immutable Release APK verifier and workflows are not modified.
    base.APK = APK
    base.EXPECTED_SHA = digest
    base.FIXTURE = FIXTURE
    observed: set[str] = set()
    original_chooser = base.chooser_present

    def observe_before_chooser() -> bool:
        # Use existing allowlisted booleans; never emit raw UI XML.
        try:
            state = base.stage_summary("debug-only PDF await boundary")
            for label, category in HINTS.items():
                if state.get(label) is True:
                    observed.add(category)
        except (RuntimeError, subprocess.TimeoutExpired):
            pass
        return original_chooser()

    base.chooser_present = observe_before_chooser
    server = None
    try:
        server = start_local_metro()
        base.adb("reverse", f"tcp:{BUNDLE_PORT}", f"tcp:{BUNDLE_PORT}")
        print("STAGE (LAB): Android emulator connected to isolated Metro", flush=True)
        semantic.run_lab()
        report = json.loads(semantic.REPORT.read_text(encoding="utf8"))
        if (report.get("api") != 28 or report.get("apkSha256") != digest or
            report.get("sourceFixture") != "synthetic-48-collection-reference-invalid" or
            report.get("nativePdfSemanticTextVerified") is not True or
            report.get("receiverCacheClean") is not True or
            report.get("approvedForProduction") is not False or
            report.get("stableReleaseAllowed") is not False):
            raise RuntimeError("Debug-only PDF evidence has inconsistent synthetic gates")
        if not observed:
            raise RuntimeError("no actual debug-only pending-phase marker was observed")
        # Print only categories that the source defines, never values from UI.
        for category in sorted(observed):
            print("PASS STAGE (LAB): observed " + category, flush=True)
        print("PASS (LAB): Debug synthetic PDF received, rendered, checked and erased")
    finally:
        semantic.REPORT.unlink(missing_ok=True)
        base.REPORT.unlink(missing_ok=True)
        try:
            base.adb("reverse", "--remove", f"tcp:{BUNDLE_PORT}", check=False)
        except (RuntimeError, subprocess.TimeoutExpired):
            pass
        if server is not None:
            if server.poll() is None:
                os.killpg(server.pid, signal.SIGTERM)
                try:
                    server.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    os.killpg(server.pid, signal.SIGKILL)
                    server.wait(timeout=4)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        # No sensitive exception messages, data, PDF, UI dump or Metro logs.
        print("BLOCK (LAB): Debug Android PDF phase verification incomplete", file=sys.stderr)
        raise SystemExit(1)

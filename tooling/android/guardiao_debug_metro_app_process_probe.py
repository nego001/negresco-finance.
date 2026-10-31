#!/usr/bin/env python3
"""Read-only shell-UID transport evidence from a disposable Android 9 emulator.

Compiles a tiny, fixed-source Java probe for Android's app_process, with NO
APK, app permissions, settings edits, financial values, raw HTTP output or
device log collection. Only fixed result categories leave this Python module.
Shell-UID reachability does NOT prove React Native app-UID reachability.
"""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import tempfile

DESTINATION = "/data/local/tmp/negresco-metro-route-lab.jar"
CLASS_NAME = "com.negresco.lab.MetroRouteProbe"
MAX_RESULT = 512
UNCONFIRMED = ("shell-route-unconfirmed", "shell-route-unconfirmed")
UNAVAILABLE = ("shell-probe-unavailable", "shell-probe-unavailable")
ALLOWED = {"REACHABLE": "shell-metro-status-reachable",
           "UNCONFIRMED": "shell-route-unconfirmed"}

JAVA_SOURCE = r"""
package com.negresco.lab;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

public final class MetroRouteProbe {
    private static final int PORT = 8081;
    private static final int MAX_BYTES = 8192;

    private static String check(final String host) {
        // Both destinations are constants supplied only below, never user input.
        if (!host.equals("127.0.0.1") && !host.equals("10.0.2.2")) {
            return "UNCONFIRMED";
        }
        try (Socket connection = new Socket()) {
            connection.connect(new InetSocketAddress(host, PORT), 3000);
            connection.setSoTimeout(3000);
            OutputStream output = connection.getOutputStream();
            output.write(("GET /status HTTP/1.0\r\n"
                    + "Host: localhost\r\n"
                    + "Connection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
            output.flush();
            InputStream input = connection.getInputStream();
            ByteArrayOutputStream memory = new ByteArrayOutputStream();
            byte[] chunk = new byte[1024];
            while (memory.size() < MAX_BYTES) {
                int length = input.read(chunk, 0, Math.min(chunk.length, MAX_BYTES - memory.size()));
                if (length < 0) {
                    break;
                }
                memory.write(chunk, 0, length);
                // Some servers keep sockets open despite Connection: close.
                String prefix = memory.toString("US-ASCII");
                if (prefix.contains("packager-status:running")) {
                    break;
                }
            }
            String response = memory.toString("US-ASCII");
            if ((response.startsWith("HTTP/1.0 200") || response.startsWith("HTTP/1.1 200"))
                    && response.contains("packager-status:running")) {
                return "REACHABLE";
            }
        } catch (Exception ignored) {
            // NEVER print exception, endpoint, response, headers or stack.
        }
        return "UNCONFIRMED";
    }

    public static void main(String[] ignoredArgs) {
        // Exactly two fixed categories. No raw HTTP or host addresses printed.
        System.out.println("LOOPBACK=" + check("127.0.0.1")
                + ";ALIAS=" + check("10.0.2.2"));
    }
}
"""


def classify_result(raw: str | None) -> tuple[str, str]:
    """Reject anything except the exact two fixed category tokens."""
    if not isinstance(raw, str) or len(raw) > MAX_RESULT:
        return UNCONFIRMED
    candidate = raw.strip()
    if candidate.count("\n") or candidate.count("\r"):
        return UNCONFIRMED
    if not candidate.startswith("LOOPBACK=") or ";ALIAS=" not in candidate:
        return UNCONFIRMED
    left, right = candidate.split(";ALIAS=", 1)
    first = left[len("LOOPBACK="):]
    if first not in ALLOWED or right not in ALLOWED:
        return UNCONFIRMED
    return ALLOWED[first], ALLOWED[right]


def _command(arguments: list[str], *, timeout: int) -> str | None:
    """Never emit or persist tool stdout/stderr (even when a child fails)."""
    try:
        result = subprocess.run(arguments, capture_output=True,
                                check=False, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0 or len(result.stdout) > MAX_RESULT:
        return None
    return result.stdout


def probe_shell_routes() -> tuple[str, str]:
    """Probe local emulator routes as shell UID only; no production claim."""
    sdk = os.environ.get("ANDROID_HOME", "")
    if not sdk:
        return UNAVAILABLE
    d8 = Path(sdk) / "build-tools" / "35.0.0" / "d8"
    if not d8.is_file():
        return UNAVAILABLE
    try:
        with tempfile.TemporaryDirectory(prefix="negresco-metro-route-lab-") as tmp:
            root = Path(tmp)
            java = root / "MetroRouteProbe.java"
            classes = root / "classes"
            dex = root / "dex"
            package = root / "route-probe.jar"
            java.write_text(JAVA_SOURCE, encoding="utf-8")
            classes.mkdir()
            dex.mkdir()
            if _command(["javac", "-source", "8", "-target", "8", "-encoding", "UTF-8",
                         "-d", str(classes), str(java)], timeout=25) is None:
                return UNAVAILABLE
            compiled = classes / "com" / "negresco" / "lab" / "MetroRouteProbe.class"
            if not compiled.is_file():
                return UNAVAILABLE
            if _command([str(d8), "--min-api", "28", "--output", str(dex),
                         str(compiled)], timeout=30) is None:
                return UNAVAILABLE
            if not (dex / "classes.dex").is_file():
                return UNAVAILABLE
            if _command(["jar", "cf", str(package), "-C", str(dex), "classes.dex"],
                        timeout=15) is None:
                return UNAVAILABLE
            try:
                if _command(["adb", "push", str(package), DESTINATION],
                            timeout=20) is None:
                    return UNAVAILABLE
                result = _command(
                    ["adb", "shell", "sh", "-c",
                     f"CLASSPATH={DESTINATION} app_process /system/bin {CLASS_NAME}"],
                    timeout=25,
                )
                return classify_result(result)
            finally:
                # Remove executable probe; emulator itself is discarded by CI.
                _command(["adb", "shell", "rm", "-f", DESTINATION], timeout=10)
    except (OSError, ValueError):
        return UNAVAILABLE

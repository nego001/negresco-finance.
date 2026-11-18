#!/usr/bin/env python3
"""Only testOnly synthetic own-package Android9 reference. No finance app use."""
from __future__ import annotations
import subprocess
import sys

PACKAGE = "com.negresco.a11ypersistent.lab"
APK = "tooling/android/a11y-persistent-lab/app/build/outputs/apk/debug/a11y-persistent-lab.apk"
BLOCK = "BLOCK (LAB): persistent UiAutomation synthetic reference unconfirmed"


def classify(raw: object) -> str:
    if type(raw) is not str or not 1 <= len(raw) <= 64000:
        return "unconfirmed"
    fields = {}
    codes = []
    required = {"sample1", "sample2", "sample3", "verdict"}
    for line in raw.splitlines():
        if line.startswith("INSTRUMENTATION_RESULT: "):
            key, sep, value = line[len("INSTRUMENTATION_RESULT: "):].partition("=")
            if sep and key in required:
                if key in fields:
                    return "unconfirmed"
                fields[key] = value.strip()
        elif line.startswith("INSTRUMENTATION_CODE: "):
            codes.append(line[len("INSTRUMENTATION_CODE: "):].strip())
        elif line.startswith(("INSTRUMENTATION_FAILED:", "INSTRUMENTATION_ABORTED:")):
            return "unconfirmed"
    if set(fields) != required or codes != ["-1"]:
        return "unconfirmed"
    if all(fields[f"sample{i}"] == "present" for i in (1, 2, 3)) and fields["verdict"] == "all-present":
        return "all-present"
    if any(fields[f"sample{i}"] == "null" for i in (1, 2, 3)) and fields["verdict"] == "some-null":
        return "some-null"
    return "unconfirmed"


def adb(*args: str, timeout: int = 35) -> str:
    proc = subprocess.run(["adb", *args], capture_output=True, text=True,
                          check=False, timeout=timeout)
    if proc.returncode:
        raise RuntimeError("ADB command failed")
    return proc.stdout


def run() -> None:
    if len(sys.argv) != 1:
        raise RuntimeError("CLI arguments forbidden")
    try:
        if adb("shell", "getprop", "ro.build.version.sdk").strip() != "28":
            raise RuntimeError("wrong API level")
        # Missing package is the expected synthetic reference state. pm path
        # can exit nonzero for that normal state, so use the list query instead.
        installed = adb("shell", "pm", "list", "packages", "com.negresco.finance")
        if any(line.strip() == "package:com.negresco.finance"
               for line in installed.splitlines()):
            raise RuntimeError("finance package must be absent from synthetic reference")
        adb("install", "-t", "-r", APK, timeout=50)
        result = adb("shell", "am", "instrument", "-w", "-r",
                     PACKAGE + "/.ProbeInstrumentation", timeout=100)
        if classify(result) != "all-present":
            raise RuntimeError("synthetic root presence not proven")
        print("PASS (LAB): one persistent UiAutomation, three synthetic roots present")
    finally:
        try:
            adb("uninstall", PACKAGE, timeout=25)
        except Exception:
            pass


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print(BLOCK, file=sys.stderr)
        raise SystemExit(1)

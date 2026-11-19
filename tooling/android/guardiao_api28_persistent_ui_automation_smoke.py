#!/usr/bin/env python3
"""Only testOnly synthetic own-package Android9 reference. No finance app use."""
from __future__ import annotations
import subprocess
import sys

PACKAGE = "com.negresco.a11ypersistent.lab"
APK = "tooling/android/a11y-persistent-lab/app/build/outputs/apk/debug/a11y-persistent-lab.apk"
BLOCK = "BLOCK (LAB): persistent UiAutomation synthetic reference unconfirmed"
MODES = frozenset(("baseline", "stabilized", "synced", "synced-idle"))
STAGE = "startup"


def classify(raw: object, expected_mode: str) -> tuple[str, str]:
    """Return fixed allowlisted verdict and P/N mask, never raw output."""
    if type(raw) is not str or not 1 <= len(raw) <= 64000 or expected_mode not in MODES:
        return "unconfirmed", "---"
    fields = {}
    codes = []
    required = {"sample1", "sample2", "sample3", "verdict", "mode", "readiness", "idle"}
    for line in raw.splitlines():
        if line.startswith("INSTRUMENTATION_RESULT: "):
            key, sep, value = line[len("INSTRUMENTATION_RESULT: "):].partition("=")
            if not sep or key not in required or key in fields:
                return "unconfirmed", "---"
            fields[key] = value.strip()
        elif line.startswith("INSTRUMENTATION_CODE: "):
            codes.append(line[len("INSTRUMENTATION_CODE: "):].strip())
        elif line.startswith(("INSTRUMENTATION_FAILED:", "INSTRUMENTATION_ABORTED:")):
            return "unconfirmed", "---"
    if set(fields) != required or codes != ["-1"] or fields["mode"] != expected_mode:
        return "unconfirmed", "---"
    expected_readiness = "not-requested" if expected_mode == "baseline" else "ready"
    if fields["readiness"] != expected_readiness:
        return "unconfirmed", "---"
    expected_idle = "idle-observed" if expected_mode == "synced-idle" else "not-requested"
    if fields["idle"] != expected_idle:
        return "unconfirmed", "---"
    samples = [fields[f"sample{i}"] for i in (1, 2, 3)]
    if any(v not in ("present", "null") for v in samples):
        return "unconfirmed", "---"
    pattern = "".join("P" if value == "present" else "N" for value in samples)
    if pattern == "PPP" and fields["verdict"] == "all-present":
        return "all-present", pattern
    if "N" in pattern and fields["verdict"] == "some-null":
        return "some-null", pattern
    return "unconfirmed", "---"


def classify_readiness(raw: object, expected_mode: str) -> str:
    """Independent fixed-only readiness diagnosis; never changes root PASS/BLOCK."""
    if type(raw) is not str or not 1 <= len(raw) <= 64000 or expected_mode not in MODES:
        return "unconfirmed"
    fields = {}
    codes = []
    for line in raw.splitlines():
        if line.startswith("INSTRUMENTATION_RESULT: "):
            key, sep, value = line[len("INSTRUMENTATION_RESULT: "):].partition("=")
            if not sep:
                return "unconfirmed"
            if key in ("mode", "readiness"):
                if key in fields:
                    return "unconfirmed"
                fields[key] = value.strip()
        elif line.startswith("INSTRUMENTATION_CODE: "):
            codes.append(line[len("INSTRUMENTATION_CODE: "):].strip())
        elif line.startswith(("INSTRUMENTATION_FAILED:", "INSTRUMENTATION_ABORTED:")):
            return "unconfirmed"
    allowed = {"ready", "not-requested", "activity-missing", "not-resumed", "no-focus", "no-layout", "not-ready"}
    if codes != ["-1"] or fields.get("mode") != expected_mode or fields.get("readiness") not in allowed:
        return "unconfirmed"
    return fields["readiness"]


def classify_idle(raw: object, expected_mode: str) -> str:
    """Read only an allowlisted idle category, never affect the three-root gate."""
    if type(raw) is not str or not 1 <= len(raw) <= 64000 or expected_mode not in MODES:
        return "unconfirmed"
    fields = {}
    codes = []
    for line in raw.splitlines():
        if line.startswith("INSTRUMENTATION_RESULT: "):
            key, sep, value = line[len("INSTRUMENTATION_RESULT: "):].partition("=")
            if not sep:
                return "unconfirmed"
            if key in ("mode", "idle"):
                if key in fields:
                    return "unconfirmed"
                fields[key] = value.strip()
        elif line.startswith("INSTRUMENTATION_CODE: "):
            codes.append(line[len("INSTRUMENTATION_CODE: "):].strip())
        elif line.startswith(("INSTRUMENTATION_FAILED:", "INSTRUMENTATION_ABORTED:")):
            return "unconfirmed"
    allowed = {"idle-observed", "idle-timeout", "not-requested"}
    if codes != ["-1"] or fields.get("mode") != expected_mode or fields.get("idle") not in allowed:
        return "unconfirmed"
    return fields["idle"]

def adb(*args: str, timeout: int = 35) -> str:
    proc = subprocess.run(["adb", *args], capture_output=True, text=True,
                          check=False, timeout=timeout)
    if proc.returncode:
        raise RuntimeError("ADB command failed")
    return proc.stdout


def run(mode: str) -> None:
    global STAGE
    if mode not in MODES:
        raise RuntimeError("invalid synthetic mode")
    try:
        STAGE = "api28-check"
        if adb("shell", "getprop", "ro.build.version.sdk").strip() != "28":
            raise RuntimeError("wrong API level")
        STAGE = "package-preflight"
        installed = adb("shell", "pm", "list", "packages", "com.negresco.finance")
        if any(line.strip() == "package:com.negresco.finance"
               for line in installed.splitlines()):
            raise RuntimeError("finance package must be absent from synthetic reference")
        STAGE = "synthetic-install"
        adb("install", "-t", "-r", APK, timeout=50)
        STAGE = "instrumentation-command"
        result = adb("shell", "am", "instrument", "-w", "-r", "-e", "mode", mode,
                     PACKAGE + "/.ProbeInstrumentation", timeout=100)
        STAGE = "root-verdict"
        outcome, pattern = classify(result, mode)
        readiness = classify_readiness(result, mode)
        idle = classify_idle(result, mode)
        print("ENV (LAB): persistent-readiness-category=" + readiness, flush=True)
        print("ENV (LAB): persistent-idle-category=" + idle, flush=True)
        print("ENV (LAB): persistent-root-category=" + outcome, flush=True)
        if outcome in ("all-present", "some-null"):
            print("ENV (LAB): persistent-root-pattern=" + pattern, flush=True)
        if outcome != "all-present":
            raise RuntimeError("synthetic root presence not proven")
        print("PASS (LAB): one persistent UiAutomation, three synthetic roots present mode=" + mode)
    finally:
        try:
            adb("uninstall", PACKAGE, timeout=25)
        except Exception:
            pass


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2 or sys.argv[1] not in MODES:
            raise RuntimeError("only allowlisted synthetic mode accepted")
        run(sys.argv[1])
    except Exception:
        print(BLOCK + " stage=" + STAGE, file=sys.stderr)
        raise SystemExit(1)

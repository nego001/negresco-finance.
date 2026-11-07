#!/usr/bin/env python3
"""Restricted diagnostic of synthetic Android Debug startup only.

Native messages are never printed, saved, uploaded or returned. Only one
fixed non-sensitive category may leave the ephemeral CI process.
"""
from __future__ import annotations

import re
import subprocess

APP_PACKAGE = "com.negresco.finance"
MAX_NATIVE_OUTPUT = 120_000
MAX_PACKAGE_OUTPUT = 1_000_000

def classify_permissions(snapshot: str) -> str:
    """Inspect the app's INTERNET permission using category-only output."""
    if not isinstance(snapshot, str) or len(snapshot) > MAX_PACKAGE_OUTPUT:
        return "internet-permission-unconfirmed"
    if "android.permission.INTERNET" not in snapshot:
        return "internet-permission-not-declared"
    if re.search(r"android\.permission\.INTERNET:\s*granted=true\b", snapshot):
        return "internet-permission-granted"
    if re.search(r"android\.permission\.INTERNET:\s*granted=false\b", snapshot):
        return "internet-permission-not-granted"
    return "internet-permission-unconfirmed"

def classify_native_startup(snapshot: str) -> str:
    """Allowlisted native failure categories, never excerpts or stack text."""
    if not isinstance(snapshot, str) or len(snapshot) > MAX_NATIVE_OUTPUT:
        return "native-startup-unconfirmed"
    low = snapshot.casefold()
    if "cleartext" in low and ("not permitted" in low or "blocked" in low):
        return "native-cleartext-denied"
    if ("securityexception" in low or "permission denial" in low) and "internet" in low:
        return "native-internet-permission-denied"
    if "unknownhostexception" in low:
        return "native-dns-unreachable"
    if ("connectexception" in low or "failed to connect" in low) and (
        "refused" in low or "econnrefused" in low
    ):
        return "native-connection-refused"
    if "sockettimeoutexception" in low or "etimedout" in low:
        return "native-connection-timeout"
    if "unable to load script" in low or "failed to load bundle" in low:
        return "native-js-bundle-load-error"
    if "reactnativejs" in low and ("typeerror:" in low or "referenceerror:" in low):
        return "native-js-runtime-error"
    return "native-startup-unconfirmed"

def _adb(arguments: list[str], timeout: int) -> str | None:
    try:
        result = subprocess.run(["adb", *arguments], capture_output=True,
                                text=True, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    return result.stdout

def reset_native_window() -> None:
    """Clear only disposable emulator diagnostics before synthetic app launch."""
    _adb(["logcat", "-c"], 10)


def collect_categories() -> tuple[str, str]:
    # -t bounds lines; -s restricts tags, and no stderr/stdout are logged.
    permissions = _adb(["shell", "dumpsys", "package", APP_PACKAGE], 20)
    perm_category = (classify_permissions(permissions) if permissions is not None
                     else "internet-permission-unconfirmed")
    native_lines = _adb(["logcat", "-d", "-t", "240", "-s",
                         "ReactNative:W", "ReactNativeJS:E", "ReactNativeJNI:E",
                         "AndroidRuntime:E", "NetworkSecurityConfig:W",
                         "DevServerHelper:W", "BundleDownloader:W",
                         "Expo:W", "ExpoUpdates:W"], 20)
    boot_category = (classify_native_startup(native_lines) if native_lines is not None
                     else "native-startup-unconfirmed")
    return perm_category, boot_category

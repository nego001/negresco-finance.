#!/usr/bin/env python3
"""Reject drift in the Expo app.config asset of the exact downloaded lab APK.

The compiled AndroidManifest.xml is verified in a distinct preceding workflow
step. Recheck the second Expo config representation, not just native metadata.
"""
from __future__ import annotations

import json
import stat
import sys
import zipfile
from pathlib import Path

ASSET = "assets/app.config"
APP_VERSION = "3.1.3"
PACKAGE = "com.negresco.finance"
VERSION_CODE = 34
SDK = "54.0.0"
PROJECT_ID = "a506611f-a159-4341-bed7-28dcbd47bf95"
ENDPOINT = "https://u.expo.dev/" + PROJECT_ID
CHANNEL = "preview"
MAX_APK = 1024 * 1024 * 1024
MAX_CONFIG = 65536

def block(message: str):
    raise ValueError("BLOCK: packaged Expo OTA config: " + message)

def unique_json(pairs):
    obj = {}
    for name, value in pairs:
        if name in obj:
            block("duplicated JSON key in packaged Expo config")
        obj[name] = value
    return obj

def fail_json_constant(value):
    block("non-finite JSON number in packaged Expo config")

def read_config(apk: Path):
    if apk.is_symlink() or not apk.is_file() or not 8 <= apk.stat().st_size <= MAX_APK:
        block("APK is missing, linked or oversized")
    try:
        with zipfile.ZipFile(apk) as archive:
            entries = [item for item in archive.infolist() if item.filename == ASSET]
            if len(entries) != 1:
                block("APK must have one unique assets/app.config")
            entry = entries[0]
            mode = stat.S_IFMT((entry.external_attr >> 16) & 0xFFFF) if entry.create_system == 3 else 0
            if entry.flag_bits & 1 or mode not in (0, stat.S_IFREG) or not 2 <= entry.file_size <= MAX_CONFIG:
                block("packaged Expo config ZIP entry is unsafe")
            with archive.open(entry) as stream:
                raw = stream.read(MAX_CONFIG + 1)
            if len(raw) != entry.file_size:
                block("packaged Expo config is incomplete or oversized")
    except (OSError, zipfile.BadZipFile, RuntimeError, EOFError, zipfile.LargeZipFile):
        block("APK config ZIP is invalid")
    try:
        return json.loads(raw.decode("utf-8", "strict"),
                          object_pairs_hook=unique_json,
                          parse_constant=fail_json_constant)
    except (ValueError, TypeError, UnicodeError) as exc:
        block("invalid JSON encoding or structure: " + str(exc))

def verify(expo):
    if not isinstance(expo, dict):
        block("packaged Expo config must be an object")
    if expo.get("version") != APP_VERSION or expo.get("runtimeVersion") != {"policy": "appVersion"}:
        block("packaged version/runtimeVersion is not pinned to appVersion 3.1.3")
    if expo.get("sdkVersion") != SDK or expo.get("platforms") != ["ios", "android"]:
        block("packaged Expo SDK/platforms differ from trusted laboratory policy")
    if expo.get("owner") != "negresco-finance":
        block("packaged Expo owner changed")
    extra = expo.get("extra")
    eas = extra.get("eas") if isinstance(extra, dict) else None
    if not isinstance(eas, dict) or eas.get("projectId") != PROJECT_ID:
        block("packaged EAS project identity differs from pinned endpoint")
    android = expo.get("android")
    if not isinstance(android, dict) or android.get("package") != PACKAGE or \
            android.get("versionCode") != VERSION_CODE or android.get("allowBackup") is not False:
        block("packaged Android identity/version/backup policy changed")
    updates = expo.get("updates")
    if not isinstance(updates, dict) or set(updates) != {
        "enabled", "checkAutomatically", "fallbackToCacheTimeout", "url", "requestHeaders"
    }:
        block("packaged OTA updates keys are missing or unexpected")
    if updates["enabled"] is not True or updates["checkAutomatically"] != "ON_LOAD" or \
            type(updates["fallbackToCacheTimeout"]) is not int or updates["fallbackToCacheTimeout"] != 0:
        block("packaged preview OTA enabling/check/fallback policy drift")
    if updates["url"] != ENDPOINT:
        block("packaged OTA endpoint differs from trusted preview endpoint")
    if updates["requestHeaders"] != {"expo-channel-name": CHANNEL}:
        block("packaged OTA channel must be preview only with no extra headers")
    # Preview intentionally has no Expo OTA code-signing keys. A stable release
    # MUST instead have independently signed OTA or updates.enabled=false.
    print("PASS: downloaded APK packaged Expo config agrees with pinned preview OTA lab policy")

def main(argv):
    if len(argv) != 2:
        print("Usage: verify_packaged_expo_config.py <downloaded.apk>", file=sys.stderr)
        return 2
    try:
        verify(read_config(Path(argv[1])))
        return 0
    except (OSError, ValueError, UnicodeError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

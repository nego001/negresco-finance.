#!/usr/bin/env python3
"""Validate Expo's Android runtimeVersion resource before it is compiled.

A localized expo_runtime_version can silently change OTA compatibility.
The check is intentionally source-of-truth aware but does not claim to audit
compiled resources. Android APK compiled checks remain separate.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

ANDROID = "{http://schemas.android.com/apk/res/android}"
NAME = "expo_runtime_version"
META = "expo.modules.updates.EXPO_RUNTIME_VERSION"
MAX_BYTES = 1024 * 1024


def block(reason):
    raise ValueError("BLOCK: generated Expo OTA runtime resource: " + reason)


def read_xml(file):
    if file.is_symlink() or not file.is_file() or not 0 < file.stat().st_size <= MAX_BYTES:
        block("XML input is missing, linked, empty or oversized")
    raw = file.read_bytes()
    if b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
        block("XML entities and DTDs are forbidden")
    return ET.fromstring(raw)


def check(app_file, manifest_file, values_file, res_dir):
    app_file, manifest_file, values_file, res_dir = map(Path, (
        app_file, manifest_file, values_file, res_dir
    ))
    if app_file.is_symlink() or not app_file.is_file() or not 0 < app_file.stat().st_size <= MAX_BYTES:
        block("app.json is missing or unsafe")
    data = json.loads(app_file.read_text(encoding="utf-8"))
    expo = data.get("expo") if isinstance(data, dict) else None
    if not isinstance(expo, dict) or expo.get("runtimeVersion") != {"policy": "appVersion"}:
        block("runtimeVersion must use the appVersion policy")
    version = expo.get("version")
    if not isinstance(version, str) or not re.fullmatch(
        r"[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?", version
    ):
        block("invalid explicit Expo app version")

    manifest = read_xml(manifest_file)
    if manifest.tag != "manifest":
        block("Android manifest root changed")
    apps = manifest.findall("application")
    if len(apps) != 1:
        block("expected exactly one Android application")
    runtime = [item for item in apps[0].findall("meta-data")
               if item.get(ANDROID + "name") == META]
    if len(runtime) != 1 or runtime[0].get(ANDROID + "value") != "@string/" + NAME:
        block("manifest must reference only the locked Expo runtime resource")

    if res_dir.is_symlink() or not res_dir.is_dir():
        block("Android resource directory missing or symlinked")
    default_dir = values_file.parent
    if (default_dir.name != "values" or default_dir.parent.resolve() != res_dir.resolve()
            or values_file.name != "strings.xml"):
        block("expected canonical res/values/strings.xml")
    strings = read_xml(values_file)
    if strings.tag != "resources":
        block("Android strings resources root changed")
    runtime_values = [x for x in strings if x.tag == "string" and x.get("name") == NAME]
    if len(runtime_values) != 1:
        block("runtime resource must occur exactly once in default strings.xml")
    string = runtime_values[0]
    if string.attrib != {"name": NAME, "translatable": "false"}:
        block("runtime resource must have translatable=false and no other attributes")
    if string.text != version or len(string) != 0:
        block("runtime resource differs from pinned appVersion")

    # No competing string in a values qualifier, even if Play or a plugin
    # inserts another candidate for locale-specific resource resolution.
    values_dirs = [d for d in res_dir.iterdir()
                   if d.name == "values" or d.name.startswith("values-")]
    if len(values_dirs) > 256:
        block("too many Android values directories")
    seen_default = 0
    for directory in values_dirs:
        if directory.is_symlink() or not directory.is_dir():
            block("linked or malformed Android values directory")
        files = list(directory.glob("*.xml"))
        if len(files) > 256:
            block("too many Android values resources")
        for file in files:
            root = read_xml(file)
            if root.tag != "resources":
                block("invalid resources XML root")
            for item in root:
                if item.get("name") != NAME:
                    continue
                if item.tag != "string" and not (
                    item.tag == "item" and item.get("type") == "string"
                ):
                    continue
                if file == values_file and item is string:
                    # ET parses a fresh tree. Count based on location instead.
                    pass
                if file == values_file and item.tag == "string" and \
                        item.get("translatable") == "false" and item.text == version:
                    seen_default += 1
                    continue
                block("duplicate/translated runtime resource in Android values")
    if seen_default != 1:
        block("runtime string resource has an ambiguous default definition")
    return version


def main(argv):
    if len(argv) != 5:
        print("Usage: verify_generated_ota_runtime.py <app.json> <AndroidManifest.xml> <strings.xml> <res-directory>", file=sys.stderr)
        return 2
    try:
        result = check(*argv[1:])
        print("PASS: generated Expo OTA runtime is non-translatable appVersion " + result)
        return 0
    except (OSError, UnicodeError, TypeError, ValueError, ET.ParseError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

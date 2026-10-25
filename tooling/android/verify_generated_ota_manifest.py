#!/usr/bin/env python3
"""Fail-closed proof that Expo CNG wrote stable OTA policy to AndroidManifest.

This checks the *generated native manifest*, not the final compiled APK.
The separate source gate validates public X.509 keys and validity windows.
"""
import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

ANDROID = "{http://schemas.android.com/apk/res/android}"
PREFIX = "expo.modules.updates."
CERT = PREFIX + "CODE_SIGNING_CERTIFICATE"
METADATA = PREFIX + "CODE_SIGNING_METADATA"
ENABLED = PREFIX + "ENABLED"


def reject(message):
    raise ValueError("BLOCK: generated Android OTA security policy: " + message)


def read_bounded(file, limit):
    p = Path(file)
    if p.is_symlink() or not p.is_file() or p.stat().st_size > limit:
        reject("input must be a bounded regular non-symlink file")
    return p.read_bytes()


def certificate_bytes(config, app_json):
    requested = config.get("codeSigningCertificate")
    if not isinstance(requested, str) or not requested.strip():
        reject("missing certificate path")
    root = app_json.parent.resolve()
    relative_path = Path(requested)
    if relative_path.is_absolute():
        reject("absolute certificate path")
    destination = (root / relative_path).resolve()
    if destination == root or root not in destination.parents:
        reject("certificate path escapes app directory")
    cursor = root
    for segment in relative_path.parts:
        cursor /= segment
        if cursor.is_symlink():
            reject("symlink in certificate path")
    raw = read_bounded(destination, 32768)
    if not raw:
        reject("certificate must not be empty")
    try:
        return raw.decode("utf-8")
    except UnicodeError:
        reject("certificate is not UTF-8")


def check(app_json_path, manifest_path):
    app_json = Path(app_json_path).resolve()
    app = json.loads(read_bounded(app_json, 524288))
    expo = app.get("expo") if isinstance(app, dict) else None
    config = expo.get("updates") if isinstance(expo, dict) else None
    if not isinstance(config, dict):
        reject("missing explicit Expo updates configuration")

    binary_xml = read_bounded(manifest_path, 1048576)
    if b"<!DOCTYPE" in binary_xml.upper() or b"<!ENTITY" in binary_xml.upper():
        reject("doctype/entities are forbidden in generated manifest")
    root = ET.fromstring(binary_xml)
    if root.tag != "manifest":
        reject("unexpected AndroidManifest root")
    apps = root.findall("application")
    if len(apps) != 1:
        reject("expected exactly one Android application")

    metadata = {}
    for item in apps[0].findall("meta-data"):
        name = item.get(ANDROID + "name")
        if not isinstance(name, str):
            continue
        if name in metadata:
            reject("duplicate application metadata: " + name)
        metadata[name] = item.get(ANDROID + "value")

    signing_names = {name for name in metadata if name.startswith(PREFIX + "CODE_SIGNING_")}
    if not signing_names.issubset({CERT, METADATA}):
        reject("unexpected code signing metadata")
    if config.get("enabled") is False:
        if metadata.get(ENABLED) != "false":
            reject("embedded-only mode not explicitly disabled in native manifest")
        if signing_names:
            reject("disabled OTA must not embed code signing metadata")
        return "embedded-only"

    if config.get("enabled") is not True:
        reject("enabled must be an explicit boolean")
    if metadata.get(ENABLED) not in ("true",):
        reject("native Expo updates must be explicitly enabled")
    if signing_names != {CERT, METADATA}:
        reject("signed OTA certificate and metadata not both embedded")
    expected_cert = certificate_bytes(config, app_json)
    if metadata[CERT] != expected_cert:
        reject("native embedded certificate differs from checked-in certificate")
    expected_meta = config.get("codeSigningMetadata")
    if not isinstance(expected_meta, dict) or set(expected_meta) != {"alg", "keyid"}:
        reject("invalid expected code signing metadata")
    try:
        actual_meta = json.loads(metadata[METADATA])
    except (TypeError, ValueError):
        reject("native code signing metadata is not valid JSON")
    if not isinstance(actual_meta, dict) or actual_meta != expected_meta:
        reject("native signing algorithm/keyid differs from app configuration")
    return "signed-ota"


def main(argv):
    if len(argv) != 3:
        print("Usage: verify_generated_ota_manifest.py <app.json> <AndroidManifest.xml>", file=sys.stderr)
        return 2
    try:
        mode = check(argv[1], argv[2])
        print("PASS: generated Android manifest OTA policy " + mode)
        return 0
    except (OSError, UnicodeError, ET.ParseError, ValueError, TypeError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

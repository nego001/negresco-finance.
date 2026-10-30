#!/usr/bin/env python3
"""Narrow, disposable Android Debug-manifest denied-permission removal.

The policy for the *final assembled APK* remains a separate fail-closed gate.
Do not run against a Release manifest or a source-controlled product artifact.
"""
from __future__ import annotations
import stat
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ANDROID = "http://schemas.android.com/apk/res/android"
TOOLS = "http://schemas.android.com/tools"
DENIED = (
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.READ_MEDIA_IMAGES",
)
ET.register_namespace("android", ANDROID)
ET.register_namespace("tools", TOOLS)


def patch_debug_manifest(file: Path) -> None:
    if file.name != "AndroidManifest.xml" or file.parent.name != "debug":
        raise ValueError("only Android Debug manifest permitted")
    if file.is_symlink() or not file.is_file():
        raise ValueError("Debug AndroidManifest not regular")
    if not stat.S_ISREG(file.stat().st_mode):
        raise ValueError("Debug AndroidManifest must be regular")
    if not 30 <= file.stat().st_size <= 128 * 1024:
        raise ValueError("Debug AndroidManifest outside permitted size")
    root = ET.parse(file).getroot()
    if root.tag != "manifest":
        raise ValueError("Debug AndroidManifest lacks manifest root")
    for node in list(root):
        if node.tag in ("uses-permission", "uses-permission-sdk-23") and node.get(
            f"{{{ANDROID}}}name"
        ) in DENIED:
            root.remove(node)
    for permission in DENIED:
        ET.SubElement(
            root, "uses-permission",
            {f"{{{ANDROID}}}name": permission, f"{{{TOOLS}}}node": "remove"},
        )
    # Postcondition: each denied permission has only a declarative removal
    # marker, never an active declaration in this high-priority Debug overlay.
    for permission in DENIED:
        matching = [
            node for node in root
            if node.tag in ("uses-permission", "uses-permission-sdk-23")
            and node.get(f"{{{ANDROID}}}name") == permission
        ]
        if (len(matching) != 1 or matching[0].tag != "uses-permission" or
                matching[0].get(f"{{{TOOLS}}}node") != "remove"):
            raise ValueError("Debug permission removal postcondition failed")
    ET.ElementTree(root).write(file, encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("BLOCK (LAB): expected exactly one Debug manifest", file=sys.stderr)
        raise SystemExit(2)
    try:
        patch_debug_manifest(Path(sys.argv[1]))
    except (ValueError, OSError, ET.ParseError):
        # Do not print potentially private XML, filesystem paths or exceptions.
        print("BLOCK (LAB): Debug permission manifest could not be restricted", file=sys.stderr)
        raise SystemExit(1)
    print("PASS (LAB): four denied permissions marked for removal in Debug overlay")

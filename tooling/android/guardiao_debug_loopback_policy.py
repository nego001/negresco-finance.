#!/usr/bin/env python3
"""Strictly scoped Android Debug resource overlay for local Metro testing.

The release resource, native product config and main APK are never modified.
Only three emulator/loopback hostnames may use cleartext inside this Debug APK.
"""
from __future__ import annotations

import re
import stat
import subprocess
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path("apps/mobile/android/app")
RESOURCE = "negresco_network_security.xml"
HOSTS = ("localhost", "127.0.0.1", "10.0.2.2")
RELEASE_XML = (
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<network-security-config>\n'
    '  <base-config cleartextTrafficPermitted="false">\n'
    '    <trust-anchors>\n'
    '      <certificates src="system"/>\n'
    '    </trust-anchors>\n'
    '  </base-config>\n'
    '</network-security-config>\n'
)
DEBUG_XML = (
    RELEASE_XML.replace(
        '</network-security-config>\n',
        '  <domain-config cleartextTrafficPermitted="true">\n'
        + "".join('    <domain>' + host + '</domain>\n' for host in HOSTS)
        + '  </domain-config>\n</network-security-config>\n'
    )
)
APK = Path("apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk")


def ensure_regular(file: Path) -> None:
    if file.is_symlink() or not file.is_file() or not stat.S_ISREG(file.stat().st_mode):
        raise ValueError("policy file must be regular")


def install(root: Path = ROOT) -> None:
    # Paths are fixed; reject symlinked project components before mkdir/write.
    main = root / "src/main/res/xml" / RESOURCE
    debug_dir = root / "src/debug/res/xml"
    debug = debug_dir / RESOURCE
    for part in (root, root / "src", root / "src/debug", root / "src/debug/res", debug_dir):
        if part.is_symlink():
            raise ValueError("symlinked Debug resource directory")
    ensure_regular(main)
    if main.read_text(encoding="utf-8") != RELEASE_XML:
        raise ValueError("release network policy differs from approved fail-closed form")
    if debug.exists() or debug.is_symlink():
        ensure_regular(debug)
        if debug.read_text(encoding="utf-8") != DEBUG_XML:
            raise ValueError("unexpected existing Debug network policy")
    else:
        debug_dir.mkdir(parents=True, exist_ok=True)
        with debug.open("x", encoding="utf-8") as stream:
            stream.write(DEBUG_XML)
    # Must remain an overlay of the SAME resource name, never a global manifest edit.
    tree = ET.fromstring(debug.read_text(encoding="utf-8"))
    base, domain = list(tree)
    if (tree.tag != "network-security-config" or len(tree) != 2 or
        base.tag != "base-config" or base.attrib != {"cleartextTrafficPermitted":"false"} or
        domain.tag != "domain-config" or domain.attrib != {"cleartextTrafficPermitted":"true"} or
        [x.text for x in domain] != list(HOSTS) or
        any(x.tag != "domain" or x.attrib for x in domain) or
        len(base) != 1 or base[0].tag != "trust-anchors" or
        len(base[0]) != 1 or base[0][0].attrib != {"src":"system"}):
        raise ValueError("Debug network policy host or trust scope violated")


def verify_apk(apk: Path = APK, aapt: str = "aapt") -> None:
    ensure_regular(apk)
    try:
        proc = subprocess.run(
            [aapt, "dump", "xmltree", str(apk), "res/xml/" + RESOURCE],
            capture_output=True, text=True, timeout=30, check=False
        )
    except (OSError, subprocess.TimeoutExpired):
        raise ValueError("compiled Debug network policy inspection unavailable") from None
    if proc.returncode or len(proc.stdout) > 160_000:
        raise ValueError("compiled Debug network policy inspection rejected")
    xmltree = proc.stdout
    # AAPT's binary-XML dump describes the actual compiled resource included
    # in this APK. Never print the dump or include it in an artifact.
    if (not re.search(r"E: base-config\b", xmltree) or
        not re.search(r"E: domain-config\b", xmltree) or
        len(re.findall(r"E: domain\s*\(", xmltree)) != 3):
        raise ValueError("compiled Debug network configuration is missing")
    for host in HOSTS:
        if len(re.findall(r'C:\s*"' + re.escape(host) + r'"', xmltree)) != 1:
            raise ValueError("compiled Debug loopback host set differs")
    attrs = re.findall(r"^\s*A: (?:android:)?cleartextTrafficPermitted[^\n]*$", xmltree, re.M)
    # AAPT booleans are encoded 0xffffffff/0x00000000, with vendor formats
    # allowing 0x1/0x0. Check both attributes in expected element order.
    if len(attrs) != 2:
        raise ValueError("compiled Debug cleartext rules not uniquely encoded")
    def value(line: str) -> bool | None:
        match = re.search(r"\(type 0x12\)0x([0-9a-fA-F]+)", line)
        if match:
            return int(match.group(1), 16) != 0
        if re.search(r'=\s*"false"\b|=\s*false\b', line):
            return False
        if re.search(r'=\s*"true"\b|=\s*true\b', line):
            return True
        return None
    if [value(a) for a in attrs] != [False, True]:
        raise ValueError("compiled Debug policy has unintended global cleartext")


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "install":
        install()
        print("PASS (LAB): Debug only loopback policy overlay installed")
    elif len(sys.argv) == 4 and sys.argv[1] == "verify-apk":
        verify_apk(Path(sys.argv[2]), sys.argv[3])
        print("PASS (LAB): compiled Debug APK limits cleartext to loopback hosts")
    else:
        raise ValueError("only fixed Debug policy commands permitted")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, ET.ParseError):
        print("BLOCK (LAB): temporary Debug network policy not proven", file=sys.stderr)
        raise SystemExit(1)

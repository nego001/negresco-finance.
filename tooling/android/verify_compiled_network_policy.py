#!/usr/bin/env python3
"""Audit the compiled Android Network Security Configuration in an APK.

Run from the unprivileged build, before preserving the release candidate.
Fail closed. Resolves the manifest ID through the resources table, then
checks the actual compiled XML, avoiding guesses about res/xml paths.
"""
from __future__ import annotations

import re
import stat
import subprocess
import sys
import zipfile
from pathlib import Path

NAME = "xml/negresco_network_security"
MAX_OUTPUT = 4 * 1024 * 1024
MAX_POLICY_BYTES = 64 * 1024


def reject(reason: str) -> None:
    raise ValueError("BLOCK: compiled Android network policy: " + reason)


def aapt2_dump(binary: str, apk: Path, command: str, file: str | None = None) -> str:
    args = [binary, "dump", command, str(apk)]
    if file is not None:
        args += ["--file", file]
    result = subprocess.run(args, text=True, capture_output=True, timeout=30, check=False)
    if result.returncode or len(result.stdout) > MAX_OUTPUT:
        reject("aapt2 " + command + " failed or returned unbounded output")
    return result.stdout


def parse_reference(manifest: str) -> str:
    lines = manifest.splitlines()
    apps = [line for line in lines if re.match(r"^\s*E: application(?:\s|$)", line)]
    if len(apps) != 1:
        reject("expected exactly one compiled application element")
    index = lines.index(apps[0])
    attributes = []
    for line in lines[index + 1:]:
        if re.match(r"^\s*E: ", line):
            break
        if re.match(r"^\s*A: ", line):
            attributes.append(line)
    values = [line for line in attributes if re.search(r"\bnetworkSecurityConfig\(", line)]
    if len(values) != 1:
        reject("missing or duplicate compiled networkSecurityConfig reference")
    match = re.search(r"networkSecurityConfig\(0x[0-9a-fA-F]{8}\)=@(0x[0-9a-fA-F]{8})(?:\s|$)", values[0])
    if not match:
        reject("invalid compiled networkSecurityConfig reference")
    return match.group(1).lower()


def resolve_resource(resources: str, resource_id: str) -> str:
    lines = resources.splitlines()
    head = re.compile(r"^\s*resource\s+(0x[0-9a-fA-F]{8})\s+(?:[^\s:]+:)?(xml/[^\s]+)")
    matches = []
    for i, line in enumerate(lines):
        h = head.match(line)
        if not h or h.group(1).lower() != resource_id:
            continue
        if h.group(2) != NAME:
            reject("manifest points to an unexpected XML resource")
        following = []
        for next_line in lines[i + 1:]:
            if head.match(next_line):
                break
            following.append(next_line)
        paths = set(re.findall(r"\bres/[a-zA-Z0-9_./-]+\.xml\b", "\n".join(following)))
        if len(paths) != 1:
            reject("resource table must resolve to exactly one packaged XML path")
        matches.append(next(iter(paths)))
    if len(matches) != 1:
        reject("resource ID is missing or ambiguous in resources.arsc")
    path = matches[0]
    if not path.startswith("res/") or ".." in path.split("/") or not re.fullmatch(r"res/[a-zA-Z0-9_./-]+\.xml", path):
        reject("unsafe compiled XML resource path")
    return path


def verify_compiled_policy(tree: str) -> None:
    lines = tree.splitlines()
    elements = []
    attrs = []
    for line in lines:
        el = re.match(r"^(\s*)E: ([a-zA-Z0-9_-]+)(?:\s|$)", line)
        if el:
            elements.append((len(el.group(1)), el.group(2)))
        at = re.match(r"^(\s*)A: ([a-zA-Z0-9_-]+)(?:\(0x[0-9a-fA-F]{8}\))?=(.*)$", line)
        if at:
            attrs.append((len(at.group(1)), at.group(2), at.group(3).strip()))
    expected = [
        "network-security-config", "base-config", "trust-anchors", "certificates"
    ]
    if [tag for _, tag in elements] != expected:
        reject("unexpected XML elements, domain overrides or missing trust anchors")
    if any(elements[i + 1][0] <= elements[i][0] for i in range(3)):
        reject("unexpected XML nesting in network policy")
    if len(attrs) != 2:
        reject("compiled network policy must contain exactly two attributes")
    clear = [x for x in attrs if x[1] == "cleartextTrafficPermitted"]
    source = [x for x in attrs if x[1] == "src"]
    if len(clear) != 1 or not re.match(r"^\(type 0x12\)0x0+$", clear[0][2]):
        reject("cleartextTrafficPermitted must be explicitly Boolean false")
    # Attributes of base-config share the indentation of its child
    # trust-anchors element in aapt2 XML tree output.
    if clear[0][0] != elements[2][0]:
        reject("cleartext attribute not nested under base-config")
    if len(source) != 1:
        reject("network policy must use one trusted certificate source")
    if source[0][0] <= elements[3][0]:
        reject("certificate source must belong to certificates element")
    value = source[0][2]
    # AAPT2 may preserve the original string in (Raw: "..."), or quote
    # the resolved literal directly; never accept user or @raw anchors.
    if not (re.fullmatch(r'"system"(?:\s+\(Raw: "system"\))?', value)
            or re.fullmatch(r'\(type 0x03\)0x[0-9a-fA-F]+\s+\(Raw: "system"\)', value)
            or re.fullmatch(r'"system"', value)):
        reject("certificate source must be system only")


def inspect(apk: Path, binary: str) -> None:
    if not apk.is_file() or not apk.stat().st_size:
        reject("APK missing or empty")
    manifest = aapt2_dump(binary, apk, "xmltree", "AndroidManifest.xml")
    reference = parse_reference(manifest)
    resources = aapt2_dump(binary, apk, "resources")
    path = resolve_resource(resources, reference)
    with zipfile.ZipFile(apk) as archive:
        files = [x for x in archive.infolist() if x.filename == path]
        if len(files) != 1:
            reject("compiled network XML missing or duplicated in APK")
        member = files[0]
        mode = stat.S_IFMT((member.external_attr >> 16) & 0xFFFF) if member.create_system == 3 else 0
        if mode not in (0, stat.S_IFREG) or not 0 < member.file_size <= MAX_POLICY_BYTES:
            reject("compiled network XML is linked, empty, special or unbounded")
    verify_compiled_policy(aapt2_dump(binary, apk, "xmltree", path))
    print("PASS: packaged network security XML forbids cleartext and trusts system certificates only")


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("Usage: verify_compiled_network_policy.py <apk> <aapt2>", file=sys.stderr)
        return 2
    try:
        inspect(Path(argv[1]).resolve(), argv[2])
    except (OSError, ValueError, zipfile.BadZipFile, subprocess.TimeoutExpired) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

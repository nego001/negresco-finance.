#!/usr/bin/env python3
"""Fail closed if compiled Android backup/transfer XML allows data extraction.

Analyze the signed APK rather than trusting the Expo XML source. Resource IDs
are resolved through resources.arsc, so AAPT2 resource path obfuscation is safe.
"""
from __future__ import annotations

import re
import stat
import subprocess
import sys
import zipfile
from pathlib import Path

DOMAINS = frozenset((
    "root", "file", "database", "sharedpref", "external",
    "device_root", "device_file", "device_database", "device_sharedpref"
))
POLICIES = (
    ("dataExtractionRules", "xml/negresco_no_data_extraction", "modern"),
    ("fullBackupContent", "xml/negresco_legacy_no_backup", "legacy"),
)
RESOURCE = re.compile(r"^\s*resource\s+(0x[0-9a-fA-F]{8})\s+(?:[^\s:]+:)?(xml/[^\s]+)")
MAX_DUMP = 4 * 1024 * 1024
MAX_XML = 64 * 1024


def deny(reason: str) -> None:
    raise ValueError("BLOCK: compiled Android backup policy: " + reason)


def dump(tool: str, apk: Path, category: str, filename: str | None = None) -> str:
    args = [tool, "dump", category, str(apk)]
    if filename is not None:
        args += ["--file", filename]
    try:
        proc = subprocess.run(args, text=True, capture_output=True, timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        deny("aapt2 resource inspection unavailable")
    if proc.returncode or len(proc.stdout) > MAX_DUMP:
        deny("aapt2 inspection failed or exceeded size limit")
    return proc.stdout


def manifest_ids(raw: str) -> dict[str, str]:
    lines = raw.splitlines()
    found = [(idx, line) for idx, line in enumerate(lines)
             if re.match(r"^\s*E: application(?:\s|$)", line)]
    if len(found) != 1:
        deny("exactly one compiled application required")
    app_attrs = []
    for line in lines[found[0][0] + 1:]:
        if re.match(r"^\s*E: ", line):
            break
        if re.match(r"^\s*A: ", line):
            app_attrs.append(line)
    refs = {}
    for name, _, _ in POLICIES:
        matches = [a for a in app_attrs if re.search(r"\bandroid:" + name + r"\(", a)]
        if len(matches) != 1:
            deny("missing or duplicate " + name + " reference")
        match = re.search(r"android:" + name +
                          r"\(0x[0-9a-fA-F]{8}\)=@(0x[0-9a-fA-F]{8})(?:\s|$)",
                          matches[0])
        if not match:
            deny("invalid compiled " + name + " resource ID")
        refs[name] = match.group(1).lower()
    if len(set(refs.values())) != len(refs):
        deny("modern and legacy backup rules share one compiled resource")
    return refs


def compiled_path(resources: str, resource_id: str, expected: str) -> str:
    lines = resources.splitlines()
    results = []
    for i, line in enumerate(lines):
        header = RESOURCE.match(line)
        if not header or header.group(1).lower() != resource_id:
            continue
        if header.group(2) != expected:
            deny("backup resource name changed: " + expected)
        following = []
        for nxt in lines[i + 1:]:
            if RESOURCE.match(nxt):
                break
            following.append(nxt)
        locations = set(re.findall(r"\bres/[a-zA-Z0-9_./-]+\.xml\b",
                                   "\n".join(following)))
        if len(locations) != 1:
            deny("missing or ambiguous resource table path: " + expected)
        results.extend(locations)
    if len(results) != 1:
        deny("missing or duplicate resource ID: " + expected)
    file = results[0]
    if not re.fullmatch(r"res/[a-zA-Z0-9_./-]+\.xml", file) or ".." in file.split("/"):
        deny("unsafe compiled backup XML path")
    return file


def parse_tree(raw: str) -> dict:
    roots = []
    stack = []
    for line in raw.splitlines():
        e = re.match(r"^(\s*)E: ([a-zA-Z0-9_-]+)(?:\s|$)", line)
        if e:
            depth = len(e.group(1))
            node = {"tag": e.group(2), "depth": depth, "attrs": {}, "children": []}
            while stack and stack[-1]["depth"] >= depth:
                stack.pop()
            if stack:
                stack[-1]["children"].append(node)
            else:
                roots.append(node)
            stack.append(node)
            continue
        a = re.match(r"^\s*A: ([a-zA-Z0-9_-]+)(?:\(0x[0-9a-fA-F]{8}\))?=(.*)$", line)
        if a:
            if not stack or a.group(1) in stack[-1]["attrs"]:
                deny("orphan or duplicate compiled XML attribute")
            stack[-1]["attrs"][a.group(1)] = a.group(2)
    if len(roots) != 1:
        deny("backup XML must have exactly one root element")
    return roots[0]


def literal(value: str, expected: str) -> bool:
    esc = re.escape(expected)
    return bool(
        re.fullmatch(r'(?:' + esc + r'|"' + esc +
                     r'")(?: \(Raw: "' + esc + r'"\))?', value) or
        re.fullmatch(r'\(type 0x03\)0x[0-9a-fA-F]+ \(Raw: "' +
                     esc + r'"\)', value)
    )


def boolean_true(value: str) -> bool:
    return bool(
        literal(value, "true") or
        re.fullmatch(r"\(type 0x12\)0x(?:1|ffffffff)", value)
    )


def exclusions(section: dict, label: str) -> None:
    if len(section["children"]) != len(DOMAINS):
        deny(label + " must contain exactly nine exclusions")
    seen = set()
    for child in section["children"]:
        if child["tag"] != "exclude" or child["children"]:
            deny(label + " contains an inclusion or nested exception")
        if set(child["attrs"]) != {"domain", "path"}:
            deny(label + " exclusion requires only domain and path")
        domain = next((d for d in DOMAINS
                       if literal(child["attrs"]["domain"], d)), None)
        if domain is None or domain in seen:
            deny(label + " domain is missing, duplicated or unexpected")
        if not literal(child["attrs"]["path"], "."):
            deny(label + " contains a partial/unsafe exclusion path")
        seen.add(domain)
    if seen != DOMAINS:
        deny(label + " has incomplete domain coverage")


def validate(tree: str, kind: str) -> None:
    root = parse_tree(tree)
    if kind == "modern":
        if root["tag"] != "data-extraction-rules" or root["attrs"] or len(root["children"]) != 2:
            deny("modern extraction policy root or sections changed")
        cloud, transfer = root["children"]
        if cloud["tag"] != "cloud-backup" or transfer["tag"] != "device-transfer":
            deny("cloud/transfer rules changed or reordered")
        if set(cloud["attrs"]) != {"disableIfNoEncryptionCapabilities"} or not boolean_true(
                cloud["attrs"]["disableIfNoEncryptionCapabilities"]):
            deny("cloud encryption capability requirement missing")
        if transfer["attrs"]:
            deny("device-transfer has unexpected attributes")
        exclusions(cloud, "cloud-backup")
        exclusions(transfer, "device-transfer")
    elif kind == "legacy":
        if root["tag"] != "full-backup-content" or root["attrs"]:
            deny("legacy backup policy root or attributes changed")
        exclusions(root, "legacy full-backup")
    else:
        deny("unknown backup policy category")


def inspect(apk: Path, tool: str) -> None:
    if not apk.is_file() or not apk.stat().st_size:
        deny("APK is missing or empty")
    ids = manifest_ids(dump(tool, apk, "xmltree", "AndroidManifest.xml"))
    resources = dump(tool, apk, "resources")
    paths = [(kind, compiled_path(resources, ids[name], resource))
             for name, resource, kind in POLICIES]
    if len(set(path for _, path in paths)) != len(paths):
        deny("two backup resource IDs point to the same packaged XML")
    try:
        with zipfile.ZipFile(apk) as archive:
            for kind, path in paths:
                members = [m for m in archive.infolist() if m.filename == path]
                if len(members) != 1:
                    deny(kind + " policy XML missing or duplicated in APK")
                item = members[0]
                mode = stat.S_IFMT((item.external_attr >> 16) & 0xffff) if item.create_system == 3 else 0
                if mode not in (0, stat.S_IFREG) or not 0 < item.file_size <= MAX_XML:
                    deny(kind + " XML empty, linked, special or oversized")
    except (OSError, zipfile.BadZipFile):
        deny("APK ZIP structure is invalid")
    for kind, path in paths:
        validate(dump(tool, apk, "xmltree", path), kind)
    print("PASS: compiled APK denies cloud backup, device transfer and legacy full backup")


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("Usage: verify_compiled_backup_policy.py <apk> <aapt2>", file=sys.stderr)
        return 2
    try:
        inspect(Path(argv[1]).resolve(), argv[2])
    except (OSError, ValueError, subprocess.TimeoutExpired, zipfile.BadZipFile) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

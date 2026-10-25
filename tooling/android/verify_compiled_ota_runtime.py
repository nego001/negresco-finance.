#!/usr/bin/env python3
"""Fail-closed check of the compiled OTA runtimeVersion resource in an APK.

Reads the compiled manifest and resources.arsc through Android's AAPT2 rather
than trusting generated XML files or a plaintext occurrence in a ZIP.
"""
from __future__ import annotations

import re
import stat
import subprocess
import sys
import zipfile
from pathlib import Path

NAME = "expo.modules.updates.EXPO_RUNTIME_VERSION"
RESOURCE = "string/expo_runtime_version"
MAX_DUMP = 32 * 1024 * 1024
MAX_APK = 1024 * 1024 * 1024
MAX_TABLE = 48 * 1024 * 1024
RE_ID = r"0x[0-9a-fA-F]{8}"
RE_HEADER = re.compile(r"^\s*resource\s+(0x[0-9a-fA-F]{8})\s+(?:[^\s:]+:)?(string/[^\s:]+)")
RE_ELEMENT = re.compile(r"^(\s*)E:\s+([a-zA-Z0-9_-]+)(?:\s|$)")
RE_ATTRIBUTE = re.compile(r"^\s*A:\s+android:(name|value)\(0x[0-9a-fA-F]{8}\)=(.*)$")
RE_VERSION = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?")


def block(reason):
    raise ValueError("BLOCK: compiled Android OTA runtime resource: " + reason)


def run_dump(aapt2: str, apk: Path, what: str, file: str | None = None) -> str:
    args = [aapt2, "dump", what, str(apk)]
    if file is not None:
        args += ["--file", file]
    try:
        p = subprocess.run(args, capture_output=True, text=True,
                           timeout=35, encoding="utf-8", errors="strict")
    except (OSError, subprocess.TimeoutExpired, UnicodeError):
        block("AAPT2 parser is unavailable")
    if p.returncode != 0 or not p.stdout or len(p.stdout.encode("utf-8")) > MAX_DUMP:
        block("AAPT2 failed or inspection output exceeds bounds")
    return p.stdout


def apk_contents(apk: Path) -> None:
    if apk.is_symlink() or not apk.is_file() or not 0 < apk.stat().st_size <= MAX_APK:
        block("APK is missing, linked or oversized")
    try:
        with zipfile.ZipFile(apk) as archive:
            for name, limit in (("AndroidManifest.xml", 2 * 1024 * 1024),
                                ("resources.arsc", MAX_TABLE)):
                items = [item for item in archive.infolist() if item.filename == name]
                if len(items) != 1:
                    block(name + " must be unique inside APK")
                item = items[0]
                kind = stat.S_IFMT((item.external_attr >> 16) & 0xffff) if item.create_system == 3 else 0
                if item.flag_bits & 1 or kind not in (0, stat.S_IFREG) or not 8 <= item.file_size <= limit:
                    block(name + " has unsafe ZIP attributes")
    except (OSError, zipfile.BadZipFile):
        block("APK ZIP cannot be inspected")


def typed_reference(raw: str) -> str | None:
    m = re.match(r"^@(0x[0-9a-fA-F]{8})(?:\s+\(Raw:\s+\"[^\"]*\"\))?\s*$", raw)
    return m.group(1).lower() if m else None


def manifest_resource_id(raw: str) -> str:
    stack: list[tuple[str, int]] = []
    apps = 0
    refs = []
    node_name = None
    node_value = None

    def finish_node() -> None:
        if node_name is not None and NAME in node_name:
            if node_name != '"' + NAME + '" (Raw: "' + NAME + '")' and node_name != '"' + NAME + '"':
                block("OTA runtime metadata name is ambiguous")
            if not node_value:
                block("OTA runtime metadata lacks compiled value reference")
            reference = typed_reference(node_value)
            if reference is None:
                block("OTA runtime metadata must be a typed resource reference")
            refs.append(reference)

    for line in raw.splitlines() + ["E: __finish__"]:
        e = RE_ELEMENT.match(line)
        if e:
            depth = len(e.group(1))
            while stack and stack[-1][1] >= depth:
                if [v[0] for v in stack] == ["manifest", "application", "meta-data"]:
                    finish_node()
                    node_name = node_value = None
                stack.pop()
            parent = [s[0] for s in stack]
            tag = e.group(2)
            if tag == "application" and parent == ["manifest"]:
                apps += 1
            if tag == "meta-data" and parent == ["manifest", "application"]:
                if node_name is not None:
                    block("concurrent application metadata")
                node_name = node_value = None
            stack.append((tag, depth))
            continue
        a = RE_ATTRIBUTE.match(line)
        if a and stack and [v[0] for v in stack] == ["manifest", "application", "meta-data"]:
            if a.group(1) == "name":
                if node_name is not None:
                    block("duplicate metadata name")
                node_name = a.group(2).strip()
            if a.group(1) == "value":
                if node_value is not None:
                    block("duplicate metadata value")
                node_value = a.group(2).strip()
    if apps != 1 or len(refs) != 1:
        block("expected exactly one compiled application OTA runtime reference")
    return refs[0]


def table_runtime(raw: str, ref: str, version: str) -> None:
    lines = raw.splitlines()
    found = []
    # AAPT2 prints every possible resource configuration beneath its header.
    for i, line in enumerate(lines):
        heading = RE_HEADER.match(line)
        if not heading:
            continue
        res_id, name = heading.groups()
        if name == RESOURCE or res_id.lower() == ref:
            if name != RESOURCE or res_id.lower() != ref:
                block("OTA runtime string name and manifest resource ID disagree")
            values = []
            for entry in lines[i+1:]:
                if RE_HEADER.match(entry) or re.match(r"^\s*type\s+\w+\s+id=", entry) or re.match(r"^Package name=", entry):
                    break
                if not entry.strip():
                    continue
                value = re.fullmatch(r'\s*(\([^)]*\))\s+(?:(?:\(string8\)|\(string16\))\s+)?\"([^\"]*)\"\s*', entry)
                if value:
                    values.append((value.group(1), value.group(2)))
                elif entry.strip().startswith("("):
                    block("unexpected or indirect OTA runtime table value")
            found.append(values)
    if len(found) != 1:
        block("missing, ambiguous or duplicated compiled OTA runtime resource")
    if found[0] != [("()", version)]:
        block("OTA runtime must have exactly one default nonlocalized value matching appVersion")


def inspect(apk: Path, tool: str, version: str) -> None:
    if not RE_VERSION.fullmatch(version):
        block("explicit pinned appVersion required")
    apk_contents(apk)
    rid = manifest_resource_id(run_dump(tool, apk, "xmltree", "AndroidManifest.xml"))
    table_runtime(run_dump(tool, apk, "resources"), rid, version)
    print("PASS: compiled APK OTA runtime resource " + version +
          " has exactly one nonlocalized value and manifest reference")


def main(argv):
    if len(argv) != 4:
        print("Usage: verify_compiled_ota_runtime.py <apk> <aapt2> <appVersion>",
              file=sys.stderr)
        return 2
    try:
        inspect(Path(argv[1]), argv[2], argv[3])
        return 0
    except (ValueError, OSError, UnicodeError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

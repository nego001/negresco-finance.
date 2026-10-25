#!/usr/bin/env python3
"""Fail-closed check of the compiled OTA runtimeVersion resource in an APK.

Reads the compiled manifest and resources.arsc through Android's AAPT2 rather
than trusting generated XML files or a plaintext occurrence in a ZIP.
"""
from __future__ import annotations

import re
import struct
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
ANDROID = "http://schemas.android.com/apk/res/android"
PREFIX = "expo.modules.updates."
NO_INDEX = 0xFFFFFFFF
MAX_XML = 2 * 1024 * 1024
MAX_STRINGS = 65536
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


def u16(raw: bytes, pos: int) -> int:
    if pos < 0 or pos + 2 > len(raw):
        block("truncated binary XML short")
    return struct.unpack_from("<H", raw, pos)[0]


def u32(raw: bytes, pos: int) -> int:
    if pos < 0 or pos + 4 > len(raw):
        block("truncated binary XML word")
    return struct.unpack_from("<I", raw, pos)[0]


def length8(raw: bytes, pos: int, end: int) -> tuple[int, int]:
    if pos >= end:
        block("invalid UTF-8 string length")
    first = raw[pos]
    pos += 1
    if first & 0x80:
        if pos >= end:
            block("invalid two-byte string length")
        return ((first & 0x7f) << 8) | raw[pos], pos + 1
    return first, pos


def length16(raw: bytes, pos: int, end: int) -> tuple[int, int]:
    if pos + 2 > end:
        block("invalid UTF-16 string length")
    first = u16(raw, pos)
    pos += 2
    if first & 0x8000:
        if pos + 2 > end:
            block("invalid extended UTF-16 string length")
        return ((first & 0x7fff) << 16) | u16(raw, pos), pos + 2
    return first, pos


def string_pool(raw: bytes, start: int, end: int, header: int) -> list[str]:
    if header < 28:
        block("invalid binary XML string pool")
    count, style_count, flags = u32(raw, start + 8), u32(raw, start + 12), u32(raw, start + 16)
    string_start, style_start = u32(raw, start + 20), u32(raw, start + 24)
    if count > MAX_STRINGS or style_count > MAX_STRINGS or flags & ~0x107:
        block("unexpected string pool count or flags")
    if header + 4 * (count + style_count) > end - start:
        block("string pool offset table truncated")
    if string_start < header + 4 * (count + style_count) or start + string_start > end:
        block("string pool data starts outside chunk")
    strings = []
    for i in range(count):
        offset = u32(raw, start + header + 4 * i)
        pos = start + string_start + offset
        if pos >= end or (style_start and pos >= start + style_start):
            block("string offset outside pool")
        if flags & 0x100:
            utf16_len, pos = length8(raw, pos, end)
            size, pos = length8(raw, pos, end)
            if size > MAX_XML or pos + size + 1 > end or raw[pos + size] != 0:
                block("UTF-8 string malformed")
            data = raw[pos:pos + size].decode("utf-8", "strict")
            if len(data.encode("utf-16le")) // 2 != utf16_len:
                block("inconsistent UTF-8 string length")
        else:
            size, pos = length16(raw, pos, end)
            if size > MAX_XML // 2 or pos + size * 2 + 2 > end or raw[pos + size * 2:pos + size * 2 + 2] != b"\x00\x00":
                block("UTF-16 string malformed")
            data = raw[pos:pos + size * 2].decode("utf-16le", "strict")
        strings.append(data)
    return strings


def parsed_manifest(raw: bytes) -> dict[str, tuple[int, object]]:
    if not (8 <= len(raw) <= MAX_XML) or u16(raw, 0) != 0x0003 or u16(raw, 2) != 8 or u32(raw, 4) != len(raw):
        block("not a complete Android compiled binary manifest")
    strings: list[str] | None = None
    stack: list[str] = []
    application_count = 0
    root_count = 0
    metadata: dict[str, tuple[int, object]] = {}
    p = 8

    def string(index: int) -> str | None:
        if index == NO_INDEX:
            return None
        if strings is None or index >= len(strings):
            block("invalid compiled string index")
        return strings[index]

    while p < len(raw):
        if p + 8 > len(raw):
            block("trailing incomplete binary XML chunk")
        kind, header, size = struct.unpack_from("<HHI", raw, p)
        end = p + size
        if header < 8 or size < header or end > len(raw):
            block("binary XML chunk overflows document")
        if kind == 0x0001:
            if strings is not None or stack:
                block("duplicate or out-of-place string pool")
            strings = string_pool(raw, p, end, header)
        elif kind in (0x0180, 0x0100, 0x0101):
            if strings is None or header < (8 if kind == 0x0180 else 16):
                block("bad resource or namespace chunk")
        elif kind == 0x0102:
            if strings is None or header < 16 or size < 36:
                block("invalid start element")
            name = string(u32(raw, p + 20))
            ns = string(u32(raw, p + 16))
            if not name or ns:
                block("unexpected namespace or empty XML element")
            attr_start, attr_size, attr_count = (u16(raw, p + 24), u16(raw, p + 26), u16(raw, p + 28))
            if attr_start < 20 or attr_size != 20 or attr_count > 2048:
                block("invalid attribute layout")
            first = p + 16 + attr_start
            if first + attr_count * attr_size > end:
                block("attribute list exceeds node")
            attrs: dict[tuple[str | None, str], tuple[int, object]] = {}
            for i in range(attr_count):
                a = first + i * 20
                namespace, key = string(u32(raw, a)), string(u32(raw, a + 4))
                raw_index = u32(raw, a + 8)
                value_size, data_type, data = u16(raw, a + 12), raw[a + 15], u32(raw, a + 16)
                if value_size != 8 or not key or (namespace, key) in attrs:
                    block("malformed or duplicate binary XML attribute")
                if data_type == 0x03:
                    value = string(data)
                    if raw_index != NO_INDEX and string(raw_index) != value:
                        block("raw/typed compiled string mismatch")
                elif data_type == 0x12:
                    if data not in (0, 1, 0xffffffff):
                        block("malformed compiled boolean")
                    value = bool(data)
                else:
                    value = data
                attrs[(namespace, key)] = (data_type, value)
            if not stack:
                root_count += 1
                if name != "manifest":
                    block("compiled root must be manifest")
            if name == "application" and stack == ["manifest"]:
                application_count += 1
            if name == "meta-data" and stack == ["manifest", "application"]:
                id_attr = attrs.get((ANDROID, "name"))
                if not id_attr or id_attr[0] != 0x03 or not isinstance(id_attr[1], str):
                    block("invalid application metadata name")
                key = id_attr[1]
                if key in metadata:
                    block("duplicate application metadata: " + key)
                value = attrs.get((ANDROID, "value"))
                if key.startswith(PREFIX) and (value is None or (ANDROID, "resource") in attrs):
                    block("Expo updates metadata is missing literal android:value")
                if value is not None:
                    metadata[key] = value
            stack.append(name)
        elif kind == 0x0103:
            if header < 16 or size < 24 or not stack:
                block("invalid compiled end element")
            name = string(u32(raw, p + 20))
            if name != stack.pop():
                block("unbalanced compiled XML elements")
        elif kind == 0x0104:
            if header < 16:
                block("invalid CDATA")
        else:
            block("unknown compiled XML chunk")
        p = end
    if strings is None or stack or root_count != 1 or application_count != 1:
        block("exactly one closed manifest/application required")
    return metadata


def read_apk(apk: Path) -> bytes:
    if apk.is_symlink() or not apk.is_file() or not apk.stat().st_size:
        block("missing, linked or empty APK")
    try:
        with zipfile.ZipFile(apk) as archive:
            entries = [m for m in archive.infolist() if m.filename == "AndroidManifest.xml"]
            if len(entries) != 1:
                block("compiled AndroidManifest must be unique in APK")
            member = entries[0]
            mode = stat.S_IFMT((member.external_attr >> 16) & 0xffff) if member.create_system == 3 else 0
            if member.flag_bits & 1 or mode not in (0, stat.S_IFREG) or not 8 <= member.file_size <= MAX_XML:
                block("compiled AndroidManifest has unsafe ZIP attributes")
            with archive.open(member) as stream:
                xml = stream.read(MAX_XML + 1)
            if len(xml) != member.file_size:
                block("compiled AndroidManifest is truncated or oversized")
            return xml
    except (OSError, zipfile.BadZipFile, RuntimeError):
        block("cannot read APK ZIP safely")



def binary_manifest_reference(apk: Path) -> str:
    # Read the actual compiled AXML bytes. AAPT2 text output varies between SDKs.
    # Only a typed TYPE_REFERENCE may drive the OTA runtime compatibility.
    metadata = parsed_manifest(read_apk(apk))
    runtime = metadata.get(NAME)
    if runtime is None or runtime[0] != 0x01 or not isinstance(runtime[1], int) or runtime[1] in (0, 0xffffffff):
        block("expected exactly one typed binary application OTA runtime reference")
    return f"0x{runtime[1]:08x}"


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
    rid = binary_manifest_reference(apk)
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

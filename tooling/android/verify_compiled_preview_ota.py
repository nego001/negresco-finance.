#!/usr/bin/env python3
"""Audit OTA metadata in the binary AndroidManifest.xml inside the EXACT APK.

--parse-only exercises binary-AXML decoding on ordinary preview artifacts; it
is NOT a security approval. --verify-stable requires source-to-binary agreement,
and must run only after the X.509 source gate on a manual stable build.
"""
from __future__ import annotations

import json
import re
import stat
import struct
import sys
import zipfile
from pathlib import Path

ANDROID = "http://schemas.android.com/apk/res/android"
PREFIX = "expo.modules.updates."
ENABLED = PREFIX + "ENABLED"
CERT = PREFIX + "CODE_SIGNING_CERTIFICATE"
META = PREFIX + "CODE_SIGNING_METADATA"
UPDATE_URL = PREFIX + "EXPO_UPDATE_URL"
REQUEST_HEADERS = PREFIX + "UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY"
PINNED_ENDPOINT = "https://u.expo.dev/a506611f-a159-4341-bed7-28dcbd47bf95"
NO_INDEX = 0xFFFFFFFF
MAX_XML = 2 * 1024 * 1024
MAX_STRINGS = 65536
MAX_CONFIG = 512 * 1024


def block(message: str) -> None:
    raise ValueError("BLOCK: compiled Android OTA policy: " + message)


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



# Laboratory APKs have unsigned Expo preview OTA by design.
# This check prohibits privilege/channel escalation but does NOT authorize
# a production release (which must require signed OTA or embedded-only).
EXPECTED_CHANNEL = {"expo-channel-name": "preview"}


def no_duplicate_json_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            block("duplicate OTA request header keys")
        result[key] = value
    return result


def verify_preview(metadata: dict[str, tuple[int, object]]) -> None:
    if metadata.get(ENABLED) != (0x12, True):
        block("preview OTA must have explicitly enabled updates")
    if metadata.get(UPDATE_URL) != (0x03, PINNED_ENDPOINT):
        block("compiled preview OTA endpoint changed")
    value = metadata.get(REQUEST_HEADERS)
    if not value or value[0] != 0x03 or not isinstance(value[1], str) or len(value[1]) > 2048:
        block("compiled preview OTA channel must be a short literal JSON string")
    try:
        headers = json.loads(value[1], object_pairs_hook=no_duplicate_json_keys)
    except (ValueError, TypeError):
        block("malformed compiled preview OTA channel headers")
    if not isinstance(headers, dict) or headers != EXPECTED_CHANNEL:
        block("downloaded APK must use preview channel only")
    # No certificate/key identifier should be inserted into a laboratory APK.
    # Merely having a certificate is not enough to approve production OTA.
    signing_keys = [key for key in metadata if key.startswith(PREFIX + "CODE_SIGNING_")]
    if signing_keys:
        block("laboratory preview APK unexpectedly contains OTA signing metadata")
    print("PASS: downloaded APK compiled OTA URL/channel pinned to unsigned preview (LAB ONLY)")


def main(argv):
    if len(argv) != 2:
        print("Usage: verify_compiled_preview_ota.py <apk>", file=sys.stderr)
        return 2
    try:
        verify_preview(parsed_manifest(read_apk(Path(argv[1]))))
        return 0
    except (OSError, ValueError, UnicodeError, struct.error, zipfile.LargeZipFile) as ex:
        print(str(ex), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

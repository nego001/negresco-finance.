#!/usr/bin/env python3
"""Fail-closed minimum-permission gate for an exact compiled Android APK.

Only examines AndroidManifest.xml bytes. No execution, no ADB, no signing.
This experimental policy is not a production or runtime permission review.
"""
from __future__ import annotations

import stat
import struct
import sys
import zipfile
from pathlib import Path

APK_MANIFEST = "AndroidManifest.xml"
MAX_MANIFEST = 2 * 1024 * 1024
NO_INDEX = 0xffffffff
ANDROID = "http://schemas.android.com/apk/res/android"
FORBIDDEN = frozenset({
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.READ_MEDIA_IMAGES",
})
REQUIRED = frozenset({
    "android.permission.INTERNET",
    "android.permission.USE_BIOMETRIC",
})

def block(reason: str) -> None:
    raise ValueError("BLOCK: Android minimum permissions lab: " + reason)

def u16(data: bytes, pos: int) -> int:
    if pos < 0 or pos + 2 > len(data):
        block("invalid short")
    return struct.unpack_from("<H", data, pos)[0]

def u32(data: bytes, pos: int) -> int:
    if pos < 0 or pos + 4 > len(data):
        block("invalid word")
    return struct.unpack_from("<I", data, pos)[0]

def length8(data: bytes, pos: int, end: int) -> tuple[int, int]:
    if pos >= end: block("invalid UTF-8 size")
    a = data[pos]
    pos += 1
    if a & 0x80:
        if pos >= end: block("invalid extended UTF-8 size")
        return ((a & 0x7f) << 8) | data[pos], pos + 1
    return a, pos

def length16(data: bytes, pos: int, end: int) -> tuple[int, int]:
    a = u16(data, pos)
    pos += 2
    if a & 0x8000:
        if pos + 2 > end: block("invalid extended UTF-16 size")
        return ((a & 0x7fff) << 16) | u16(data, pos), pos + 2
    return a, pos

def strings(data: bytes, pos: int, end: int, header: int) -> list[str]:
    if header < 28: block("invalid string pool header")
    count, styles, flags = u32(data, pos+8), u32(data, pos+12), u32(data, pos+16)
    start = u32(data, pos+20)
    if count > 65536 or styles > 65536 or flags & ~0x107:
        block("unsafe pool size or flags")
    if header + 4 * (count + styles) > end - pos or start < header + 4 * (count + styles):
        block("unsafe string pool offsets")
    result = []
    for i in range(count):
        where = pos + start + u32(data, pos + header + i*4)
        if where >= end: block("string outside pool")
        if flags & 0x100:
            chars, where = length8(data, where, end)
            n, where = length8(data, where, end)
            if n > MAX_MANIFEST or where + n >= end or data[where+n] != 0:
                block("invalid UTF-8 member")
            value = data[where:where+n].decode("utf-8", "strict")
            if len(value.encode("utf-16le")) // 2 != chars:
                block("inconsistent UTF-8 length")
        else:
            n, where = length16(data, where, end)
            if n > MAX_MANIFEST // 2 or where + 2*n + 2 > end:
                block("invalid UTF-16 member")
            if data[where+2*n:where+2*n+2] != b"\0\0":
                block("unterminated UTF-16 member")
            value = data[where:where+2*n].decode("utf-16le", "strict")
        result.append(value)
    return result

def permissions(data: bytes) -> set[str]:
    if len(data) < 8 or len(data) > MAX_MANIFEST or u16(data, 0) != 3 or \
       u16(data, 2) != 8 or u32(data, 4) != len(data):
        block("invalid compiled AndroidManifest")
    pool = None
    stack = []
    seen: set[str] = set()
    app_count = root_count = 0
    pos = 8
    def lookup(idx: int) -> str | None:
        if idx == NO_INDEX: return None
        if pool is None or idx >= len(pool): block("invalid string index")
        return pool[idx]
    while pos < len(data):
        if pos+8 > len(data): block("truncated AXML chunk")
        kind, header, size = struct.unpack_from("<HHI", data, pos)
        end = pos + size
        if header < 8 or size < header or end > len(data):
            block("unsafe chunk bounds")
        if kind == 0x0001:
            if pool is not None or stack: block("duplicate or misplaced string pool")
            pool = strings(data, pos, end, header)
        elif kind in (0x0180, 0x0100, 0x0101):
            if pool is None or header < (8 if kind == 0x0180 else 16):
                block("invalid metadata chunk")
        elif kind == 0x0102:
            if pool is None or header < 16 or size < 36:
                block("invalid start element")
            name = lookup(u32(data, pos+20))
            if not name or lookup(u32(data, pos+16)):
                block("malformed element")
            if not stack:
                root_count += 1
                if name != "manifest": block("unexpected root")
            if name == "application" and stack == ["manifest"]:
                app_count += 1
            offset, stride, count = u16(data, pos+24), u16(data, pos+26), u16(data, pos+28)
            first = pos+16+offset
            if offset < 20 or stride != 20 or count > 2048 or first+20*count > end:
                block("unsafe attribute table")
            attrs = {}
            for i in range(count):
                at = first+i*20
                ns, key, raw = u32(data, at), u32(data, at+4), u32(data, at+8)
                typ, value = data[at+15], u32(data, at+16)
                if u16(data, at+12) != 8: block("invalid attribute value size")
                k = (lookup(ns), lookup(key))
                if not k[1] or k in attrs: block("missing/duplicate attribute")
                v = lookup(value) if typ == 3 else None
                if typ == 3 and raw != NO_INDEX and lookup(raw) != v:
                    block("raw and typed value mismatch")
                attrs[k] = (typ, v)
            if name in ("uses-permission", "uses-permission-sdk-23", "uses-permission-sdk-m"):
                key = (ANDROID, "name")
                if key not in attrs or attrs[key][0] != 3:
                    block("permission must have a literal Android name")
                perm = attrs[key][1]
                if not isinstance(perm, str) or not perm:
                    block("malformed Android permission")
                if perm in seen: block("duplicate declared permission")
                seen.add(perm)
            stack.append(name)
        elif kind == 0x0103:
            if header < 16 or size < 24 or not stack or lookup(u32(data, pos+20)) != stack.pop():
                block("unbalanced closing tag")
        elif kind == 0x0104:
            if header < 16: block("invalid CDATA chunk")
        else:
            block("unsupported AndroidManifest chunk type")
        pos = end
    if pool is None or stack or root_count != 1 or app_count != 1:
        block("incomplete/ambiguous application manifest")
    return seen

def inspect(apk: Path) -> None:
    if apk.is_symlink() or not apk.is_file() or apk.stat().st_size < 1024:
        block("missing/linked/empty APK")
    try:
        with zipfile.ZipFile(apk) as z:
            parts = [x for x in z.infolist() if x.filename == APK_MANIFEST]
            if len(parts) != 1: block("compiled manifest must be unique")
            e = parts[0]
            mode = stat.S_IFMT((e.external_attr >> 16) & 0xffff) if e.create_system == 3 else 0
            if e.flag_bits & 1 or mode not in (0, stat.S_IFREG) or not 8 <= e.file_size <= MAX_MANIFEST:
                block("unsafe AndroidManifest ZIP metadata")
            with z.open(e) as f:
                raw = f.read(MAX_MANIFEST+1)
            if len(raw) != e.file_size: block("incomplete compiled manifest")
    except (zipfile.BadZipFile, OSError, RuntimeError):
        block("could not inspect APK")
    found = permissions(raw)
    denied = sorted(found & FORBIDDEN)
    if denied: block("forbidden compiled Android permissions: " + ", ".join(denied))
    if not REQUIRED.issubset(found):
        block("required permissions unexpectedly lost")
    print("PASS (LAB): compiled APK excludes overlay/external storage/media read/write; essential permissions preserved")

if __name__ == "__main__":
    try:
        if len(sys.argv) != 2: block("usage: verify_compiled_minimum_permissions.py <apk>")
        inspect(Path(sys.argv[1]))
    except (ValueError, OSError, UnicodeError, struct.error, zipfile.LargeZipFile) as ex:
        print(str(ex), file=sys.stderr)
        raise SystemExit(1)

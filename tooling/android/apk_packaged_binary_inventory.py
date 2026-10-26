#!/usr/bin/env python3
"""Lab-only digest of DEX and ELF .so files actually inside a debug-signed APK.

This is not proof of Maven origin, a full APK SBOM or production approval.
"""
from __future__ import annotations

import hashlib
import json
import re
import stat
import sys
import zipfile
from pathlib import Path

MAX_APK = 1024 * 1024 * 1024
MAX_GRADLE = 12 * 1024 * 1024
MAX_EVIDENCE = 12 * 1024 * 1024
MAX_ENTRIES = 30000
MAX_ENTRY = 512 * 1024 * 1024
MAX_SELECTED = 2 * 1024 * 1024 * 1024
SHA = re.compile(r"[0-9a-f]{64}\Z")
COMMIT = re.compile(r"[0-9a-f]{40}\Z")
LIB = re.compile(r"lib/(armeabi-v7a|arm64-v8a|x86|x86_64)/[A-Za-z0-9_.+-]+\.so\Z")
DEX = re.compile(r"classes(?:[2-9][0-9]*)?\.dex\Z")


def block(reason: str) -> None:
    raise ValueError("BLOCK: APK packaged binary inventory: " + reason)


def safe_bytes(filename: str, limit: int) -> bytes:
    p = Path(filename)
    if p.is_symlink() or not p.is_file():
        block("missing, linked or nonregular file: " + p.name)
    if not 4 <= p.stat().st_size <= limit:
        block("empty or oversized file: " + p.name)
    return p.read_bytes()


def sha256(buf: bytes) -> str:
    return hashlib.sha256(buf).hexdigest()


def inspect_apk(apk: str) -> tuple[list[dict], int]:
    binaries = []
    seen = set()
    total = 0
    try:
        with zipfile.ZipFile(apk) as archive:
            entries = archive.infolist()
            if not 0 < len(entries) <= MAX_ENTRIES:
                block("invalid APK ZIP entry count")
            for entry in entries:
                name = entry.filename
                if (not name or name in seen or name.startswith("/") or "\\" in name
                        or any(part in ("", ".", "..") for part in name.rstrip("/").split("/"))
                        or any(ord(ch) < 32 or ord(ch) == 127 for ch in name)):
                    block("duplicate or unsafe ZIP member: " + repr(name))
                seen.add(name)
                mode = stat.S_IFMT(entry.external_attr >> 16)
                if mode not in (0, stat.S_IFREG, stat.S_IFDIR):
                    block("linked or special ZIP entry: " + repr(name))
                if mode and entry.is_dir() != (mode == stat.S_IFDIR):
                    block("ZIP file/directory type mismatch: " + repr(name))
                if entry.flag_bits & 1:
                    block("encrypted ZIP entry: " + repr(name))
                if entry.file_size > MAX_ENTRY:
                    block("oversized ZIP entry: " + repr(name))
                if entry.is_dir():
                    continue
                kind = ("native-so" if LIB.fullmatch(name) else
                        "dex" if DEX.fullmatch(name) else None)
                if kind is None and (name.endswith(".so") or name.endswith(".dex")):
                    block("unrecognized packaged DEX/ELF location: " + repr(name))
                if kind is None:
                    continue
                total += entry.file_size
                if total > MAX_SELECTED:
                    block("oversized selected binary payload")
                digest = hashlib.sha256()
                count = 0
                with archive.open(entry) as payload:
                    while chunk := payload.read(1024 * 1024):
                        count += len(chunk)
                        if count > entry.file_size or count > MAX_ENTRY:
                            block("inconsistent binary ZIP entry")
                        digest.update(chunk)
                if count != entry.file_size or not count:
                    block("empty or inconsistent binary ZIP entry: " + repr(name))
                binaries.append({"path": name, "kind": kind, "sizeBytes": count,
                                 "sha256": digest.hexdigest()})
    except (OSError, EOFError, RuntimeError, zipfile.BadZipFile) as exc:
        block("invalid or unreadable APK ZIP: " + type(exc).__name__)
    binaries.sort(key=lambda item: item["path"])
    if not any(item["kind"] == "dex" for item in binaries):
        block("APK has no packaged root DEX files")
    if not any(item["kind"] == "native-so" for item in binaries):
        block("APK has no packaged native .so files")
    return binaries, len(seen)


def generate(apk: str, gradle_inventory: str, commit: str) -> dict:
    if not COMMIT.fullmatch(commit):
        block("invalid Git commit SHA")
    apk_hash = sha256(safe_bytes(apk, MAX_APK))
    raw_gradle = safe_bytes(gradle_inventory, MAX_GRADLE)
    try:
        gradle = json.loads(raw_gradle)
    except (UnicodeDecodeError, ValueError, TypeError):
        block("invalid Gradle inventory JSON")
    if (not isinstance(gradle, dict) or gradle.get("schemaVersion") != 1
            or gradle.get("approvedForProduction") is not False
            or gradle.get("sourceCommit") != commit
            or gradle.get("apkSha256") != apk_hash
            or not isinstance(gradle.get("gradleReportSha256"), str)
            or not SHA.fullmatch(gradle["gradleReportSha256"])):
        block("Gradle inventory does not match exact APK or source commit")
    binaries, count = inspect_apk(apk)
    return {
        "schemaVersion": 1,
        "approvedForProduction": False,
        "scope": "LAB APK DEX/ELF CONTENTS; NOT BINARY PROVENANCE OR FULL SBOM",
        "sourceCommit": commit,
        "apkSha256": apk_hash,
        "gradleReportSha256": gradle["gradleReportSha256"],
        "gradleInventorySha256": sha256(raw_gradle),
        "zipEntryCount": count,
        "packagedNativeLibraryCount": sum(b["kind"] == "native-so" for b in binaries),
        "packagedDexCount": sum(b["kind"] == "dex" for b in binaries),
        "nativeAbis": sorted({b["path"].split("/")[1] for b in binaries if b["kind"] == "native-so"}),
        "packagedBinaries": binaries,
    }


def encode(data: dict) -> bytes:
    return (json.dumps(data, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def capture(apk: str, gradle: str, commit: str, output: str) -> None:
    payload = encode(generate(apk, gradle, commit))
    p = Path(output)
    if p.exists() or p.is_symlink():
        block("refusing to overwrite existing packaged inventory")
    with p.open("xb") as handle:
        handle.write(payload)
    result = json.loads(payload)
    print("PASS (LAB): exact APK has " + str(result["packagedNativeLibraryCount"]) +
          " packaged .so and " + str(result["packagedDexCount"]) +
          " DEX; SHA-bound to original Gradle evidence")


def verify(apk: str, gradle: str, commit: str, output: str) -> None:
    actual = safe_bytes(output, MAX_EVIDENCE)
    expected = encode(generate(apk, gradle, commit))
    if actual != expected:
        block("downloaded APK/Gradle/packaged binary evidence differs")
    print("PASS (LAB): independent APK DEX/.so rehash exactly matches downloaded evidence")


def main(argv: list[str]) -> int:
    if len(argv) != 5 or argv[0] not in ("capture", "verify"):
        print("Usage: apk_packaged_binary_inventory.py capture|verify APK GradleJSON CommitSHA OutputJSON", file=sys.stderr)
        return 2
    try:
        if argv[0] == "capture":
            capture(*argv[1:])
        else:
            verify(*argv[1:])
        return 0
    except (OSError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

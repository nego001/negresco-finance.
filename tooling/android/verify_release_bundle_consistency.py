#!/usr/bin/env python3
"""P0-1 verify that a disposable Release candidate has no divergent APK copies.

Read-only: does not sign, publish, install or authorize financial operations.
This checks consistency, NOT provenance/trust of a signing certificate.
"""
from __future__ import annotations

import hashlib
import re
import sys
import zipfile
from pathlib import Path

APK = "Negresco-Finance-V3.1.3-preview.apk"
BUNDLE = "Negresco-Finance-V3.1.3-preview.zip"
SIGNATURE = "APK-SIGNATURE.txt"
RELEASE_HASHES = "SHA256-release.txt"
ORIGINAL_HASHES = "android-apk.sha256"
NESTED_HASHES = "SHA256-original-apk.txt"
NOTES = "LEIA-ME.txt"
EXPECTED_ZIP = frozenset((APK, SIGNATURE, NESTED_HASHES, NOTES))
EXPECTED_HASHES = frozenset((APK, BUNDLE, SIGNATURE))
MAX_MEMBER_BYTES = 1024 * 1024 * 1024


def digest_file(path: Path) -> str:
    if not path.is_file() or path.is_symlink() or not path.stat().st_size:
        raise ValueError(f"absent, empty or symlinked artifact: {path.name}")
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def digest_stream(stream) -> str:
    h = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        h.update(chunk)
    return h.hexdigest()


def parse_checksums(data: str) -> dict[str, str]:
    found: dict[str, str] = {}
    lines = data.splitlines()
    if not lines:
        raise ValueError("empty SHA256 manifest")
    for line in lines:
        match = re.fullmatch(r"([a-fA-F0-9]{64})  ([A-Za-z0-9_.-]+)", line)
        if match is None:
            raise ValueError("malformed or unsafe SHA256 entry")
        hexsum, name = match.groups()
        if name in found:
            raise ValueError("duplicate SHA256 manifest entry")
        found[name] = hexsum.lower()
    if set(found) != EXPECTED_HASHES:
        raise ValueError("SHA256 manifest has missing/unexpected names")
    return found


def original_checksum(data: str) -> str:
    match = re.fullmatch(
        r"([a-fA-F0-9]{64})  android/app/build/outputs/apk/release/app-release\.apk\n?",
        data,
    )
    if match is None:
        raise ValueError("malformed original APK SHA256 record")
    return match.group(1).lower()


def audit(work_dir: Path) -> None:
    assembled = work_dir / "android/app/build/outputs/apk/release/app-release.apk"
    apk_file = work_dir / APK
    zip_file = work_dir / BUNDLE
    signature_file = work_dir / SIGNATURE
    hashes_file = work_dir / RELEASE_HASHES
    original_file = work_dir / ORIGINAL_HASHES

    original = digest_file(assembled)
    standalone = digest_file(apk_file)
    if original != standalone:
        raise ValueError("standalone APK differs from the assembled APK")

    signature = digest_file(signature_file)
    outer = parse_checksums(hashes_file.read_text(encoding="utf-8"))
    observed = {APK: standalone, BUNDLE: digest_file(zip_file), SIGNATURE: signature}
    if outer != observed:
        raise ValueError("SHA256-release.txt disagrees with candidate contents")
    recorded_original = original_checksum(original_file.read_text(encoding="utf-8"))
    if recorded_original != original:
        raise ValueError("original APK SHA256 record disagrees with assembled candidate")

    with zipfile.ZipFile(zip_file, "r") as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or set(names) != EXPECTED_ZIP:
            raise ValueError("ZIP has duplicated, missing or extra entries")
        for member in archive.infolist():
            if member.is_dir() or member.file_size <= 0 or member.file_size > MAX_MEMBER_BYTES:
                raise ValueError("ZIP contains invalid/oversized member")
        with archive.open(APK) as z_apk:
            if digest_stream(z_apk) != original:
                raise ValueError("APK in ZIP differs from assembled APK")
        with archive.open(SIGNATURE) as z_sig:
            if digest_stream(z_sig) != signature:
                raise ValueError("APK signature report differs inside ZIP")
        with archive.open(NESTED_HASHES) as f:
            nested_original = original_checksum(f.read().decode("utf-8"))
        if nested_original != original:
            raise ValueError("ZIP original APK hash disagrees with assembled APK")
        with archive.open(NOTES) as f:
            if not f.read(1):
                raise ValueError("ZIP readme missing content")

    print("PASS: assembled, standalone and ZIP APK SHA256 are identical; reports match")


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: verify_release_bundle_consistency.py <apps/mobile>", file=sys.stderr)
        return 2
    try:
        audit(Path(argv[1]))
    except (OSError, ValueError, UnicodeError, zipfile.BadZipFile, RuntimeError) as exc:
        print(f"SEC05 BLOCK: release bundle consistency: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

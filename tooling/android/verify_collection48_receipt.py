#!/usr/bin/env python3
"""Strict offline metadata gate for the synthetic 48-digit Android PDF lab.

This validates the *shape and internal consistency* of a lab receipt, not a
cryptographic attestation that a device ran or a bank verified a charge.
No source PDF, financial input, or user data is read, emitted or uploaded.
"""
from __future__ import annotations

import io
import json
import re
import stat
import struct
import sys
import zipfile
from pathlib import Path

APK_SHA = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"
MEMBER = "guardiao-android-real-pdf-text-receipt.json"
SCOPE = "SHA_PINNED_ANDROID_APP_SYNTHETIC_PDF_TEXT"
FIXTURE = "synthetic-48-collection-reference-invalid"
TRUE_FLAGS = {
    "allPagesRendered", "guardiaoOpened", "nativePdfSemanticTextVerified",
    "pdfActionTriggered", "privateCaptureDeleted", "realAndroidApkPdf",
    "receiverCacheClean", "receiverPdfRead", "renderedFirstPage",
    "syntheticInput", "systemChooserObserved",
}
FALSE_FLAGS = {"approvedForProduction", "chromeReferenceUsed", "stableReleaseAllowed"}
REQUIRED = TRUE_FLAGS | FALSE_FLAGS | {
    "api", "apkSha256", "nonblankPages", "pdfPageCount", "pdfPages",
    "pdfSizeBytes", "receivedPdfSha256", "schemaVersion", "scope",
    "sourceFixture", "textPagesVerified",
}
MAX_JSON = 4096
MAX_ZIP = 1_048_576
HEX64 = re.compile(r"[0-9a-f]{64}\Z")


class InvalidReceipt(ValueError):
    pass


def unique_pairs(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise InvalidReceipt("duplicate JSON key")
        result[key] = value
    return result


def reject_constant(value: str) -> None:
    raise InvalidReceipt("nonfinite JSON value")


def load_json(raw: bytes) -> dict:
    if not 20 <= len(raw) <= MAX_JSON:
        raise InvalidReceipt("invalid JSON size")
    try:
        value = json.loads(
            raw.decode("utf-8", errors="strict"),
            object_pairs_hook=unique_pairs,
            parse_constant=reject_constant,
        )
    except (UnicodeError, ValueError, TypeError) as exc:
        raise InvalidReceipt("malformed JSON") from exc
    if type(value) is not dict or set(value) != REQUIRED:
        raise InvalidReceipt("unknown or missing receipt fields")
    return value


def verify_contiguous_zip(raw: bytes, entry: zipfile.ZipInfo) -> None:
    """Reject hidden preambles, overlays, slack and unaccounted ZIP members.

    The metadata-only artifact has one fixed ASCII member and does not need
    ZIP64, extra fields, comments or multi-disk structures. GitHub artifact
    ZIPs may contain an ordinary 16-byte data descriptor (general bit 3).
    """
    name = MEMBER.encode("ascii")
    if len(raw) < 30 + len(name) + 46 + len(name) + 22:
        raise InvalidReceipt("ZIP archive is too small")
    if raw[-22:-18] != b"PK\x05\x06":
        raise InvalidReceipt("ZIP end marker is not at physical EOF")
    signature, disk, cd_disk, disk_count, count, cd_size, cd_offset, comment_len = (
        struct.unpack_from("<IHHHHIIH", raw, len(raw) - 22)
    )
    if (
        signature != 0x06054B50 or disk != 0 or cd_disk != 0
        or disk_count != 1 or count != 1 or comment_len != 0
        or cd_size != 46 + len(name)
        or cd_offset + cd_size != len(raw) - 22
        or entry.header_offset != 0
        or entry.flag_bits not in (0, 8, 0x800, 0x808)
        or entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)
    ):
        raise InvalidReceipt("unsafe ZIP directory layout")
    if raw[cd_offset:cd_offset + 4] != b"PK\x01\x02":
        raise InvalidReceipt("ZIP directory is not contiguous")
    local = struct.unpack_from("<IHHHHHIIIHH", raw, 0)
    (local_signature, _version, flags, method, _time, _date,
     local_crc, local_compressed, local_uncompressed, name_len, extra_len) = local
    if (
        local_signature != 0x04034B50 or flags != entry.flag_bits
        or method != entry.compress_type or name_len != len(name)
        or extra_len != 0 or raw[30:30 + len(name)] != name
    ):
        raise InvalidReceipt("unsafe ZIP local header")
    if not flags & 8 and (
        local_crc != entry.CRC
        or local_compressed != entry.compress_size
        or local_uncompressed != entry.file_size
    ):
        raise InvalidReceipt("ZIP local checksums and sizes disagree")
    payload_end = 30 + len(name) + entry.compress_size
    if payload_end > cd_offset:
        raise InvalidReceipt("ZIP entry overlaps central directory")
    trailer = raw[payload_end:cd_offset]
    if flags & 8:
        expected = struct.pack("<III", entry.CRC, entry.compress_size, entry.file_size)
        if trailer not in (expected, b"PK\x07\x08" + expected):
            raise InvalidReceipt("ZIP has an unexpected data descriptor or hidden bytes")
    elif trailer:
        raise InvalidReceipt("ZIP has hidden bytes before directory")


def read_receipt(path: Path) -> dict:
    if path.is_symlink() or not stat.S_ISREG(path.stat(follow_symlinks=False).st_mode):
        raise InvalidReceipt("not a regular file")
    size = path.stat(follow_symlinks=False).st_size
    if path.suffix == ".json":
        if path.name != MEMBER or size > MAX_JSON:
            raise InvalidReceipt("invalid JSON container")
        return load_json(path.read_bytes())
    if path.suffix != ".zip" or size > MAX_ZIP:
        raise InvalidReceipt("unsupported artifact container")
    # Bounded read ensures the checked ZIP is the exact ZIP that is parsed.
    with path.open("rb") as stream:
        zip_bytes = stream.read(MAX_ZIP + 1)
    if len(zip_bytes) > MAX_ZIP or len(zip_bytes) != size:
        raise InvalidReceipt("unsafe archive size")
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as archive:
        entries = archive.infolist()
        if archive.comment or len(entries) != 1:
            raise InvalidReceipt("archive contains extra data or entries")
        item = entries[0]
        mode = (item.external_attr >> 16) & 0o170000
        if (
            item.filename != MEMBER or item.is_dir() or mode == stat.S_IFLNK
            or item.header_offset != 0 or item.comment or item.extra
            or item.flag_bits & 1 or not 20 <= item.file_size <= MAX_JSON
            or item.compress_size > MAX_JSON
        ):
            raise InvalidReceipt("unsafe archive entry")
        verify_contiguous_zip(zip_bytes, item)
        receipt_bytes = archive.read(item)
    return load_json(receipt_bytes)


def verify(value: dict, expected_api: int) -> None:
    if type(expected_api) is not int or expected_api not in (26, 28):
        raise InvalidReceipt("unexpected API")
    if any(value.get(key) is not True for key in TRUE_FLAGS):
        raise InvalidReceipt("missing success evidence flag")
    if any(value.get(key) is not False for key in FALSE_FLAGS):
        raise InvalidReceipt("unsafe release or provenance flag")
    if type(value["api"]) is not int or value["api"] != expected_api:
        raise InvalidReceipt("API does not match tested matrix entry")
    if type(value["schemaVersion"]) is not int or value["schemaVersion"] != 2:
        raise InvalidReceipt("unknown receipt schema")
    if value["apkSha256"] != APK_SHA or value["scope"] != SCOPE:
        raise InvalidReceipt("untrusted APK or receipt scope")
    if value["sourceFixture"] != FIXTURE:
        raise InvalidReceipt("receipt is not the fixed invalid 48-digit scenario")
    pages = value["pdfPageCount"]
    if type(pages) is not int or not 1 <= pages <= 8:
        raise InvalidReceipt("page count outside bounds")
    for key in ("pdfPages", "nonblankPages", "textPagesVerified"):
        if type(value[key]) is not int or value[key] != pages:
            raise InvalidReceipt("page verification mismatch")
    size = value["pdfSizeBytes"]
    if type(size) is not int or not 200 < size <= 8 * 1024 * 1024:
        raise InvalidReceipt("PDF byte size outside bounds")
    digest = value["receivedPdfSha256"]
    if type(digest) is not str or HEX64.fullmatch(digest) is None:
        raise InvalidReceipt("PDF digest is malformed")


def main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[0] not in ("26", "28"):
        print("BLOCK (LAB): receipt gate requires fixed API 26 or 28", file=sys.stderr)
        return 2
    try:
        receipt = read_receipt(Path(argv[1]))
        verify(receipt, int(argv[0]))
    except (OSError, ValueError, zipfile.BadZipFile, RuntimeError, KeyError):
        # Never print a path, document text, exception or attacker-controlled value.
        print("BLOCK (LAB): synthetic Android receipt rejected", file=sys.stderr)
        return 1
    print("PASS (LAB): bounded synthetic Android receipt metadata verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

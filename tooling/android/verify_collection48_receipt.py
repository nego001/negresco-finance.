#!/usr/bin/env python3
"""Strict offline metadata gate for the synthetic 48-digit Android PDF lab.

This validates the *shape and internal consistency* of a lab receipt, not a
cryptographic attestation that a device ran or a bank verified a charge.
No source PDF, financial input, or user data is read, emitted or uploaded.
"""
from __future__ import annotations

import io
import os
import json
import re
import stat
import struct
import sys
import zipfile
import zlib
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
    # ZIPs for this one-file lab cannot span disks or carry opaque central
    # attributes. Ordinary ZIP readers can ignore these covert-data fields.
    # Accept only the common zero or DOS archive-bit attributes.
    if (
        entry.volume != 0 or entry.internal_attr != 0
        or (entry.external_attr & 0xFFFF) not in (0, 0x20)
    ):
        raise InvalidReceipt("unsupported ZIP central directory attributes")
    # The lab only accepts known normal ZIP creator/extractor version metadata.
    # Other values are ignored by ordinary readers and can hide opaque bytes.
    # GitHub artifact upload uses Unix creator 4.5, Python test ZIPs use 2.0.
    if (
        (entry.create_system, entry.create_version) not in ((0, 20), (3, 20), (3, 45))
        or entry.reserved != 0
        or entry.extract_version not in (
            (10, 20) if entry.compress_type == zipfile.ZIP_STORED else (20,)
        )
    ):
        raise InvalidReceipt("unsupported ZIP creator or extractor version")
    # The same ZIP member has both local and central metadata. Any mismatch
    # makes the artifact ambiguous even if Python's ZipFile.read() tolerates it.
    # Compare raw DOS time/date and extraction-version fields without relying
    # on timezone conversions or interpreted ZipInfo timestamps.
    if (
        raw[4:6] != raw[cd_offset + 6:cd_offset + 8]
        or raw[10:14] != raw[cd_offset + 12:cd_offset + 16]
    ):
        raise InvalidReceipt("ZIP local and central metadata disagree")
    local = struct.unpack_from("<IHHHHHIIIHH", raw, 0)
    (local_signature, _version, flags, method, _time, _date,
     local_crc, local_compressed, local_uncompressed, name_len, extra_len) = local
    if (
        local_signature != 0x04034B50 or flags != entry.flag_bits
        or method != entry.compress_type or name_len != len(name)
        or extra_len != 0 or raw[30:30 + len(name)] != name
    ):
        raise InvalidReceipt("unsafe ZIP local header")
    if flags & 8:
        # Descriptor-format artifact: local CRC and lengths are deferred.
        # Require their conventional zero placeholders; reject contradictory
        # local claims even when zipfile ignores them and reads successfully.
        if local_crc != 0 or local_compressed != 0 or local_uncompressed != 0:
            raise InvalidReceipt("ZIP deferred local checksums or sizes are not zero")
    elif (
        local_crc != entry.CRC
        or local_compressed != entry.compress_size
        or local_uncompressed != entry.file_size
    ):
        raise InvalidReceipt("ZIP local checksums and sizes disagree")
    payload_start = 30 + len(name)
    payload_end = payload_start + entry.compress_size
    if payload_end > cd_offset:
        raise InvalidReceipt("ZIP entry overlaps central directory")
    if entry.compress_type == zipfile.ZIP_DEFLATED:
        # Python's ZipFile.read() can silently ignore bytes appended *inside*
        # a declared deflate stream. Require full, exact stream consumption.
        try:
            decoder = zlib.decompressobj(wbits=-15)
            expanded = decoder.decompress(raw[payload_start:payload_end], MAX_JSON + 1)
        except zlib.error as exc:
            raise InvalidReceipt("malformed ZIP deflate stream") from exc
        if (
            not decoder.eof or decoder.unused_data or decoder.unconsumed_tail
            or len(expanded) != entry.file_size
        ):
            raise InvalidReceipt("ZIP deflate stream has hidden or unconsumed bytes")
    elif entry.compress_size != entry.file_size:
        raise InvalidReceipt("ZIP stored entry length mismatch")
    trailer = raw[payload_end:cd_offset]
    if flags & 8:
        expected = struct.pack("<III", entry.CRC, entry.compress_size, entry.file_size)
        if trailer not in (expected, b"PK\x07\x08" + expected):
            raise InvalidReceipt("ZIP has an unexpected data descriptor or hidden bytes")
    elif trailer:
        raise InvalidReceipt("ZIP has hidden bytes before directory")


def read_bounded_regular_file(path: Path, limit: int) -> bytes:
    """Open the checked inode itself, not a separately pre-checked path.

    No symlink traversal, unbounded reads or blocking on special files.
    This is a local lab file hygiene gate, not origin attestation.
    """
    if not hasattr(os, "O_NOFOLLOW"):
        raise InvalidReceipt("nofollow file opening unavailable")
    flags = os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)
    flags |= getattr(os, "O_NONBLOCK", 0)
    fd = os.open(path, flags)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or not 20 <= info.st_size <= limit:
            raise InvalidReceipt("unsafe or oversized receipt container")
        with os.fdopen(fd, "rb", closefd=False) as source:
            raw = source.read(limit + 1)
        if len(raw) != info.st_size:
            raise InvalidReceipt("receipt container changed while reading")
        return raw
    finally:
        os.close(fd)


def read_receipt(path: Path) -> dict:
    if path.suffix == ".json":
        if path.name != MEMBER:
            raise InvalidReceipt("invalid JSON container")
        return load_json(read_bounded_regular_file(path, MAX_JSON))
    if path.suffix != ".zip":
        raise InvalidReceipt("unsupported artifact container")
    zip_bytes = read_bounded_regular_file(path, MAX_ZIP)
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as archive:
        entries = archive.infolist()
        if archive.comment or len(entries) != 1:
            raise InvalidReceipt("archive contains extra data or entries")
        item = entries[0]
        mode = (item.external_attr >> 16) & 0o170000
        if (
            item.filename != MEMBER or item.is_dir() or mode not in (0, stat.S_IFREG)
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

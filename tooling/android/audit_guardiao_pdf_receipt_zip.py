#!/usr/bin/env python3
"""Offline P0 lab verifier for the published metadata-only ZIP of synthetic PDF.

This checks the archive schema and internal consistency, not that Android really
executed. Correlate the artifact ID with the successful GitHub Actions run.
Only a fixed 48-digit invalid test fixture is allowed; never a payable input.
"""
from __future__ import annotations

import argparse
import json
import re
import stat
import sys
import zipfile
from pathlib import Path

ENTRY = "guardiao-android-real-pdf-text-receipt.json"
APK_SHA = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"
SCOPE = "SHA_PINNED_ANDROID_APP_SYNTHETIC_PDF_TEXT"
FIXTURE = "synthetic-48-collection-reference-invalid"
TRUE_FLAGS = frozenset({
    "allPagesRendered", "guardiaoOpened", "nativePdfSemanticTextVerified",
    "pdfActionTriggered", "privateCaptureDeleted", "realAndroidApkPdf",
    "receiverCacheClean", "receiverPdfRead", "renderedFirstPage",
    "syntheticInput", "systemChooserObserved",
})
FALSE_FLAGS = frozenset({
    "approvedForProduction", "chromeReferenceUsed", "stableReleaseAllowed",
})
COUNTERS = frozenset({"pdfPageCount", "pdfPages", "nonblankPages", "textPagesVerified"})
KEYS = (TRUE_FLAGS | FALSE_FLAGS | COUNTERS | {
    "api", "apkSha256", "pdfSizeBytes", "receivedPdfSha256",
    "schemaVersion", "scope", "sourceFixture",
})


class InvalidReceipt(ValueError):
    pass


def reject_duplicates(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj:
            raise InvalidReceipt("duplicate JSON key")
        obj[key] = value
    return obj


def reject_constant(_value):
    raise InvalidReceipt("non-JSON numeric constant")


def verify(path: Path, expected_api: int) -> None:
    if expected_api not in (26, 28):
        raise InvalidReceipt("unsupported API")
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= 65536:
        raise InvalidReceipt("unsafe archive")
    with zipfile.ZipFile(path, "r") as archive:
        members = archive.infolist()
        if archive.comment or len(members) != 1:
            raise InvalidReceipt("archive contains unexpected entries")
        member = members[0]
        mode = member.external_attr >> 16
        if (member.filename != ENTRY or member.is_dir() or stat.S_IFMT(mode) == stat.S_IFLNK
                or (member.flag_bits & 1) or member.compress_type not in (
                    zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)
                or not 0 < member.file_size <= 4096
                or not 0 < member.compress_size <= 4096):
            raise InvalidReceipt("unsafe artifact member")
        payload = archive.read(member)
    report = json.loads(payload.decode("utf-8", "strict"),
                        object_pairs_hook=reject_duplicates, parse_constant=reject_constant)
    if not isinstance(report, dict) or set(report) != KEYS:
        raise InvalidReceipt("unexpected metadata schema")
    if any(report[key] is not True for key in TRUE_FLAGS):
        raise InvalidReceipt("a positive gate is not true")
    if any(report[key] is not False for key in FALSE_FLAGS):
        raise InvalidReceipt("a blocked release gate was altered")
    if (type(report["schemaVersion"]) is not int or report["schemaVersion"] != 2
            or type(report["api"]) is not int or report["api"] != expected_api):
        raise InvalidReceipt("invalid API or schema version")
    if report["scope"] != SCOPE or report["sourceFixture"] != FIXTURE:
        raise InvalidReceipt("scope or fixture differs")
    if report["apkSha256"] != APK_SHA:
        raise InvalidReceipt("unapproved APK hash")
    sha = report["receivedPdfSha256"]
    if not isinstance(sha, str) or re.fullmatch(r"[0-9a-f]{64}", sha) is None:
        raise InvalidReceipt("invalid PDF digest")
    if (type(report["pdfSizeBytes"]) is not int
            or not 200 < report["pdfSizeBytes"] <= 8 * 1024 * 1024):
        raise InvalidReceipt("invalid PDF size")
    pages = report["pdfPages"]
    if (type(pages) is not int or not 1 <= pages <= 8
            or any(type(report[key]) is not int or report[key] != pages for key in COUNTERS)):
        raise InvalidReceipt("inconsistent page counts")


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline metadata-only Guardiao lab ZIP verifier")
    parser.add_argument("zip_path", type=Path)
    parser.add_argument("--api", type=int, choices=(26, 28), required=True)
    args = parser.parse_args()
    try:
        verify(args.zip_path, args.api)
    except (InvalidReceipt, OSError, ValueError, zipfile.BadZipFile, RuntimeError):
        # No raw data, path, filename or financial text in logs.
        print("BLOCK (LAB): receipt archive could not be verified", file=sys.stderr)
        return 1
    print(f"PASS (LAB): synthetic API {args.api} metadata-only receipt structure verified; provenance must be checked independently")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

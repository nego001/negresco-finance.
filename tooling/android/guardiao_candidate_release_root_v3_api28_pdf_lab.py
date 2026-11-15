#!/usr/bin/env python3
"""API28 root-hit-order Release-mode preview, never the immutable original.

Runs in isolated GitHub CI against an existing, SHA-pinned, DEBUG-SIGNED
release-mode candidate, not the historical Release or a production build.
Only fixed invalid synthetic collection input is used. Requires independent
receiver, semantic PDF checks, bounded receipts and private-cache cleanup.
Does not log PDF text, UI hierarchy, hashes, customer data or native logs.
"""
from __future__ import annotations

import hashlib
import json
import re
import stat
import sys
from pathlib import Path

import guardiao_original_release_input_replay_lab as replay
import guardiao_android_export_pdf_text_emulator_smoke as semantic
import verify_collection48_receipt as contract

BASE = semantic.base
PINNED_CANDIDATE = "64a119ca30e482ea85122a2f381be89b78b798318b496b5c4661aab9515cf2fc"
ORIGINAL_IMMUTABLE = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"
APK = Path("test-apk/android/app/build/outputs/apk/release/app-release.apk")
MAX_APK_BYTES = 200 * 1024 * 1024
FIXTURE = "synthetic-48-collection-reference-invalid"


def candidate_identity(path: Path) -> bool:
    try:
        if (path.is_symlink() or not path.is_file()
                or not 25_000_000 <= path.stat().st_size <= MAX_APK_BYTES):
            return False
        info = path.stat()
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            return False
        digest = hashlib.sha256()
        read_bytes = 0
        with path.open("rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                read_bytes += len(chunk)
                if read_bytes > MAX_APK_BYTES:
                    return False
                digest.update(chunk)
        after = path.stat()
        return (info.st_size == read_bytes == after.st_size
                and info.st_mtime_ns == after.st_mtime_ns
                and info.st_ino == after.st_ino
                and digest.hexdigest() == PINNED_CANDIDATE
                and digest.hexdigest() != ORIGINAL_IMMUTABLE)
    except OSError:
        return False


def candidate_receipt(report: object) -> bool:
    """Require original gate's complete schema, but keep distinct candidate pin."""
    if type(report) is not dict or set(report) != contract.REQUIRED:
        return False
    if (report.get("apkSha256") != PINNED_CANDIDATE
            or type(report.get("api")) is not int or report["api"] != 28
            or report.get("sourceFixture") != FIXTURE
            or report.get("scope") != contract.SCOPE
            or type(report.get("schemaVersion")) is not int
            or report["schemaVersion"] != 2):
        return False
    if any(report.get(k) is not True for k in contract.TRUE_FLAGS):
        return False
    if any(report.get(k) is not False for k in contract.FALSE_FLAGS):
        return False
    pages, size = report.get("pdfPageCount"), report.get("pdfSizeBytes")
    if (type(pages) is not int or not 1 <= pages <= 8
            or type(size) is not int or not 200 < size <= 8 * 1024 * 1024):
        return False
    if any(type(report.get(k)) is not int or report[k] != pages for k in
           ("pdfPages","nonblankPages","textPagesVerified")):
        return False
    sha = report.get("receivedPdfSha256")
    return type(sha) is str and re.fullmatch(r"[0-9a-f]{64}",sha) is not None


def run() -> None:
    if len(sys.argv) != 1:
        raise RuntimeError("candidate lab accepts no runtime arguments")
    if not candidate_identity(APK):
        raise RuntimeError("candidate Release APK identity does not match")
    if BASE.adb("shell","getprop","ro.build.version.sdk",timeout=15).strip() != "28":
        raise RuntimeError("candidate lab requires Android API28")
    if semantic.REPORT.exists():
        raise RuntimeError("old receipt present in isolated lab")
    BASE.APK, BASE.EXPECTED_SHA = APK, PINNED_CANDIDATE
    # Historical Release workflow and receipt verifier remain unchanged:
    # this is a different, current test candidate.
    print("STAGE (LAB): distinct current candidate Release SHA verified",flush=True)
    try:
        replay.run()
        report = contract.load_json(semantic.REPORT.read_bytes())
        if not candidate_receipt(report):
            raise RuntimeError("candidate receiver/semantic receipt incomplete")
        if not semantic.ensure_absent:
            raise RuntimeError("semantic cleanup hook unavailable")
        semantic.ensure_absent()
        print("PASS (LAB): root-hit-order candidate API28 PDF received, rendered and semantic content verified",flush=True)
        print("PASS (LAB): test-only candidate, not immutable original Release and no production authorization",flush=True)
    finally:
        semantic.REPORT.unlink(missing_ok=True)
        BASE.REPORT.unlink(missing_ok=True)

if __name__ == "__main__":
    try:
        run()
    except Exception:
        print("BLOCK (LAB): candidate Release API28 PDF replay unverified",file=sys.stderr)
        raise SystemExit(1)

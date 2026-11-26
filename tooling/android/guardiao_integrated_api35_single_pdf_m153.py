#!/usr/bin/env python3
"""Compare one real synthetic PDF on Android API35 using EXACT v4 APK bytes.

No original Release substitution. No app changes or extra gestures. Preserve
the independent receiver, PDF text verification, stale receipt and cleanup
gates. Emit only fixed, non-sensitive PASS/BLOCK categories.
"""
from __future__ import annotations

import re
import sys

import guardiao_candidate_release_root_v4_api28_pdf_lab as candidate
import guardiao_original_release_input_replay_lab as replay
import guardiao_android_export_pdf_text_emulator_smoke as semantic
import verify_collection48_receipt as contract

BASE = candidate.BASE
EXPECTED_API = 35


def receipt_valid(report: object) -> bool:
    """Same strict v4 candidate semantic receipt gates, with API35 instead of 28."""
    if type(report) is not dict or set(report) != contract.REQUIRED:
        return False
    if (report.get("apkSha256") != candidate.PINNED_CANDIDATE
            or type(report.get("api")) is not int or report["api"] != EXPECTED_API
            or report.get("sourceFixture") != candidate.FIXTURE
            or report.get("scope") != contract.SCOPE
            or type(report.get("schemaVersion")) is not int
            or report["schemaVersion"] != 2):
        return False
    if any(report.get(key) is not True for key in contract.TRUE_FLAGS):
        return False
    if any(report.get(key) is not False for key in contract.FALSE_FLAGS):
        return False
    pages, size = report.get("pdfPageCount"), report.get("pdfSizeBytes")
    if (type(pages) is not int or not 1 <= pages <= 8
            or type(size) is not int or not 200 < size <= 8 * 1024 * 1024):
        return False
    if any(type(report.get(key)) is not int or report[key] != pages
           for key in ("pdfPages", "nonblankPages", "textPagesVerified")):
        return False
    digest = report.get("receivedPdfSha256")
    return type(digest) is str and re.fullmatch(r"[0-9a-f]{64}", digest) is not None


def run() -> None:
    if (len(sys.argv) != 1
            or not candidate.candidate_identity(candidate.APK)
            or candidate.PINNED_CANDIDATE == candidate.ORIGINAL_IMMUTABLE
            or semantic.REPORT.exists() or BASE.REPORT.exists()):
        raise RuntimeError("candidate identity or isolated workspace rejected")
    if BASE.adb("shell", "getprop", "ro.build.version.sdk", timeout=15).strip() != "35":
        raise RuntimeError("Android API35 required")

    BASE.APK, BASE.EXPECTED_SHA = candidate.APK, candidate.PINNED_CANDIDATE
    print("STAGE (LAB): same immutable experimental APK verified on API35",
          flush=True)
    try:
        replay.run()
        raw = semantic.REPORT.read_bytes()
        report = contract.load_json(raw)
        if not receipt_valid(report):
            raise RuntimeError("API35 independent receiver/semantics receipt not verified")
        # run_lab requires private PDF capture + receiver cache cleanup.
        # Verify again before any PASS is emitted.
        semantic.ensure_absent()
        print("PASS (LAB): API35 real candidate PDF received, all pages rendered, semantic text verified and cache cleared",flush=True)
        print("PASS (LAB): candidate-only comparison; historic Release P0 remains blocked",flush=True)
    finally:
        semantic.REPORT.unlink(missing_ok=True)
        BASE.REPORT.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print("BLOCK (LAB): API35 candidate PDF parity incomplete",file=sys.stderr)
        raise SystemExit(1)

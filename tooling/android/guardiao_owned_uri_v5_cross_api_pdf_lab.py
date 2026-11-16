#!/usr/bin/env python3
"""Test the exact Debug-signed v5 APK with owned-private-PDF URI gating.

This wrapper reuses already proven synthetic Android end-to-end receiver
harnesses. All *relevant* original v4 receipt checks run against a different
pinned APK hash: the v5 SHA from successful build #43789332636.

This tests an actual compiled APK, not merely JavaScript mocks. No bank data,
network upload, shell UI gestures, production signing or release approval.
"""
from __future__ import annotations

import sys

import guardiao_candidate_release_root_v4_api28_pdf_lab as base_candidate
import guardiao_candidate_release_v4_api26_single_pdf_lab as api26

NEW_SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
PREVIOUS_SHA = "3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6"
HISTORICAL_SHA = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"


def run() -> None:
    if len(sys.argv) != 1:
        raise RuntimeError("lab accepts no dynamic SHA or file path")
    if len({NEW_SHA, PREVIOUS_SHA, HISTORICAL_SHA}) != 3:
        raise RuntimeError("v5 candidate cannot be original or previous candidate")

    # The existing candidate/receiver adapters derive their receipt SHA from
    # this module global. Set it before identity and PDF checks, never weaken
    # receipt fields or suppress a blocked native outcome.
    base_candidate.PINNED_CANDIDATE = NEW_SHA
    if not base_candidate.candidate_identity(base_candidate.APK):
        raise RuntimeError("v5 APK identity mismatch")
    actual_api = base_candidate.BASE.adb(
        "shell", "getprop", "ro.build.version.sdk", timeout=15
    ).strip()
    if actual_api not in {"26", "28"}:
        raise RuntimeError("Android 8 or 9 required")
    if base_candidate.semantic.REPORT.exists() or base_candidate.BASE.REPORT.exists():
        raise RuntimeError("stale receipt in isolated emulator")

    print("STAGE (LAB): immutable v5 owned-uri candidate identity verified",
          flush=True)
    try:
        if actual_api == "26":
            api26.run()
        else:
            base_candidate.run()
        base_candidate.semantic.ensure_absent()
        print("PASS (LAB): v5 real owned-uri PDF receiver verified on API" + actual_api,
              flush=True)
        print("BLOCK (PRODUCTION): historical APK untested, candidate debug signed",
              flush=True)
    finally:
        base_candidate.semantic.REPORT.unlink(missing_ok=True)
        base_candidate.BASE.REPORT.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print("BLOCK (LAB): v5 owned-uri PDF Android receiver unverified",
              file=sys.stderr, flush=True)
        raise SystemExit(1)

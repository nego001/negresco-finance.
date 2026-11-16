#!/usr/bin/env python3
"""Four real synthetic PDF receipts + bounded scoped Home returns on v5 APK.

Pin the *new* v5 Debug-signed Release-mode APK before invoking the existing
v4-scoped replay harnesses. No rebuild, user data, screenshot, raw UI log,
extra gestures, forced app restart, modified original, or release approval.
"""
from __future__ import annotations

import sys

import guardiao_candidate_release_root_v4_api28_pdf_lab as candidate
import guardiao_candidate_release_v4_api26_scoped_four_pdf_samepid_lab as scoped26
import guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab as scoped28
import guardiao_android_export_pdf_text_emulator_smoke as semantic

NEW_SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
PREVIOUS_SHA = "3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6"
HISTORICAL_SHA = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"
BASE = candidate.BASE


def run() -> None:
    if len(sys.argv) != 1 or len({NEW_SHA, PREVIOUS_SHA, HISTORICAL_SHA}) != 3:
        raise RuntimeError("v5 fixed identity preflight rejected")
    # All the imported scoped/core/API26 adapters share this exact module
    # instance. The original v4 module remains untouched on disk.
    candidate.PINNED_CANDIDATE = NEW_SHA
    if (not candidate.candidate_identity(candidate.APK)
            or semantic.REPORT.exists() or BASE.REPORT.exists()):
        raise RuntimeError("v5 candidate identity or stale receipt rejected")
    api = BASE.adb("shell", "getprop", "ro.build.version.sdk", timeout=15).strip()
    if api not in ("26", "28"):
        raise RuntimeError("API26 or API28 required")
    print("STAGE (LAB): v5 exact SHA and real Android API verified", flush=True)
    try:
        if api == "26":
            scoped26.run()
        else:
            scoped28.run()
        # The scoped runner asserts four actual independent receiver receipts,
        # one immutable PID, 3 guarded Home returns, initial/pre/post geometry.
        if semantic.REPORT.exists() or BASE.REPORT.exists():
            raise RuntimeError("temporary receipt survived four PDF cycles")
        semantic.ensure_absent()
        print("PASS (LAB): v5 API" + api +
              " owned-uri four real PDFs, three scoped Home returns, same PID",
              flush=True)
        print("BLOCK (PRODUCTION): historical original not reproduced, test APK only",
              flush=True)
    finally:
        semantic.REPORT.unlink(missing_ok=True)
        BASE.REPORT.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print("BLOCK (LAB): v5 four-PDF same-PID scoped proof incomplete",
              file=sys.stderr, flush=True)
        raise SystemExit(1)

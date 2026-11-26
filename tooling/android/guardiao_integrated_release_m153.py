#!/usr/bin/env python3
"""M153: locally built, debug-signed Release-mode APK only, same-job evidence.
No historical pin file mutation, no APK/PDF upload, no production claim.
"""
import hashlib
import os
import re
import stat
import sys
from pathlib import Path

import guardiao_candidate_release_root_v4_api28_pdf_lab as candidate
import guardiao_integrated_api35_scoped_four_pdf_m153 as scoped

REF = "refs/heads/lab/p01-guardiao-active-integration-m149-v1"
APK = Path("apps/mobile/android/app/build/outputs/apk/release/app-release.apk")
PIN = Path("m153-private-apk.sha256")

def check_pin(raw, digest, original):
    if (type(raw) is not str or not re.fullmatch(r"[0-9a-f]{64}\n", raw)
            or raw.strip() != digest or digest == original):
        raise RuntimeError("local candidate digest unconfirmed")
    return digest

def run():
    if (len(sys.argv) != 1 or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != REF):
        raise RuntimeError("M153 CI scope required")
    for path in (APK, PIN):
        if path.is_symlink() or not path.is_file() or path.stat().st_nlink != 1:
            raise RuntimeError("local evidence path unconfirmed")
    if PIN.stat().st_size != 65 or not 25_000_000 <= APK.stat().st_size <= candidate.MAX_APK_BYTES:
        raise RuntimeError("local evidence size unconfirmed")
    digest = hashlib.sha256()
    with APK.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    pin = check_pin(PIN.read_text(encoding="ascii"), digest.hexdigest(), candidate.ORIGINAL_IMMUTABLE)
    previous = candidate.PINNED_CANDIDATE, candidate.APK
    previous_base = candidate.BASE.APK, candidate.BASE.EXPECTED_SHA
    original_smoke = candidate.BASE.run_smoke

    def api35_smoke(after_receiver_install=None, after_verified_receipt=None):
        return original_smoke(after_receiver_install=after_receiver_install,
                              after_verified_receipt=after_verified_receipt,
                              expected_api=35)
    try:
        candidate.PINNED_CANDIDATE, candidate.APK = pin, APK
        if not candidate.candidate_identity(APK):
            raise RuntimeError("M153 immutable local candidate identity failed")
        candidate.BASE.run_smoke = api35_smoke
        scoped.run()
        if not candidate.candidate_identity(APK):
            raise RuntimeError("candidate changed during runtime")
        print("PASS (LAB): M153 new integrated Release-mode candidate four synthetic PDFs, no production approval", flush=True)
    finally:
        candidate.PINNED_CANDIDATE, candidate.APK = previous
        candidate.BASE.APK, candidate.BASE.EXPECTED_SHA = previous_base
        candidate.BASE.run_smoke = original_smoke

if __name__ == "__main__":
    try:
        run()
    except Exception:
        print("BLOCK (LAB): M153 integrated Release-mode runtime proof incomplete", file=sys.stderr)
        raise SystemExit(1)

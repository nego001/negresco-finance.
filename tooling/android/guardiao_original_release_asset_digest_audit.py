#!/usr/bin/env python3
"""Offline Release asset inventory check, *never* an APK verification.

Input is a bounded, locally supplied JSON snapshot of GitHub Releases API
metadata. The output deliberately does not contain asset names, URLs, paths
or digests. A metadata match requires a subsequent actual-byte SHA-256
verification; no result grants production approval or proves repository
exhaustiveness.
"""
from __future__ import annotations

import json
import re
import stat
import sys
from pathlib import Path

EXPECTED_SHA256 = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"
MAX_SNAPSHOT_BYTES = 512_000
MAX_RELEASES = 200
MAX_ASSETS_PER_RELEASE = 100

def classify(releases: object) -> tuple[str, int, int]:
    """Return category, release count, APK count; no user-controlled fields."""
    if type(releases) is not list or not 1 <= len(releases) <= MAX_RELEASES:
        return ("invalid-or-incomplete-metadata", 0, 0)
    matching = 0
    count = 0
    for release in releases:
        if type(release) is not dict:
            return ("invalid-or-incomplete-metadata", 0, 0)
        assets = release.get("assets")
        if (type(release.get("tag_name")) is not str
                or not 1 <= len(release["tag_name"]) <= 160
                or type(assets) is not list
                or len(assets) > MAX_ASSETS_PER_RELEASE):
            return ("invalid-or-incomplete-metadata", 0, 0)
        for asset in assets:
            if type(asset) is not dict or type(asset.get("name")) is not str:
                return ("invalid-or-incomplete-metadata", 0, 0)
            name = asset["name"]
            if not 1 <= len(name) <= 255:
                return ("invalid-or-incomplete-metadata", 0, 0)
            if not name.lower().endswith(".apk"):
                continue
            count += 1
            digest = asset.get("digest")
            if type(digest) is not str or re.fullmatch(r"sha256:[0-9a-f]{64}", digest) is None:
                return ("invalid-or-incomplete-metadata", 0, 0)
            if digest == "sha256:" + EXPECTED_SHA256:
                matching += 1
    if count == 0:
        return ("no-apk-assets-in-provided-metadata", len(releases), 0)
    if matching:
        return ("candidate-metadata-only-bytes-unverified", len(releases), count)
    return ("no-match-in-provided-metadata", len(releases), count)


def audit_file(path: Path) -> tuple[str, int, int]:
    try:
        if path.is_symlink() or not path.is_file():
            return ("invalid-or-incomplete-metadata", 0, 0)
        mode = path.stat().st_mode
        size = path.stat().st_size
        if not stat.S_ISREG(mode) or not 1 <= size <= MAX_SNAPSHOT_BYTES:
            return ("invalid-or-incomplete-metadata", 0, 0)
        releases = json.loads(path.read_text(encoding="utf8"))
    except (OSError, ValueError, UnicodeError):
        return ("invalid-or-incomplete-metadata", 0, 0)
    return classify(releases)


def main() -> int:
    if len(sys.argv) != 2:
        print("BLOCK (LAB): release metadata input missing or ambiguous")
        return 1
    result, releases, apks = audit_file(Path(sys.argv[1]))
    print("RELEASE_ASSET_METADATA (LAB): " + result)
    print("RELEASE_ASSET_COUNTS (LAB): releases=" + str(releases) + " apk_assets=" + str(apks))
    print("RELEASE_PRODUCTION_GATES (LAB): approvedForProduction=false stableReleaseAllowed=false")
    return 1 if result == "invalid-or-incomplete-metadata" else 0


if __name__ == "__main__":
    raise SystemExit(main())

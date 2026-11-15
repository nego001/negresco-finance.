#!/usr/bin/env python3
"""Read-only preflight. Never download, rebuild, sign or publish the original APK."""
from __future__ import annotations
import json
import os
import sys
from urllib.request import Request, urlopen

REPO = "nego001/negresco-finance."
RUN_ID = 40617164086
SOURCE_COMMIT = "a01286f91c53a12e977c3e550300c872e5955d45"
ARTIFACT_NAME = "negresco-finance-v313-security-preview"
MAX_RESPONSE_BYTES = 1_048_576

def classify_metadata(run: object, listing: object) -> str:
    if not isinstance(run, dict) or run.get("id") != RUN_ID:
        return "source-run-unconfirmed"
    if (run.get("head_sha") != SOURCE_COMMIT or run.get("status") != "completed"
            or run.get("conclusion") != "success"):
        return "source-run-provenance-unconfirmed"
    if not isinstance(listing, dict):
        return "artifact-list-unconfirmed"
    records = listing.get("artifacts")
    count = listing.get("total_count")
    if (not isinstance(records, list) or not isinstance(count, int)
            or isinstance(count, bool) or count != len(records) or count > 100):
        return "artifact-list-unconfirmed"
    matches = [a for a in records if isinstance(a, dict) and
               a.get("name") == ARTIFACT_NAME]
    if not matches:
        return "original-artifact-not-listed"
    if len(matches) != 1:
        return "original-artifact-ambiguous"
    item = matches[0]
    if item.get("expired") is not False:
        return "original-artifact-expired-or-unconfirmed"
    size = item.get("size_in_bytes")
    if not isinstance(size, int) or isinstance(size, bool) or size < 25_000_000:
        return "original-artifact-size-unconfirmed"
    linked = item.get("workflow_run")
    if not isinstance(linked, dict) or linked.get("id") != RUN_ID:
        return "original-artifact-link-unconfirmed"
    if not isinstance(item.get("id"), int) or isinstance(item.get("id"), bool):
        return "original-artifact-id-unconfirmed"
    return "original-artifact-metadata-ready-for-sha-verification"

def fetch_json(path: str, token: str) -> object:
    url = f"https://api.github.com/repos/{REPO}/actions/{path}"
    request = Request(url, headers={
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Negresco-Readonly-Provenance-Lab",
    })
    with urlopen(request, timeout=20) as response:
        if response.status != 200:
            raise ValueError("metadata unavailable")
        raw = response.read(MAX_RESPONSE_BYTES + 1)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise ValueError("metadata too large")
    return json.loads(raw)

def main() -> int:
    if len(sys.argv) != 1 or not os.environ.get("GITHUB_TOKEN"):
        print("BLOCK (LAB): original-apk-metadata-auth-unavailable", flush=True)
        return 1
    try:
        run = fetch_json(f"runs/{RUN_ID}", os.environ["GITHUB_TOKEN"])
        listing = fetch_json(f"runs/{RUN_ID}/artifacts?per_page=100",
                             os.environ["GITHUB_TOKEN"])
        verdict = classify_metadata(run, listing)
    except Exception:
        print("BLOCK (LAB): original-apk-metadata-api-unavailable", flush=True)
        return 1
    if verdict != "original-artifact-metadata-ready-for-sha-verification":
        print("BLOCK (LAB): " + verdict, flush=True)
        return 1
    print("PASS (LAB): original-artifact-metadata-ready-for-sha-verification",
          flush=True)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

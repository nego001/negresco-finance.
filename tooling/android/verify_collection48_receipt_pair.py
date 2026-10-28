#!/usr/bin/env python3
"""Fail-closed second check of both metadata-only receipts after GitHub upload.

This is a file-layout and internal-consistency check, not Android attestation.
The script never reads PDFs, captures, UI dumps, financial inputs or secrets.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import verify_collection48_receipt as receipt

PREFIX = "guardiao-android-collection48-pdf-text-api-"
SUFFIX = "-unreviewed"
APIS = (26, 28)
EXPECTED_DIRS = {f"{PREFIX}{api}{SUFFIX}" for api in APIS}


def verify_pair(root: Path) -> None:
    if root.is_symlink() or not root.is_dir():
        raise receipt.InvalidReceipt("unsafe pair root")
    with os.scandir(root) as directory:
        actual = list(directory)
    if len(actual) != 2 or {entry.name for entry in actual} != EXPECTED_DIRS:
        raise receipt.InvalidReceipt("missing or extra Android artifact directory")
    if any(not entry.is_dir(follow_symlinks=False) for entry in actual):
        raise receipt.InvalidReceipt("unexpected Android artifact directory type")
    for api in APIS:
        folder = root / f"{PREFIX}{api}{SUFFIX}"
        with os.scandir(folder) as directory:
            members = list(directory)
        if (
            len(members) != 1
            or members[0].name != receipt.MEMBER
            or not members[0].is_file(follow_symlinks=False)
        ):
            raise receipt.InvalidReceipt("missing or extra receipt file")
        parsed = receipt.read_receipt(folder / receipt.MEMBER)
        receipt.verify(parsed, api)


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("BLOCK (LAB): expected one receipt-pair directory", file=sys.stderr)
        return 2
    try:
        verify_pair(Path(argv[0]))
    except Exception:
        # Fixed diagnostic only: never echo paths or untrusted JSON.
        print("BLOCK (LAB): post-upload Android receipt pair rejected", file=sys.stderr)
        return 1
    print("PASS (LAB): both published synthetic Android receipts checked after upload")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

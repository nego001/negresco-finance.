#!/usr/bin/env python3
"""Fail-closed, metadata-only receipt audit: API26 control and three API28 samples.

Each matrix job uses a fresh Android emulator. Receipt labels are not
cryptographic attestation. Never print untrusted metadata or sensitive data.
"""
from __future__ import annotations

import os
import stat
import sys
from pathlib import Path

import verify_collection48_receipt as receipt
from verify_collection48_receipt_pair import DIR_FLAGS, read_member_at

PREFIX = "guardiao-android-collection48-pdf-text-api-"
SUFFIX = "-unreviewed"
SAMPLES = ((26, "control"), (28, "a"), (28, "b"), (28, "c"))
EXPECTED = {f"{PREFIX}{api}-repeat-{sample}{SUFFIX}" for api, sample in SAMPLES}


def verify_repetition(root: Path) -> None:
    root_fd = receipt.open_no_symlink_path(root, DIR_FLAGS)
    try:
        if not stat.S_ISDIR(os.fstat(root_fd).st_mode):
            raise receipt.InvalidReceipt("unsafe receipt root")
        if set(os.listdir(root_fd)) != EXPECTED:
            raise receipt.InvalidReceipt("missing or extra sample receipt")
        for api, sample in SAMPLES:
            folder = f"{PREFIX}{api}-repeat-{sample}{SUFFIX}"
            folder_fd = os.open(folder, DIR_FLAGS, dir_fd=root_fd)
            try:
                if not stat.S_ISDIR(os.fstat(folder_fd).st_mode):
                    raise receipt.InvalidReceipt("unsafe sample directory")
                if os.listdir(folder_fd) != [receipt.MEMBER]:
                    raise receipt.InvalidReceipt("unexpected sample member")
                parsed = read_member_at(folder_fd)
                receipt.verify(parsed, api)
            finally:
                os.close(folder_fd)
    finally:
        os.close(root_fd)


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("BLOCK (LAB): expected fixed receipt root", file=sys.stderr)
        return 2
    try:
        verify_repetition(Path(argv[0]))
    except Exception:
        print("BLOCK (LAB): repeated Release receipts incomplete", file=sys.stderr)
        return 1
    print("PASS (LAB): API26 control and three independent API28 receipts validated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

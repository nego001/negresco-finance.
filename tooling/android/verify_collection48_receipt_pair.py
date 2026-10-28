#!/usr/bin/env python3
"""Fail-closed second check of both metadata-only receipts after GitHub upload.

This is a file-layout and internal-consistency check, not Android attestation.
The script never reads PDFs, captures, UI dumps, financial inputs or secrets.
"""
from __future__ import annotations

import os
import stat
import sys
from pathlib import Path

import verify_collection48_receipt as receipt

PREFIX = "guardiao-android-collection48-pdf-text-api-"
SUFFIX = "-unreviewed"
APIS = (26, 28)
EXPECTED_DIRS = {f"{PREFIX}{api}{SUFFIX}" for api in APIS}


DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)
FILE_FLAGS = os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0) | os.O_NONBLOCK


def read_member_at(folder_fd: int) -> dict:
    """Read the exact regular-file inode beneath a pinned directory fd."""
    file_fd = os.open(receipt.MEMBER, FILE_FLAGS, dir_fd=folder_fd)
    try:
        info = os.fstat(file_fd)
        if not stat.S_ISREG(info.st_mode) or not 20 <= info.st_size <= receipt.MAX_JSON:
            raise receipt.InvalidReceipt("unsafe or oversized post-upload JSON")
        with os.fdopen(file_fd, "rb", closefd=False) as stream:
            raw = stream.read(receipt.MAX_JSON + 1)
        if len(raw) != info.st_size:
            raise receipt.InvalidReceipt("post-upload JSON changed during read")
        return receipt.load_json(raw)
    finally:
        os.close(file_fd)


def verify_pair(root: Path) -> None:
    # A held directory descriptor cannot be redirected by renaming a path or
    # replacing its last component with a symlink during the next lookup.
    root_fd = os.open(root, DIR_FLAGS)
    try:
        if not stat.S_ISDIR(os.fstat(root_fd).st_mode):
            raise receipt.InvalidReceipt("unsafe post-upload root")
        if set(os.listdir(root_fd)) != EXPECTED_DIRS:
            raise receipt.InvalidReceipt("missing or extra Android artifact directory")
        for api in APIS:
            folder_name = f"{PREFIX}{api}{SUFFIX}"
            folder_fd = os.open(folder_name, DIR_FLAGS, dir_fd=root_fd)
            try:
                if not stat.S_ISDIR(os.fstat(folder_fd).st_mode):
                    raise receipt.InvalidReceipt("unexpected Android artifact directory type")
                if os.listdir(folder_fd) != [receipt.MEMBER]:
                    raise receipt.InvalidReceipt("missing or extra receipt file")
                parsed = read_member_at(folder_fd)
                receipt.verify(parsed, api)
            finally:
                os.close(folder_fd)
    finally:
        os.close(root_fd)

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

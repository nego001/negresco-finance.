#!/usr/bin/env python3
"""Fail-closed audit of two metadata-only API28 receipts from one emulator.

This checks receipt shape and file safety, not cryptographic proof of separate
device executions. The runner also explicitly resets app data between cycles.
"""
from __future__ import annotations

import os
import stat
import sys
from pathlib import Path

import verify_collection48_receipt as receipt
from verify_collection48_receipt_pair import DIR_FLAGS, read_member_at

EXPECTED = frozenset(("cycle-a", "cycle-b"))


def verify_two_cycles(root: Path) -> None:
    root_fd = receipt.open_no_symlink_path(root, DIR_FLAGS)
    try:
        if not stat.S_ISDIR(os.fstat(root_fd).st_mode):
            raise receipt.InvalidReceipt("unsafe two-cycle root")
        if set(os.listdir(root_fd)) != EXPECTED:
            raise receipt.InvalidReceipt("missing or extra two-cycle metadata")
        for cycle in ("cycle-a", "cycle-b"):
            folder_fd = os.open(cycle, DIR_FLAGS, dir_fd=root_fd)
            try:
                if not stat.S_ISDIR(os.fstat(folder_fd).st_mode):
                    raise receipt.InvalidReceipt("non-directory cycle")
                if os.listdir(folder_fd) != [receipt.MEMBER]:
                    raise receipt.InvalidReceipt("missing or extra receipt member")
                parsed = read_member_at(folder_fd)
                receipt.verify(parsed, 28)
            finally:
                os.close(folder_fd)
    finally:
        os.close(root_fd)


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("BLOCK (LAB): fixed two-cycle metadata directory required",
              file=sys.stderr)
        return 2
    try:
        verify_two_cycles(Path(argv[0]))
    except Exception:
        print("BLOCK (LAB): API28 two-cycle metadata incomplete",
              file=sys.stderr)
        return 1
    print("PASS (LAB): both API28 metadata receipts passed strict audit")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

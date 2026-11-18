#!/usr/bin/env python3
"""Diagnostic for reused UIAutomator XML after an Android 9 chooser handoff.

No additional ADB reads, gestures, sleeps or files. Only in-memory SHA-256
digests of already captured synthetic UI XML are retained. No raw XML, names,
hashes, URIs, private text or exception details are logged. Verifier untouched.
"""
from __future__ import annotations
import hashlib
import sys

import guardiao_v5_api28_pre_snapshot_focus_lab as prior
import guardiao_pdf_ui_emulator_smoke as base

SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
BLOCK = "BLOCK (LAB): chooser UI XML reuse diagnosis incomplete"
DUMP_ARGS = ("shell", "uiautomator", "dump", "/sdcard/negresco_ui.xml")
CAT_ARGS = ("exec-out", "cat", "/sdcard/negresco_ui.xml")
MAX_XML_BYTES = 2_000_000


def dump_ack(value: object) -> str:
    """An acknowledgement is NOT proof that the file was refreshed."""
    if type(value) is not str or len(value) > 4096:
        return "unconfirmed"
    text = value.strip()
    if text.startswith("UI hier") and text.endswith(
            "dumped to: /sdcard/negresco_ui.xml"):
        return "reported"
    return "unconfirmed"


def xml_fingerprint(value: object) -> bytes | None:
    """Digest only; never store raw content or expose digest in logs."""
    if type(value) is not str or not value or len(value) > MAX_XML_BYTES:
        return None
    return hashlib.sha256(value.encode("utf-8")).digest()


def comparison(previous: bytes | None, current: bytes | None) -> str:
    if previous is None:
        return "no-chooser-reference"
    if current is None:
        return "current-xml-unconfirmed"
    return "byte-identical-to-chooser" if current == previous else \
        "different-from-chooser"


def run() -> None:
    if len(sys.argv) != 1 or prior.SHA != SHA:
        raise RuntimeError("pinned API28 candidate identity not confirmed")
    original_adb = base.adb
    original_receiver = base.receive_from_chooser
    original_sample = prior.sample
    chooser = False
    last_chooser_fingerprint: bytes | None = None
    pending_first = False
    last_dump_ack = "unconfirmed"

    def observed_adb(*args, **kwargs):
        nonlocal last_chooser_fingerprint, pending_first, last_dump_ack
        result = original_adb(*args, **kwargs)
        if args == DUMP_ARGS:
            last_dump_ack = dump_ack(result)
        elif args == CAT_ARGS:
            fingerprint = xml_fingerprint(result)
            if chooser:
                last_chooser_fingerprint = fingerprint
            if pending_first:
                pending_first = False
                category = comparison(last_chooser_fingerprint, fingerprint)
                print("ENV (LAB): pre-return-xml-chooser-equality=" + category +
                      " dump-ack=" + last_dump_ack, flush=True)
                last_chooser_fingerprint = None  # discard after comparison
                last_dump_ack = "unconfirmed"
        return result

    def observed_receiver(*args, **kwargs):
        nonlocal chooser, last_chooser_fingerprint
        if chooser:
            raise RuntimeError("nested chooser receiver refused")
        chooser = True
        last_chooser_fingerprint = None
        try:
            return original_receiver(*args, **kwargs)
        finally:
            chooser = False

    def observed_pre_return_sample():
        nonlocal pending_first
        if pending_first:
            raise RuntimeError("unexpected nested pre-return XML sample")
        pending_first = True
        return original_sample()

    base.adb = observed_adb
    base.receive_from_chooser = observed_receiver
    prior.sample = observed_pre_return_sample
    try:
        prior.run()
    finally:
        base.adb = original_adb
        base.receive_from_chooser = original_receiver
        prior.sample = original_sample


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print(BLOCK, file=sys.stderr, flush=True)
        raise SystemExit(1)

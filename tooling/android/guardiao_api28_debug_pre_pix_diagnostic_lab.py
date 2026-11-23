#!/usr/bin/env python3
"""M78 allowlist for pre-Pix attribution after original Home census.

Pure literals only: no Android/device/filesystem/network/printing access.
"""
from __future__ import annotations

PRE_PIX_CATEGORIES = frozenset((
    "not-started",
    "pre-pix-process-or-focus-unconfirmed",
    "pre-pix-snapshot-unconfirmed",
    "pre-pix-classifier-unconfirmed",
    "pre-pix-target-unconfirmed",
    "pre-pix-target-attested",
))

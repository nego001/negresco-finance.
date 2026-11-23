#!/usr/bin/env python3
"""M80 allowlisted phase markers only; no device, network or file operations."""
from __future__ import annotations

SNAPSHOT_CATEGORIES = frozenset((
    "not-started",
    "snapshot-screen-size-unconfirmed",
    "snapshot-ui-tree-unconfirmed",
    "snapshot-shape-unconfirmed",
    "snapshot-cleanup-unconfirmed",
    "snapshot-attested",
))

#!/usr/bin/env python3
"""M80 allowlisted phase markers only; no device, network or file operations."""
from __future__ import annotations

SNAPSHOT_CATEGORIES = frozenset((
    "not-started",
    "snapshot-screen-size-unconfirmed",
    "snapshot-ui-tree-unconfirmed",
    "snapshot-ui-dump-timeout",
    "snapshot-ui-dump-command-failed",
    "snapshot-ui-file-timeout",
    "snapshot-ui-file-command-failed",
    "snapshot-ui-xml-parse-unconfirmed",
    "snapshot-ui-xml-no-elements",
    "snapshot-ui-xml-unclosed-token",
    "snapshot-ui-xml-invalid-token",
    "snapshot-ui-xml-mismatched-tag",
    "snapshot-ui-xml-trailing-content",
    "snapshot-ui-xml-partial-character",
    "snapshot-shape-unconfirmed",
    "snapshot-cleanup-unconfirmed",
    "snapshot-attested",
))

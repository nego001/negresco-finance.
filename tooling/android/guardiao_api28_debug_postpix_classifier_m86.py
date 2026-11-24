#!/usr/bin/env python3
"""M86 pure post-Pix failure category from a snapshot ALREADY captured by M69.

This code has no ADB, XML reads, screenshots, logging, waits or input.
It only compares fixed, source-defined public Home markers in memory.
"""
from __future__ import annotations

import guardiao_api28_debug_home_readiness_census_lab as home

CATEGORIES = frozenset((
    "not-started",
    "post-pix-snapshot-attested",
    "post-pix-home-still-visible",
    "post-pix-content-unconfirmed",
    "post-pix-content-attested",
    "post-pix-home-classifier-unconfirmed",
    "post-pix-home-target-unconfirmed",
    "post-pix-home-target-attested",
))


def classify_missing_pix(nodes: object) -> str:
    """Never infer a touch reached Pix from ADB input's return status."""
    try:
        home_category, _, _ = home.classify_readiness(nodes)
        if home_category == "home-static-all":
            return "post-pix-home-still-visible"
    except Exception:
        pass
    return "post-pix-content-unconfirmed"

#!/usr/bin/env python3
"""M76: pure categorical reason for an unconfirmed return to Demo Home.

No device, network, filesystem or logging operations. All values returned are
literal allowlisted categories. Use only from an already permitted snapshot.
"""
from __future__ import annotations

RETURN_CATEGORIES = frozenset((
    "not-started",
    "home-input-command-returned",
    "post-home-process-or-focus-unconfirmed",
    "post-home-snapshot-unconfirmed",
    "post-home-classifier-unconfirmed",
    "post-home-tabs-unconfirmed",
    "post-home-marker-unconfirmed",
    "post-home-static-unconfirmed",
    "post-home-structure-unconfirmed",
    "post-home-candidate-unconfirmed",
    "post-home-attested",
))


def classify(
    nav: object, marker: object, static: object,
    structure: object, candidate: object
) -> str:
    """Classify the FIRST unconfirmed gate; never authorize a failed state."""
    if nav != "tabs-present-bounded":
        return "post-home-tabs-unconfirmed"
    if marker != "home-marker-unique":
        return "post-home-marker-unconfirmed"
    if static != "home-static-all":
        return "post-home-static-unconfirmed"
    if structure != "app-text-and-clickable":
        return "post-home-structure-unconfirmed"
    if candidate != "eligible-candidate-only":
        return "post-home-candidate-unconfirmed"
    return "post-home-attested"

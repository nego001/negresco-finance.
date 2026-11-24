#!/usr/bin/env python3
"""M87: pure categorical Debug touch flags from already-read post-Pix UI XML.

No ADB, UI snapshots, gestures, waiting, file logging, screenshots or coordinates.
Flag absence does not prove a native touch did not happen.
"""
from __future__ import annotations
import re
import guardiao_api28_debug_home_readiness_census_lab as home

HEADER_PREFIX = "negresco-lab-rn-page-"
HEADER = re.compile(
    r"negresco-lab-rn-page-home-pressin-(yes|no)-call-(yes|no)"
    r"-rootstart-(yes|no)-bottomstart-(yes|no)"
)
CATEGORIES = frozenset((
    "not-started",
    "touch-chain-header-unconfirmed",
    "touch-chain-marker-sequence-unresolved",
    "touch-chain-root-not-marked",
    "touch-chain-root-marked-bottom-not-marked",
    "touch-chain-bottom-marked-pressin-not-marked",
    "touch-chain-pressin-marked-nav-not-marked",
    "touch-chain-nav-marked-home-still-visible",
))


def classify_home_visible(nodes: object) -> str:
    unknown = "touch-chain-header-unconfirmed"
    if type(nodes) is not list or len(nodes) > 20000 or not all(
        type(node) is dict for node in nodes
    ):
        return unknown
    headers = []
    for node in nodes:
        if node.get("package") != home.PACKAGE:
            continue
        rid = node.get("resource-id")
        if type(rid) is not str:
            continue
        marker = rid.rsplit("/", 1)[-1]
        if marker.startswith(HEADER_PREFIX):
            headers.append(marker)
    if len(headers) != 1:
        return unknown
    found = HEADER.fullmatch(headers[0])
    if found is None:
        return unknown
    press, call, root, bottom = (x == "yes" for x in found.groups())
    if (call and not press) or (press and not bottom) or (bottom and not root):
        return "touch-chain-marker-sequence-unresolved"
    if not root:
        return "touch-chain-root-not-marked"
    if not bottom:
        return "touch-chain-root-marked-bottom-not-marked"
    if not press:
        return "touch-chain-bottom-marked-pressin-not-marked"
    if not call:
        return "touch-chain-pressin-marked-nav-not-marked"
    return "touch-chain-nav-marked-home-still-visible"

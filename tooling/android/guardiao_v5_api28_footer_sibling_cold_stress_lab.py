#!/usr/bin/env python3
"""Read-only categorization of footer labels versus extra exact labels.

Run four unmodified four-PDF same-PID Android9 experiments against SHA-pinned
v5 Debug-signed candidate. This wrapper adds no Android UI read, gesture, wait,
reinstall, or approval. Existing two-pass scoped verifier owns every verdict.
"""
from __future__ import annotations

import sys

import guardiao_v5_api28_scoped_home_failure_diagnostic_lab as prior
import guardiao_candidate_release_v4_scoped_triplet_api28_lab as geometry
import guardiao_original_release_same_process_lab as home

SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
NAMES = ("Início", "Pix", "Negresco")
BLOCK = "BLOCK (LAB): API28 footer-only sibling diagnostic incomplete"


def classify_footer_labels(nodes: object, width: object, height: object) -> str:
    """Fixed category only: labels in the lower band and exact extras elsewhere.

    This read-only classification never verifies a clickable ancestor and
    MUST NOT authorize navigation or override the original scoped validator.
    """
    if (type(nodes) is not list or len(nodes) > 2500 or
            type(width) is not int or type(height) is not int or
            not (200 <= width <= 5000 and 200 <= height <= 5000)):
        return "snapshot-unconfirmed"
    counts = {name: [0, 0] for name in NAMES}
    for node in nodes:
        if type(node) is not dict:
            return "snapshot-unconfirmed"
        if (node.get("package") != geometry.BASE.PACKAGE or
                node.get("class") != "android.widget.TextView" or
                node.get("enabled") != "true"):
            continue
        found = [name for name in NAMES if
                 node.get("text") == name or node.get("content-desc") == name]
        if len(found) > 1:
            return "label-cross-match-unconfirmed"
        if not found:
            continue
        raw = node.get("bounds")
        if type(raw) is not str:
            return "snapshot-unconfirmed"
        category = home.safe_bounds_shape(raw, width, height)
        counts[found[0]][0 if category == "on-bottom-band" else 1] += 1
    if any(counts[name][0] != 1 for name in NAMES):
        return "footer-candidates-not-unique"
    extras = {name for name in NAMES if counts[name][1] > 0}
    if not extras:
        return "footer-candidates-unique-no-extras"
    if extras == {"Pix"}:
        return "footer-candidates-unique-pix-extra"
    if extras == {"Negresco"}:
        return "footer-candidates-unique-negresco-extra"
    if extras == {"Início"}:
        return "footer-candidates-unique-home-extra"
    return "footer-candidates-unique-multiple-extras"


def run() -> None:
    if len(sys.argv) != 1 or prior.SHA != SHA:
        raise RuntimeError("untrusted runtime or candidate identity")
    original_detail = home.safe_initial_home_detail

    def read_only_detail(nodes, width, height):
        # The very SAME in-memory nodes received by the existing diagnostic.
        # Print category only; never publish the hierarchy or coordinates.
        category = classify_footer_labels(nodes, width, height)
        print("ENV (LAB): footer-label-candidates=" + category, flush=True)
        return original_detail(nodes, width, height)

    home.safe_initial_home_detail = read_only_detail
    try:
        prior.run()
    finally:
        home.safe_initial_home_detail = original_detail


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print(BLOCK, file=sys.stderr, flush=True)
        raise SystemExit(1)

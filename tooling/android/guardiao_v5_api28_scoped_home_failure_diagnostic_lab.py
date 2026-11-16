#!/usr/bin/env python3
"""No-gesture fixed-category diagnosis of API28 v5 repeated PDF Home boundary.

In failed E2E 43793157261, A/B/C PDF receipts succeeded. The generic
launcher 'Home not observed' message can hide a strict scoped geometry
precondition exception: this wrapper disambiguates that without changing
timeouts, touches, APK bytes, UI state or verdicts.
"""
from __future__ import annotations

import sys

import guardiao_v5_owned_uri_scoped_four_pdf_samepid_cross_api_lab as v5
import guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab as scoped
import guardiao_candidate_release_v4_scoped_triplet_api28_lab as geometry
import guardiao_original_release_same_process_lab as home

SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
SCOPED_CODES = frozenset((
    "scoped-three-tabs-verified", "invalid-input", "home-not-bounded",
    "package-unconfirmed", "malformed-node", "label-bounds-unconfirmed",
    "label-bounds-invalid", "bottom-label-not-unique", "parent-not-eligible",
    "parent-bounds-unconfirmed", "label-not-in-parent",
    "clickable-parent-not-unique", "parent-center-overlapped",
    "duplicate-parent", "horizontal-overlap-or-order", "rows-not-aligned",
))
STAGES = frozenset(("initial", "pre-return", "post-return"))
BLOCK = "BLOCK (LAB): API28 scoped boundary diagnosis incomplete"


def safe_code(value: object) -> str:
    return value if type(value) is str and value in SCOPED_CODES else "unknown-or-untrusted"


def run() -> None:
    if len(sys.argv) != 1 or v5.NEW_SHA != SHA:
        raise RuntimeError("fixed candidate invocation rejected")
    original_attest = scoped.attest_triplet
    original_home = home.restore_home_tab_in_same_process
    original_scoped = geometry.scoped_triplet_category

    def diagnostic_category(nodes, width, height):
        verdict = original_scoped(nodes, width, height)
        print("ENV (LAB): scoped-geometry=" + safe_code(verdict), flush=True)
        return verdict

    def diagnostic_attest(expected_pid: str, stage: str):
        if stage not in STAGES:
            raise RuntimeError("unexpected scoped stage")
        print("STAGE (LAB): scoped-" + stage + "-entry", flush=True)
        try:
            return original_attest(expected_pid, stage)
        except Exception:
            print("BLOCK STAGE (LAB): scoped-" + stage + "-not-verified",
                  flush=True)
            raise

    def diagnostic_home(expected_pid: str):
        print("STAGE (LAB): bounded-Home-navigation-entry", flush=True)
        try:
            return original_home(expected_pid)
        except Exception as err:
            print("BLOCK STAGE (LAB): bounded-Home-navigation-" +
                  home.safe_home_block_category(err), flush=True)
            raise

    geometry.scoped_triplet_category = diagnostic_category
    scoped.attest_triplet = diagnostic_attest
    home.restore_home_tab_in_same_process = diagnostic_home
    try:
        v5.run()
    finally:
        # Restore all interceptors on both success and failure.
        geometry.scoped_triplet_category = original_scoped
        scoped.attest_triplet = original_attest
        home.restore_home_tab_in_same_process = original_home


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print(BLOCK, file=sys.stderr, flush=True)
        raise SystemExit(1)

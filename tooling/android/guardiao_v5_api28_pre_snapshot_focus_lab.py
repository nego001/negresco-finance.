#!/usr/bin/env python3
"""One bounded window-focus read before the first existing pre-return UI snapshot.

Read-only probe. Timing changes may affect race reproduction; never claim this
instrumentation is a fix. The strict gate still owns all accept/reject decisions.
"""
from __future__ import annotations
import sys
import guardiao_v5_api28_resolver_focus_readonly_lab as prior
import guardiao_candidate_release_v4_scoped_four_pdf_samepid_lab as scoped
import guardiao_original_release_same_process_lab as home

SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
BLOCK = "BLOCK (LAB): pre-snapshot focus probe incomplete"
ALLOWED = frozenset(("window-focus-app", "window-focus-chooser",
                     "window-focus-ime-named", "window-focus-other",
                     "window-focus-null", "window-focus-unconfirmed"))


def sample() -> str:
    """Private, never retained; fixed-category output only."""
    category = "window-focus-unconfirmed"
    try:
        raw = home.base.adb("shell", "dumpsys", "window", "windows",
                            timeout=8, check=False)
        if type(raw) is str:
            category = home.safe_window_focus_category(raw, home.base.PACKAGE)
    except Exception:
        pass
    return category if category in ALLOWED else "window-focus-unconfirmed"


def run() -> None:
    if len(sys.argv) != 1 or prior.SHA != SHA or scoped.BASE is not home.base:
        raise RuntimeError("unexpected instrumented runner")
    old_attest = scoped.attest_triplet
    old_xml = scoped.BASE.xml_nodes
    active = False
    pending_first = False

    def pre_return_attest(pid: str, stage: str):
        nonlocal active, pending_first
        if stage not in ("initial", "pre-return", "post-return") or active:
            raise RuntimeError("unexpected attestation nesting or stage")
        active = stage == "pre-return"
        pending_first = active
        try:
            return old_attest(pid, stage)
        finally:
            active = False
            pending_first = False

    def instrumented_xml(*args, **kwargs):
        nonlocal pending_first
        if active and pending_first:
            pending_first = False  # exactly once even if the snapshot fails
            print("ENV (LAB): focus-before-first-pre-return-snapshot=" +
                  sample(), flush=True)
        return old_xml(*args, **kwargs)

    scoped.attest_triplet = pre_return_attest
    scoped.BASE.xml_nodes = instrumented_xml
    try:
        prior.run()
    finally:
        scoped.attest_triplet = old_attest
        scoped.BASE.xml_nodes = old_xml


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print(BLOCK, file=sys.stderr, flush=True)
        raise SystemExit(1)

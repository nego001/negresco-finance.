#!/usr/bin/env python3
"""M64: fixed-category, passive Debug Home readiness census after proven PPP.

Do not print, save or upload raw XML, text, labels, IDs, geometry, PIDs,
bundles or errors. One on-device hierarchy, no retries/gestures/PDF.
"""
from __future__ import annotations

import sys
import guardiao_api28_debug_external_a11y_readonly_lab as observer
import guardiao_api28_debug_targetid_presence_lab as previous

BASE = observer.debug.base
PACKAGE = observer.DEBUG_PACKAGE
# Only fixed, public, source-defined UI strings are ever compared in memory.
HOME_TEXT_MARKERS = ("PAINEL PRINCIPAL", "MODO PRÉVIA", "Acesso rápido")

CONTENT_CATEGORIES = frozenset((
    "home-static-all", "home-static-partial", "home-static-none",
    "home-static-duplicate", "home-static-unconfirmed",
))
STRUCTURE_CATEGORIES = frozenset((
    "app-text-and-clickable", "app-text-only", "app-clickable-only",
    "app-no-text-or-clickables", "app-structure-unconfirmed",
))
ID_CATEGORIES = frozenset(("app-resource-ids-present", "app-resource-ids-absent",
                           "app-resource-ids-unconfirmed"))


def classify_readiness(nodes: object) -> tuple[str, str, str]:
    """Inspect one snapshot in memory: package-owned classes, fixed labels and ID existence."""
    if (type(nodes) is not list or len(nodes) > 20000
            or not all(type(n) is dict for n in nodes)):
        return ("home-static-unconfirmed", "app-structure-unconfirmed",
                "app-resource-ids-unconfirmed")
    own = [n for n in nodes if n.get("package") == PACKAGE]

    # Reads only whether Android exposed three constant UI strings; never
    # retain/print arbitrary values or use their bounds as touch coordinates.
    counts = tuple(sum(
        n.get("class") == "android.widget.TextView"
        and n.get("text") == marker for n in own
    ) for marker in HOME_TEXT_MARKERS)
    if any(n > 1 for n in counts):
        home = "home-static-duplicate"
    elif all(n == 1 for n in counts):
        home = "home-static-all"
    elif any(n == 1 for n in counts):
        home = "home-static-partial"
    else:
        home = "home-static-none"

    text_visible = any(n.get("class") == "android.widget.TextView" for n in own)
    clickable_visible = any(
        n.get("enabled") == "true" and n.get("clickable") == "true"
        for n in own
    )
    structure = (
        "app-text-and-clickable" if text_visible and clickable_visible else
        "app-text-only" if text_visible else
        "app-clickable-only" if clickable_visible else
        "app-no-text-or-clickables"
    )
    resource_ids = (
        "app-resource-ids-present" if any(
            type(n.get("resource-id")) is str and bool(n.get("resource-id"))
            for n in own
        ) else "app-resource-ids-absent"
    )
    return home, structure, resource_ids


def passive_home_census() -> None:
    tab_status = "snapshot-unconfirmed"
    marker_status = "home-marker-unconfirmed"
    home_status = "home-static-unconfirmed"
    structure_status = "app-structure-unconfirmed"
    resource_status = "app-resource-ids-unconfirmed"
    try:
        width, height = BASE.screen_size()
        # Only one private UIAutomator snapshot. M63 and M64 classify the
        # very same data, never a second query or post-failure retry.
        nodes = BASE.xml_nodes()
        tab_status, marker_status = previous.classify_snapshot(
            nodes, width, height
        )
        home_status, structure_status, resource_status = classify_readiness(nodes)
        if tab_status == "snapshot-unconfirmed":
            home_status = "home-static-unconfirmed"
            structure_status = "app-structure-unconfirmed"
            resource_status = "app-resource-ids-unconfirmed"
    except Exception:
        pass
    finally:
        # A missing or failed deletion makes ALL classifications uncertain.
        try:
            BASE.adb("shell", "rm", "-f", "/sdcard/negresco_ui.xml", timeout=15)
        except Exception:
            tab_status = "snapshot-unconfirmed"
            marker_status = "home-marker-unconfirmed"
            home_status = "home-static-unconfirmed"
            structure_status = "app-structure-unconfirmed"
            resource_status = "app-resource-ids-unconfirmed"

    print("ENV (LAB): debug-targetids=" + tab_status, flush=True)
    print("ENV (LAB): debug-home-marker=" + marker_status, flush=True)
    print("ENV (LAB): debug-home-static=" + home_status, flush=True)
    print("ENV (LAB): debug-app-structure=" + structure_status, flush=True)
    print("ENV (LAB): debug-app-resourceids=" + resource_status, flush=True)

    # Root PPP and Metro delivery are NOT substitutes for these separate gates.
    if (tab_status, marker_status, home_status) != (
        "tabs-present-bounded", "home-marker-unique", "home-static-all"
    ):
        raise RuntimeError("M64 native UI Home and bottom geometry not proven")
    print("PASS (LAB): Debug Home static markers and three bounded targets verified")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 1:
            raise RuntimeError("Unexpected M64 arguments")
        observer.run(after_verified_observation=passive_home_census)
    except Exception:
        print("BLOCK (LAB): M64 passive Debug Home readiness evidence incomplete",
              file=sys.stderr)
        raise SystemExit(1)

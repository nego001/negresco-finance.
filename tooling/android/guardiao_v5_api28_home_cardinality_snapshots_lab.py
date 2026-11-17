#!/usr/bin/env python3
"""Read-only Home TextView cardinality diagnosis on exact v5 Android9 APK.

Reuses the SAME in-memory UI snapshots as the strict four-PDF runner. This
adapter may only print safe categories. It never reads more Android UI, changes
a gesture, revises a verdict, relaxes two-pass gating or accesses bank data.
"""
from __future__ import annotations
import sys
import guardiao_v5_api28_footer_sibling_cold_stress_lab as prior
import guardiao_original_release_same_process_lab as home
import guardiao_candidate_release_v4_scoped_triplet_api28_lab as scoped

SHA = "0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4"
NAMES = ("Início", "Pix", "Negresco")
BANDS = frozenset(("on-bottom-band", "onscreen-other-band", "offscreen",
                   "point-only", "zero-area", "unconfirmed", "reversed",
                   "viewport-unconfirmed"))
BLOCK = "BLOCK (LAB): Android9 Home label cardinality unverified"


def cardinality(items: list[object]) -> str:
    return "none" if not items else "one" if len(items) == 1 else "many"


def safe_band(value: object) -> str:
    return value if type(value) is str and value in BANDS else "unconfirmed"


def classify(nodes: object, width: object, height: object) -> tuple[str, ...]:
    if (type(nodes) is not list or len(nodes) > 2500
            or type(width) is not int or type(height) is not int
            or not (200 <= width <= 5000 and 200 <= height <= 5000)):
        return ("unconfirmed",) * 5
    labels = {name: [] for name in NAMES}
    footer = {name: [] for name in NAMES}
    for node in nodes:
        if type(node) is not dict:
            return ("unconfirmed",) * 5
        if (node.get("class") != "android.widget.TextView"
                or node.get("enabled") != "true"):
            continue
        names = [name for name in NAMES if (
            node.get("text") == name or node.get("content-desc") == name)]
        if len(names) > 1:
            return ("unconfirmed",) * 5
        if not names:
            continue
        name = names[0]
        labels[name].append(node)
        if (node.get("package") == scoped.BASE.PACKAGE
                and safe_band(home.safe_bounds_shape(node.get("bounds", ""), width, height))
                == "on-bottom-band"):
            footer[name].append(node)
    home_all = cardinality(labels["Início"])
    home_band = ("not-single" if home_all != "one" else safe_band(
        home.safe_bounds_shape(labels["Início"][0].get("bounds", ""), width, height)))
    return (home_all, cardinality(footer["Início"]),
            cardinality(footer["Pix"]), cardinality(footer["Negresco"]),
            home_band)


def run() -> None:
    if len(sys.argv) != 1 or prior.SHA != SHA:
        raise RuntimeError("candidate identity rejected")
    original = prior.classify_footer_labels

    def classify_read_only(nodes, width, height):
        h, hf, p, n, b = classify(nodes, width, height)
        print("ENV (LAB): home-text=" + h + " home-footer=" + hf +
              " pix-footer=" + p + " negresco-footer=" + n +
              " home-band=" + b, flush=True)
        return original(nodes, width, height)

    prior.classify_footer_labels = classify_read_only
    try:
        prior.run()
    finally:
        prior.classify_footer_labels = original


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print(BLOCK, file=sys.stderr, flush=True)
        raise SystemExit(1)

#!/usr/bin/env python3
"""API28 synthetic Release PDF replay twice while the app PID remains unchanged.

Never changes original Release bytes, deletes application data or exports PDFs.
A failed/unavailable PID comparison BLOCKS, never counts as a PDF regression.
This is a best-effort process identity observation, not proof of process memory.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import guardiao_original_release_input_replay_lab as replay
import guardiao_android_export_pdf_text_emulator_smoke as semantic
import guardiao_pdf_ui_emulator_smoke as base
import verify_collection48_receipt as receipt

OUT = Path("same-process-receipts")
CYCLES = ("a", "b")


def observed_single_app_pid() -> str | None:
    """Keep exact PID private and in memory; never publish a numeric identifier."""
    raw = base.adb("shell", "pidof", base.PACKAGE, timeout=10, check=False).strip()
    return raw if re.fullmatch(r"[1-9][0-9]{0,8}", raw) else None



HOME_BLOCK_CODES = {
    "same-process home-navigation PID unconfirmed": "pid-before-home-unconfirmed",
    "same-process exact home tab unavailable": "tab-absent-or-ambiguous",
    "same-process home tab label type unconfirmed": "tab-label-other-class",
    "same-process home tab bounds unavailable": "tab-bounds-unconfirmed",
    "same-process home tab outside bounded bottom bar": "tab-outside-bottom-bar",
    "same-process home-navigation PID changed": "pid-after-home-changed",
    "same-process home-only banner not observed": "home-banner-unconfirmed",
}


def safe_home_block_category(exc: Exception) -> str:
    """Allowlisted literals only. Never print a raw Android or Python error."""
    if type(exc) is not RuntimeError:
        return "other-or-unconfirmed"
    return HOME_BLOCK_CODES.get(str(exc), "other-or-unconfirmed")



def safe_home_tab_band(x: int, y: int, width: int, height: int) -> str:
    """Coarse fixed classification, never emit actual UI coordinates."""
    if width <= 0 or height <= 0 or not (0 < x < width and 0 < y < height):
        return "outside-screen"
    if y < int(height * .40):
        return "upper"
    if y <= int(height * .70):
        return "middle"
    if y < int(height * .985):
        return "lower"
    return "bottom-edge"



def safe_home_axis_category(x: int, y: int, width: int, height: int) -> str:
    """One constant category for which axis rejected the tab location."""
    if width <= 0 or height <= 0:
        return "screen-unconfirmed"
    invalid_x = x <= 0 or x >= width
    invalid_y = y <= 0 or y >= height
    if invalid_x and invalid_y:
        return "both-outside"
    if x <= 0:
        return "x-before"
    if x >= width:
        return "x-after"
    if y <= 0:
        return "y-before"
    if y >= height:
        return "y-after"
    return "within-screen-not-footer"

def safe_ime_category(raw: str) -> str:
    """Read only known IME display flags from unsaved private dumpsys output."""
    flags = re.findall(r"\bm(?:InputShown|IsInputViewShown)\s*=\s*(true|false)\b", raw)
    if not flags:
        return "unconfirmed"
    if all(f == "true" for f in flags):
        return "shown"
    if all(f == "false" for f in flags):
        return "hidden"
    return "ambiguous"


def safe_ime_window_registration(raw: str) -> str:
    """Observation of WindowManager registration, NOT keyboard visibility."""
    if not isinstance(raw, str) or len(raw) > 256_000:
        return "ime-window-unconfirmed"
    candidates = re.findall(r"(?m)^\s*mInputMethodWindow=([^\r\n]+)", raw)
    if len(candidates) != 1:
        return "ime-window-unconfirmed"
    value = candidates[0].strip()
    if value == "null":
        return "ime-window-not-listed"
    if re.fullmatch(r"Window\{[^{}\r\n]{1,256}\}", value):
        return "ime-window-listed"
    return "ime-window-unconfirmed"


def safe_window_focus_category(raw: str, own_package: str) -> str:
    """Coarse focused-window owner, without returning window or package text."""
    if not isinstance(raw, str) or len(raw) > 256_000 or not own_package:
        return "window-focus-unconfirmed"
    candidates = re.findall(r"(?m)^\s*mCurrentFocus=([^\r\n]+)", raw)
    if len(candidates) != 1:
        return "window-focus-unconfirmed"
    value = candidates[0].strip()
    if value == "null":
        return "window-focus-null"
    if re.fullmatch(r"Window\{[^{}\r\n]{1,256}\}", value) is None:
        return "window-focus-unconfirmed"
    # A substring can match a different package, e.g. app.id.evil.
    # Only the exact Android component owner (package followed by '/') passes.
    if (re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+", own_package)
            and re.search(r"(?<![A-Za-z0-9_.])" + re.escape(own_package) + r"/", value)):
        return "window-focus-app"
    if "InputMethod" in value or "ime" in value.lower():
        return "window-focus-ime-named"
    if "ChooserActivity" in value or "ResolverActivity" in value:
        return "window-focus-chooser"
    return "window-focus-other"


def safe_ime_flag_pair(raw: str) -> str:
    """Aggregate exact Android input/view visibility flags without raw output."""
    pair = []
    for name in ("mInputShown", "mIsInputViewShown"):
        values = re.findall(r"\b" + name + r"\s*=\s*(true|false)\b", raw)
        if len(set(values)) > 1:
            return "ime-flags-conflicting"
        pair.append(values[0] if values else "missing")
    if "missing" in pair:
        return "ime-flags-missing"
    return {
        ("true", "true"): "both-shown",
        ("false", "false"): "both-hidden",
        ("true", "false"): "input-only-shown",
        ("false", "true"): "view-only-shown",
    }.get(tuple(pair), "ime-flags-unconfirmed")


def safe_focused_edit_category(node: dict[str, str],
                               nodes: list[dict[str, str]]) -> str:
    """Only report whether an EditText remains focused, never its contents."""
    pkg = node.get("package", "")
    if not pkg:
        return "focus-package-unconfirmed"
    focused = [n for n in nodes if n.get("focused") == "true"]
    edits = [n for n in focused if n.get("class") == "android.widget.EditText"]
    if len(edits) > 1:
        return "multiple-editables-focused"
    if len(edits) == 1:
        return ("app-editable-focused" if edits[0].get("package") == pkg
                else "other-editable-focused")
    return "other-focused" if focused else "no-focused-node"


def safe_wm_override_category(raw: str, x: int, y: int) -> str:
    """Classify overrides, never permit a gesture based on this diagnostic."""
    physical = re.search(r"(?m)^Physical size:\s*(\d+)x(\d+)\s*$", raw)
    override = re.search(r"(?m)^Override size:\s*(\d+)x(\d+)\s*$", raw)
    if physical is None:
        return "unconfirmed"
    if override is None:
        return "physical-only"
    if physical.groups() == override.groups():
        return "override-equal"
    width, height = map(int, override.groups())
    if width > 0 and height > 0 and 0 < x < width and (
        int(height * .70) < y < int(height * .985)
    ):
        return "override-would-pass"
    return "override-still-outside"


def safe_bounds_shape(raw: str, width: int, height: int) -> str:
    """Classify XML geometry locally; do not publish coordinates or XML."""
    match = base.BOUNDS.fullmatch(raw)
    if match is None:
        return "unconfirmed"
    x1, y1, x2, y2 = map(int, match.groups())
    if x2 < x1 or y2 < y1:
        return "reversed"
    if x2 == x1 and y2 == y1:
        return "point-only"
    if x2 == x1 or y2 == y1:
        return "zero-area"
    if width <= 0 or height <= 0:
        return "viewport-unconfirmed"
    center_x, center_y = (x1 + x2) // 2, (y1 + y2) // 2
    if not (0 < center_x < width and 0 < center_y < height):
        return "offscreen"
    if int(height * .70) < center_y < int(height * .985):
        return "on-bottom-band"
    return "onscreen-other-band"


def safe_ancestor_geometry(node: dict[str, str], width: int, height: int) -> str:
    """Bounded ancestry classification: observation is not tap approval."""
    label = node.get("bounds", "")
    ancestor = node.get("_tap_bounds", "")
    if not ancestor:
        return "not-provided"
    if ancestor == label:
        return "same-as-label"
    return safe_bounds_shape(ancestor, width, height)




def safe_ancestor_constraint_category(raw: str, width: int, height: int) -> str:
    """One bounded diagnostic for bottom-tab geometry, never an input target."""
    bound = base.BOUNDS.fullmatch(raw)
    if bound is None:
        return "bounds-unconfirmed"
    x1, y1, x2, y2 = map(int, bound.groups())
    if width <= 0 or height <= 0:
        return "viewport-unconfirmed"
    if x2 <= x1 or y2 <= y1:
        return "bounds-degenerate"
    if not (0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height):
        return "bounds-offscreen"
    if y1 <= int(height * .68):
        return "top-outside-bottom-tab"
    if y2 >= int(height * .985):
        return "bottom-too-low"
    if x2 - x1 < int(width * .08):
        return "width-too-small"
    if x2 - x1 > int(width * .45):
        return "width-too-large"
    if y2 - y1 < int(height * .025):
        return "height-too-small"
    if y2 - y1 > int(height * .20):
        return "height-too-large"
    return "geometry-eligible"




def safe_sibling_tab_height_category(
    tab: dict[str, str], nodes: list[dict[str, str]], width: int, height: int
) -> str:
    """Read-only comparison of bottom-nav sibling heights; never return pixels."""
    if width <= 0 or height <= 0:
        return "viewport-unconfirmed"
    package = tab.get("package", "")
    if not package:
        return "package-unconfirmed"
    home = base.BOUNDS.fullmatch(tab.get("_tap_bounds", ""))
    if home is None:
        return "home-bounds-unconfirmed"
    home_rect = tuple(map(int, home.groups()))
    siblings: list[tuple[int, int, int, int]] = []
    for name in ("Pix", "Negresco"):
        matches = [
            node for node in nodes
            if node.get("class") == "android.widget.TextView"
            and node.get("enabled") == "true"
            and (node.get("text") == name or node.get("content-desc") == name)
        ]
        if len(matches) != 1:
            return "siblings-missing-or-ambiguous"
        node = matches[0]
        if node.get("package") != package:
            return "siblings-package-mismatch"
        bound = base.BOUNDS.fullmatch(node.get("_tap_bounds", ""))
        if bound is None:
            return "siblings-bounds-unconfirmed"
        rect = tuple(map(int, bound.groups()))
        x1, y1, x2, y2 = rect
        if not (0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height):
            return "siblings-offscreen-or-degenerate"
        siblings.append(rect)
    if siblings[0] == siblings[1] or home_rect in siblings:
        return "siblings-shared-region"
    short = [rect[3]-rect[1] < int(height * .025) for rect in siblings]
    if all(short):
        return "siblings-both-thin"
    if not any(short):
        return "siblings-both-regular"
    return "siblings-mixed-height"



def safe_clickable_ancestor_attestation(
    tab: dict[str, str], nodes: list[dict[str, str]],
    width: int, height: int
) -> str:
    """Read-only proof that a point-only label belongs to one safe bottom tab.

    This function NEVER returns tap coordinates or authorizes a gesture.
    """
    if (tab.get("class") != "android.widget.TextView"
            or tab.get("enabled") != "true"
            or (tab.get("text") != "Início"
                and tab.get("content-desc") != "Início")):
        return "label-unconfirmed"
    label = base.BOUNDS.fullmatch(tab.get("bounds", ""))
    if label is None:
        return "label-bounds-unconfirmed"
    lx1, ly1, lx2, ly2 = map(int, label.groups())
    if lx1 != lx2 or ly1 != ly2:
        return "label-not-point-only"
    parent_raw = tab.get("_tap_bounds", "")
    parent = base.BOUNDS.fullmatch(parent_raw)
    if parent is None or parent_raw == tab.get("bounds"):
        return "ancestor-unconfirmed"
    if safe_ancestor_constraint_category(parent_raw, width, height) != "geometry-eligible":
        return "ancestor-not-bounded-bottom-tab"
    x1, y1, x2, y2 = map(int, parent.groups())
    matched = [
        n for n in nodes
        if n.get("bounds") == parent_raw
        and n.get("clickable") == "true"
        and n.get("enabled") == "true"
        and n.get("_tap_bounds") == parent_raw
    ]
    if len(matched) != 1:
        return "ancestor-not-unique-clickable"
    package = tab.get("package")
    if not package or matched[0].get("package") != package:
        return "ancestor-package-unconfirmed"
    # Other clickable regions must not cover the candidate center.
    # An overlapping area could be an overlay/keyboard/other interactive UI.
    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    for n in nodes:
        if n is matched[0] or n.get("clickable") != "true":
            continue
        overlap = base.BOUNDS.fullmatch(n.get("bounds", ""))
        if overlap is None:
            continue
        a, b, c, d = map(int, overlap.groups())
        if a <= cx <= c and b <= cy <= d:
            return "ancestor-overlapped"
    return "ancestor-associated-unique-bounded"


def emit_home_geometry_diagnostic(x: int, y: int, width: int,
                                  height: int, node: dict[str, str] | None = None,
                                  nodes: list[dict[str, str]] | None = None) -> None:
    """Passive categories only, never upload dumpsys, UI XML or exception."""
    band = safe_home_tab_band(x, y, width, height)
    axis = safe_home_axis_category(x, y, width, height)
    label_shape = safe_bounds_shape((node or {}).get("bounds", ""), width, height)
    ancestor_shape = safe_ancestor_geometry(node or {}, width, height)
    ancestor_constraint = safe_ancestor_constraint_category(
        (node or {}).get("_tap_bounds", ""), width, height
    )
    sibling_height = safe_sibling_tab_height_category(
        node or {}, nodes or [], width, height
    )
    chrome_geometry = safe_header_footer_geometry_category(
        node or {}, nodes or [], width, height
    )
    attestation = safe_clickable_ancestor_attestation(
        node or {}, nodes or [], width, height
    )
    ime = "unconfirmed"
    ime_pair = "ime-flags-unconfirmed"
    focus = safe_focused_edit_category(node or {}, nodes or [])
    viewport = "unconfirmed"
    ime_window = "ime-window-unconfirmed"
    window_focus = "window-focus-unconfirmed"
    try:
        private_ime = base.adb("shell", "dumpsys", "input_method",
                               timeout=8, check=False)
        ime = safe_ime_category(private_ime)
        ime_pair = safe_ime_flag_pair(private_ime)
    except Exception:
        pass
    try:
        private_windows = base.adb("shell", "dumpsys", "window", "windows",
                                   timeout=8, check=False)
        ime_window = safe_ime_window_registration(private_windows)
        window_focus = safe_window_focus_category(
            private_windows, (node or {}).get("package", "")
        )
    except Exception:
        pass
    try:
        viewport = safe_wm_override_category(
            base.adb("shell", "wm", "size", timeout=8, check=False), x, y
        )
    except Exception:
        pass
    print("ENV (LAB): home-position-band=" + band +
          " axis=" + axis + " label-shape=" + label_shape +
          " clickable-ancestor-shape=" + ancestor_shape +
          " ancestor-constraint=" + ancestor_constraint +
          " sibling-height=" + sibling_height +
          " header-footer=" + chrome_geometry +
          " ancestor-attestation=" + attestation +
          " ime=" + ime + " ime-pair=" + ime_pair +
          " focus=" + focus + " ime-window=" + ime_window +
          " window-focus=" + window_focus +
          " viewport=" + viewport, flush=True)



def safe_header_footer_geometry_category(
    tab: dict[str, str], nodes: list[dict[str, str]],
    width: int, height: int
) -> str:
    """Compare fixed app chrome with thin footer, no pixels or text emitted."""
    if width <= 0 or height <= 0:
        return "chrome-viewport-unconfirmed"
    package = tab.get("package", "")
    if not package:
        return "chrome-package-unconfirmed"
    if (safe_ancestor_constraint_category(tab.get("_tap_bounds", ""),
                                          width, height) != "height-too-small"
            or safe_sibling_tab_height_category(tab, nodes, width, height)
            != "siblings-both-thin"):
        return "footer-not-three-thin"
    # Exact, invariant subtitle from App.tsx. No user-generated text.
    headers = [n for n in nodes
               if n.get("class") == "android.widget.TextView"
               and n.get("text") == "SEU UNIVERSO FINANCEIRO"
               and n.get("package") == package]
    if len(headers) != 1:
        return "header-missing-or-ambiguous"
    match = base.BOUNDS.fullmatch(headers[0].get("bounds", ""))
    if match is None:
        return "header-bounds-unconfirmed"
    x1, y1, x2, y2 = map(int, match.groups())
    if not (0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height):
        return "header-bounds-invalid"
    if (y2 < int(height * .40) and x2 - x1 >= int(width * .10)
            and y2 - y1 >= max(1, int(height * .01))):
        return "header-bounded-footer-thin"
    return "header-other-geometry-footer-thin"


def safe_initial_home_detail(nodes: list[dict[str, str]],
                             width: int, height: int) -> tuple[str, str, str]:
    """Three allowlisted geometric categories; never publish raw UI data."""
    tabs = [n for n in nodes
            if n.get("class") == "android.widget.TextView"
            and n.get("enabled") == "true"
            and (n.get("text") == "Início" or n.get("content-desc") == "Início")]
    if len(tabs) != 1:
        return ("label-unconfirmed", "ancestor-unconfirmed",
                "siblings-unconfirmed")
    tab = tabs[0]
    return (
        safe_bounds_shape(tab.get("bounds", ""), width, height),
        safe_ancestor_constraint_category(tab.get("_tap_bounds", ""),
                                          width, height),
        safe_sibling_tab_height_category(tab, nodes, width, height),
    )


def safe_home_layout_snapshot_category(nodes: list[dict[str, str]],
                                       width: int, height: int) -> str:
    """Categorize one private accessibility snapshot, not a touch permission."""
    tabs = [n for n in nodes
            if n.get("class") == "android.widget.TextView"
            and n.get("enabled") == "true"
            and (n.get("text") == "Início" or n.get("content-desc") == "Início")]
    if len(tabs) != 1:
        return "home-label-unconfirmed"
    tab = tabs[0]
    bounds = base.BOUNDS.fullmatch(tab.get("bounds", ""))
    if bounds is None:
        return "home-bounds-unconfirmed"
    x1, y1, x2, y2 = map(int, bounds.groups())
    if (x1 == x2 and y1 == y2
            and safe_ancestor_constraint_category(
                tab.get("_tap_bounds", ""), width, height
            ) == "height-too-small"
            and safe_sibling_tab_height_category(tab, nodes, width, height)
            == "siblings-both-thin"):
        return "three-tabs-thin"
    x, y = (x1 + x2) // 2, (y1 + y2) // 2
    if (width > 0 and height > 0 and x2 > x1 and y2 > y1
            and 0 < x < width and int(height * .70) < y < int(height * .985)):
        return "home-label-bounded"
    return "home-layout-unconfirmed"


def safe_home_layout_evolution(first: list[dict[str, str]],
                               width: int, height: int,
                               expected_pid: str) -> str:
    """Two EXTRA read-only snapshots after rejection; no tap, back or swipe."""
    observed = [safe_home_layout_snapshot_category(first, width, height)]
    for _ in range(2):
        try:
            if observed_single_app_pid() != expected_pid:
                return "recheck-process-unconfirmed"
            observed.append(safe_home_layout_snapshot_category(
                base.xml_nodes(), width, height
            ))
        except Exception:
            return "recheck-unavailable"
    if len(set(observed)) == 1:
        return {
            "three-tabs-thin": "three-observations-thin",
            "home-label-bounded": "three-observations-bounded",
        }.get(observed[0], "three-observations-unconfirmed")
    if observed[0] == "three-tabs-thin" and observed[-1] == "home-label-bounded":
        return "thin-then-bounded"
    if "three-tabs-thin" in observed:
        return "thin-layout-changed"
    return "other-layout-changed"



def restore_home_tab_in_same_process(expected_pid: str) -> None:
    """Navigate to home through one exact bottom tab, without resetting app."""
    if observed_single_app_pid() != expected_pid:
        raise RuntimeError("same-process home-navigation PID unconfirmed")
    # Android UI hierarchy can be briefly stale after reentering the app.
    # Read only; never retry a tap, type text or trust more than one target.
    tabs = []
    other_class_label_seen = False
    for _ in range(5):
        nodes = base.xml_nodes()  # Private in-memory snapshot only.
        matching_label = [
            n for n in nodes
            if n.get("text") == "Início" or n.get("content-desc") == "Início"
        ]
        tabs = [
            n for n in matching_label
            if n.get("class") == "android.widget.TextView"
            and n.get("enabled") == "true"
        ]
        if len(tabs) > 1:
            raise RuntimeError("same-process exact home tab unavailable")
        if tabs:
            break
        if matching_label:
            other_class_label_seen = True
    if len(tabs) != 1:
        raise RuntimeError("same-process home tab label type unconfirmed"
                           if other_class_label_seen
                           else "same-process exact home tab unavailable")
    print("STAGE (LAB): same-process unique home tab verified", flush=True)
    bound = base.BOUNDS.fullmatch(tabs[0].get("bounds", ""))
    if bound is None:
        raise RuntimeError("same-process home tab bounds unavailable")
    x1, y1, x2, y2 = map(int, bound.groups())
    width, height = base.screen_size()
    x, y = (x1 + x2) // 2, (y1 + y2) // 2
    if not (x2 > x1 and y2 > y1 and 0 < x < width
            and int(height * .70) < y < int(height * .985)):
        emit_home_geometry_diagnostic(x, y, width, height, tabs[0], nodes)
        print("ENV (LAB): home-layout-recheck=" +
              safe_home_layout_evolution(nodes, width, height, expected_pid),
              flush=True)
        raise RuntimeError("same-process home tab outside bounded bottom bar")
    print("STAGE (LAB): same-process home tab target bounded", flush=True)
    base.adb("shell", "input", "tap", str(x), str(y), timeout=10)
    for _ in range(8):
        if base.lookup("Seu dinheiro.") is not None:
            if observed_single_app_pid() != expected_pid:
                raise RuntimeError("same-process home-navigation PID changed")
            print("STAGE (LAB): exact home tab and home-only banner verified",
                  flush=True)
            return
        base.scroll_backward()
    raise RuntimeError("same-process home-only banner not observed")


def run() -> None:
    if len(sys.argv) != 1 or OUT.exists() or semantic.REPORT.exists():
        raise RuntimeError("unsafe or stale same-process laboratory")
    if base.EXPECTED_SHA != receipt.APK_SHA or replay.FIXTURE != "8" + "0" * 47:
        raise RuntimeError("unexpected original APK or synthetic-only fixture")
    OUT.mkdir(mode=0o700)
    baseline_pid: str | None = None

    for cycle in CYCLES:
        if semantic.REPORT.exists():
            raise RuntimeError("previous cycle metadata still present")
        semantic.observed = None
        print("STAGE (LAB): original API28 same-process cycle " + cycle, flush=True)
        if baseline_pid is None:
            # One passive observation on the initial Início screen, prior to
            # Guardião navigation, synthetic input and the first PDF export.
            original_wait_visible = base.wait_visible
            initial_home_probed = False

            def wait_with_initial_home_probe(needle, retries=25, *,
                                             scroll=False, enabled=False):
                nonlocal initial_home_probed
                selected = original_wait_visible(
                    needle, retries=retries, scroll=scroll, enabled=enabled
                )
                if needle == "Seu universo" and not initial_home_probed:
                    initial_home_probed = True
                    try:
                        width, height = base.screen_size()
                        initial_nodes = base.xml_nodes()
                        category = safe_home_layout_snapshot_category(
                            initial_nodes, width, height
                        )
                        label, ancestor, siblings = safe_initial_home_detail(
                            initial_nodes, width, height
                        )
                    except Exception:
                        category = "initial-home-unavailable"
                        label, ancestor, siblings = (
                            "label-unconfirmed", "ancestor-unconfirmed",
                            "siblings-unconfirmed"
                        )
                    print("ENV (LAB): home-before-pdf=" + category +
                          " label=" + label + " ancestor=" + ancestor +
                          " siblings=" + siblings, flush=True)
                return selected

            # Observe the same bottom navigation once more only after the
            # existing PDF button is verified, immediately before its first
            # export tap. No additional Android input commands or retry.
            original_wait_export_button = base.wait_export_button
            pre_export_probed = False

            def wait_with_pre_export_geometry():
                nonlocal pre_export_probed
                button = original_wait_export_button()
                if not pre_export_probed:
                    pre_export_probed = True
                    try:
                        width, height = base.screen_size()
                        pre_export_nodes = base.xml_nodes()
                        category = safe_home_layout_snapshot_category(
                            pre_export_nodes, width, height
                        )
                        label, ancestor, siblings = safe_initial_home_detail(
                            pre_export_nodes, width, height
                        )
                    except Exception:
                        category = "pre-export-unavailable"
                        label, ancestor, siblings = (
                            "label-unconfirmed", "ancestor-unconfirmed",
                            "siblings-unconfirmed"
                        )
                    print("ENV (LAB): home-before-export=" + category +
                          " label=" + label + " ancestor=" + ancestor +
                          " siblings=" + siblings, flush=True)
                return button

            base.wait_visible = wait_with_initial_home_probe
            base.wait_export_button = wait_with_pre_export_geometry
            try:
                replay.run()  # Unmodified SHA-pinned APK.
            finally:
                base.wait_visible = original_wait_visible
                base.wait_export_button = original_wait_export_button
            baseline_pid = observed_single_app_pid()
            if baseline_pid is None:
                raise RuntimeError("same-process baseline not confirmed")
            print("ENV (LAB): original app process baseline observed", flush=True)
        else:
            if observed_single_app_pid() != baseline_pid:
                raise RuntimeError("same-process pre-replay identity unconfirmed")

            # This opt-in wrapper skips ONLY the second original APK install.
            # Every other Android command, receiver install, chooser and receipt
            # continues through the existing fail-closed source runner.
            real_adb = base.adb
            skipped = False

            def keep_installed_app(*args, **kwargs):
                nonlocal skipped
                if args == ("install", "-r", str(base.APK)):
                    if skipped or observed_single_app_pid() != baseline_pid:
                        raise RuntimeError("same-process install gate unconfirmed")
                    skipped = True
                    print("STAGE (LAB): original app reused without reinstall",
                          flush=True)
                    return ""
                return real_adb(*args, **kwargs)

            # The tagline is global; reopening the app may resume Guardiao.
            # Require exact return to Início before searching its Guardiao tile.
            original_wait_visible = base.wait_visible
            home_gate_done = False

            def wait_with_home_gate(needle, retries=25, *, scroll=False,
                                    enabled=False):
                nonlocal home_gate_done
                # The home-only label cannot appear until the existing
                # Guardiao page returns to Início. Restore first, then wait
                # for the actual home-only marker; never claim PDF failure
                # when this navigation gate has not been confirmed.
                if needle == "Seu universo" and not home_gate_done:
                    print("STAGE (LAB): same-process return to home started",
                          flush=True)
                    try:
                        restore_home_tab_in_same_process(baseline_pid)
                    except Exception as error:
                        # Only map exact locally authored error constants to
                        # fixed public categories; never print raw exception.
                        print("BLOCK STAGE (LAB): same-process home return " +
                              safe_home_block_category(error), flush=True)
                        raise
                    home_gate_done = True
                return original_wait_visible(
                    needle, retries=retries, scroll=scroll, enabled=enabled
                )

            base.adb = keep_installed_app
            base.wait_visible = wait_with_home_gate
            try:
                replay.run()
            finally:
                base.adb = real_adb
                base.wait_visible = original_wait_visible
            if not skipped or observed_single_app_pid() != baseline_pid:
                raise RuntimeError("same-process post-replay identity unconfirmed")
            if not home_gate_done:
                raise RuntimeError("same-process home navigation not confirmed")
            print("ENV (LAB): original app process identity preserved", flush=True)

        parsed = receipt.read_receipt(semantic.REPORT)
        receipt.verify(parsed, 28)
        folder = OUT / ("cycle-" + cycle)
        folder.mkdir(mode=0o700)
        semantic.REPORT.replace(folder / receipt.MEMBER)
        print("PASS (LAB): original API28 same-process cycle " + cycle +
              " PDF receipt verified", flush=True)

    print("PASS (LAB): two same-process synthetic PDF receipts verified",
          flush=True)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        # No device PID, user input, UI XML, PDFs, logs or exception output.
        print("BLOCK (LAB): API28 same-process replay not confirmed",
              file=sys.stderr)
        raise SystemExit(1)

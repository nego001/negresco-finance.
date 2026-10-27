#!/usr/bin/env python3
"""Android UI smoke of real Negresco Guardião PDF flow (synthetic input only).

Never records window XML, screen captures, account details or the generated PDF.
Proves only that the OS share resolver opens, not that a receiver reads the PDF.
"""
from __future__ import annotations
import hashlib
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = "com.negresco.finance"
FIXTURE = "0" * 47  # Deliberately INVALID synthetic boleto; no financial data.
EXPECTED_SHA = "668fabea94131b41e5d4e50e3c1a543df2546da295981aefa1b3d77a66c43c88"
APK = Path("test-apk/android/app/build/outputs/apk/release/app-release.apk")
REPORT = Path("pdf-ui-emulator-report.json")
BOUNDS = re.compile(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]")

def run(*args: str, timeout: int = 40, check: bool = True) -> str:
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)
    if check and p.returncode:
        raise RuntimeError("command failed: " + " ".join(args[:3]) + " [exit code " + str(p.returncode) + "]")
    return p.stdout.strip()

def adb(*args: str, timeout: int = 40, check: bool = True) -> str:
    return run("adb", *args, timeout=timeout, check=check)

def xml_nodes() -> list[dict[str, str]]:
    # Never print or upload raw UI hierarchy. Tap clickable ancestor for text labels.
    adb("shell", "uiautomator", "dump", "/sdcard/negresco_ui.xml", timeout=35)
    raw = adb("exec-out", "cat", "/sdcard/negresco_ui.xml", timeout=12)
    root = ET.fromstring(raw.lstrip("\ufeff"))
    found: list[dict[str, str]] = []
    def visit(item: ET.Element, nearest_click: dict[str, str] | None = None) -> None:
        props = dict(item.attrib)
        if props.get("clickable") == "true" and props.get("enabled") == "true":
            nearest_click = props
        if item.tag == "node":
            props["_tap_bounds"] = (nearest_click or props).get("bounds", "")
            found.append(props)
        for child in item:
            visit(child, nearest_click)
    visit(root)
    return found

def lookup(needle: str, *, enabled: bool = False) -> dict[str, str] | None:
    for n in xml_nodes():
        if enabled and n.get("enabled") != "true":
            continue
        values = (n.get("text", ""), n.get("content-desc", ""))
        if any(needle.lower() in v.lower() for v in values):
            return n
    return None

def tap_node(node: dict[str, str], *, prefer_label: bool = False) -> None:
    label = BOUNDS.fullmatch(node.get("bounds", ""))
    ancestor = BOUNDS.fullmatch(node.get("_tap_bounds", ""))
    if label is None:
        raise RuntimeError("missing Android label bounds")
    xa, ya, xb, yb = map(int, label.groups())
    area = max(0, xb-xa) * max(0, yb-ya)
    click = ancestor or label
    cx1, cy1, cx2, cy2 = map(int, click.groups())
    click_area = max(0,cx2-cx1)*max(0,cy2-cy1)
    # ScrollView-sized "clickable" ancestors cannot be assumed to be buttons.
    if prefer_label or area <= 0 or click_area > 4 * area:
        click = label
    x1, y1, x2, y2 = map(int, click.groups())
    w, h = screen_size()
    x, y = (x1+x2)//2, (y1+y2)//2
    if not (0 < x < w and int(h*.13) < y < int(h*.88)):
        raise RuntimeError("refusing touch outside safe app viewport")
    adb("shell", "input", "tap", str(x), str(y))

def screen_size() -> tuple[int, int]:
    raw = adb("shell", "wm", "size")
    m = re.search(r"(\d+)x(\d+)", raw)
    if m is None:
        raise RuntimeError("emulator screen size unavailable")
    return tuple(map(int, m.groups()))

def scroll_forward() -> None:
    w, h = screen_size()
    adb("shell", "input", "swipe", str(w//2), str(int(h*0.77)),
        str(w//2), str(int(h*0.28)), "320")
    time.sleep(0.55)

def scroll_backward() -> None:
    w, h = screen_size()
    adb("shell", "input", "swipe", str(w//2), str(int(h*0.28)),
        str(w//2), str(int(h*0.77)), "320")
    time.sleep(0.4)

def wait_visible(needle: str, retries: int = 25, *, scroll: bool = False,
                 enabled: bool = False) -> dict[str, str]:
    for i in range(retries):
        try:
            node = lookup(needle, enabled=enabled)
            if node is not None:
                if not scroll:
                    return node
                match = BOUNDS.fullmatch(node.get("_tap_bounds", node.get("bounds", "")))
                if match:
                    x1, y1, x2, y2 = map(int, match.groups())
                    _, h = screen_size()
                    if int(h*.16) < (y1+y2)//2 < int(h*.78):
                        return node
        except (RuntimeError, ET.ParseError, subprocess.TimeoutExpired):
            pass
        if scroll and i % 2 == 0:
            scroll_forward()
        time.sleep(0.65)
    raise RuntimeError("required UI element unavailable: " + needle)

def stage_summary(label: str) -> None:
    # Fixed boolean allowlist only. Never print EditText values or raw XML.
    allow = ("Analisar estrutura", "Preparando histórico seguro",
             "Verificação inconclusiva ou inválida", "Estrutura consistente",
             "Gerar e compartilhar relatório PDF", "Limpar dados da análise atual")
    nodes = xml_nodes()
    visible = {k: any(k.lower() in (n.get("text","")+" "+n.get("content-desc","")).lower()
                       for n in nodes) for k in allow}
    print("STAGE (LAB): "+label+" | "+json.dumps(visible, sort_keys=True), flush=True)

def chooser_present() -> bool:
    # In Android 8/9 the system resolver is exposed as ChooserActivity or ResolverActivity.
    # Inspect the foreground activity rather than trusting stale app UI text.
    try:
        activity = adb("shell", "dumpsys", "activity", "activities", timeout=20)
        focus = adb("shell", "dumpsys", "window", "windows", timeout=20, check=False)
        if re.search(r"(?:mResumedActivity|topResumedActivity|mFocusedApp|mCurrentFocus).*"
                     r"(?:ChooserActivity|ResolverActivity)", activity + "\n" + focus):
            return True
        # Some API levels print the resumed activity on a second line.
        for line in (activity + "\n" + focus).splitlines():
            if ("ChooserActivity" in line or "ResolverActivity" in line) and (
                "Resumed" in line or "mCurrentFocus" in line or "topActivity" in line
                or "mFocusedApp" in line
            ):
                return True
        return False
    except (RuntimeError, subprocess.TimeoutExpired):
        return False

def run_smoke() -> None:
    if not APK.is_file() or APK.is_symlink() or APK.stat().st_size < 25_000_000:
        raise RuntimeError("missing or unsafe audited test APK")
    hasher = hashlib.sha256()
    with APK.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            hasher.update(block)
    digest = hasher.hexdigest()
    if digest != EXPECTED_SHA:
        raise RuntimeError("APK is not the audited four-permission-free binary")
    api = int(adb("shell", "getprop", "ro.build.version.sdk").strip())
    if api not in (26, 28):
        raise RuntimeError("unsupported Android API for this lab")
    adb("shell", "settings", "put", "global", "window_animation_scale", "0")
    adb("shell", "settings", "put", "global", "transition_animation_scale", "0")
    adb("shell", "settings", "put", "global", "animator_duration_scale", "0")
    # Avoid network dependencies: this test validates the embedded preview only.
    adb("shell", "svc", "wifi", "disable", check=False)
    adb("shell", "svc", "data", "disable", check=False)
    adb("install", "-r", str(APK), timeout=150)
    launched = adb("shell", "monkey", "-p", PACKAGE, "-c",
                   "android.intent.category.LAUNCHER", "1", timeout=30)
    if "Events injected: 1" not in launched:
        raise RuntimeError("Android launcher did not start Negresco")
    wait_visible("Seu universo", retries=45)
    tap_node(wait_visible("Guardião", retries=24, scroll=True))
    input_node = wait_visible("Linha digitável do boleto", retries=30)
    tap_node(input_node)
    adb("shell", "input", "text", FIXTURE)
    adb("shell", "input", "keyevent", "4")  # Hide keyboard.
    # The actual EditText value is required; a tap on the label alone proves nothing.
    populated = wait_visible("Linha digitável do boleto", retries=10)
    if populated.get("text", "") != FIXTURE:
        raise RuntimeError("synthetic 47-digit boleto was not populated in the EditText")
    stage_summary("synthetic field entered")
    tap_node(wait_visible("Analisar estrutura", retries=12, enabled=True, scroll=True))
    stage_summary("after first Analyze tap")
    # A missed synthetic tap is allowed one safe, explicit second attempt
    # after returning to the form. Never press arbitrary other controls.
    try:
        wait_visible("Verificação inconclusiva ou inválida", retries=14, scroll=True)
    except RuntimeError:
        stage_summary("first Analyze tap did not show result")
        for _ in range(7):
            scroll_backward()
        button = wait_visible("Analisar estrutura", retries=12, enabled=True, scroll=True)
        tap_node(button, prefer_label=True)
        stage_summary("after text-center retry")
        try:
            wait_visible("Verificação inconclusiva ou inválida", retries=14, scroll=True)
        except RuntimeError:
            stage_summary("analysis result missing after two bounded taps, no PDF attempted")
            raise
    print("STAGE (LAB): synthetic analysis result visible, next checking PDF export button")
    pdf_button = wait_visible("Gerar e compartilhar relatório PDF", retries=35, scroll=True)
    tap_node(pdf_button)
    for _ in range(55):
        if chooser_present():
            REPORT.write_text(json.dumps({
                "schemaVersion": 1,
                "scope": "UI_SMOKE_ONLY_NO_PDF_RECEIVER_VERIFICATION",
                "api": api, "apkSha256": digest, "syntheticInput": True,
                "guardiaoOpened": True, "pdfActionTriggered": True,
                "systemChooserObserved": True, "stableReleaseAllowed": False
            }, sort_keys=True, indent=2) + "\n", encoding="utf8")
            print(f"PASS (LAB): real Android API {api} opened system PDF share chooser from Guardião")
            return
        time.sleep(1)
    raise RuntimeError("PDF share chooser not observed after synthetic user action")

if __name__ == "__main__":
    try:
        run_smoke()
    except Exception as exc:
        # Avoid logging UI dump or content potentially containing user strings.
        print("BLOCK (LAB): Android UI PDF smoke: " + str(exc), file=sys.stderr)
        raise SystemExit(1)

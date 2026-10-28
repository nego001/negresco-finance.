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
EXPECTED_SHA = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"
APK = Path("test-apk/android/app/build/outputs/apk/release/app-release.apk")
REPORT = Path("pdf-ui-emulator-report.json")
# Deliberately no dynamic error text, no screenshots, no PDF upload.
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

def scroll_forward_precise() -> None:
    # A 49%-height fling can entirely skip the short PDF button on Android 9.
    # Use a small touch gesture and independently inspect after every step.
    w, h = screen_size()
    adb("shell", "input", "swipe", str(w//2), str(int(h*0.69)),
        str(w//2), str(int(h*0.49)), "280")
    time.sleep(0.35)

def wait_export_button() -> dict[str, str]:
    for step in range(48):
        node = lookup("Gerar e compartilhar relatório PDF", enabled=True)
        if node is not None:
            match = BOUNDS.fullmatch(node.get("bounds", ""))
            if match:
                x1, y1, x2, y2 = map(int, match.groups())
                _, h = screen_size()
                if int(h*.17) < (y1+y2)//2 < int(h*.79):
                    print("STAGE (LAB): PDF action button really visible at bounded viewport", flush=True)
                    return node
        if step in (0,12,24,36):
            stage_summary("searching PDF button with small-step scrolling")
        scroll_forward_precise()
    stage_summary("PDF button not observed after bounded small-step scrolling")
    raise RuntimeError("PDF button not visible after 48 small scroll steps")

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

def stage_summary(label: str) -> dict[str, bool]:
    # Fixed boolean allowlist only. Never print EditText values or raw XML.
    allow = ("Analisar estrutura", "Preparando histórico seguro",
             "Verificação inconclusiva ou inválida", "Estrutura consistente",
             "Gerar e compartilhar relatório PDF", "Limpar dados da análise atual",
             "Gerando PDF local...", "Não foi possível gerar ou compartilhar o PDF.",
             "Compartilhamento de PDF indisponível neste dispositivo.",
             "Falha ao gerar o PDF local.",
             "Falha ao gerar o relatório PDF. Teste sintético mínimo criou arquivo local.",
             "Falha ao gerar o relatório PDF. Teste sintético mínimo também falhou.",
             "Falha ao gerar o PDF local. Teste sintético sem resultado verificável.",
             "O arquivo PDF gerado não tem um endereço local válido.",
             "Falha ao verificar o compartilhamento disponível.",
             "Falha ao abrir o compartilhamento nativo do Android.",
             "Seletor de compartilhamento encerrado.")
    nodes = xml_nodes()
    visible = {k: any(k.lower() in (n.get("text","")+" "+n.get("content-desc","")).lower()
                       for n in nodes) for k in allow}
    print("STAGE (LAB): "+label+" | "+json.dumps(visible, sort_keys=True), flush=True)
    return visible

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
    first = stage_summary("after first Analyze tap")
    # The UI evidence may be visible for only one snapshot. Preserve it and
    # NEVER scroll the result away then incorrectly report it as absent.
    observed = first["Verificação inconclusiva ou inválida"]
    if not observed:
        try:
            wait_visible("Verificação inconclusiva ou inválida", retries=5, scroll=False)
            observed = True
        except RuntimeError:
            stage_summary("first Analyze tap did not show result")
    if not observed:
        # Exactly one bounded retry, never press unknown controls.
        for _ in range(7):
            scroll_backward()
        button = wait_visible("Analisar estrutura", retries=12, enabled=True, scroll=True)
        tap_node(button, prefer_label=True)
        retry = stage_summary("after text-center retry")
        observed = retry["Verificação inconclusiva ou inválida"]
        if not observed:
            try:
                wait_visible("Verificação inconclusiva ou inválida", retries=6, scroll=False)
                observed = True
            except RuntimeError:
                stage_summary("analysis result missing after two bounded taps, no PDF attempted")
                raise
    if not observed:
        raise RuntimeError("analysis result was never observed; do not export PDF")
    print("STAGE (LAB): synthetic analysis result visible, next checking PDF export button")
    pdf_button = wait_export_button()
    tap_node(pdf_button, prefer_label=True)
    print("STAGE (LAB): one bounded PDF export tap dispatched", flush=True)
    for attempt in range(55):
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
        if attempt in (1,5,12,24,40):
            state = stage_summary("PDF chooser pending")
            # All three probe verdicts are BLOCK outcomes for the real report.
            # Do not consider the synthetic PDF to be the user's requested report.
            probe_verdicts = (
                ("Falha ao gerar o relatório PDF. Teste sintético mínimo criou arquivo local.", "report-failed-minimal-created"),
                ("Falha ao gerar o relatório PDF. Teste sintético mínimo também falhou.", "report-failed-minimal-failed"),
                ("Falha ao gerar o PDF local. Teste sintético sem resultado verificável.", "report-failed-minimal-unverified"),
            )
            for label, verdict in probe_verdicts:
                if state[label]:
                    raise RuntimeError("Guardião synthetic A/B result: " + verdict)
            phase_errors = (
                ("Falha ao gerar o PDF local.", "print"),
                ("O arquivo PDF gerado não tem um endereço local válido.", "invalid-uri"),
                ("Falha ao verificar o compartilhamento disponível.", "availability"),
                ("Falha ao abrir o compartilhamento nativo do Android.", "share"),
            )
            for label, phase in phase_errors:
                if state[label]:
                    raise RuntimeError("Guardião PDF native failure phase: " + phase)
            if state["Não foi possível gerar ou compartilhar o PDF."]:
                raise RuntimeError("Guardião reported unclassified PDF failure")
            if state["Compartilhamento de PDF indisponível neste dispositivo."]:
                raise RuntimeError("Guardião reported Android PDF sharing unavailable")
        time.sleep(1)
    stage_summary("PDF chooser timeout; no app status is treated as success")
    raise RuntimeError("PDF share chooser not observed after synthetic user action")

if __name__ == "__main__":
    try:
        run_smoke()
    except Exception as exc:
        # Avoid logging UI dump or content potentially containing user strings.
        print("BLOCK (LAB): Android UI PDF smoke: " + str(exc), file=sys.stderr)
        raise SystemExit(1)

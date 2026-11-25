#!/usr/bin/env python3
"""M116: Guardiao-only keyboard tap handling and fixed Debug callbacks."""
from __future__ import annotations
import os
import re
import sys
import guardiao_debug_first_analyze_m115 as m115
from guardiao_debug_safe_insets_m111 import APP

LAB_REF = "refs/heads/lab/p01-guardiao-debug-analyze-keyboard-m116-v1"
APP_PAIRS = [["<ScrollView key={page} ref=","<ScrollView key={page} keyboardShouldPersistTaps={page==='Guardião'?'handled':'never'} ref="],["disabled={!historyLoaded} onPress={()=>{reportRequestId.current++;const result=inspectBoleto(boletoLine);","disabled={!historyLoaded} onPressIn={__DEV__?()=>console.log('NEGRESCO_LAB_M116_ANALYZE_IN'):undefined} onPress={()=>{if(__DEV__)console.log('NEGRESCO_LAB_M116_ANALYZE_CALL');reportRequestId.current++;const result=inspectBoleto(boletoLine);"]]
BASE_PAIRS = [["    tap_node(wait_visible(\"Analisar estrutura\", retries=12, enabled=True, scroll=True), prefer_label=True)","    from guardiao_debug_analyze_keyboard_m116 import sample, report\n    m116_before = sample()\n    tap_node(wait_visible(\"Analisar estrutura\", retries=12, enabled=True, scroll=True), prefer_label=True)"],["    if not observed:\n        raise RuntimeError(\"analysis result was never observed; do not export PDF\")","    report(m116_before)\n    if not observed:\n        raise RuntimeError(\"analysis result was never observed; do not export PDF\")"]]

def scope():
    return os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("GITHUB_REF") == LAB_REF

def transform(source, pairs):
    out = source
    for before, after in pairs:
        if out.count(before) != 1 or after in out:
            raise RuntimeError("M116 exact source unconfirmed")
        out = out.replace(before, after, 1)
    return out

def apply():
    if not scope() or any(not p.is_file() or p.is_symlink() for p in (APP, m115.BASE)):
        raise RuntimeError("M116 scope unconfirmed")
    app = transform(m115.m114.app_transform(APP.read_text(encoding="utf-8")), APP_PAIRS)
    base = transform(m115.transform(m115.BASE.read_text(encoding="utf-8")), BASE_PAIRS)
    old = m115.LAB_REF
    try:
        m115.LAB_REF = LAB_REF
        m115.apply()
    finally:
        m115.LAB_REF = old
    for path, content in ((APP, app), (m115.BASE, base)):
        path.write_text(content, encoding="utf-8")
        if path.read_text(encoding="utf-8") != content:
            raise RuntimeError("M116 temporary source unconfirmed")

def counts(raw, pid):
    if type(raw) is not str or len(raw) > 150000 or not re.fullmatch(r"[1-9][0-9]{0,8}", pid):
        return None
    pattern = re.compile(r"^I/ReactNativeJS\(\s*" + pid + r"\): NEGRESCO_LAB_M116_ANALYZE_(IN|CALL)$")
    events = [m.group(1) for line in raw.splitlines() if (m := pattern.fullmatch(line))]
    return events.count("IN"), events.count("CALL")

def sample():
    try:
        if not scope():
            return None
        import guardiao_pdf_ui_emulator_smoke as base
        pid = base.adb("shell", "pidof", base.PACKAGE, timeout=10).strip()
        if not re.fullmatch(r"[1-9][0-9]{0,8}", pid):
            return None
        raw = base.adb("logcat", "-d", "-t", "240", "--pid="+pid, "-v", "brief", "-s", "ReactNativeJS:I", timeout=12)
        c = counts(raw, pid)
        if c is None or base.adb("shell", "pidof", base.PACKAGE, timeout=10).strip() != pid:
            return None
        return pid, c
    except Exception:
        return None

def classify(before, after):
    if before is None or after is None or before[0] != after[0]:
        return "callback-evidence-unconfirmed"
    delta = tuple(b-a for a,b in zip(before[1], after[1]))
    return {(1,1):"press-in-and-call-observed",(0,1):"call-observed",(1,0):"press-in-only-observed",(0,0):"no-new-marker-observed"}.get(delta,"callback-evidence-unconfirmed")

def report(before):
    print("ENV (LAB): m116-analyze-callback="+classify(before,sample()), flush=True)

if __name__ == "__main__":
    try:
        if sys.argv != [sys.argv[0], "apply"]:
            raise RuntimeError("unexpected arguments")
        apply()
        print("PASS (LAB): M116 scoped handled keyboard taps plus fixed Debug markers", flush=True)
    except Exception:
        print("BLOCK (LAB): M116 scoped control not attested", file=sys.stderr)
        raise SystemExit(1)

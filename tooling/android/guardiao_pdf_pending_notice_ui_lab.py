#!/usr/bin/env python3
"""Disposable API28 Debug UI proof of a delayed PDF warning. NO native print.

The install subcommand changes App.tsx only inside an authorized CI checkout,
injecting a synthetic forever-pending promise before any native print call.
The emulator checks the actual accessibility warning after 30 seconds, while
no chooser or receiver receipt exists and the app PID remains unchanged.
This cannot reproduce or fix the immutable original Release APK failure.
"""
from __future__ import annotations
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
import guardiao_pdf_debug_metro_lab as debug
import guardiao_debug_metro_transport_probe as transport
import guardiao_original_release_same_process_lab as identity

APP = Path("apps/mobile/App.tsx")
BASE = debug.base
LABEL = "PDF ainda pendente. Nenhuma segunda exportação será iniciada."
TEXT_A = "A geração do PDF está demorando mais que o normal."
TEXT_B = "Outra exportação permanece bloqueada"
ANCHOR = ("      print:async content=>{\n"
          "        try{return await Print.printToFileAsync({html:content});}")
PATCH = ("      print:async content=>{\n"
         "        // CI-only synthetic Debug hang. No native PDF print runs.\n"
         "        if(typeof __DEV__!=='undefined'&&__DEV__)\n"
         "          return await new Promise<{uri:string}>(()=>{});\n"
         "        try{return await Print.printToFileAsync({html:content});}")

def patch_source(source: str) -> str:
    if (type(source) is not str or len(source) > 200000
            or source.count(ANCHOR) != 1 or PATCH in source
            or "reportPdfBusy&&reportPdfLongPending&&pdfNativeGate.current.busy()" not in source
            or LABEL not in source):
        raise RuntimeError("unexpected disposable Debug source")
    return source.replace(ANCHOR, PATCH, 1)

def install() -> None:
    if os.environ.get("CI") != "true" or os.environ.get("NEGRESCO_PENDING_NOTICE_LAB") != "1":
        raise RuntimeError("CI-only disposable source modification refused")
    if APP.is_symlink() or not APP.is_file():
        raise RuntimeError("disposable source unavailable")
    updated = patch_source(APP.read_text(encoding="utf8"))
    APP.write_text(updated, encoding="utf8")
    if APP.read_text(encoding="utf8") != updated:
        raise RuntimeError("disposable source patch not confirmed")
    print("PASS (LAB): synthetic Debug-only unresolved print installed", flush=True)

def strict_notice(nodes: list[dict[str, str]]) -> bool:
    if type(nodes) is not list or len(nodes) > 2000:
        return False
    hits = [n for n in nodes if (type(n) is dict and
            n.get("class") == "android.widget.TextView" and
            n.get("content-desc") == LABEL)]
    return (len(hits) == 1 and type(hits[0].get("text")) is str and
            TEXT_A in hits[0]["text"] and TEXT_B in hits[0]["text"])

class NoticeVerified(Exception):
    pass

def run() -> None:
    if BASE.adb("shell","getprop","ro.build.version.sdk",timeout=15).strip() != "28":
        raise RuntimeError("Android API 28 required")
    digest = debug.debug_digest()
    BASE.APK = debug.APK
    BASE.EXPECTED_SHA = digest
    BASE.FIXTURE = debug.FIXTURE
    BASE.REPORT = Path("guardiao-pending-notice-must-not-exist.json")
    if BASE.REPORT.exists():
        raise RuntimeError("stale receiver receipt")
    original_adb, original_chooser = BASE.adb, BASE.chooser_present
    radio_skips: set[str] = set()
    started, baseline_pid = None, None
    server, relay = None, None
    verified = False

    def keep_metro(*args, **kwargs):
        if debug.is_legacy_offline_radio_disable(args,kwargs):
            radio_skips.add(args[2])
            return ""
        if args[:2] == ("shell","svc") and "disable" in args:
            raise RuntimeError("unexpected radio disable")
        return original_adb(*args,**kwargs)

    def observe() -> bool:
        nonlocal started, baseline_pid
        if original_chooser():
            raise RuntimeError("unexpected native chooser")
        pid = identity.observed_single_app_pid()
        if not pid or (baseline_pid is not None and baseline_pid != pid):
            raise RuntimeError("pending app process identity unconfirmed")
        if started is None:
            started, baseline_pid = time.monotonic(), pid
        elapsed = time.monotonic()-started
        if elapsed >= 27 and strict_notice(BASE.xml_nodes()):
            if not 28 <= elapsed <= 95:
                raise RuntimeError("pending notice timing outside bounded range")
            if BASE.receiver_receipt() is not None or BASE.REPORT.exists():
                raise RuntimeError("unexpected receipt while synthetic print unresolved")
            if identity.observed_single_app_pid() != baseline_pid:
                raise RuntimeError("pending notice app PID changed")
            raise NoticeVerified()
        return False

    try:
        server = debug.start_local_metro()
        debug.prewarm_android_bundle()
        relay = transport.PrivateMetroRelay()
        relay.start()
        original_adb("reverse",f"tcp:{debug.BUNDLE_PORT}",f"tcp:{transport.LISTEN_PORT}")
        relay.reset_after_preflight()
        BASE.adb, BASE.chooser_present = keep_metro, observe
        try:
            # Existing strict one-shot real Android navigation, fixed invalid
            # synthetic input and export tap; no PDF is expected in this test.
            BASE.run_smoke()
            raise RuntimeError("unexpected successful PDF in pending UI lab")
        except NoticeVerified:
            if radio_skips != {"wifi","data"}:
                raise RuntimeError("Debug Metro radio policy not exercised")
            verified=True
        if not verified:
            raise RuntimeError("no verified pending warning")
        print("PASS (LAB): Android 9 real UI warning after synthetic unresolved print",flush=True)
        print("PASS (LAB): unchanged app PID, no chooser, no PDF receipt",flush=True)
    finally:
        BASE.adb, BASE.chooser_present = original_adb, original_chooser
        BASE.REPORT.unlink(missing_ok=True)
        try:
            original_adb("reverse","--remove",f"tcp:{debug.BUNDLE_PORT}",check=False)
        except (RuntimeError,subprocess.TimeoutExpired):
            pass
        if relay is not None:
            relay.stop()
        if server is not None and server.poll() is None:
            os.killpg(server.pid,signal.SIGTERM)
            try: server.wait(timeout=8)
            except subprocess.TimeoutExpired:
                os.killpg(server.pid,signal.SIGKILL)
                server.wait(timeout=4)

if __name__ == "__main__":
    try:
        if len(sys.argv) != 2 or sys.argv[1] not in ("install","run"):
            raise RuntimeError("invalid lab mode")
        if sys.argv[1] == "install": install()
        else: run()
    except Exception:
        print("BLOCK (LAB): Android 9 pending PDF warning proof unverified",file=sys.stderr)
        raise SystemExit(1)

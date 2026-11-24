#!/usr/bin/env python3
"""M94: fixed pre-operation labels, exact M93 compatibility control."""
from __future__ import annotations
import os
import sys
from guardiao_debug_zindex_one_compat_m93 import APP, OBSERVER, APIS, m91_pure, observer_transform

LAB_REF = "refs/heads/lab/p01-guardiao-debug-compat-preflight-m94-v1"
ANCHORS = (
    ("        relay = debug.transport.PrivateMetroRelay()", "relay-create"),
    ("        relay.start()", "relay-start"),
    ("        BASE.adb(\"reverse\", f\"tcp:{debug.BUNDLE_PORT}\", f\"tcp:{debug.transport.LISTEN_PORT}\")", "reverse"),
    ("        relay.reset_after_preflight()", "relay-reset"),
    ("        BASE.adb(\"install\", \"-r\", str(debug.APK), timeout=150)", "install-app"),
    ("        BASE.adb(\"install\", \"-t\", \"-r\", str(OBSERVER_APK), timeout=60)", "install-observer"),
    ("        launched = BASE.adb(\"shell\", \"monkey\", \"-p\", DEBUG_PACKAGE,", "launch-command"),
    ("        if \"Events injected: 1\" not in launched:", "launch-verify"),
    ("        time.sleep(30.0)", "settle"),
    ("        before_pid = debug_pid()", "pid"),
    ("        if not debug_focus():", "focus"),
    ("        raw = BASE.adb(\"shell\", \"am\", \"instrument\", \"-w\", \"-r\",", "instrument"),
    ("        idle, verdict, mask = parse_instrumentation(raw)", "parse-observation"),
)

def checkpoint_line(category: str) -> str:
    return '        print("ENV (LAB): m94-preflight-next=' + category + '", flush=True)\n'

def diagnostic_transform(source: str, api: str) -> str:
    control = observer_transform(source, api)
    changed = control
    for anchor, category in ANCHORS:
        marker = checkpoint_line(category)
        if changed.count(anchor) != 1 or marker in changed:
            raise RuntimeError("checkpoint anchor not unique")
        changed = changed.replace(anchor, marker + anchor)
    restored = changed
    for _, category in ANCHORS:
        marker = checkpoint_line(category)
        if restored.count(marker) != 1:
            raise RuntimeError("checkpoint marker not unique")
        restored = restored.replace(marker, "")
    if restored != control:
        raise RuntimeError("nonisolated diagnostic change")
    return changed

def apply(api: str) -> None:
    if any(not p.is_file() or p.is_symlink() for p in (APP, OBSERVER)):
        raise RuntimeError("unexpected source path")
    app = m91_pure(APP.read_text(encoding="utf-8"))
    observer = diagnostic_transform(OBSERVER.read_text(encoding="utf-8"), api)
    APP.write_text(app, encoding="utf-8")
    OBSERVER.write_text(observer, encoding="utf-8")
    if APP.read_text(encoding="utf-8") != app or OBSERVER.read_text(encoding="utf-8") != observer:
        raise RuntimeError("temporary source not attested")

if __name__ == "__main__":
    try:
        if (sys.argv != [sys.argv[0], "apply"]
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("GITHUB_REF") != LAB_REF):
            raise RuntimeError("unrecognized M94 branch")
        api = os.environ.get("M93_EXPECTED_API")
        if api not in APIS:
            raise RuntimeError("M94 matrix API not allowlisted")
        apply(api)
        print("PASS (LAB): M94 exact M93 control plus fixed preflight checkpoints API " + api, flush=True)
    except Exception:
        print("BLOCK (LAB): M94 scoped diagnostic source not attested", file=sys.stderr)
        raise SystemExit(1)

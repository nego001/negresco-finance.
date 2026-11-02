#!/usr/bin/env python3
"""Synthetic-only Debug/Metro Guardiao PDF test; no real payment information.

This builds on the existing on-device receiver and text verifier, but uses a
NEW temporary debug APK plus local Metro. The previous SHA-pinned Release lab
and its independently approved receipt files are never changed.
"""
from __future__ import annotations

import hashlib
import http.client
import json
import os
import re
import signal
import socket
import stat
import subprocess
import sys
import time
from pathlib import Path

import guardiao_android_export_pdf_text_emulator_smoke as semantic
import guardiao_debug_native_boot_categories as native_diagnosis
import guardiao_debug_metro_transport_probe as transport
import guardiao_debug_metro_host_routes as host_routes
import guardiao_debug_metro_app_process_probe as shell_route_probe
import guardiao_pdf_native_phase_lab as native_print_phase

base = semantic.base
APK = Path("apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk")
MANIFEST = Path("/tmp/negresco-debug-test-apk.sha256")
BUNDLE_PORT = 8081
MAX_APK_BYTES = 256 * 1024 * 1024
FIXTURE = "8" + "0" * 47
HINTS = {
    "Gerando PDF local... [LAB: impressão pendente]": "lab-print-pending",
    "Gerando PDF local... [LAB: disponibilidade pendente]": "lab-availability-pending",
    "Gerando PDF local... [LAB: compartilhamento pendente]": "lab-share-pending",
}


def debug_digest() -> str:
    if APK.is_symlink() or not APK.is_file():
        raise RuntimeError("non-regular debug test APK")
    info = APK.stat()
    if not stat.S_ISREG(info.st_mode) or not (25_000_000 <= info.st_size <= MAX_APK_BYTES):
        raise RuntimeError("debug test APK size out of safe bounds")
    expected = re.fullmatch(
        r"([0-9a-f]{64})  apps/mobile/android/app/build/outputs/apk/debug/app-debug\.apk\n?",
        MANIFEST.read_text(encoding="ascii"),
    )
    if expected is None:
        raise RuntimeError("debug APK SHA file malformed")
    h = hashlib.sha256()
    with APK.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    digest = h.hexdigest()
    if digest != expected.group(1):
        raise RuntimeError("debug APK differs from independent build-stage SHA")
    return digest


def start_local_metro() -> subprocess.Popen:
    env = dict(os.environ)
    # Expo CLI treats --offline and --localhost as mutually exclusive host
    # flags. Keep local-only listening and prohibit external network checks
    # via EXPO_OFFLINE, without passing the conflicting --offline flag.
    env.update({"CI": "1", "EXPO_NO_TELEMETRY": "1", "EXPO_OFFLINE": "1"})
    # Never print Metro output, JS source, path, host addresses or app data.
    server = subprocess.Popen(
        ["npx", "expo", "start", "--localhost", "--port", str(BUNDLE_PORT)],
        cwd="apps/mobile",
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
        env=env,
    )
    for _ in range(90):
        if server.poll() is not None:
            print("BLOCK STAGE (LAB): private Metro exited before local readiness", flush=True)
            raise RuntimeError("isolated Metro terminated before serving")
        try:
            with socket.create_connection(("127.0.0.1", BUNDLE_PORT), timeout=1):
                print("STAGE (LAB): isolated local Metro port ready", flush=True)
                return server
        except OSError:
            time.sleep(1)
    print("BLOCK STAGE (LAB): private Metro readiness not reached", flush=True)
    raise RuntimeError("local Metro readiness not observed in bounded window")


def prewarm_android_bundle() -> None:
    """Bounded local-only JS compile; never collect or print bundle contents."""
    print("STAGE (LAB): prewarm local Android Debug JS bundle", flush=True)
    # The mobile entrypoint is declared in apps/mobile/package.json. This
    # request is always loopback, cannot reach Expo's hosted OTA or a CDN.
    path = "/node_modules/expo/AppEntry.bundle?platform=android&dev=true&minify=false"
    conn = http.client.HTTPConnection("127.0.0.1", BUNDLE_PORT, timeout=210)
    try:
        conn.request("GET", path, headers={"Host": "localhost"})
        response = conn.getresponse()
        content_type = response.getheader("Content-Type", "").lower()
        if response.status != 200 or "javascript" not in content_type:
            print("BLOCK STAGE (LAB): private Android JS bundle not served", flush=True)
            raise RuntimeError("private Android Debug bundle HTTP policy rejected")
        if not response.read(1):
            print("BLOCK STAGE (LAB): private Android JS bundle empty", flush=True)
            raise RuntimeError("private Android Debug bundle empty")
        print("STAGE (LAB): private Android Debug JS bundle served locally", flush=True)
    except (OSError, http.client.HTTPException):
        print("BLOCK STAGE (LAB): private Android JS bundle request unavailable", flush=True)
        raise
    finally:
        conn.close()


BOOT_DIAGNOSTIC_LABELS = (
    ("Preparando proteção", "local-lock-loading"),
    ("Proteção indisponível", "local-lock-error"),
    ("Acesso protegido", "local-lock-protected"),
    ("Unable to load script", "js-bundle-load-error"),
    ("Could not connect to development server", "js-dev-server-error"),
    ("Unable to connect to development server", "js-dev-server-error"),
    ("Failed to load bundle", "js-bundle-load-error"),
    ("Failed to load JavaScript bundle", "js-bundle-load-error"),
    ("Welcome to Expo", "expo-development-screen"),
    ("Open a project", "expo-development-screen"),
    ("Start a development server", "expo-development-screen"),
    ("React Native DevTools", "react-native-debug-screen"),
    ("Reload the app", "react-native-debug-screen"),
    ("JavaScript Error", "react-native-error-screen"),
)


def classify_boot_nodes(nodes: list[dict[str, str]]) -> str:
    """Return ONLY fixed categories; no original text, XML or user input."""
    labels = tuple(
        (node.get("text", "") + " " + node.get("content-desc", "")).casefold()
        for node in nodes
    )
    for phrase, category in BOOT_DIAGNOSTIC_LABELS:
        if any(phrase.casefold() in label for label in labels):
            return category
    return "no-recognized-boot-label"


def diagnose_private_debug_home() -> None:
    # Native app is already installed; read only parsed UI nodes in memory.
    # Neither hierarchy, source text, data, coordinates nor filenames leave CI.
    try:
        category = classify_boot_nodes(base.xml_nodes())
    except (RuntimeError, subprocess.TimeoutExpired):
        category = "ui-inspection-unavailable"
    print("ENV (LAB): Android Debug startup category " + category, flush=True)


def probe_android_local_metro() -> str:
    """Read-only, fixed-loopback-only transport probe; no native logs/content."""
    try:
        routes = base.adb("reverse", "--list", timeout=15, check=False)
        mapping = f"tcp:{BUNDLE_PORT} tcp:{transport.LISTEN_PORT}"
        if mapping not in routes:
            return "adb-reverse-not-confirmed"
        # This endpoint contains only the static Metro status. Android API 28
        # may lack toybox nc, so a missing tool is NOT reported as an outage.
        request = (
            "printf 'GET /status HTTP/1.0\\r\\n"
            "Host: localhost\\r\\n"
            "Connection: close\\r\\n\\r\\n' "
            f"| toybox nc -w 4 127.0.0.1 {BUNDLE_PORT}"
        )
        raw = base.adb("shell", "sh", "-c", request, timeout=15, check=False)
        if len(raw) > 24_000:
            return "device-status-probe-unconfirmed"
        if "HTTP/1." in raw and "packager-status:running" in raw:
            return "device-local-metro-reachable"
        return "device-status-probe-unconfirmed"
    except (OSError, RuntimeError, subprocess.TimeoutExpired):
        return "device-status-probe-unavailable"


def classify_debug_synthetic_input_node(
    selected: dict[str, str], nodes: list[dict[str, str]], fixture: str
) -> str:
    """Classify only fixed synthetic EditText states; never return input text.

    Never infer a successful injection from a label alone. The original strict
    fixture equality check in the shared Release smoke remains authoritative.
    """
    label = "Linha digitável do boleto"
    candidates = [
        node for node in nodes
        if node.get("class") == "android.widget.EditText"
        and node.get("content-desc") == label
    ]
    if selected.get("text") == fixture:
        return "synthetic-selected-value-matched"
    if any(node.get("text") == fixture for node in candidates):
        return "synthetic-value-in-other-edittext"
    if not candidates:
        return "synthetic-edittext-not-observed"
    if any(node.get("text", "") for node in candidates):
        return "synthetic-edittext-nonempty-mismatch"
    return "synthetic-edittext-empty"


def select_verified_debug_synthetic_edittext(
    selected: dict[str, str], nodes: list[dict[str, str]], fixture: str
) -> dict[str, str]:
    """Prefer the *unique* actual EditText with the exact synthetic value.

    Never infer a match from a label, nor choose when duplicate/ambiguous
    candidates exist. Original Release fixture validation still runs.
    """
    if len(fixture) != 48 or fixture != "8" + "0" * 47:
        return selected
    candidates = [
        node for node in nodes
        if node.get("class") == "android.widget.EditText"
        and node.get("content-desc") == "Linha digitável do boleto"
    ]
    if len(candidates) == 1 and candidates[0].get("text") == fixture:
        return candidates[0]
    return selected


def is_legacy_offline_radio_disable(args: tuple[str, ...], kwargs: dict) -> bool:
    """Only the two fixed offline-smoke commands can be deferred in Debug CI."""
    return (
        args in (
            ("shell", "svc", "wifi", "disable"),
            ("shell", "svc", "data", "disable"),
        )
        and kwargs == {"check": False}
    )


def report_android_local_metro(stage: str) -> None:
    # stage comes only from literal call sites, never external strings.
    if stage not in ("before-app", "after-app-failure"):
        raise ValueError("unapproved Android network-probe phase")
    print("ENV (LAB): " + stage + " " + probe_android_local_metro(), flush=True)


def run() -> None:
    if len(sys.argv) != 1 or len(FIXTURE) != 48 or FIXTURE[2] != "0":
        raise RuntimeError("synthetic fixture policy rejected")
    print("STAGE (LAB): Debug APK local integrity check starting", flush=True)
    try:
        digest = debug_digest()
    except (ValueError, OSError, RuntimeError):
        print("BLOCK STAGE (LAB): Debug APK local integrity check rejected", flush=True)
        raise
    print("STAGE (LAB): Debug APK local integrity check passed", flush=True)
    # Explicitly override only the isolated process's Debug APK identity.
    # The immutable Release APK verifier and workflows are not modified.
    base.APK = APK
    base.EXPECTED_SHA = digest
    base.FIXTURE = FIXTURE
    observed: set[str] = set()
    native_before_receiver: str | None = None
    original_chooser = base.chooser_present

    def observe_before_chooser() -> bool:
        nonlocal native_before_receiver
        # Use existing allowlisted booleans; never emit raw UI XML.
        try:
            state = base.stage_summary("debug-only PDF await boundary")
            for label, category in HINTS.items():
                if state.get(label) is True:
                    observed.add(category)
        except (RuntimeError, subprocess.TimeoutExpired):
            pass
        chooser_visible = original_chooser()
        if chooser_visible and native_before_receiver is None:
            # Sample while real Android chooser is visible, before switching
            # to the independent receiver. A missing event is diagnostic only.
            native_before_receiver = native_print_phase.collect_last_phase()
            print("ENV (LAB): Android Debug native phase before receiver " +
                  native_before_receiver, flush=True)
        return chooser_visible

    base.chooser_present = observe_before_chooser
    original_wait_visible = base.wait_visible
    original_adb = base.adb
    deferred_radios: set[str] = set()

    def preserve_debug_metro_radios(*args: str, **kwargs) -> str:
        # The old smoke script is a RELEASE offline test and disables radio
        # before launch. This DEBUG-only APK instead needs Metro for its JS.
        # Intercept exactly those two legacy commands in this process only.
        if is_legacy_offline_radio_disable(args, kwargs):
            deferred_radios.add(args[2])
            return ""
        if args[:2] == ("shell", "svc") and "disable" in args:
            raise RuntimeError("unexpected radio command in isolated Debug Metro lab")
        return original_adb(*args, **kwargs)

    def wait_home_with_early_native_checkpoint(needle: str, retries: int = 25,
                                               *, scroll: bool = False,
                                               enabled: bool = False):
        if needle == "Linha digitável do boleto" and retries == 10:
            # The strict smoke test then compares node["text"] to a fixed,
            # deliberately invalid fixture. If that fails, classify without
            # printing it or retyping. Do not turn UI flakiness into PDF PASS.
            try:
                field = original_wait_visible(
                    needle, retries=retries, scroll=scroll, enabled=enabled
                )
            except (RuntimeError, subprocess.TimeoutExpired):
                print("ENV (LAB): Android Debug synthetic input "
                      "synthetic-input-view-unconfirmed", flush=True)
                raise
            # The generic text lookup may return the label TextView before
            # the actual EditText. Read the hierarchy ONLY in memory and
            # select the unique, exact-value, accessibility-labeled EditText.
            # Do not inject text, change the fixture or bypass smoke equality.
            try:
                nodes = base.xml_nodes()
            except (RuntimeError, subprocess.TimeoutExpired, ValueError):
                print("ENV (LAB): Android Debug synthetic input "
                      "synthetic-input-view-unconfirmed", flush=True)
                return field
            verified = select_verified_debug_synthetic_edittext(
                field, nodes, FIXTURE
            )
            if verified is not field:
                print("ENV (LAB): Android Debug synthetic input "
                      "synthetic-edittext-exact-verified", flush=True)
                return verified
            if (field.get("class") == "android.widget.EditText"
                    and field.get("content-desc") == "Linha digitável do boleto"
                    and field.get("text") == FIXTURE):
                return field
            category = classify_debug_synthetic_input_node(
                field, nodes, FIXTURE
            )
            print("ENV (LAB): Android Debug synthetic input " + category, flush=True)
            return field
        if needle != "Seu universo" or retries < 2:
            return original_wait_visible(needle, retries=retries, scroll=scroll, enabled=enabled)
        early = min(8, retries - 1)
        try:
            return original_wait_visible(needle, retries=early, scroll=scroll, enabled=enabled)
        except RuntimeError:
            # Fixed categories only, sampled soon after actual app launch.
            perm, native_phase = native_diagnosis.collect_categories()
            print("ENV (LAB): early Android network permission " + perm, flush=True)
            print("ENV (LAB): early Android Debug native startup " + native_phase, flush=True)
        return original_wait_visible(needle, retries=retries - early,
                                     scroll=scroll, enabled=enabled)

    base.wait_visible = wait_home_with_early_native_checkpoint
    server = None
    relay = None
    try:
        print("STAGE (LAB): start private offline Metro", flush=True)
        server = start_local_metro()
        prewarm_android_bundle()
        relay = transport.PrivateMetroRelay()
        relay.start()
        base.adb("reverse", f"tcp:{BUNDLE_PORT}", f"tcp:{transport.LISTEN_PORT}")
        report_android_local_metro("before-app")
        # Compare shell-UID local routes *before* the legacy smoke runner turns
        # Wi-Fi and mobile data off. The Debug build depends on Metro JS.
        # This is observational only, not a request from the app itself.
        before_loopback, before_alias = shell_route_probe.probe_shell_routes()
        print("ENV (LAB): before-radio-disable shell loopback " + before_loopback, flush=True)
        print("ENV (LAB): before-radio-disable shell emulator alias " + before_alias, flush=True)
        # Probes above can themselves connect via adb reverse. Discard their
        # sockets before launch so they cannot be mistaken for app requests.
        relay.reset_after_preflight()
        print("STAGE (LAB): Android emulator connected to isolated Metro", flush=True)
        print("STAGE (LAB): start synthetic on-device Guardiao PDF test", flush=True)
        native_diagnosis.reset_native_window()
        # Separate read-path canary, never a native callback and never a PDF PASS.
        # Runs after native diagnostic log reset, before any PDF export.
        print("ENV (LAB): Android Debug native diagnostic channel " +
              native_print_phase.verify_diagnostic_channel(), flush=True)
        # Keep transport for Debug JS; Release's offline runner is unchanged.
        base.adb = preserve_debug_metro_radios
        try:
            semantic.run_lab()
            if deferred_radios != {"wifi", "data"}:
                raise RuntimeError("Debug Metro radio boundary was not exercised")
        except Exception:
            print("ENV (LAB): Android Debug native print phase " +
                  native_print_phase.collect_last_phase(), flush=True)
            # Fixed process state only: no stdout, JavaScript, stack or PDF.
            print("ENV (LAB): private Metro process " +
                  ("alive" if server.poll() is None else "exited"), flush=True)
            diagnose_private_debug_home()
            if relay is not None:
                print("ENV (LAB): Android Debug bundle transport " + relay.category(), flush=True)
            # Independent fixed-address diagnosis runs only after the UI fails.
            # It cannot claim success and never emits raw HTTP or device config.
            host_property, reverse_route, emulator_alias = host_routes.fixed_route_categories()
            print("ENV (LAB): Android Debug Metro host property " + host_property, flush=True)
            print("ENV (LAB): Android Debug Metro reverse route " + reverse_route, flush=True)
            print("ENV (LAB): Android Debug Metro emulator alias " + emulator_alias, flush=True)
            # API 28 emulator images often lack toybox nc. The standalone Java
            # shell-UID probe is observational, not proof of app reachability.
            shell_loopback, shell_alias = shell_route_probe.probe_shell_routes()
            print("ENV (LAB): Android Debug shell loopback " + shell_loopback, flush=True)
            print("ENV (LAB): Android Debug shell emulator alias " + shell_alias, flush=True)
            report_android_local_metro("after-app-failure")
            permission_category, native_category = native_diagnosis.collect_categories()
            print("ENV (LAB): Android app network permission " + permission_category, flush=True)
            print("ENV (LAB): Android Debug native startup " + native_category, flush=True)
            raise
        if relay is not None:
            print("ENV (LAB): Android Debug bundle transport " + relay.category(), flush=True)
        print("ENV (LAB): Android Debug native print phase " +
              native_print_phase.collect_last_phase(), flush=True)
        report = json.loads(semantic.REPORT.read_text(encoding="utf8"))
        if (report.get("api") != 28 or report.get("apkSha256") != digest or
            report.get("sourceFixture") != "synthetic-48-collection-reference-invalid" or
            report.get("nativePdfSemanticTextVerified") is not True or
            report.get("receiverCacheClean") is not True or
            report.get("approvedForProduction") is not False or
            report.get("stableReleaseAllowed") is not False):
            raise RuntimeError("Debug-only PDF evidence has inconsistent synthetic gates")
        if not observed:
            # After the external receiver verified and cleaned the real PDF,
            # return from its Activity to observe a persistent, fixed
            # Debug-only phase marker. This is an "entered" event, never a
            # claim that the native await was pending at inspection time.
            # No tap/relaunch is performed before PDF evidence is complete.
            try:
                base.adb("shell", "input", "keyevent", "4", timeout=15)
                base.wait_visible("LAB: última etapa PDF iniciada: share", retries=12)
                observed.add("lab-share-entered-after-receipt")
            except (RuntimeError, subprocess.TimeoutExpired):
                pass
        if not observed:
            raise RuntimeError("no actual debug-only phase marker was observed")
        # Print only categories that the source defines, never values from UI.
        for category in sorted(observed):
            print("PASS STAGE (LAB): observed " + category, flush=True)
        print("PASS (LAB): Debug synthetic PDF received, rendered, checked and erased")
    finally:
        base.adb = original_adb
        base.wait_visible = original_wait_visible
        base.chooser_present = original_chooser
        semantic.REPORT.unlink(missing_ok=True)
        base.REPORT.unlink(missing_ok=True)
        try:
            base.adb("reverse", "--remove", f"tcp:{BUNDLE_PORT}", check=False)
        except (RuntimeError, subprocess.TimeoutExpired):
            pass
        if relay is not None:
            relay.stop()
        if server is not None:
            if server.poll() is None:
                os.killpg(server.pid, signal.SIGTERM)
                try:
                    server.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    os.killpg(server.pid, signal.SIGKILL)
                    server.wait(timeout=4)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        # No sensitive exception messages, data, PDF, UI dump or Metro logs.
        print("BLOCK (LAB): Debug Android PDF phase verification incomplete", file=sys.stderr)
        raise SystemExit(1)

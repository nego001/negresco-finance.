#!/usr/bin/env python3
"""M65: category-only native Debug bootstrap and Metro transport diagnosis.

One disposable Android9 Debug APK, one external PPP observer and ONE inherited
Home UIAutomator snapshot. Never print/read out raw logs, XML, HTTP, UI labels,
package dumps, permissions lists, PID, URLs, coordinates or JavaScript.
"""
from __future__ import annotations

import sys
import guardiao_api28_debug_external_a11y_readonly_lab as observer
import guardiao_api28_debug_home_readiness_census_lab as home

BASE = observer.debug.base
DIAG = observer.debug.native_diagnosis
HOST = observer.debug.host_routes
SHELL = observer.debug.shell_route_probe

PERMISSIONS = frozenset((
    "internet-permission-unconfirmed",
    "internet-permission-not-declared",
    "internet-permission-granted",
    "internet-permission-not-granted",
))
BOOT = frozenset((
    "native-startup-unconfirmed",
    "native-cleartext-denied",
    "native-internet-permission-denied",
    "native-dns-unreachable",
    "native-connection-refused",
    "native-connection-timeout",
    "native-js-bundle-load-error",
    "native-js-runtime-error",
))
HOST_PROPERTY = frozenset((
    "metro-host-property-unconfirmed",
    "metro-host-property-unset",
    "metro-host-property-device-loopback",
    "metro-host-property-emulator-alias",
    "metro-host-property-other-redacted",
))
DEVICE_ROUTE = frozenset((
    "metro-status-reachable", "route-unconfirmed", "probe-tool-unavailable",
))
SHELL_ROUTE = frozenset((
    "shell-metro-status-reachable",
    "shell-route-unconfirmed",
    "shell-probe-unavailable",
))
REVERSE = frozenset((
    "adb-reverse-confirmed", "adb-reverse-absent", "adb-reverse-unconfirmed",
))


def classify_reverse(raw: object) -> str:
    """Inspect only the exact loopback relay mapping; never expose other routes."""
    if type(raw) is not str or len(raw) > 16384:
        return "adb-reverse-unconfirmed"
    match_count = 0
    for line in raw.splitlines():
        tokens = line.strip().split()
        if len(tokens) == 3 and tokens[1:] == [
                "tcp:8081", "tcp:18081"]:
            match_count += 1
    if match_count == 1:
        return "adb-reverse-confirmed"
    if match_count > 1:
        return "adb-reverse-unconfirmed"
    return "adb-reverse-absent"


def safe_category(value: object, allowlist: frozenset[str], fallback: str) -> str:
    return value if type(value) is str and value in allowlist else fallback


def collect_bootstrap_categories() -> tuple[str, str, str, str, str, str, str, str]:
    """No raw tool data escapes; all errors map to fixed inconclusive categories."""
    permission = "internet-permission-unconfirmed"
    boot = "native-startup-unconfirmed"
    property_status = "metro-host-property-unconfirmed"
    reverse = "adb-reverse-unconfirmed"
    loopback = "probe-tool-unavailable"
    alias = "probe-tool-unavailable"
    shell_loopback = "shell-probe-unavailable"
    shell_alias = "shell-probe-unavailable"

    try:
        permission, boot = DIAG.collect_categories()
    except Exception:
        pass
    try:
        reverse = classify_reverse(
            BASE.adb("reverse", "--list", timeout=15, check=False)
        )
    except Exception:
        pass
    try:
        property_status, loopback, alias = HOST.fixed_route_categories()
    except Exception:
        pass
    try:
        shell_loopback, shell_alias = SHELL.probe_shell_routes()
    except Exception:
        pass

    values = (
        safe_category(permission, PERMISSIONS, "internet-permission-unconfirmed"),
        safe_category(boot, BOOT, "native-startup-unconfirmed"),
        safe_category(property_status, HOST_PROPERTY,
                      "metro-host-property-unconfirmed"),
        safe_category(reverse, REVERSE, "adb-reverse-unconfirmed"),
        safe_category(loopback, DEVICE_ROUTE, "route-unconfirmed"),
        safe_category(alias, DEVICE_ROUTE, "route-unconfirmed"),
        safe_category(shell_loopback, SHELL_ROUTE, "shell-probe-unavailable"),
        safe_category(shell_alias, SHELL_ROUTE, "shell-probe-unavailable"),
    )
    return values


def passive_native_transport_triage() -> None:
    """Called once, only after external PPP/PID and first Metro category."""
    (permission, boot, host, reverse, loopback, alias,
     shell_loopback, shell_alias) = collect_bootstrap_categories()
    print("ENV (LAB): debug-internet-permission=" + permission, flush=True)
    print("ENV (LAB): debug-native-bootstrap=" + boot, flush=True)
    print("ENV (LAB): debug-metro-host=" + host, flush=True)
    print("ENV (LAB): debug-adb-reverse=" + reverse, flush=True)
    print("ENV (LAB): debug-device-loopback=" + loopback, flush=True)
    print("ENV (LAB): debug-device-alias=" + alias, flush=True)
    print("ENV (LAB): debug-shell-loopback=" + shell_loopback, flush=True)
    print("ENV (LAB): debug-shell-alias=" + shell_alias, flush=True)

    # These shell-UID probes run AFTER the relay's app-observation snapshot;
    # they cannot be mistaken for requests by the finance app.
    # No successful route/permission signal bypasses the old Home geometry gate.
    home.passive_home_census()


if __name__ == "__main__":
    try:
        if len(sys.argv) != 1:
            raise RuntimeError("Unexpected M65 arguments")
        observer.run(after_verified_observation=passive_native_transport_triage)
    except Exception:
        print("BLOCK (LAB): M65 native transport or Debug Home not attested",
              file=sys.stderr)
        raise SystemExit(1)

#!/usr/bin/env python3
"""Read-only Android 9 emulator Metro route classifier for synthetic Debug CI.

Neither HTTP responses, command errors, device properties nor request URLs are
printed, saved or uploaded. Probe only two fixed local-development destinations.
Both checks are observational and NEVER constitute product or PDF approval.
"""
from __future__ import annotations

import re
import subprocess

MAX_OUTPUT = 16_384
EMULATOR_HOST = "10.0.2.2"
DEVICE_LOOPBACK = "127.0.0.1"
PORT = 8081


def classify_property(value: str | None) -> str:
    """Observe only a fixed allowlist, never disclose an unknown configured host."""
    if value is None or len(value) > 256:
        return "metro-host-property-unconfirmed"
    host = value.strip().lower()
    if not host:
        return "metro-host-property-unset"
    if host in ("127.0.0.1", "localhost", "127.0.0.1:8081", "localhost:8081"):
        return "metro-host-property-device-loopback"
    if host in ("10.0.2.2", "10.0.2.2:8081"):
        return "metro-host-property-emulator-alias"
    return "metro-host-property-other-redacted"


def classify_probe(output: str | None, *, tool_available: bool) -> str:
    if not tool_available:
        return "probe-tool-unavailable"
    if output is None or len(output) > MAX_OUTPUT:
        return "route-unconfirmed"
    # /status is a static local Metro route. Never export response body/headers.
    if re.search(r"HTTP/1\.[01] 200\b", output) and "packager-status:running" in output:
        return "metro-status-reachable"
    return "route-unconfirmed"


def _adb(arguments: list[str], timeout: int = 15) -> str | None:
    try:
        result = subprocess.run(
            ["adb", *arguments], capture_output=True, text=True, check=False,
            timeout=timeout,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0 or len(result.stdout) > MAX_OUTPUT:
        return None
    return result.stdout


def metro_host_property() -> str:
    raw = _adb(["shell", "getprop", "metro.host"], timeout=10)
    return classify_property(raw)


def has_android_nc() -> bool:
    # Android 9 images differ in toybox builds. Absence is inconclusive.
    tools = _adb(["shell", "toybox", "--list"], timeout=10)
    return bool(tools and "nc" in tools.split())


def probe_route(host: str, *, available: bool | None = None) -> str:
    if host not in (DEVICE_LOOPBACK, EMULATOR_HOST):
        raise ValueError("only fixed emulator development hosts are allowed")
    if available is None:
        available = has_android_nc()
    if not available:
        return "probe-tool-unavailable"
    # No shell interpolation of user strings. Host/port are fixed allowlist.
    request = (
        "printf 'GET /status HTTP/1.0\\r\\nHost: localhost\\r\\n"
        "Connection: close\\r\\n\\r\\n' | "
        f"toybox nc -w 4 {host} {PORT}"
    )
    output = _adb(["shell", "sh", "-c", request], timeout=15)
    return classify_probe(output, tool_available=True)


def fixed_route_categories() -> tuple[str, str, str]:
    """One system-property category plus distinct local route observations."""
    property_category = metro_host_property()
    available = has_android_nc()
    reverse_category = probe_route(DEVICE_LOOPBACK, available=available)
    alias_category = probe_route(EMULATOR_HOST, available=available)
    return property_category, reverse_category, alias_category

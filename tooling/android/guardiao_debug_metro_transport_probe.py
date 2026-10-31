#!/usr/bin/env python3
"""Ephemeral loopback relay: fixed-category evidence that Android requested Metro.

This handles only synthetic Android Debug CI. No request URL, JavaScript,
response body, headers, IP address, exception, or financial value is logged,
written to disk, returned, or uploaded. Both sockets bind/connect to loopback.
"""
from __future__ import annotations

import re
import select
import socket
import socketserver
import threading
import time

LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = 18081
METRO_HOST = "127.0.0.1"
METRO_PORT = 8081
MAX_HEADER_SAMPLE = 2048
CHUNK_SIZE = 65536
MAX_CONNECTION_SECONDS = 240


class _PrivateServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


class _ForwardHandler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        observer = self.server.observer
        observer._connection()
        try:
            upstream = socket.create_connection((METRO_HOST, METRO_PORT), timeout=5)
        except OSError:
            return
        with upstream:
            request_head = b""
            response_head = b""
            bundle = False
            request_seen = False
            status_seen = False
            deadline = time.monotonic() + MAX_CONNECTION_SECONDS
            while time.monotonic() < deadline:
                try:
                    readable, _, _ = select.select((self.request, upstream), (), (), 5)
                    if not readable:
                        continue
                    for incoming in readable:
                        outgoing = upstream if incoming is self.request else self.request
                        piece = incoming.recv(CHUNK_SIZE)
                        if not piece:
                            return
                        if incoming is self.request and not request_seen:
                            request_head = (request_head + piece)[:MAX_HEADER_SAMPLE]
                            if b"\r\n" in request_head:
                                first_line = request_head.split(b"\r\n", 1)[0]
                                # Observe only whether the fixed JS-bundle path shape
                                # occurred, never the full request or query parameters.
                                bundle = bool(re.match(rb"^(GET|HEAD) /[^ ]*\.bundle(?:\?| )", first_line))
                                request_seen = True
                                if bundle:
                                    observer._bundle_request()
                        if incoming is upstream and bundle and not status_seen:
                            response_head = (response_head + piece)[:128]
                            if b"\r\n" in response_head:
                                first_line = response_head.split(b"\r\n", 1)[0]
                                match = re.match(rb"^HTTP/1\.[01] ([0-9]{3})(?: |$)", first_line)
                                if match:
                                    observer._bundle_response(match.group(1) == b"200")
                                status_seen = True
                        outgoing.sendall(piece)
                except (OSError, ValueError):
                    return


class PrivateMetroRelay:
    """Only aggregate flags leave this process; no raw traffic is retained."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._connections = 0
        self._bundles = 0
        self._bundle_ok = False
        self._bundle_rejected = False
        self._server = None
        self._thread = None

    def _connection(self) -> None:
        with self._lock:
            self._connections += 1

    def _bundle_request(self) -> None:
        with self._lock:
            self._bundles += 1

    def _bundle_response(self, ok: bool) -> None:
        with self._lock:
            if ok:
                self._bundle_ok = True
            else:
                self._bundle_rejected = True

    def start(self) -> None:
        if self._server is not None:
            raise RuntimeError("relay already started")
        server = _PrivateServer((LISTEN_HOST, LISTEN_PORT), _ForwardHandler)
        server.observer = self
        self._server = server
        self._thread = threading.Thread(target=server.serve_forever, daemon=True)
        self._thread.start()

    def category(self) -> str:
        with self._lock:
            if self._bundle_ok:
                return "device-debug-bundle-http-200"
            if self._bundle_rejected:
                return "device-debug-bundle-http-non200"
            if self._bundles:
                return "device-debug-bundle-response-unconfirmed"
            if self._connections:
                return "device-metro-connection-without-bundle"
            return "device-no-metro-connection-observed"

    def stop(self) -> None:
        server = self._server
        if server is None:
            return
        self._server = None
        server.shutdown()
        server.server_close()
        if self._thread is not None:
            self._thread.join(timeout=3)
        self._thread = None

#!/usr/bin/env python3
"""M81 pure classification of existing Debug XML capture exceptions.

No device calls, logging, I/O, exception messages in logs, retries or new reads.
Only recognize known command prefixes and an exact sanitized exit-status shape.
"""
from __future__ import annotations

import re
import subprocess
import xml.etree.ElementTree as ET
from xml.parsers import expat

# The parser's public error-code enumeration, never message/content/position.
_XML_ERROR_CATEGORIES = {
    expat.errors.codes[expat.errors.XML_ERROR_NO_ELEMENTS]: "snapshot-ui-xml-no-elements",
    expat.errors.codes[expat.errors.XML_ERROR_UNCLOSED_TOKEN]: "snapshot-ui-xml-unclosed-token",
    expat.errors.codes[expat.errors.XML_ERROR_INVALID_TOKEN]: "snapshot-ui-xml-invalid-token",
    expat.errors.codes[expat.errors.XML_ERROR_TAG_MISMATCH]: "snapshot-ui-xml-mismatched-tag",
    expat.errors.codes[expat.errors.XML_ERROR_JUNK_AFTER_DOC_ELEMENT]: "snapshot-ui-xml-trailing-content",
    expat.errors.codes[expat.errors.XML_ERROR_PARTIAL_CHAR]: "snapshot-ui-xml-partial-character",
}


FALLBACK = "snapshot-ui-tree-unconfirmed"


def classify(error: BaseException) -> str:
    """Return one allowed literal, never expose the exception or its data."""
    if isinstance(error, ET.ParseError):
        # Pure code lookup; do not read the error message, position or XML.
        return _XML_ERROR_CATEGORIES.get(
            getattr(error, "code", None), "snapshot-ui-xml-parse-unconfirmed"
        )

    if isinstance(error, subprocess.TimeoutExpired):
        command = error.cmd
        if type(command) in (tuple, list) and all(
            type(part) is str for part in command[:4]
        ):
            if tuple(command[:4]) == ("adb", "shell", "uiautomator", "dump"):
                return "snapshot-ui-dump-timeout"
            if tuple(command[:3]) == ("adb", "exec-out", "cat"):
                return "snapshot-ui-file-timeout"
        return FALLBACK

    if type(error) is RuntimeError and len(error.args) == 1:
        value = error.args[0]
        if type(value) is str and len(value) <= 96:
            if re.fullmatch(
                r"command failed: adb shell uiautomator \[exit code [1-9][0-9]{0,4}\]",
                value,
            ):
                return "snapshot-ui-dump-command-failed"
            if re.fullmatch(
                r"command failed: adb exec-out cat \[exit code [1-9][0-9]{0,4}\]",
                value,
            ):
                return "snapshot-ui-file-command-failed"
    return FALLBACK

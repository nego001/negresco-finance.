#!/usr/bin/env python3
"""Two three-page synthetic fixtures through the same Android PdfRenderer receiver.

No financial APK, production UI, network, PDF file, screenshots, XML or logcat.
This tests the receiver's multipage rendering, not cross-app sharing.
"""
from __future__ import annotations
import hashlib
import json
import re
import subprocess
import time
from pathlib import Path

PKG = "com.negresco.pdfreceiver.lab"
APK = Path("tooling/android/pdf-receiver-lab/app/build/outputs/apk/debug/app-debug.apk")
REPORT = Path("pdf-multipage-emulator-report.json")
AUTHORITY = "com.negresco.pdfreceiver.lab.fixtures"
ACTIVITY = PKG + "/.ReceiverActivity"


def run(*args: str, check: bool = True, timeout: int = 40) -> str:
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError("Android command failed (status " + str(result.returncode) + ")")
    return result.stdout.strip()


def adb(*args: str, check: bool = True, timeout: int = 40) -> str:
    return run("adb", *args, check=check, timeout=timeout)


def read_receipt() -> dict | None:
    raw = adb("shell", "run-as", PKG, "cat", "files/receipt.json", check=False)
    if len(raw) > 1600 or not raw.startswith("{"):
        return None
    try:
        receipt = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return receipt if isinstance(receipt, dict) else None


def receiver_cache_clean() -> bool:
    # Cannot claim clean cache when run-as or ls fails.
    listing = adb("shell", "run-as", PKG, "ls", "cache", check=True)
    return "received-" not in listing


def exercise_fixture(path: str, expect_success: bool) -> dict:
    # Fail closed on stale receipts, and do not read or publish document bytes.
    adb("shell", "run-as", PKG, "rm", "-f", "files/receipt.json")
    uri = "content://" + AUTHORITY + "/" + path
    # Do not use am start -W: that waits for the slow synchronous PDF activity
    # to finish drawing and can freeze shell invocation on old emulators.
    # The independent receipt below (never the am start exit alone) determines PASS.
    adb("shell", "am", "start", "-n", ACTIVITY,
        "-a", "android.intent.action.SEND", "-t", "application/pdf",
        "-f", "0x1", "--eu", "android.intent.extra.STREAM", uri, timeout=25)
    receipt = None
    for _ in range(30):
        receipt = read_receipt()
        if receipt is not None:
            break
        time.sleep(0.5)
    if receipt is None or receipt.get("schemaVersion") != 1 or receipt.get("syntheticOnly") is not True:
        raise RuntimeError("missing or inauthentic receiver receipt")
    if receipt.get("stableReleaseAllowed") is not False:
        raise RuntimeError("fixture unexpectedly permits production")
    if not receiver_cache_clean():
        raise RuntimeError("temporary receiver PDF remains in private cache")
    if expect_success:
        for name in ("contentUriGranted", "pdfHeaderAndEof", "renderedFirstPage",
                     "allPagesRendered"):
            if receipt.get(name) is not True:
                raise RuntimeError("multipage positive fixture missing proof")
        if receipt.get("status") != "received-rendered":
            raise RuntimeError("three-page positive fixture rejected")
        if type(receipt.get("pages")) is not int or receipt["pages"] != 3:
            raise RuntimeError("positive fixture did not contain three pages")
        if type(receipt.get("nonblankPages")) is not int or receipt["nonblankPages"] != 3:
            raise RuntimeError("positive fixture did not render three inked pages")
        size, digest = receipt.get("bytes"), receipt.get("sha256")
        if type(size) is not int or not 200 < size <= 8 * 1024 * 1024:
            raise RuntimeError("positive PDF length outside bounds")
        if not isinstance(digest, str) or re.fullmatch("[0-9a-f]{64}", digest) is None:
            raise RuntimeError("positive PDF hash missing")
        return {"renderedPages": 3, "nonblankPages": 3, "pdfSizeBytes": size,
                "pdfSha256": digest, "receiverCacheClean": True}
    if receipt.get("status") != "blocked" or receipt.get("reason") != "blank-page":
        raise RuntimeError("blank second page did not produce specific blocked receipt")
    if type(receipt.get("rejectedPageIndex")) is not int or receipt["rejectedPageIndex"] != 1:
        raise RuntimeError("blank page rejection was not at page index 1")
    if receipt.get("allPagesRendered") is True:
        raise RuntimeError("rejected fixture pretended to fully render")
    return {"blockedBlankPageIndex": 1, "receiverCacheClean": True}


def main() -> None:
    if not APK.is_file() or APK.is_symlink() or APK.stat().st_size < 2000:
        raise RuntimeError("independent receiver APK missing")
    api = int(adb("shell", "getprop", "ro.build.version.sdk"))
    if api not in (26, 28):
        raise RuntimeError("unsupported API for this isolated lab")
    adb("shell", "svc", "wifi", "disable", check=False)
    adb("shell", "svc", "data", "disable", check=False)
    adb("install", "-r", str(APK), timeout=120)
    positive = exercise_fixture("nonblank-3", True)
    negative = exercise_fixture("blank-middle-3", False)
    REPORT.write_text(json.dumps({
        "schemaVersion": 1, "scope": "ISOLATED_SYNTHETIC_PDF_THREE_PAGE_RECEIVER",
        "api": api, "financialApkInstalled": False,
        "crossAppShareValidatedHere": False, "syntheticOnly": True,
        "positive": positive, "negative": negative,
        "approvedForProduction": False, "stableReleaseAllowed": False
    }, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("PASS (LAB): Android API " + str(api) +
          " three-page PDF rendered 3/3; blank middle page rejected; cache clean")


if __name__ == "__main__":
    main()

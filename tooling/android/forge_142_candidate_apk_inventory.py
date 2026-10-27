#!/usr/bin/env python3
"""Read-only APK inventory for isolated node-forge 1.4.2 Android builds."""
import hashlib
import json
import os
from pathlib import Path
import sys
import zipfile

def block(reason):
    raise ValueError("BLOCK: forge 1.4.2 APK lab: " + reason)

def safe_bytes(filename, limit):
    p = Path(filename)
    if p.is_symlink() or not p.is_file() or p.stat().st_size > limit or p.stat().st_size < 2:
        block("missing/unsafe evidence: " + p.name)
    return p.read_bytes()

def digest(b):
    return hashlib.sha256(b).hexdigest()

def make(apk, lockfile, upstream_report, commit):
    if len(commit) != 40 or not all(c in "0123456789abcdef" for c in commit):
        block("invalid source commit")
    apk_bytes = safe_bytes(apk, 100 * 1024 * 1024)
    lock_bytes = safe_bytes(lockfile, 8 * 1024 * 1024)
    report_bytes = safe_bytes(upstream_report, 4 * 1024 * 1024)
    lock = json.loads(lock_bytes)
    upstream = json.loads(report_bytes)
    if lock.get("lockfileVersion") != 3 or lock.get("name") != "@negresco/mobile":
        block("unexpected app lockfile")
    if lock.get("packages", {}).get("node_modules/node-forge", {}).get("version") != "1.4.2":
        block("not patched node-forge 1.4.2 in APK candidate")
    if upstream.get("sourceCommit") != commit or upstream.get("approvedForProduction") is not False or \
        upstream.get("stableReleaseAllowed") is not False or \
        upstream.get("upstream", {}).get("version") != "1.4.2" or \
        upstream.get("candidate", {}).get("lockSha256") != digest(lock_bytes):
        block("candidate does not match independent forge provenance")
    with zipfile.ZipFile(apk) as z:
        names = z.namelist()
        if len(names) != len(set(names)) or any(n.startswith("/") or ".." in Path(n).parts for n in names):
            block("duplicate or unsafe APK members")
        if z.testzip() is not None:
            block("corrupted APK member")
        so_count = sum(n.endswith(".so") for n in names)
        dex_count = sum(n.endswith(".dex") for n in names)
        if so_count != 56 or dex_count != 3:
            block("unexpected packaged native or DEX binaries")
        try:
            hermes = z.read("assets/index.android.bundle")
        except KeyError:
            block("missing Hermes payload")
        if len(hermes) < 32 or hermes[:4] != bytes.fromhex("c61fbc03"):
            block("non-Hermes or truncated JS payload")
    return {
        "schemaVersion": 1,
        "sourceCommit": commit,
        "scope": "UNREVIEWED DEBUG_SIGNED_ANDROID_APK_WITH_PREVIEW_OTA",
        "approvedForProduction": False,
        "stableReleaseAllowed": False,
        "apkSha256": digest(apk_bytes),
        "apkSize": len(apk_bytes),
        "apkEntryCount": len(names),
        "sharedLibraries": so_count,
        "dexFiles": dex_count,
        "hermesSha256": digest(hermes),
        "hermesSize": len(hermes),
        "lockSha256": digest(lock_bytes),
        "forgeUpstreamProofSha256": digest(report_bytes),
        "warning": "Expo preview OTA is enabled; not embedded-only and not for financial distribution",
    }

def canonical(v):
    return (json.dumps(v, indent=2, ensure_ascii=False) + "\n").encode("utf8")

def run(args):
    if len(args) != 6 or args[0] not in ("capture", "verify"):
        block("usage: capture|verify APK LOCK FORGE_PROOF COMMIT REPORT")
    mode, apk, lock, upstream, commit, output = args
    data = canonical(make(apk, lock, upstream, commit))
    if mode == "capture":
        if Path(output).exists():
            block("refuse overwriting report")
        with open(output, "xb") as f:
            f.write(data)
        print("PASS (LAB): debug APK, Hermes, npm lock and forge proof bound by SHA-256")
    else:
        if safe_bytes(output, 1024 * 1024) != data:
            block("downloaded APK inventory disagrees with bytes")
        print("PASS (LAB): independent APK/Hermes inventory identical to downloaded evidence")

if __name__ == "__main__":
    try:
        run(sys.argv[1:])
    except (ValueError, OSError, zipfile.BadZipFile, KeyError, json.JSONDecodeError) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)

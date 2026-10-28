#!/usr/bin/env python3
"""P0 LAB: inspect the actual PDF shared by the SHA-pinned Negresco Android APK.

Only the fixed synthetic 47-zero input is ever entered. A private one-shot
marker lets the independently built debuggable receiver expose a transient
PDF to ADB run-as. The runner extracts text without uploading its bytes.
This is not a bank validation or a production/release test.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

import guardiao_pdf_ui_emulator_smoke as base

PKG = base.RECEIVER_PACKAGE
MARKER = "files/allow-synthetic-text-check-once"
CAPTURE = "files/captured-synthetic-report.pdf"
REPORT = Path("guardiao-android-real-pdf-text-receipt.json")
EXPECTED = (
    "Relatório de evidências",
    "Verificação local",
    "Dígitos inconsistentes ou formato inválido",
    "Consulta de cadastro empresarial",
    "Fontes externas consultadas: 0",
    "Nenhuma consulta externa de CNPJ incluída neste relatório.",
    "O que continua desconhecido",
    "Beneficiário: não identificado no banco",
    "Emissor: não identificado no banco",
    "Registro bancário: não consultado",
    "Legitimidade da cobrança: inconclusiva.",
    "Nenhuma operação de pagamento foi realizada.",
)
FORBIDDEN = (
    "Autenticidade confirmada",
    "Pagamento autorizado",
    "Boleto legítimo",
    "0" * 47,
    "00000000000000",
)


def normalize(s: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", s).split()).casefold()


def tool(args: list[str], *, timeout: int = 45, binary: bool = False):
    result = subprocess.run(args, capture_output=True, timeout=timeout, check=False)
    if result.returncode:
        # Never log native stderr/stdout, PDF bytes, or extracted text.
        raise RuntimeError("bounded local fixture tool failed")
    return result.stdout if binary else result.stdout.decode("utf-8", errors="replace")


def names() -> str:
    return base.adb("shell", "run-as", PKG, "ls", "files", timeout=15)


def ensure_absent() -> None:
    listing = names()
    if "allow-synthetic-text-check-once" in listing or "captured-synthetic-report.pdf" in listing:
        raise RuntimeError("private synthetic capture remains; BLOCK")


def prepare_private_one_shot() -> None:
    # This runs only AFTER the independently compiled receiver was installed.
    # Fresh emulator expected; refuse to reuse a prior synthetic snapshot.
    ensure_absent()
    base.adb("shell", "run-as", PKG, "touch", MARKER)
    if "allow-synthetic-text-check-once" not in names():
        raise RuntimeError("private capture gate could not be confirmed")


def remove_private_capture() -> None:
    # The private receiver is disposable and only ever sees synthetic input.
    base.adb("shell", "run-as", PKG, "rm", "-f", CAPTURE, MARKER)
    ensure_absent()


observed = None


def inspect_real_android_pdf(receipt: dict) -> None:
    global observed
    if observed is not None or receipt.get("syntheticTextCapture") is not True:
        raise RuntimeError("receiver did not consume the one-shot private PDF gate")
    if base.FIXTURE != "0" * 47:
        raise RuntimeError("non-synthetic financial input would be unsafe")
    captured = False
    try:
        raw = tool(["adb", "exec-out", "run-as", PKG, "cat", CAPTURE],
                   timeout=30, binary=True)
        captured = True
        if not (200 < len(raw) <= 8 * 1024 * 1024) or not raw.startswith(b"%PDF-") or b"%%EOF" not in raw[-2048:]:
            raise RuntimeError("captured Android document is not a bounded PDF")
        digest = hashlib.sha256(raw).hexdigest()
        if digest != receipt.get("sha256") or len(raw) != receipt.get("bytes"):
            raise RuntimeError("captured bytes differ from independent receiver receipt")
        if not shutil.which("pdftotext") or not shutil.which("pdfinfo"):
            raise RuntimeError("required offline PDF extraction tools are missing")

        with tempfile.TemporaryDirectory(prefix="negresco-android-pdf-synthetic-") as dirname:
            document = Path(dirname) / "synthetic.pdf"
            descriptor = os.open(str(document), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            try:
                with os.fdopen(descriptor, "wb") as stream:
                    stream.write(raw)
            except Exception:
                document.unlink(missing_ok=True)
                raise
            raw = b""  # No duplicate copy retained beyond the bounded local test.
            info = tool(["pdfinfo", str(document)])
            match = re.search(r"^Pages:\s*(\d+)\s*$", info, re.M)
            if match is None:
                raise RuntimeError("native Android PDF page count unavailable")
            pages = int(match.group(1))
            if pages != receipt.get("pages") or not 1 <= pages <= 8:
                raise RuntimeError("received PDF page count differs from independent renderer")
            text_pages = []
            for i in range(1, pages + 1):
                text = normalize(tool(["pdftotext", "-f", str(i), "-l", str(i),
                                       "-enc", "UTF-8", "-layout", str(document), "-"]))
                if len(text) < 20:
                    raise RuntimeError("native PDF has a blank or unextractable page")
                text_pages.append(text)
            actual = " ".join(text_pages)
            for expected in EXPECTED:
                if normalize(expected) not in actual:
                    raise RuntimeError("native PDF fails required synthetic semantic assertion")
            for forbidden in FORBIDDEN:
                if normalize(forbidden) in actual:
                    raise RuntimeError("native PDF leaks fixture or falsely authenticates a charge")
            observed = {
                "nativePdfSemanticTextVerified": True, "textPagesVerified": pages,
                "pdfPages": pages, "receivedPdfSha256": digest,
                "privateCaptureDeleted": True,
            }
    finally:
        # Mandatory regardless of output or extraction failure.
        # If it fails, the workflow cannot report a PASS.
        remove_private_capture()


def run_lab() -> None:
    global observed
    if not REPORT.parent.samefile(Path(".")):
        raise RuntimeError("report must be inside isolated CI workspace")
    if REPORT.exists():
        raise RuntimeError("stale synthetic semantic receipt")
    base.REPORT = REPORT
    try:
        base.run_smoke(after_receiver_install=prepare_private_one_shot,
                       after_verified_receipt=inspect_real_android_pdf)
        if observed is None:
            raise RuntimeError("semantic PDF hook never completed")
        baseline = json.loads(REPORT.read_text(encoding="utf-8"))
        if baseline.get("syntheticInput") is not True or baseline.get("stableReleaseAllowed") is not False:
            raise RuntimeError("base receiver evidence not consistent")
        baseline.update(observed)
        baseline.update({
            "scope": "SHA_PINNED_ANDROID_APP_SYNTHETIC_PDF_TEXT",
            "chromeReferenceUsed": False,
            "realAndroidApkPdf": True, "sourceFixture": "synthetic-47-zero-invalid",
            "approvedForProduction": False, "stableReleaseAllowed": False,
        })
        # Assert zero content remains even if a hidden lifecycle branch was taken.
        ensure_absent()
        REPORT.write_text(json.dumps(baseline, indent=2, sort_keys=True) + "\n",
                          encoding="utf-8")
        print("PASS (LAB): Android app PDF semantics verified with synthetic input, cache and capture cleared")
    finally:
        # Also handle a failure before the native chooser, such as UI timeout.
        try:
            remove_private_capture()
        except (RuntimeError, subprocess.TimeoutExpired):
            if observed is not None:
                raise RuntimeError("failed final cleanup of private synthetic capture")


if __name__ == "__main__":
    try:
        run_lab()
    except Exception:
        # Fixed category only. No URI, UI dump, PDF, exception, or extracted text.
        print("BLOCK (LAB): Android synthetic PDF text proof incomplete", file=sys.stderr)
        raise SystemExit(1)

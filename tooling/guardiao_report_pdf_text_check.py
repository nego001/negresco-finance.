#!/usr/bin/env python3
"""LAB ONLY: verify visible text of synthetic HTML rendered to PDF by headless Chrome.

Not Android Expo Print. No PDF, HTML, extracted text or image is uploaded/logged.
Only fixed-status metadata is written outside the private temporary directory.
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

NAMES = ("invalid", "consistent", "registry", "unavailable")
BASE_REQUIRED = (
    "Relatório de evidências",
    "Verificação local",
    "Consulta de cadastro empresarial",
    "O que continua desconhecido",
    "Beneficiário: não identificado no banco",
    "Emissor: não identificado no banco",
    "Legitimidade da cobrança: inconclusiva.",
    "Confira os dados no aplicativo oficial do banco antes de pagar.",
    "Nenhuma operação de pagamento foi realizada.",
)
SCENARIOS = {
    "invalid": (
        ("Dígitos inconsistentes ou formato inválido", "Fontes externas consultadas: 0",
         "Nenhuma consulta externa de CNPJ incluída"),
        ("Dígitos consistentes", "LABORATORIO FICTICIO LTDA"),
    ),
    "consistent": (
        ("Dígitos consistentes", "Fontes externas consultadas: 0"),
        ("Dígitos inconsistentes ou formato inválido", "LABORATORIO FICTICIO LTDA"),
    ),
    "registry": (
        ("Dígitos consistentes", "Fontes externas consultadas: 1",
         "BrasilAPI (terceiros): Cadastro encontrado",
         "LABORATORIO FICTICIO LTDA", "Consulta independente"),
        ("Cadastro não encontrado nesta fonte",),
    ),
    "unavailable": (
        ("Dígitos inconsistentes ou formato inválido", "Fontes externas consultadas: 0",
         "Consulta não concluída", "CONSULTA FICTICIA INDISPONIVEL"),
        ("Dígitos consistentes", "Cadastro encontrado"),
    ),
}


def execute(args: list[str], timeout: int = 90) -> str:
    proc = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          text=True, timeout=timeout, check=False)
    if proc.returncode != 0:
        # Intentionally withhold native logs, URLs, HTML and document content.
        raise RuntimeError("required local PDF tool failed (code " + str(proc.returncode) + ")")
    return proc.stdout


def normalize(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split()).casefold()


def inspect_pdf(chrome: str, workspace: Path, name: str) -> dict:
    html = workspace / ("report-" + name + ".html")
    pdf = workspace / ("rendered-" + name + ".pdf")
    if not html.is_file() or html.is_symlink() or pdf.exists():
        raise RuntimeError("untrusted or missing synthetic input")
    source = html.read_text(encoding="utf-8")
    if len(source) > 120_000 or any(token in source for token in (
        "0" * 47, "00000000000000")) or re.search(
            r"<\s*(script|iframe|img|link|form|base)\b|https?://", source, re.I):
        raise RuntimeError("synthetic HTML violates privacy or offline contract")

    profile = workspace / ("chrome-" + name)
    command = [
        chrome, "--headless", "--no-sandbox", "--disable-gpu",
        "--disable-background-networking", "--disable-sync", "--disable-extensions",
        "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
        "--no-pdf-header-footer",
        "--user-data-dir=" + str(profile),
        "--print-to-pdf=" + str(pdf),
        html.resolve().as_uri(),
    ]
    execute(command, timeout=120)
    if not pdf.is_file() or pdf.is_symlink():
        raise RuntimeError("Chrome produced no PDF")
    size = pdf.stat().st_size
    if not (300 < size <= 2 * 1024 * 1024):
        raise RuntimeError("synthetic PDF has unexpected size")
    data = pdf.read_bytes()
    if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-2048:]:
        raise RuntimeError("PDF integrity boundaries failed")

    info = execute(["pdfinfo", str(pdf)])
    match = re.search(r"^Pages:\s*(\d+)\s*$", info, flags=re.MULTILINE)
    if not match:
        raise RuntimeError("unable to confirm PDF page count")
    pages = int(match.group(1))
    if not 1 <= pages <= 8:
        raise RuntimeError("PDF pages outside reasonable lab bound")

    text = normalize(execute(["pdftotext", "-enc", "UTF-8", "-layout", str(pdf), "-"]))
    if len(text) < 250 or len(text) > 30_000:
        raise RuntimeError("PDF text unreadable or oversized")
    required, forbidden = SCENARIOS[name]
    for phrase in (*BASE_REQUIRED, *required):
        if normalize(phrase) not in text:
            raise RuntimeError("PDF text missing one required semantic assertion")
    for phrase in (*forbidden, "0" * 47, "00000000000000",
                   "Autenticidade confirmada", "Pagamento autorizado",
                   "Boleto legítimo"):
        if normalize(phrase) in text:
            raise RuntimeError("PDF text contains forbidden assertion or private fixture")
    return {
        "case": name, "result": "pass", "pages": pages, "bytes": size,
        "sha256": hashlib.sha256(data).hexdigest(),
        "documentRetained": False,
    }


def main() -> None:
    if len(sys.argv) != 3:
        raise RuntimeError("usage: synthetic_workspace metadata_output")
    workspace = Path(sys.argv[1]).resolve(strict=True)
    output = Path(sys.argv[2]).resolve()
    if workspace.is_symlink() or not workspace.is_dir() or output.is_relative_to(workspace):
        raise RuntimeError("workspace or report path is unsafe")
    chrome = shutil.which("google-chrome") or shutil.which("google-chrome-stable") or shutil.which("chromium")
    if not chrome or not shutil.which("pdfinfo") or not shutil.which("pdftotext"):
        raise RuntimeError("browser or poppler tools missing; do not fake PASS")
    results = [inspect_pdf(chrome, workspace, name) for name in NAMES]
    output.write_text(json.dumps({
        "schemaVersion": 1, "scope": "SYNTHETIC_REPORT_HTML_CHROME_PDF_TEXT_LAB",
        "renderer": "headless-chrome-not-expo-print", "financialApkInstalled": False,
        "source": "apps/mobile/guardiao/report.ts",
        "semanticCheckPassed": all(x["result"] == "pass" for x in results),
        "cases": results,
        "approvedForProduction": False, "stableReleaseAllowed": False,
    }, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print("PASS (LAB): 4 synthetic report PDFs contain required cautionary text; no financial APK")


if __name__ == "__main__":
    main()

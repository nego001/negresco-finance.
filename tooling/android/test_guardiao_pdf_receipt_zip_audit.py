"""Negative tests for the offline Guardiao metadata ZIP verifier (all synthetic)."""
import importlib.util
import json
import stat
import tempfile
import unittest
import zipfile
from pathlib import Path

AUDITOR = Path(__file__).with_name("audit_guardiao_pdf_receipt_zip.py")
spec = importlib.util.spec_from_file_location("guardiao_zip_audit", AUDITOR)
auditor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(auditor)


def fixture():
    data = {key: True for key in auditor.TRUE_FLAGS}
    data.update({key: False for key in auditor.FALSE_FLAGS})
    data.update({key: 1 for key in auditor.COUNTERS})
    data.update({
        "api": 28, "apkSha256": auditor.APK_SHA, "pdfSizeBytes": 39268,
        "receivedPdfSha256": "a" * 64, "schemaVersion": 2,
        "scope": auditor.SCOPE, "sourceFixture": auditor.FIXTURE,
    })
    return data


class ReceiptAuditTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(prefix="guardiao-synthetic-audit-")
        self.path = Path(self.folder.name) / "fixture.zip"

    def tearDown(self):
        self.folder.cleanup()

    def write_archive(self, value=None, *, extras=None, name=None):
        with zipfile.ZipFile(self.path, "w", compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr(name or auditor.ENTRY, json.dumps(fixture() if value is None else value))
            for filename, content in (extras or {}).items():
                z.writestr(filename, content)

    def test_valid_fixture_structure(self):
        self.write_archive()
        auditor.verify(self.path, 28)

    def test_rejects_different_api(self):
        self.write_archive()
        with self.assertRaises(auditor.InvalidReceipt):
            auditor.verify(self.path, 26)

    def test_rejects_extra_pdf(self):
        self.write_archive(extras={"report.pdf": "%PDF fake"})
        with self.assertRaises(auditor.InvalidReceipt):
            auditor.verify(self.path, 28)

    def test_rejects_unknown_field_leaking_content(self):
        data = fixture()
        data["privatePdfText"] = "synthetic placeholder"
        self.write_archive(data)
        with self.assertRaises(auditor.InvalidReceipt):
            auditor.verify(self.path, 28)

    def test_rejects_false_release_gate(self):
        data = fixture()
        data["approvedForProduction"] = True
        self.write_archive(data)
        with self.assertRaises(auditor.InvalidReceipt):
            auditor.verify(self.path, 28)

    def test_rejects_wrong_digest(self):
        data = fixture()
        data["receivedPdfSha256"] = "bad"
        self.write_archive(data)
        with self.assertRaises(auditor.InvalidReceipt):
            auditor.verify(self.path, 28)

    def test_rejects_bool_as_page_count(self):
        data = fixture()
        data["pdfPages"] = True
        self.write_archive(data)
        with self.assertRaises(auditor.InvalidReceipt):
            auditor.verify(self.path, 28)

    def test_rejects_duplicate_json_fields(self):
        payload = json.dumps(fixture())
        payload = payload[:-1] + ', "api": 28}'
        with zipfile.ZipFile(self.path, "w", compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr(auditor.ENTRY, payload)
        with self.assertRaises(auditor.InvalidReceipt):
            auditor.verify(self.path, 28)

    def test_rejects_zip_symlink_entry(self):
        link = zipfile.ZipInfo(auditor.ENTRY)
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        with zipfile.ZipFile(self.path, "w") as z:
            z.writestr(link, json.dumps(fixture()))
        with self.assertRaises(auditor.InvalidReceipt):
            auditor.verify(self.path, 28)

    def test_rejects_invalid_zip(self):
        self.path.write_bytes(b"not-a-ZIP")
        with self.assertRaises(zipfile.BadZipFile):
            auditor.verify(self.path, 28)


if __name__ == "__main__":
    unittest.main()

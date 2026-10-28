"""Synthetic-only adversarial checks. No PDF, payment input or app required."""
from __future__ import annotations

import unittest

from guardiao_pdf_synthetic_privacy_gate import contains_formatted_synthetic_fixture as leaked


class SyntheticFormattedLeakGateTests(unittest.TestCase):
    def test_contiguous_47_zero_boleto_fixture_is_rejected(self):
        self.assertTrue(leaked("0" * 47))

    def test_48_digit_collection_fixture_is_rejected(self):
        self.assertTrue(leaked("8" + "0" * 47))

    def test_formatted_48_digit_collection_fixture_is_rejected(self):
        self.assertTrue(leaked("8." + ".".join("0" for _ in range(47))))

    def test_multiline_whitespace_split_47_digits_is_rejected(self):
        self.assertTrue(leaked("\n  ".join("0" for _ in range(47))))

    def test_unicode_compatibility_digits_are_rejected(self):
        self.assertTrue(leaked("\uff18" + "\uff10\u200b" * 47))

    def test_page_boundary_split_does_not_hide_full_fixture(self):
        self.assertTrue(leaked("0" * 23 + " \n " + "0" * 24))

    def test_nonfixture_counts_and_redacted_suffix_remain_allowed(self):
        self.assertFalse(leaked("ARRECADAÇÃO | Quantidade de dígitos: 48 | Fontes externas consultadas: 0 | Final: 0000"))

    def test_insufficient_zeros_do_not_trigger(self):
        self.assertFalse(leaked("8." + ".".join("0" for _ in range(46))))

    def test_letters_interrupt_a_split_numeric_sequence(self):
        self.assertFalse(leaked("0" * 30 + " texto de aviso " + "0" * 30))

    def test_digits_from_unrelated_fields_do_not_join_through_letters(self):
        self.assertFalse(leaked("0" * 25 + " Fontes: 0. " + "0" * 22))


if __name__ == "__main__":
    unittest.main()

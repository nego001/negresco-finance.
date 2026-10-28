"""Offline guard for formatted copies of the two fixed invalid lab inputs.

No real boleto, bank credential, network call or external document is accepted.
The helper only recognizes runs of 47 zero digits even when visual PDF
extraction inserts separators, line breaks or Unicode compatibility glyphs.
"""
from __future__ import annotations

import unicodedata

_ZEROS = "0" * 47
_ALLOWED_SEPARATORS = frozenset("./-:|·\u200b\u200c\u200d\u2060")


def contains_formatted_synthetic_fixture(text: str) -> bool:
    """Reject a full fixed 47/48-digit zero-based lab input in extracted text.

    Uses a bounded 47-digit rolling window, not regex over untrusted PDF text.
    Only ASCII digits matter after Unicode NFKC normalization. Labels/letters
    reset the sequence, while punctuation and whitespace preserve it.
    """
    digits = ""
    for char in unicodedata.normalize("NFKC", text):
        if "0" <= char <= "9":
            digits = (digits + char)[-47:]
            if digits == _ZEROS:
                return True
        elif char.isspace() or char in _ALLOWED_SEPARATORS:
            continue
        else:
            digits = ""
    return False

#!/usr/bin/env python3
"""M71 staging: pure categorical last-verified-checkpoint ledger.

Not an Android runner. No device access, I/O, logs, UI text, coordinates,
payment operations, PDF, retry, navigation or input capabilities. A checkpoint
records ONLY that a guarded command returned, never actual touch delivery.
"""
from __future__ import annotations

CHECKPOINTS: tuple[str, ...] = (
    "preflight-pending",
    "home-attested",
    "pix-candidate-attested",
    "pix-input-command-returned",
    "pix-preview-content-attested",
    "home-candidate-attested",
    "home-input-command-returned",
    "home-return-content-attested",
    "sequence-complete",
)


class StageLedger:
    """A strict single-shot, forward-only state machine, with fixed outputs."""

    def __init__(self) -> None:
        self._index = 0

    @property
    def category(self) -> str:
        return CHECKPOINTS[self._index]

    def advance(self, category: str) -> None:
        """Only the immediately next predefined checkpoint is accepted."""
        if (type(category) is not str or self._index + 1 >= len(CHECKPOINTS)
                or category != CHECKPOINTS[self._index + 1]):
            raise RuntimeError("invalid navigation lab checkpoint")
        self._index += 1

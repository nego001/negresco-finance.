"""M119: exact M117 functional candidate, disposable dependency resolution."""
import os
import sys
import guardiao_integration_candidate_m117 as m117
LAB_REF = "refs/heads/lab/p01-guardiao-locked-dependencies-m119-v1"

def scope():
    return os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("GITHUB_REF") == LAB_REF

def apply():
    if not scope():
        raise RuntimeError("M119 scope unconfirmed")
    old = m117.LAB_REF
    try:
        m117.LAB_REF = LAB_REF
        m117.apply()
    finally:
        m117.LAB_REF = old

if __name__ == "__main__":
    try:
        if sys.argv != [sys.argv[0], "apply"]:
            raise RuntimeError("unexpected arguments")
        apply()
        print("PASS (LAB): M119 exact M117 candidate for dependency lock")
    except Exception:
        print("BLOCK (LAB): M119 scope or candidate unconfirmed", file=sys.stderr)
        raise SystemExit(1)

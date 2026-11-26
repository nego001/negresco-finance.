"""M158: passive, bounded pre-return geometry observations, no input actions."""
import time
import subprocess
import xml.etree.ElementTree as ET
import guardiao_candidate_release_root_v4_api28_pdf_lab as candidate
import guardiao_candidate_release_v4_scoped_triplet_api28_lab as geometry
import guardiao_original_release_same_process_lab as home

BASE = candidate.BASE
CATEGORIES = frozenset((
    geometry.PASS, "invalid-input", "home-not-bounded", "package-unconfirmed",
    "malformed-node", "label-bounds-unconfirmed", "label-bounds-invalid",
    "bottom-label-not-unique", "parent-not-eligible", "parent-bounds-unconfirmed",
    "label-not-in-parent", "clickable-parent-not-unique", "parent-center-overlapped",
    "duplicate-parent", "horizontal-overlap-or-order", "rows-not-aligned",
    "snapshot-unavailable",
))

def observe():
    try:
        w,h = BASE.screen_size()
        return geometry.scoped_triplet_category(BASE.xml_nodes(),w,h)
    except (RuntimeError, ET.ParseError, subprocess.TimeoutExpired):
        return "snapshot-unavailable"

def require_ready(pid, observe_fn=observe, pid_fn=home.observed_single_app_pid,
                  environment_fn=BASE.safe_environment_summary, pause=time.sleep):
    if not pid:
        raise RuntimeError("missing expected PID")
    consecutive=0
    for _ in range(5):
        if pid_fn()!=pid:
            raise RuntimeError("pre-return PID changed")
        environment=environment_fn()
        if environment.get("appProcessAlive") is not True or environment.get("foregroundCategory")!="negresco-app":
            raise RuntimeError("pre-return app foreground unconfirmed")
        category=observe_fn()
        if category not in CATEGORIES:
            raise RuntimeError("unknown geometry category")
        if pid_fn()!=pid:
            raise RuntimeError("pre-return PID changed during snapshot")
        print("ENV (LAB): M158 pre-return geometry="+category,flush=True)
        consecutive=consecutive+1 if category==geometry.PASS else 0
        if consecutive==2:
            print("PASS (LAB): M158 two consecutive passive pre-return snapshots",flush=True)
            return
        pause(.5)
    raise RuntimeError("pre-return geometry not twice confirmed")

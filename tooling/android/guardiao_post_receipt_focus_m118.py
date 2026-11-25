"""M118: bounded foreground recovery after verified synthetic receipt."""
import os
from pathlib import Path
import sys
import guardiao_integration_candidate_m117 as m117
import guardiao_original_release_same_process_lab as identity

LAB_REF = "refs/heads/lab/p01-guardiao-post-receipt-focus-m118-v1"
METRO = Path("tooling/android/guardiao_pdf_debug_metro_lab.py")
TWO = Path("tooling/android/guardiao_debug_pdf_two_same_pid_lab.py")

def scope():
    return os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("GITHUB_REF") == LAB_REF

def exact(source, before, after):
    if source.count(before) != 1:
        raise RuntimeError("M118 exact anchor unconfirmed")
    return source.replace(before, after, 1)

def metro_transform(source):
    start = source.index("def collect_persistent_visual_share_marker() -> bool:")
    end = source.index("def valid_debug_api_for_target", start)
    original = source[start:end]
    if "Debug after receiver Back" not in original or "for _ in range(2):" not in original:
        raise RuntimeError("M118 collector control unconfirmed")
    source = exact(source, original, """def collect_persistent_visual_share_marker() -> bool:
    from guardiao_post_receipt_focus_m118 import recover_exact_share
    return recover_exact_share(base, exact_visual_share_marker)


""")
    start = source.index("        if not observed:\n            # After actual receiver proof")
    end = source.index("        if not observed:\n            raise RuntimeError", start + 1)
    return exact(source, source[start:end], """        # Require final exact visual proof even when transient phase observed.
        try:
            confirmed = collect_persistent_visual_share_marker()
        except (RuntimeError, subprocess.TimeoutExpired):
            confirmed = False
        print("ENV (LAB): Debug persistent visual share marker " +
              ("visual-share-exact-confirmed" if confirmed
               else "visual-share-unconfirmed"), flush=True)
        if not confirmed:
            raise RuntimeError("M118 final exact share marker unconfirmed")
        observed.add("lab-share-entered-after-receipt")
""")

def two_transform(source):
    return exact(source, "        debug.run()\n        if receipts_verified != len(CYCLES):", """        def final_home():
            require_pid(baseline_pid)
            nav.navigate_after_verified_pdf(baseline_pid)
            require_pid(baseline_pid)
            from guardiao_post_receipt_focus_m118 import focus_category
            if focus_category(debug.base) != "app":
                raise RuntimeError("M118 final Home focus unconfirmed")
            print("PASS (LAB): M118 final guarded Home in unchanged PID", flush=True)

        debug.run(after_verified_debug_pdf=final_home)
        if receipts_verified != len(CYCLES):""")

def apply():
    if not scope() or any(not p.is_file() or p.is_symlink() for p in (METRO,TWO)):
        raise RuntimeError("M118 scope unconfirmed")
    outputs = [(METRO, metro_transform(METRO.read_text(encoding="utf-8"))),
               (TWO, two_transform(TWO.read_text(encoding="utf-8")))]
    old = m117.LAB_REF
    try:
        m117.LAB_REF = LAB_REF
        m117.apply()
    finally:
        m117.LAB_REF = old
    for p, content in outputs:
        p.write_text(content,encoding="utf-8")
        if p.read_text(encoding="utf-8") != content:
            raise RuntimeError("M118 temporary source unconfirmed")

def classify_focus(raw, app, receiver):
    a = identity.safe_window_focus_category(raw, app)
    r = identity.safe_window_focus_category(raw, receiver)
    if a == "window-focus-app" and r != "window-focus-app":
        return "app"
    if r == "window-focus-app" and a != "window-focus-app":
        return "receiver"
    if a == r == "window-focus-chooser":
        return "chooser"
    return "unconfirmed"

def focus_category(base):
    try:
        return classify_focus(base.adb("shell","dumpsys","window","windows",timeout=15,check=False),
                              base.PACKAGE,base.RECEIVER_PACKAGE)
    except Exception:
        return "unconfirmed"

def recover_exact_share(base, exact_marker):
    if not scope():
        return False
    pid = identity.observed_single_app_pid()
    if not pid:
        return False
    def stable_app():
        return identity.observed_single_app_pid() == pid and focus_category(base) == "app"
    try:
        initial = focus_category(base)
        print("ENV (LAB): m118-initial-focus="+initial,flush=True)
        if initial in ("receiver","chooser"):
            if identity.observed_single_app_pid() != pid or focus_category(base) != initial:
                return False
            result = base.adb("shell","monkey","-p",base.PACKAGE,"-c",
                              "android.intent.category.LAUNCHER","1",timeout=30)
            if "Events injected: 1" not in result:
                return False
        elif initial != "app":
            return False
        if not stable_app():
            return False
        for movement in (base.scroll_forward_precise,base.scroll_backward):
            for step in range(8):
                if not stable_app():
                    return False
                nodes = base.xml_nodes()
                if not stable_app():
                    return False
                owned = [n for n in nodes if n.get("package") == base.PACKAGE]
                if exact_marker(owned):
                    print("PASS (LAB): M118 exact app-owned share marker in unchanged PID",flush=True)
                    return True
                if step < 7:
                    if not stable_app():
                        return False
                    movement()
    except Exception:
        return False
    return False

if __name__ == "__main__":
    try:
        if sys.argv != [sys.argv[0],"apply"]:
            raise RuntimeError("unexpected arguments")
        apply()
        print("PASS (LAB): M118 exact M117 candidate and guarded final screen gate",flush=True)
    except Exception:
        print("BLOCK (LAB): M118 scoped recovery unconfirmed",file=sys.stderr)
        raise SystemExit(1)

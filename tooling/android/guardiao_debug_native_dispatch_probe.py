#!/usr/bin/env python3
"""Debug-only activity-level input dispatch evidence for a disposable Expo prebuild.

No production source, native XML, APK Release, user data, coordinates, events or
paths are printed. The generated Activity records one fixed category in private
app storage, readable only from the disposable debuggable app with run-as.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

MARKER = "NEGRESCO_LAB_NATIVE_ACTIVITY_DISPATCH_V1"
FILE = "negresco_lab_activity_dispatch_category"
SCROLL_FILE = "negresco_lab_native_scroll_coverage"
SCROLL_ALLOWED = frozenset(("scroll-ready","scroll-hit","scroll-clear","scroll-unconfirmed"))
ALLOWED = frozenset((
    "activity-ready",
    "activity-down",
    "activity-down-consumed",
    "activity-down-unconsumed",
    "activity-down-consumed-rn-hit",
    "activity-down-consumed-rn-miss",
    "activity-down-consumed-rn-unconfirmed",
    "activity-down-unconsumed-rn-hit",
    "activity-down-unconsumed-rn-miss",
    "activity-down-unconsumed-rn-unconfirmed",
))

KOTLIN = r'''
  // NEGRESCO_LAB_NATIVE_ACTIVITY_DISPATCH_V1: Debug-only, fixed codes.
  private fun negrescoLabSetDispatchCategory(category: String) {
    if (!BuildConfig.DEBUG) return
    try {
      openFileOutput("negresco_lab_activity_dispatch_category", android.content.Context.MODE_PRIVATE).use {
        it.write(category.toByteArray(Charsets.US_ASCII))
      }
    } catch (_: Exception) {
      // Never log private app state, paths, exceptions or input details.
    }
  }

  private fun negrescoLabSetScrollCategory(category: String) {
    if (!BuildConfig.DEBUG) return
    try {
      openFileOutput("negresco_lab_native_scroll_coverage", android.content.Context.MODE_PRIVATE).use {
        it.write(category.toByteArray(Charsets.US_ASCII))
      }
    } catch (_: Exception) {
      // No logs or raw native geometry leave app private storage.
    }
  }

  override fun onResume() {
    super.onResume()
    negrescoLabSetDispatchCategory("activity-ready")
    negrescoLabSetScrollCategory("scroll-ready")
  }


  // Read-only native geometric check. Neither event coordinates nor view
  // structure are retained or emitted. Do not infer actual JS delivery.
  private fun negrescoLabReactRootHitCategory(event: android.view.MotionEvent): String {
    if (!BuildConfig.DEBUG) return "rn-unconfirmed"
    return try {
      val px = event.getRawX()
      val py = event.getRawY()
      if (!px.isFinite() || !py.isFinite()) return "rn-unconfirmed"
      val pending = java.util.ArrayDeque<android.view.View>()
      pending.add(window.decorView)
      var visited = 0
      var matches = 0
      var hit = false
      while (!pending.isEmpty() && visited < 2048) {
        val node = pending.removeFirst()
        visited += 1
        if (!node.isShown) continue
        val cls = node.javaClass.name
        if (cls == "com.facebook.react.ReactRootView"
            || cls.endsWith(".ReactSurfaceView")) {
          matches += 1
          if (node.width <= 0 || node.height <= 0) return "rn-unconfirmed"
          val position = IntArray(2)
          node.getLocationOnScreen(position)
          hit = (px >= position[0] && py >= position[1]
              && px < position[0] + node.width
              && py < position[1] + node.height)
        }
        if (node is android.view.ViewGroup) {
          for (i in 0 until node.childCount) pending.add(node.getChildAt(i))
        }
      }
      if (visited >= 2048 || matches != 1) "rn-unconfirmed"
      else if (hit) "rn-hit" else "rn-miss"
    } catch (_: Exception) {
      "rn-unconfirmed"
    }
  }

  // Passive overlap probe: a visible ReactScrollView under the same raw
  // screen point is geometric context, NOT proof of interception/dispatch.
  private fun negrescoLabScrollCoverage(event: android.view.MotionEvent): String {
    if (!BuildConfig.DEBUG) return "scroll-unconfirmed"
    return try {
      val px = event.getRawX()
      val py = event.getRawY()
      if (!px.isFinite() || !py.isFinite()) return "scroll-unconfirmed"
      val pending = java.util.ArrayDeque<android.view.View>()
      pending.add(window.decorView)
      var visited = 0
      var roots = 0
      var scrollHit = false
      while (!pending.isEmpty() && visited < 2048) {
        val node = pending.removeFirst()
        visited += 1
        if (!node.isShown) continue
        val name = node.javaClass.name
        if (name == "com.facebook.react.ReactRootView"
            || name.endsWith(".ReactSurfaceView")) roots += 1
        if (name == "com.facebook.react.views.scroll.ReactScrollView"
            || name == "com.facebook.react.views.scroll.ReactHorizontalScrollView") {
          if (node.width <= 0 || node.height <= 0) return "scroll-unconfirmed"
          val p = IntArray(2)
          node.getLocationOnScreen(p)
          if (px >= p[0] && py >= p[1]
              && px < p[0] + node.width && py < p[1] + node.height) {
            scrollHit = true
          }
        }
        if (node is android.view.ViewGroup) {
          for (i in 0 until node.childCount) pending.add(node.getChildAt(i))
        }
      }
      if (visited >= 2048 || roots != 1) "scroll-unconfirmed"
      else if (scrollHit) "scroll-hit" else "scroll-clear"
    } catch (_: Exception) {
      "scroll-unconfirmed"
    }
  }

  override fun dispatchTouchEvent(event: android.view.MotionEvent): Boolean {
    if (event.actionMasked == android.view.MotionEvent.ACTION_DOWN) {
      negrescoLabSetDispatchCategory("activity-down")
    }
    // Keep the exact original dispatch semantics and return value.
    val rootHit = if (event.actionMasked == android.view.MotionEvent.ACTION_DOWN)
      negrescoLabReactRootHitCategory(event) else "rn-unconfirmed"
    val scrollCoverage = if (event.actionMasked == android.view.MotionEvent.ACTION_DOWN)
      negrescoLabScrollCoverage(event) else "scroll-unconfirmed"
    val handled = super.dispatchTouchEvent(event)
    if (event.actionMasked == android.view.MotionEvent.ACTION_DOWN) {
      negrescoLabSetDispatchCategory(
        (if (handled) "activity-down-consumed-" else "activity-down-unconsumed-") + rootHit
      )
      negrescoLabSetScrollCategory(scrollCoverage)
    }
    return handled
  }

'''


def classify_native_state(raw: str | None) -> str:
    if not isinstance(raw,str) or len(raw)>80:
        return "activity-state-unconfirmed"
    return raw if raw in ALLOWED else "activity-state-unconfirmed"


def classify_scroll_state(raw: str | None) -> str:
    if not isinstance(raw,str) or len(raw)>64:
        return "scroll-unconfirmed"
    return raw if raw in SCROLL_ALLOWED else "scroll-unconfirmed"


def read_debug_scroll_state(adb, package: str) -> str:
    """Private app-only allowlisted summary; no XML, coordinate, UI text."""
    if not isinstance(package,str) or not re.fullmatch(r"[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+",package):
        return "scroll-unconfirmed"
    try:
        raw=adb("shell","run-as",package,"cat","files/"+SCROLL_FILE,timeout=15,check=False)
    except Exception:
        return "scroll-unconfirmed"
    return classify_scroll_state(raw if isinstance(raw,str) else None)


def install(root: Path) -> str:
    """Only one generated MainActivity may be modified; mismatch fails closed."""
    root=Path(root)
    if not root.is_dir() or root.is_symlink():
        raise RuntimeError("disposable generated source directory not confirmed")
    matching=list(root.rglob("MainActivity.kt"))
    if len(matching)!=1 or matching[0].is_symlink():
        raise RuntimeError("unique generated Activity not confirmed")
    path=matching[0]
    src=path.read_text(encoding="utf8")
    anchor="class MainActivity : ReactActivity() {"
    if src.count(anchor)!=1 or not src.lstrip().startswith("package "):
        raise RuntimeError("generated Activity template unconfirmed")
    if MARKER in src:
        if src.count(MARKER)!=1 or src.count("override fun dispatchTouchEvent(")!=1:
            raise RuntimeError("existing Debug probe malformed")
        return "activity-dispatch-debug-probe-installed"
    if "override fun dispatchTouchEvent(" in src or "override fun onResume(" in src:
        raise RuntimeError("generated Activity already owns target hooks")
    path.write_text(src.replace(anchor,anchor+"\n"+KOTLIN,1),encoding="utf8")
    return "activity-dispatch-debug-probe-installed"


def read_debug_native_state(adb, package: str) -> str:
    """Only private fixed file via run-as, no raw data is ever returned."""
    if not isinstance(package,str) or not re.fullmatch(r"[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+",package):
        return "activity-state-unconfirmed"
    try:
        raw=adb("shell","run-as",package,"cat","files/"+FILE,timeout=15,check=False)
    except Exception:
        return "activity-state-unconfirmed"
    return classify_native_state(raw if isinstance(raw,str) else None)


if __name__=="__main__":
    if len(sys.argv)!=3 or sys.argv[1]!="install":
        raise SystemExit(1)
    try:
        category=install(Path(sys.argv[2]))
        print("PASS (LAB): "+category)
    except Exception:
        print("BLOCK (LAB): generated Debug Activity dispatch probe unconfirmed",file=sys.stderr)
        raise SystemExit(1)

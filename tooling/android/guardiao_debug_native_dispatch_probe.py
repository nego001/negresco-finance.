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
PIX_FILE = "negresco_lab_native_pix_target"
PIX_ALLOWED = frozenset(("pix-ready","pix-hit","pix-miss","pix-unconfirmed"))
GESTURE_FILE = "negresco_lab_native_gesture_phase"
SIBLING_FILE = "negresco_lab_native_pix_siblings"
SIBLING_ALLOWED = frozenset((
    "sibling-ready", "sibling-overlap", "sibling-clear",
    "sibling-front-candidate", "sibling-behind-only",
    "sibling-mixed-order", "sibling-unconfirmed",
    "sibling-front-direct", "sibling-front-parent",
    "sibling-front-ancestor", "sibling-front-multilevel",
    "sibling-front-root-level", "sibling-front-inner-level",
    "sibling-front-root-and-inner",
))
GESTURE_ALLOWED = frozenset((
    "gesture-ready",
    "gesture-down",
    "gesture-down-up-consumed",
    "gesture-down-up-unconsumed",
    "gesture-down-cancelled",
    "gesture-down-cancelled-unconsumed",
    "gesture-up-without-down",
    "gesture-cancel-without-down",
    "gesture-sequence-invalid",
    "gesture-unconfirmed",
))
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

  private fun negrescoLabSetPixCategory(category: String) {
    if (!BuildConfig.DEBUG) return
    try {
      openFileOutput("negresco_lab_native_pix_target", android.content.Context.MODE_PRIVATE).use {
        it.write(category.toByteArray(Charsets.US_ASCII))
      }
    } catch (_: Exception) {
      // Keep all native tag identifiers and event coordinates local.
    }
  }

  // Passive sibling geometry; never changes View properties or dispatch order.
  private fun negrescoLabSetSiblingCategory(category: String) {
    if (!BuildConfig.DEBUG) return
    try {
      openFileOutput("negresco_lab_native_pix_siblings", android.content.Context.MODE_PRIVATE).use {
        it.write(category.toByteArray(Charsets.US_ASCII))
      }
    } catch (_: Exception) {
      // No event, coordinates, view names or hierarchy are persisted.
    }
  }

  // Advisory only: native ACTION_DOWN/UP pairing, no timing or coordinates.
  private var negrescoLabGestureActive = false
  private var negrescoLabGestureInvalid = false
  private fun negrescoLabSetGestureCategory(category: String) {
    if (!BuildConfig.DEBUG) return
    try {
      openFileOutput("negresco_lab_native_gesture_phase", android.content.Context.MODE_PRIVATE).use {
        it.write(category.toByteArray(Charsets.US_ASCII))
      }
    } catch (_: Exception) {
      // Preserve the original dispatch result without exposing any event.
    }
  }

  override fun onResume() {
    super.onResume()
    negrescoLabGestureActive = false
    negrescoLabGestureInvalid = false
    negrescoLabSetDispatchCategory("activity-ready")
    negrescoLabSetScrollCategory("scroll-ready")
    negrescoLabSetPixCategory("pix-ready")
    negrescoLabSetGestureCategory("gesture-ready")
    negrescoLabSetSiblingCategory("sibling-ready")
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


  // Match the one exact Debug Pix native testID only. Categorical geometry
  // is NOT proof of event handling, JS delivery or safe production navigation.
  private fun negrescoLabPixTargetHit(event: android.view.MotionEvent): String {
    if (!BuildConfig.DEBUG) return "pix-unconfirmed"
    return try {
      val px = event.getRawX()
      val py = event.getRawY()
      if (!px.isFinite() || !py.isFinite()) return "pix-unconfirmed"
      var testTagId = resources.getIdentifier("react_test_id", "id", packageName)
      if (testTagId == 0) {
        testTagId = resources.getIdentifier("react_test_id", "id", "com.facebook.react")
      }
      if (testTagId == 0) return "pix-unconfirmed"
      val pending = java.util.ArrayDeque<android.view.View>()
      pending.add(window.decorView)
      var visited = 0
      var matches = 0
      var hit = false
      while (!pending.isEmpty() && visited < 2048) {
        val node = pending.removeFirst()
        visited += 1
        if (!node.isShown) continue
        val tag = node.getTag(testTagId)
        if (tag is String && tag.startsWith("negresco-lab-tab-pix-")) {
          matches += 1
          if (node.width <= 0 || node.height <= 0) return "pix-unconfirmed"
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
      if (visited >= 2048 || matches != 1) "pix-unconfirmed"
      else if (hit) "pix-hit" else "pix-miss"
    } catch (_: Exception) {
      "pix-unconfirmed"
    }
  }


  // Classify visible native siblings overlapping the Pix ancestor chain.
  // Android Z plus ordinary child index are only approximate draw-order clues:
  // RN may implement custom drawing order and pointer/responder rules. Never
  // claim that a front candidate actually intercepted a MotionEvent.
  private fun negrescoLabPixSiblingCategory(event: android.view.MotionEvent): String {
    if (!BuildConfig.DEBUG) return "sibling-unconfirmed"
    return try {
      val px = event.getRawX()
      val py = event.getRawY()
      if (!px.isFinite() || !py.isFinite()) return "sibling-unconfirmed"
      var testTagId = resources.getIdentifier("react_test_id", "id", packageName)
      if (testTagId == 0) {
        testTagId = resources.getIdentifier("react_test_id", "id", "com.facebook.react")
      }
      if (testTagId == 0) return "sibling-unconfirmed"
      val pending = java.util.ArrayDeque<android.view.View>()
      pending.add(window.decorView)
      var visited = 0
      var matches = 0
      var pix: android.view.View? = null
      while (!pending.isEmpty() && visited < 2048) {
        val node = pending.removeFirst()
        visited += 1
        if (!node.isShown) continue
        val tag = node.getTag(testTagId)
        if (tag is String && tag.startsWith("negresco-lab-tab-pix-")) {
          matches += 1
          pix = node
        }
        if (node is android.view.ViewGroup) {
          for (i in 0 until node.childCount) pending.add(node.getChildAt(i))
        }
      }
      if (visited >= 2048 || matches != 1 || pix == null) return "sibling-unconfirmed"
      var child: android.view.View = pix
      var depth = 0
      var overlap = false
      var frontCandidate = false
      var behindCandidate = false
      var minFrontDepth = 65
      var maxFrontDepth = 0
      var frontAtReactRoot = false
      var frontBelowReactRoot = false
      var orderUnconfirmed = false
      var reachedRoot = false
      while (depth < 64) {
        val parent = child.parent as? android.view.ViewGroup ?: break
        depth += 1
        val childIndex = parent.indexOfChild(child)
        if (childIndex < 0 || !child.z.isFinite()) return "sibling-unconfirmed"
        for (i in 0 until parent.childCount) {
          val other = parent.getChildAt(i)
          if (other === child || !other.isShown || other.alpha <= 0f) continue
          if (other.width <= 0 || other.height <= 0) continue
          val pos = IntArray(2)
          other.getLocationOnScreen(pos)
          if (px >= pos[0] && py >= pos[1]
              && px < pos[0] + other.width && py < pos[1] + other.height) {
            overlap = true
            if (!other.z.isFinite()) orderUnconfirmed = true
            else if (other.z > child.z || (other.z == child.z && i > childIndex)) {
              frontCandidate = true
              if (depth < minFrontDepth) minFrontDepth = depth
              if (depth > maxFrontDepth) maxFrontDepth = depth
              val parentClass = parent.javaClass.name
              if (parentClass == "com.facebook.react.ReactRootView"
                  || parentClass.endsWith(".ReactSurfaceView")) {
                frontAtReactRoot = true
              } else {
                frontBelowReactRoot = true
              }
            } else {
              behindCandidate = true
            }
          }
        }
        val kind = parent.javaClass.name
        if (kind == "com.facebook.react.ReactRootView"
            || kind.endsWith(".ReactSurfaceView")) {
          reachedRoot = true
          break
        }
        child = parent
      }
      if (!reachedRoot || depth >= 64 || orderUnconfirmed) "sibling-unconfirmed"
      else if (!overlap) "sibling-clear"
      else if (frontCandidate && behindCandidate) "sibling-mixed-order"
      else if (frontCandidate && frontAtReactRoot && frontBelowReactRoot)
        "sibling-front-root-and-inner"
      else if (frontCandidate && minFrontDepth != maxFrontDepth)
        "sibling-front-multilevel"
      else if (frontCandidate && minFrontDepth == 1) "sibling-front-direct"
      else if (frontCandidate && minFrontDepth == 2) "sibling-front-parent"
      else if (frontCandidate && minFrontDepth in 3..63 && frontAtReactRoot)
        "sibling-front-root-level"
      else if (frontCandidate && minFrontDepth in 3..63 && frontBelowReactRoot)
        "sibling-front-inner-level"
      else if (frontCandidate && minFrontDepth in 3..63) "sibling-front-ancestor"
      else if (behindCandidate) "sibling-behind-only"
      else "sibling-unconfirmed"
    } catch (_: Exception) {
      "sibling-unconfirmed"
    }
  }

  override fun dispatchTouchEvent(event: android.view.MotionEvent): Boolean {
    if (event.actionMasked == android.view.MotionEvent.ACTION_DOWN) {
      negrescoLabSetDispatchCategory("activity-down")
      if (negrescoLabGestureActive) negrescoLabGestureInvalid = true
      negrescoLabGestureActive = true
      negrescoLabSetGestureCategory(if (negrescoLabGestureInvalid)
        "gesture-sequence-invalid" else "gesture-down")
    }
    // Keep the exact original dispatch semantics and return value.
    val rootHit = if (event.actionMasked == android.view.MotionEvent.ACTION_DOWN)
      negrescoLabReactRootHitCategory(event) else "rn-unconfirmed"
    val scrollCoverage = if (event.actionMasked == android.view.MotionEvent.ACTION_DOWN)
      negrescoLabScrollCoverage(event) else "scroll-unconfirmed"
    val pixTarget = if (event.actionMasked == android.view.MotionEvent.ACTION_DOWN)
      negrescoLabPixTargetHit(event) else "pix-unconfirmed"
    val siblings = if (event.actionMasked == android.view.MotionEvent.ACTION_DOWN)
      negrescoLabPixSiblingCategory(event) else "sibling-unconfirmed"
    val handled = super.dispatchTouchEvent(event)
    if (event.actionMasked == android.view.MotionEvent.ACTION_DOWN) {
      negrescoLabSetDispatchCategory(
        (if (handled) "activity-down-consumed-" else "activity-down-unconsumed-") + rootHit
      )
      negrescoLabSetScrollCategory(scrollCoverage)
      negrescoLabSetPixCategory(pixTarget)
      negrescoLabSetSiblingCategory(siblings)
    }
    if (event.actionMasked == android.view.MotionEvent.ACTION_UP) {
      negrescoLabSetGestureCategory(
        if (negrescoLabGestureInvalid) "gesture-sequence-invalid"
        else if (!negrescoLabGestureActive) "gesture-up-without-down"
        else if (handled) "gesture-down-up-consumed"
        else "gesture-down-up-unconsumed"
      )
      negrescoLabGestureActive = false
    } else if (event.actionMasked == android.view.MotionEvent.ACTION_CANCEL) {
      negrescoLabSetGestureCategory(
        if (negrescoLabGestureInvalid) "gesture-sequence-invalid"
        else if (!negrescoLabGestureActive) "gesture-cancel-without-down"
        else if (handled) "gesture-down-cancelled"
        else "gesture-down-cancelled-unconsumed"
      )
      negrescoLabGestureActive = false
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


def classify_pix_native_state(raw: str | None) -> str:
    if not isinstance(raw,str) or len(raw)>64:
        return "pix-unconfirmed"
    return raw if raw in PIX_ALLOWED else "pix-unconfirmed"


def read_debug_pix_state(adb, package: str) -> str:
    """Read only fixed synthetic Pix testID hit category from private Debug."""
    if not isinstance(package,str) or not re.fullmatch(r"[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+",package):
        return "pix-unconfirmed"
    try:
        raw=adb("shell","run-as",package,"cat","files/"+PIX_FILE,timeout=15,check=False)
    except Exception:
        return "pix-unconfirmed"
    return classify_pix_native_state(raw if isinstance(raw,str) else None)


def classify_gesture_state(raw: str | None) -> str:
    """Exact fixed native lifecycle category, never the raw MotionEvent."""
    if not isinstance(raw,str) or len(raw)>64:
        return "gesture-unconfirmed"
    return raw if raw in GESTURE_ALLOWED else "gesture-unconfirmed"


def read_debug_gesture_state(adb, package: str) -> str:
    """Private app-owned one-token state; independent of ReactNativeJS logcat."""
    if not isinstance(package,str) or not re.fullmatch(r"[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+",package):
        return "gesture-unconfirmed"
    try:
        raw=adb("shell","run-as",package,"cat","files/"+GESTURE_FILE,timeout=15,check=False)
    except Exception:
        return "gesture-unconfirmed"
    return classify_gesture_state(raw if isinstance(raw,str) else None)


def classify_sibling_state(raw: str | None) -> str:
    """A fixed category only; never expose the inspected tree."""
    if not isinstance(raw,str) or len(raw)>64:
        return "sibling-unconfirmed"
    return raw if raw in SIBLING_ALLOWED else "sibling-unconfirmed"


def read_debug_sibling_state(adb, package: str) -> str:
    """Run-as reads only a Debug private category, not native view data."""
    if not isinstance(package,str) or not re.fullmatch(r"[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+",package):
        return "sibling-unconfirmed"
    try:
        raw=adb("shell","run-as",package,"cat","files/"+SIBLING_FILE,timeout=15,check=False)
    except Exception:
        return "sibling-unconfirmed"
    return classify_sibling_state(raw if isinstance(raw,str) else None)


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

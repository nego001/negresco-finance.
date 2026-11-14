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
ROOT_PEER_FILE = "negresco_lab_native_pix_root_peer"
ROOT_POINTER_FILE = "negresco_lab_native_pix_root_pointer"
RN_TARGET_FILE = "negresco_lab_native_rn_resolved_target"
RN_TARGET_ALLOWED = frozenset((
    "rn-target-ready", "rn-target-pix-direct",
    "rn-target-pix-descendant", "rn-target-pix-ancestor",
    "rn-target-other", "rn-target-root-fallback",
    "rn-target-other-root-front", "rn-target-other-root-behind",
    "rn-target-other-same-nav", "rn-target-other-same-app",
    "rn-target-other-order-unconfirmed",
    "rn-target-front-branch-auto", "rn-target-front-branch-none",
    "rn-target-front-branch-box-only", "rn-target-front-branch-box-none",
    "rn-target-front-branch-no-interface",
    "rn-target-front-branch-unconfirmed",
    "rn-front-noiface-enabled-direct",
    "rn-front-root-clickable", "rn-front-root-passive",
    "rn-front-surface-clickable", "rn-front-surface-passive",
    "rn-front-devsupport-clickable", "rn-front-devsupport-passive",
    "rn-front-view-clickable", "rn-front-view-passive",
    "rn-front-text-clickable", "rn-front-text-passive",
    "rn-front-textinput-clickable", "rn-front-textinput-passive",
    "rn-front-image-clickable", "rn-front-image-passive",
    "rn-front-viewgroup-clickable", "rn-front-viewgroup-passive",
    "rn-front-scroll-clickable", "rn-front-scroll-passive",
    "rn-front-modal-clickable", "rn-front-modal-passive",
    "rn-front-control-clickable", "rn-front-control-passive",
    "rn-front-miscview-clickable", "rn-front-miscview-passive",
    "rn-front-safearea-clickable", "rn-front-safearea-passive",
    "rn-safearea-front-empty",
    "rn-safearea-front-home-only",
    "rn-safearea-pix-home-only",
    "rn-safearea-pixhome-front-empty",
    "rn-safearea-pixhome-child-bounds-cover",
    "rn-safearea-pixhome-hit-index-higher",
    "rn-multipoint-selected-all-isolated-pix",
    "rn-multipoint-all-front-marked",
    "rn-multipoint-all-front-unmarked",
    "rn-multipoint-front-marker-unconfirmed",
    "rn-multipoint-selected-partial-isolated-pix",
    "rn-multipoint-selected-none-isolated-pix",
    "rn-multipoint-isolated-other",
    "rn-multipoint-unconfirmed",
    "rn-safearea-isolated-pix-direct",
    "rn-safearea-isolated-pix-descendant",
    "rn-safearea-isolated-pix-ancestor",
    "rn-safearea-isolated-root-fallback",
    "rn-safearea-isolated-other",
    "rn-safearea-isolated-unconfirmed",
    "rn-safearea-pixhome-hit-index-lower",
    "rn-safearea-pixhome-hit-mapped-higher",
    "rn-safearea-pixhome-hit-mapped-lower",
    "rn-safearea-pixhome-hit-order-unconfirmed",
    "rn-safearea-pixhome-self-visible-miss-child-away",
    "rn-safearea-pixhome-self-visible-unconfirmed",
    "rn-safearea-pixhome-child-bounds-none-eligible",
    "rn-safearea-pixhome-structure-unconfirmed",
    "rn-safearea-both-home",
    "rn-safearea-neither-home",
    "rn-safearea-markers-unconfirmed",
    "rn-front-refresh-clickable", "rn-front-refresh-passive",
    "rn-front-drawer-clickable", "rn-front-drawer-passive",
    "rn-front-viewpager-clickable", "rn-front-viewpager-passive",
    "rn-front-accessibility-clickable", "rn-front-accessibility-passive",
    "rn-front-unimplemented-clickable", "rn-front-unimplemented-passive",
    "rn-front-miscother-clickable", "rn-front-miscother-passive",
    "rn-front-reactother-clickable", "rn-front-reactother-passive",
    "rn-front-expo-clickable", "rn-front-expo-passive",
    "rn-front-other-clickable", "rn-front-other-passive",
    "rn-front-noiface-enabled-descendant",
    "rn-front-noiface-disabled-direct",
    "rn-front-noiface-disabled-descendant",
    "rn-target-virtual-unconfirmed", "rn-target-unconfirmed",
))
ROOT_POINTER_ALLOWED = frozenset((
    "root-pointer-ready", "root-pointer-clear",
    "root-pointer-auto", "root-pointer-none",
    "root-pointer-box-only", "root-pointer-box-none",
    "root-pointer-mixed", "root-pointer-unconfirmed",
    "root-pointer-mixed-self-eligible",
    "root-pointer-mixed-self-unconfirmed",
    "root-pointer-mixed-child-eligible",
    "root-pointer-mixed-child-unconfirmed",
    "root-pointer-mixed-none-unconfirmed",
))
ROOT_PEER_ALLOWED = frozenset((
    "root-peer-ready", "root-peer-clear", "root-peer-devsupport",
    "root-peer-expo", "root-peer-react", "root-peer-platform",
    "root-peer-other", "root-peer-mixed", "root-peer-unconfirmed",
))
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

  private fun negrescoLabSetRootPeerCategory(category: String) {
    if (!BuildConfig.DEBUG) return
    try {
      openFileOutput("negresco_lab_native_pix_root_peer", android.content.Context.MODE_PRIVATE).use {
        it.write(category.toByteArray(Charsets.US_ASCII))
      }
    } catch (_: Exception) {
      // Only fixed categories, no names, event details or hierarchy.
    }
  }

  private fun negrescoLabSetRootPointerCategory(category: String) {
    if (!BuildConfig.DEBUG) return
    try {
      openFileOutput("negresco_lab_native_pix_root_pointer", android.content.Context.MODE_PRIVATE).use {
        it.write(category.toByteArray(Charsets.US_ASCII))
      }
    } catch (_: Exception) {
      // Fixed codes only; no class name, hierarchy or touch details.
    }
  }

  private fun negrescoLabSetResolvedTargetCategory(category: String) {
    if (!BuildConfig.DEBUG) return
    try {
      openFileOutput("negresco_lab_native_rn_resolved_target", android.content.Context.MODE_PRIVATE).use {
        it.write(category.toByteArray(Charsets.US_ASCII))
      }
    } catch (_: Exception) {
      // Never store raw React tags, view hierarchy, coordinates or input details.
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
    negrescoLabSetRootPeerCategory("root-peer-ready")
    negrescoLabSetRootPointerCategory("root-pointer-ready")
    negrescoLabSetResolvedTargetCategory("rn-target-ready")
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


  // Debug-only read-only root peer class-family classification. This is NOT
  // proof of input interception, drawing order or event target ownership.
  private fun negrescoLabPixRootPeerCategory(event: android.view.MotionEvent): String {
    if (!BuildConfig.DEBUG) return "root-peer-unconfirmed"
    return try {
      val px = event.getRawX()
      val py = event.getRawY()
      if (!px.isFinite() || !py.isFinite()) return "root-peer-unconfirmed"
      var tagId = resources.getIdentifier("react_test_id", "id", packageName)
      if (tagId == 0) {
        tagId = resources.getIdentifier("react_test_id", "id", "com.facebook.react")
      }
      if (tagId == 0) return "root-peer-unconfirmed"
      val pending = java.util.ArrayDeque<android.view.View>()
      pending.add(window.decorView)
      var visited = 0
      var matches = 0
      var pix: android.view.View? = null
      while (!pending.isEmpty() && visited < 2048) {
        val node = pending.removeFirst()
        visited += 1
        if (!node.isShown) continue
        val tag = node.getTag(tagId)
        if (tag is String && tag.startsWith("negresco-lab-tab-pix-")) {
          matches += 1
          pix = node
        }
        if (node is android.view.ViewGroup) {
          for (i in 0 until node.childCount) pending.add(node.getChildAt(i))
        }
      }
      if (visited >= 2048 || matches != 1 || pix == null) {
        return "root-peer-unconfirmed"
      }
      var child: android.view.View = pix
      var depth = 0
      var root: android.view.ViewGroup? = null
      while (depth < 64) {
        val parent = child.parent as? android.view.ViewGroup ?: break
        depth += 1
        val name = parent.javaClass.name
        if (name == "com.facebook.react.ReactRootView"
            || name.endsWith(".ReactSurfaceView")) {
          root = parent
          break
        }
        child = parent
      }
      if (root == null || depth >= 64) return "root-peer-unconfirmed"
      val childIndex = root.indexOfChild(child)
      if (childIndex < 0 || !child.z.isFinite()) return "root-peer-unconfirmed"
      var candidateCount = 0
      var category = "root-peer-clear"
      for (i in 0 until root.childCount) {
        val other = root.getChildAt(i)
        if (other === child || !other.isShown || other.alpha <= 0f) continue
        if (other.width <= 0 || other.height <= 0 || !other.z.isFinite()) continue
        if (!(other.z > child.z || (other.z == child.z && i > childIndex))) continue
        val pos = IntArray(2)
        other.getLocationOnScreen(pos)
        if (!(px >= pos[0] && py >= pos[1]
              && px < pos[0] + other.width && py < pos[1] + other.height)) continue
        candidateCount += 1
        val cls = other.javaClass.name
        val kind = when {
          cls.startsWith("com.facebook.react.devsupport.") -> "root-peer-devsupport"
          cls.startsWith("expo.") -> "root-peer-expo"
          cls.startsWith("com.facebook.react.") -> "root-peer-react"
          cls.startsWith("android.") || cls.startsWith("androidx.") -> "root-peer-platform"
          else -> "root-peer-other"
        }
        if (candidateCount == 1) category = kind
        else if (category != kind) category = "root-peer-mixed"
      }
      if (candidateCount == 0) "root-peer-clear" else category
    } catch (_: Exception) {
      "root-peer-unconfirmed"
    }
  }


  // Advisory read-only property of the same geometrically front root peers.
  // Reflection is used because the generated Expo/RN Debug class may expose
  // getPointerEvents() differently across versions; no mutation or raw output.
  // This neither proves interception nor changes hit-testing.
  private fun negrescoLabPixRootPointerCategory(event: android.view.MotionEvent): String {
    if (!BuildConfig.DEBUG) return "root-pointer-unconfirmed"
    return try {
      val px = event.getRawX()
      val py = event.getRawY()
      if (!px.isFinite() || !py.isFinite()) return "root-pointer-unconfirmed"
      var tagId = resources.getIdentifier("react_test_id", "id", packageName)
      if (tagId == 0) {
        tagId = resources.getIdentifier("react_test_id", "id", "com.facebook.react")
      }
      if (tagId == 0) return "root-pointer-unconfirmed"
      val pending = java.util.ArrayDeque<android.view.View>()
      pending.add(window.decorView)
      var seen = 0
      var matches = 0
      var pix: android.view.View? = null
      while (!pending.isEmpty() && seen < 2048) {
        val node = pending.removeFirst()
        seen += 1
        if (!node.isShown) continue
        val tag = node.getTag(tagId)
        if (tag is String && tag.startsWith("negresco-lab-tab-pix-")) {
          matches += 1
          pix = node
        }
        if (node is android.view.ViewGroup) {
          for (i in 0 until node.childCount) pending.add(node.getChildAt(i))
        }
      }
      if (seen >= 2048 || matches != 1 || pix == null) return "root-pointer-unconfirmed"
      var child: android.view.View = pix
      var root: android.view.ViewGroup? = null
      var depth = 0
      while (depth < 64) {
        val parent = child.parent as? android.view.ViewGroup ?: break
        depth += 1
        val name = parent.javaClass.name
        if (name == "com.facebook.react.ReactRootView"
            || name.endsWith(".ReactSurfaceView")) {
          root = parent
          break
        }
        child = parent
      }
      if (root == null || depth >= 64) return "root-pointer-unconfirmed"
      val childIndex = root.indexOfChild(child)
      if (childIndex < 0 || !child.z.isFinite()) return "root-pointer-unconfirmed"
      var candidates = 0
      var result = "root-pointer-clear"
      var selfEligible = false
      var childEligible = false
      var unknownMode = false
      for (i in 0 until root.childCount) {
        val other = root.getChildAt(i)
        if (other === child || !other.isShown || other.alpha <= 0f) continue
        if (other.width <= 0 || other.height <= 0 || !other.z.isFinite()) continue
        if (!(other.z > child.z || (other.z == child.z && i > childIndex))) continue
        val p = IntArray(2)
        other.getLocationOnScreen(p)
        if (px < p[0] || py < p[1]
            || px >= p[0] + other.width || py >= p[1] + other.height) continue
        candidates += 1
        val method = other.javaClass.methods.firstOrNull {
          it.name == "getPointerEvents" && it.parameterTypes.isEmpty()
        }
        val mode = if (method == null) "root-pointer-unconfirmed" else {
          when (method.invoke(other)?.toString()?.lowercase(java.util.Locale.ROOT)) {
            "auto" -> "root-pointer-auto"
            "none" -> "root-pointer-none"
            "box_only", "box-only" -> "root-pointer-box-only"
            "box_none", "box-none" -> "root-pointer-box-none"
            else -> "root-pointer-unconfirmed"
          }
        }
        if (mode == "root-pointer-auto" || mode == "root-pointer-box-only") {
          selfEligible = true
        } else if (mode == "root-pointer-box-none") {
          childEligible = true
        } else if (mode == "root-pointer-unconfirmed") {
          unknownMode = true
        }
        if (candidates == 1) result = mode
        else if (result != mode) result = "root-pointer-mixed"
      }
      if (candidates == 0) "root-pointer-clear"
      else if (result != "root-pointer-mixed") result
      else if (selfEligible && unknownMode) "root-pointer-mixed-self-unconfirmed"
      else if (selfEligible) "root-pointer-mixed-self-eligible"
      else if (childEligible && unknownMode) "root-pointer-mixed-child-unconfirmed"
      else if (childEligible) "root-pointer-mixed-child-eligible"
      else "root-pointer-mixed-none-unconfirmed"
    } catch (_: Exception) {
      "root-pointer-unconfirmed"
    }
  }


  // Passive query to React Native's own touch-target resolver. It does NOT
  // dispatch, replay or consume an event. Reflection fails closed for
  // incompatible Fabric/RN builds. Never persist the returned integer tag.
  // Read-only sibling rank classifier. Does not infer actual ACTION_DOWN
  // routing, visual occlusion, interception or React/JS callback delivery.
  // Uses React Native's drawing-order mapping when the root supports it.
  private fun negrescoLabRootSiblingOrderCategory(
      root: android.view.ViewGroup,
      pixBranch: android.view.View,
      selectedBranch: android.view.View): String {
    if (!BuildConfig.DEBUG) return "rn-safearea-pixhome-hit-order-unconfirmed"
    return try {
      val size = root.childCount
      val pixIndex = root.indexOfChild(pixBranch)
      val selectedIndex = root.indexOfChild(selectedBranch)
      if (size < 2 || size > 2048 || pixIndex < 0
          || selectedIndex < 0 || pixIndex == selectedIndex) {
        "rn-safearea-pixhome-hit-order-unconfirmed"
      } else {
        val zInterface = try {
          Class.forName("com.facebook.react.uimanager.ReactZIndexedViewGroup")
        } catch (_: ClassNotFoundException) {
          null
        }
        if (zInterface == null || !zInterface.isInstance(root)) {
          // Index ordering ONLY, not equivalent to transformed hit-testing,
          // Android elevation, or real event delivery.
          if (selectedIndex > pixIndex) "rn-safearea-pixhome-hit-index-higher"
          else "rn-safearea-pixhome-hit-index-lower"
        } else {
          val getter = zInterface.getMethod("getZIndexMappedChildIndex", java.lang.Integer.TYPE)
          val visited = BooleanArray(size)
          var pixRank = -1
          var selectedRank = -1
          var mappingValid = true
          for (rank in 0 until size) {
            val nativeIndex = getter.invoke(root, rank) as? Int
            if (nativeIndex == null || nativeIndex < 0 || nativeIndex >= size
                || visited[nativeIndex]) {
              mappingValid = false
              break
            }
            visited[nativeIndex] = true
            if (nativeIndex == pixIndex) pixRank = rank
            if (nativeIndex == selectedIndex) selectedRank = rank
          }
          if (!mappingValid || pixRank < 0 || selectedRank < 0) {
            "rn-safearea-pixhome-hit-order-unconfirmed"
          } else if (selectedRank > pixRank) {
            "rn-safearea-pixhome-hit-mapped-higher"
          } else {
            "rn-safearea-pixhome-hit-mapped-lower"
          }
        }
      }
    } catch (_: Exception) {
      "rn-safearea-pixhome-hit-order-unconfirmed"
    }
  }

  // Counterfactual hit-test: run React Native's existing resolver on ONLY
  // the Pix-containing root branch. This does not dispatch/replay/consume
  // ACTION_DOWN, change pointerEvents, or predict JS callback delivery.
  // Output only fixed category strings; never log native tags or coordinates.
  private fun negrescoLabIsolatedPixTargetCategory(
      pix: android.view.View, pixBranch: android.view.View,
      px: Float, py: Float): String {
    if (!BuildConfig.DEBUG) return "rn-safearea-isolated-unconfirmed"
    return try {
      val group = pixBranch as? android.view.ViewGroup
        ?: return "rn-safearea-isolated-unconfirmed"
      if (!group.isAttachedToWindow || !group.isShown || group.width <= 0
          || group.height <= 0 || pix.id <= 0 || !px.isFinite() || !py.isFinite()) {
        return "rn-safearea-isolated-unconfirmed"
      }
      val branchOrigin = IntArray(2)
      group.getLocationOnScreen(branchOrigin)
      val x = px - branchOrigin[0]
      val y = py - branchOrigin[1]
      if (!x.isFinite() || !y.isFinite() || x < 0f || y < 0f
          || x >= group.width || y >= group.height) {
        return "rn-safearea-isolated-unconfirmed"
      }
      val resolver = Class.forName("com.facebook.react.uimanager.TouchTargetHelper")
        .getMethod("findTargetTagForTouch", java.lang.Float.TYPE,
          java.lang.Float.TYPE, android.view.ViewGroup::class.java)
      val chosen = resolver.invoke(null, x, y, group) as? Int
        ?: return "rn-safearea-isolated-unconfirmed"
      if (chosen <= 0) return "rn-safearea-isolated-unconfirmed"
      if (chosen == pix.id) return "rn-safearea-isolated-pix-direct"
      if (chosen == group.id) return "rn-safearea-isolated-root-fallback"
      var parent = pix.parent as? android.view.View
      var depth = 0
      while (parent != null && parent !== group && depth < 64) {
        if (parent.id == chosen) return "rn-safearea-isolated-pix-ancestor"
        parent = parent.parent as? android.view.View
        depth += 1
      }
      if (depth >= 64 || parent !== group) return "rn-safearea-isolated-unconfirmed"
      val pixChildren = java.util.ArrayDeque<android.view.View>()
      pixChildren.add(pix)
      var inspected = 0
      while (!pixChildren.isEmpty() && inspected < 2048) {
        val child = pixChildren.removeFirst()
        inspected += 1
        if (child !== pix && child.id == chosen) {
          return "rn-safearea-isolated-pix-descendant"
        }
        if (child is android.view.ViewGroup) {
          for (index in 0 until child.childCount) pixChildren.add(child.getChildAt(index))
        }
      }
      if (!pixChildren.isEmpty()) return "rn-safearea-isolated-unconfirmed"
      val branchChildren = java.util.ArrayDeque<android.view.View>()
      branchChildren.add(group)
      inspected = 0
      while (!branchChildren.isEmpty() && inspected < 2048) {
        val child = branchChildren.removeFirst()
        inspected += 1
        if (child.id == chosen) return "rn-safearea-isolated-other"
        if (child is android.view.ViewGroup) {
          for (index in 0 until child.childCount) branchChildren.add(child.getChildAt(index))
        }
      }
      "rn-safearea-isolated-unconfirmed"
    } catch (_: Exception) {
      "rn-safearea-isolated-unconfirmed"
    }
  }

  // Passive counterfactual sampling at the observed tap and two interior
  // horizontal points. No additional MotionEvents or UI changes. The result
  // describes target selection only, not the actual dispatch/callback path.
  private fun negrescoLabPixThreePointCategory(
      root: android.view.ViewGroup,
      pix: android.view.View,
      pixBranch: android.view.View,
      selectedBranch: android.view.View, tagId: Int,
      px: Float, py: Float): String {
    if (!BuildConfig.DEBUG) return "rn-multipoint-unconfirmed"
    return try {
      if (tagId <= 0 || !pix.isAttachedToWindow || !pix.isShown || pix.alpha <= 0f
          || pix.width < 12 || pix.height <= 0 || selectedBranch.id <= 0
          || !root.isAttachedToWindow || !root.isShown
          || !px.isFinite() || !py.isFinite()) {
        return "rn-multipoint-unconfirmed"
      }
      val pixOrigin = IntArray(2)
      val rootOrigin = IntArray(2)
      pix.getLocationOnScreen(pixOrigin)
      root.getLocationOnScreen(rootOrigin)
      if (py < pixOrigin[1] || py >= pixOrigin[1] + pix.height
          || px < pixOrigin[0] || px >= pixOrigin[0] + pix.width) {
        return "rn-multipoint-unconfirmed"
      }
      // This only samples points already inside the Pix tab. No gesture.
      val points = floatArrayOf(
        px,
        pixOrigin[0] + pix.width * 0.25f,
        pixOrigin[0] + pix.width * 0.75f
      )
      val resolver = Class.forName("com.facebook.react.uimanager.TouchTargetHelper")
        .getMethod("findTargetTagForTouch",
          java.lang.Float.TYPE, java.lang.Float.TYPE,
          android.view.ViewGroup::class.java)
      var selectedCount = 0
      for (x in points) {
        val localX = x - rootOrigin[0]
        val localY = py - rootOrigin[1]
        if (!x.isFinite() || localX < 0f || localY < 0f
            || localX >= root.width || localY >= root.height) {
          return "rn-multipoint-unconfirmed"
        }
        val isolated = negrescoLabIsolatedPixTargetCategory(pix, pixBranch, x, py)
        if (isolated == "rn-safearea-isolated-unconfirmed") {
          return "rn-multipoint-unconfirmed"
        }
        if (isolated != "rn-safearea-isolated-pix-direct"
            && isolated != "rn-safearea-isolated-pix-descendant"
            && isolated != "rn-safearea-isolated-pix-ancestor") {
          return "rn-multipoint-isolated-other"
        }
        val selected = resolver.invoke(null, localX, localY, root) as? Int
          ?: return "rn-multipoint-unconfirmed"
        // Resolver results can point to native descendants, not only the
        // direct sibling View. A direct-ID equality would falsely classify
        // these valid hits as misses. Virtual/unmatched tags fail closed.
        if (selected <= 0 || selected == root.id) {
          return "rn-multipoint-unconfirmed"
        }
        val scan = java.util.ArrayDeque<android.view.View>()
        scan.add(root)
        var inspected = 0
        var matches = 0
        var selectedView: android.view.View? = null
        while (!scan.isEmpty() && inspected < 2048) {
          val candidate = scan.removeFirst()
          inspected += 1
          if (candidate.id == selected) {
            matches += 1
            selectedView = candidate
          }
          if (candidate is android.view.ViewGroup) {
            for (index in 0 until candidate.childCount) {
              scan.add(candidate.getChildAt(index))
            }
          }
        }
        if (!scan.isEmpty() || matches != 1 || selectedView == null) {
          return "rn-multipoint-unconfirmed"
        }
        var cursor: android.view.View? = selectedView
        var depth = 0
        var underFront = false
        while (cursor != null && cursor !== root && depth < 64) {
          if (cursor === selectedBranch) {
            underFront = true
            break
          }
          cursor = cursor.parent as? android.view.View
          depth += 1
        }
        if (depth >= 64 || (!underFront && cursor !== root)) {
          return "rn-multipoint-unconfirmed"
        }
        if (underFront) selectedCount += 1
      }
      when (selectedCount) {
        3 -> {
          // This synthetic marker reveals only whether the selected front
          // branch owns ANY app Debug testID. It cannot prove View origin.
          // No raw tag, ID, class name, UI text or coordinate is persisted.
          val queue = java.util.ArrayDeque<android.view.View>()
          queue.add(selectedBranch)
          var count = 0
          var marked = false
          while (!queue.isEmpty() && count < 2048) {
            val candidate = queue.removeFirst()
            count += 1
            val marker = candidate.getTag(tagId)
            if (marker is String && marker.startsWith("negresco-lab-")) {
              marked = true
            }
            if (candidate is android.view.ViewGroup) {
              for (index in 0 until candidate.childCount) {
                queue.add(candidate.getChildAt(index))
              }
            }
          }
          if (!queue.isEmpty()) "rn-multipoint-front-marker-unconfirmed"
          else if (marked) "rn-multipoint-all-front-marked"
          else "rn-multipoint-all-front-unmarked"
        }
        1, 2 -> "rn-multipoint-selected-partial-isolated-pix"
        0 -> "rn-multipoint-selected-none-isolated-pix"
        else -> "rn-multipoint-unconfirmed"
      }
    } catch (_: Exception) {
      "rn-multipoint-unconfirmed"
    }
  }

  private fun negrescoLabResolvedTargetCategory(event: android.view.MotionEvent): String {
    if (!BuildConfig.DEBUG) return "rn-target-unconfirmed"
    return try {
      val px = event.getRawX()
      val py = event.getRawY()
      if (!px.isFinite() || !py.isFinite()) return "rn-target-unconfirmed"
      var tagId = resources.getIdentifier("react_test_id", "id", packageName)
      if (tagId == 0) tagId =
        resources.getIdentifier("react_test_id", "id", "com.facebook.react")
      if (tagId == 0) return "rn-target-unconfirmed"
      val pending = java.util.ArrayDeque<android.view.View>()
      pending.add(window.decorView)
      var seen = 0
      var matches = 0
      var pix: android.view.View? = null
      while (!pending.isEmpty() && seen < 2048) {
        val node = pending.removeFirst()
        seen += 1
        if (!node.isShown) continue
        val tag = node.getTag(tagId)
        if (tag is String && tag.startsWith("negresco-lab-tab-pix-")) {
          pix = node
          matches += 1
        }
        if (node is android.view.ViewGroup) {
          for (i in 0 until node.childCount) pending.add(node.getChildAt(i))
        }
      }
      if (seen >= 2048 || matches != 1 || pix == null || pix.id <= 0) {
        return "rn-target-unconfirmed"
      }
      var child: android.view.View = pix
      var root: android.view.ViewGroup? = null
      var depth = 0
      while (depth < 64) {
        val parent = child.parent as? android.view.ViewGroup ?: break
        depth += 1
        val kind = parent.javaClass.name
        if (kind == "com.facebook.react.ReactRootView"
            || kind.endsWith(".ReactSurfaceView")) {
          root = parent
          break
        }
        child = parent
      }
      if (root == null || depth >= 64 || root.id <= 0) return "rn-target-unconfirmed"
      val origin = IntArray(2)
      root.getLocationOnScreen(origin)
      val localX = px - origin[0]
      val localY = py - origin[1]
      if (localX < 0 || localY < 0 || localX >= root.width
          || localY >= root.height) return "rn-target-unconfirmed"
      val targetMethod = Class.forName("com.facebook.react.uimanager.TouchTargetHelper")
        .getMethod("findTargetTagForTouch",
          java.lang.Float.TYPE, java.lang.Float.TYPE, android.view.ViewGroup::class.java)
      val chosen = targetMethod.invoke(null, localX, localY, root) as? Int
        ?: return "rn-target-unconfirmed"
      if (chosen <= 0) return "rn-target-unconfirmed"
      if (chosen == pix.id) return "rn-target-pix-direct"
      if (chosen == root.id) return "rn-target-root-fallback"
      var ancestor = pix.parent as? android.view.View
      var ancestorDepth = 0
      while (ancestor != null && ancestor !== root && ancestorDepth < 64) {
        if (ancestor.id == chosen) return "rn-target-pix-ancestor"
        ancestor = ancestor.parent as? android.view.View
        ancestorDepth += 1
      }
      val descendants = java.util.ArrayDeque<android.view.View>()
      descendants.add(pix)
      var count = 0
      while (!descendants.isEmpty() && count < 2048) {
        val node = descendants.removeFirst()
        count += 1
        if (node !== pix && node.id == chosen) return "rn-target-pix-descendant"
        if (node is android.view.ViewGroup) {
          for (i in 0 until node.childCount) descendants.add(node.getChildAt(i))
        }
      }
      if (count >= 2048) return "rn-target-unconfirmed"
      val fullTree = java.util.ArrayDeque<android.view.View>()
      fullTree.add(root)
      count = 0
      while (!fullTree.isEmpty() && count < 2048) {
        val node = fullTree.removeFirst()
        count += 1
        if (node.id == chosen) {
          // Prove only structural relation to Pix, without View names or tags.
          // This is the resolver's chosen native View, not proof of JS delivery.
          val nav = pix.parent as? android.view.ViewGroup
            ?: return "rn-target-unconfirmed"
          var pixRootBranch: android.view.View = pix
          var targetRootBranch: android.view.View = node
          var pDepth = 0
          var tDepth = 0
          while (pixRootBranch.parent !== root && pDepth < 64) {
            pixRootBranch = pixRootBranch.parent as? android.view.View
              ?: return "rn-target-unconfirmed"
            pDepth += 1
          }
          while (targetRootBranch.parent !== root && tDepth < 64) {
            targetRootBranch = targetRootBranch.parent as? android.view.View
              ?: return "rn-target-unconfirmed"
            tDepth += 1
          }
          if (pDepth >= 64 || tDepth >= 64
              || pixRootBranch.parent !== root
              || targetRootBranch.parent !== root) return "rn-target-unconfirmed"
          if (pixRootBranch !== targetRootBranch) {
            val pixIndex = root.indexOfChild(pixRootBranch)
            val targetIndex = root.indexOfChild(targetRootBranch)
            if (pixIndex < 0 || targetIndex < 0
                || !pixRootBranch.z.isFinite()
                || !targetRootBranch.z.isFinite()) {
              return "rn-target-other-order-unconfirmed"
            }
            val front = targetRootBranch.z > pixRootBranch.z
              || (targetRootBranch.z == pixRootBranch.z && targetIndex > pixIndex)
            if (!front) return "rn-target-other-root-behind"
            // Inspect ONLY the selected front root branch. React Native's
            // TouchTargetHelper treats Views without ReactPointerEventsView
            // differently from explicit NONE/BOX_NONE; do not conflate them.
            // No method/property mutations, no raw class names in output.
            return try {
              val iface = Class.forName(
                "com.facebook.react.uimanager.ReactPointerEventsView")
              if (!iface.isInstance(targetRootBranch)) {
                // A branch without ReactPointerEventsView has no explicit
                // pointer policy. This read-only discriminator never claims
                // which View actually consumed the native ACTION_DOWN.
                // The selected node was already found inside this root branch.
                val branchEnabled = targetRootBranch.isEnabled
                val selectedDirectly = node === targetRootBranch
                when {
                  branchEnabled && selectedDirectly -> {
                    // Inspect a fixed native class-family bucket and whether
                    // this View advertises Android clickability. Neither the
                    // class name nor any actual View identifier is stored.
                    // Clickability is NOT a proxy for dispatch/JS delivery.
                    val owner = targetRootBranch.javaClass.name
                    val group = when {
                      owner == "com.facebook.react.ReactRootView" -> "root"
                      owner.endsWith(".ReactSurfaceView") -> "surface"
                      owner.startsWith("com.facebook.react.devsupport.") -> "devsupport"
                      owner.startsWith("com.facebook.react.views.textinput.") -> "textinput"
                      owner.startsWith("com.facebook.react.views.text.") -> "text"
                      owner.startsWith("com.facebook.react.views.image.") -> "image"
                      owner.startsWith("com.facebook.react.views.view.") -> "viewgroup"
                      owner.startsWith("com.facebook.react.views.scroll.") -> "scroll"
                      owner.startsWith("com.facebook.react.views.modal.") -> "modal"
                      owner.startsWith("com.facebook.react.views.switchview.")
                        || owner.startsWith("com.facebook.react.views.checkbox.")
                        || owner.startsWith("com.facebook.react.views.slider.")
                        || owner.startsWith("com.facebook.react.views.progressbar.") -> "control"
                      // Only this native family prefix is classified.
                      // This read-only operation must never emit owner itself.
                      owner.startsWith("com.facebook.react.views.safeareaview.") -> "safearea"
                      owner.startsWith("com.facebook.react.views.swiperefresh.")
                        || owner.startsWith("com.facebook.react.views.refresh.") -> "refresh"
                      owner.startsWith("com.facebook.react.views.drawer.") -> "drawer"
                      owner.startsWith("com.facebook.react.views.viewpager.") -> "viewpager"
                      owner.startsWith("com.facebook.react.views.accessibility.") -> "accessibility"
                      owner.startsWith("com.facebook.react.views.unimplementedview.") -> "unimplemented"
                      owner.startsWith("com.facebook.react.views.") -> "miscother"
                      owner.startsWith("com.facebook.react.") -> "reactother"
                      owner.startsWith("expo.") -> "expo"
                      else -> "other"
                    }
                    val mode = if (targetRootBranch.isClickable) "clickable" else "passive"

                    if (group == "safearea" && mode == "passive") {
                      // Scan exactly the two selected root branches in memory.
                      // Fixed synthetic Dev marker only; no class names, texts,
                      // coordinates, IDs, raw hierarchy or contents are logged.
                      var homeMask = 0
                      val rootsToCheck = arrayOf(targetRootBranch, pixRootBranch)
                      for (rootIndex in rootsToCheck.indices) {
                        val scanQueue = java.util.ArrayDeque<android.view.View>()
                        scanQueue.add(rootsToCheck[rootIndex])
                        var inspected = 0
                        while (!scanQueue.isEmpty() && inspected < 2048) {
                          val candidate = scanQueue.removeFirst()
                          inspected += 1
                          val marker = candidate.getTag(tagId)
                          if (marker is String &&
                              marker.startsWith("negresco-lab-rn-page-home-")) {
                            homeMask = homeMask or (1 shl rootIndex)
                          }
                          if (candidate is android.view.ViewGroup) {
                            for (childIndex in 0 until candidate.childCount) {
                              scanQueue.add(candidate.getChildAt(childIndex))
                            }
                          }
                        }
                        if (!scanQueue.isEmpty()) return "rn-safearea-markers-unconfirmed"
                      }
                      when (homeMask) {
                        1 -> "rn-safearea-front-home-only"
                        2 -> {
                          val frontGroup = targetRootBranch as? android.view.ViewGroup
                            ?: return "rn-safearea-pixhome-structure-unconfirmed"
                          if (frontGroup.childCount == 0) {
                            "rn-safearea-pixhome-front-empty"
                          } else {
                            // Bounds-only: does not dispatch, replay touch,
                            // call pointer handlers or mutate any native View.
                            // Never persist raw coordinates, child IDs or counts.
                            val descendants = java.util.ArrayDeque<android.view.View>()
                            for (childIndex in 0 until frontGroup.childCount) {
                              descendants.add(frontGroup.getChildAt(childIndex))
                            }
                            var countFront = 0
                            var covered = false
                            var eligibleElsewhere = false
                            while (!descendants.isEmpty() && countFront < 2048) {
                              val branchChild = descendants.removeFirst()
                              countFront += 1
                              if (branchChild.isShown && branchChild.alpha > 0f
                                  && branchChild.width > 0 && branchChild.height > 0) {
                                eligibleElsewhere = true
                                val childPosition = IntArray(2)
                                branchChild.getLocationOnScreen(childPosition)
                                if (px >= childPosition[0] && py >= childPosition[1]
                                    && px < childPosition[0] + branchChild.width
                                    && py < childPosition[1] + branchChild.height) {
                                  covered = true
                                }
                              }
                              if (branchChild is android.view.ViewGroup) {
                                for (childIndex in 0 until branchChild.childCount) {
                                  descendants.add(branchChild.getChildAt(childIndex))
                                }
                              }
                            }
                            if (!descendants.isEmpty()) {
                              "rn-safearea-pixhome-structure-unconfirmed"
                            } else if (covered) {
                              "rn-safearea-pixhome-child-bounds-cover"
                            } else if (eligibleElsewhere) {
                              // Visible footprint is read-only geometry, not
                              // proof of native event interception or JS routing.
                              val visibleRect = android.graphics.Rect()
                              if (!targetRootBranch.isShown || targetRootBranch.alpha <= 0f
                                  || targetRootBranch.width <= 0 || targetRootBranch.height <= 0
                                  || !targetRootBranch.getGlobalVisibleRect(visibleRect)
                                  || visibleRect.isEmpty) {
                                "rn-safearea-pixhome-self-visible-unconfirmed"
                              } else {
                                // getGlobalVisibleRect is in root-view coordinates,
                                // while MotionEvent rawX/rawY use screen coordinates.
                                // Convert the touch into the same root-view space.
                                // Read-only: no touch dispatch or View mutation.
                                val rootView = targetRootBranch.rootView
                                if (!rootView.isAttachedToWindow || !rootView.isShown) {
                                  "rn-safearea-pixhome-self-visible-unconfirmed"
                                } else {
                                  val rootOrigin = IntArray(2)
                                  rootView.getLocationOnScreen(rootOrigin)
                                  val rootLocalX = px - rootOrigin[0]
                                  val rootLocalY = py - rootOrigin[1]
                                  if (!rootLocalX.isFinite() || !rootLocalY.isFinite()) {
                                    "rn-safearea-pixhome-self-visible-unconfirmed"
                                  } else if (rootLocalX >= visibleRect.left && rootLocalX < visibleRect.right
                                      && rootLocalY >= visibleRect.top && rootLocalY < visibleRect.bottom) {
                                    val siblingOrder = negrescoLabRootSiblingOrderCategory(
                                      root, pixRootBranch, targetRootBranch)
                                    if (siblingOrder == "rn-safearea-pixhome-hit-index-higher"
                                        || siblingOrder == "rn-safearea-pixhome-hit-mapped-higher") {
                                      val isolated = negrescoLabIsolatedPixTargetCategory(
                                        pix, pixRootBranch, px, py)
                                      if (isolated == "rn-safearea-isolated-pix-direct"
                                          || isolated == "rn-safearea-isolated-pix-descendant"
                                          || isolated == "rn-safearea-isolated-pix-ancestor") {
                                        negrescoLabPixThreePointCategory(
                                          root, pix, pixRootBranch, targetRootBranch, tagId, px, py)
                                      } else isolated
                                    } else siblingOrder
                                  } else {
                                    "rn-safearea-pixhome-self-visible-miss-child-away"
                                  }
                                }
                              }
                            } else {
                              "rn-safearea-pixhome-child-bounds-none-eligible"
                            }
                          }
                        }
                        3 -> "rn-safearea-both-home"
                        else -> {
                          val frontGroup = targetRootBranch as? android.view.ViewGroup
                          if (frontGroup != null && frontGroup.childCount == 0)
                            "rn-safearea-front-empty"
                          else "rn-safearea-neither-home"
                        }
                      }
                    } else "rn-front-" + group + "-" + mode
                  }
                  branchEnabled && !selectedDirectly ->
                    "rn-front-noiface-enabled-descendant"
                  !branchEnabled && selectedDirectly ->
                    "rn-front-noiface-disabled-direct"
                  else -> "rn-front-noiface-disabled-descendant"
                }
              } else {
                val getter = iface.getMethod("getPointerEvents")
                when (getter.invoke(targetRootBranch)?.toString()
                    ?.lowercase(java.util.Locale.ROOT)) {
                  "auto" -> "rn-target-front-branch-auto"
                  "none" -> "rn-target-front-branch-none"
                  "box_only", "box-only" -> "rn-target-front-branch-box-only"
                  "box_none", "box-none" -> "rn-target-front-branch-box-none"
                  else -> "rn-target-front-branch-unconfirmed"
                }
              }
            } catch (_: Exception) {
              "rn-target-front-branch-unconfirmed"
            }
          }
          // Both Views share the same direct ReactRootView branch. Determine
          // whether the selected View is under another nav button, not Pix.
          var targetAncestor: android.view.View? = node
          var navDepth = 0
          while (targetAncestor != null && targetAncestor !== root && navDepth < 64) {
            if (targetAncestor === nav) return "rn-target-other-same-nav"
            targetAncestor = targetAncestor.parent as? android.view.View
            navDepth += 1
          }
          return if (navDepth >= 64) "rn-target-unconfirmed"
            else "rn-target-other-same-app"
        }
        if (node is android.view.ViewGroup) {
          for (i in 0 until node.childCount) fullTree.add(node.getChildAt(i))
        }
      }
      if (count >= 2048) "rn-target-unconfirmed"
      else "rn-target-virtual-unconfirmed"
    } catch (_: Exception) {
      "rn-target-unconfirmed"
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
    val rootPeer = if (event.actionMasked == android.view.MotionEvent.ACTION_DOWN)
      negrescoLabPixRootPeerCategory(event) else "root-peer-unconfirmed"
    val rootPointer = if (event.actionMasked == android.view.MotionEvent.ACTION_DOWN)
      negrescoLabPixRootPointerCategory(event) else "root-pointer-unconfirmed"
    val resolved = if (event.actionMasked == android.view.MotionEvent.ACTION_DOWN)
      negrescoLabResolvedTargetCategory(event) else "rn-target-unconfirmed"
    val handled = super.dispatchTouchEvent(event)
    if (event.actionMasked == android.view.MotionEvent.ACTION_DOWN) {
      negrescoLabSetDispatchCategory(
        (if (handled) "activity-down-consumed-" else "activity-down-unconsumed-") + rootHit
      )
      negrescoLabSetScrollCategory(scrollCoverage)
      negrescoLabSetPixCategory(pixTarget)
      negrescoLabSetSiblingCategory(siblings)
      negrescoLabSetRootPeerCategory(rootPeer)
      negrescoLabSetRootPointerCategory(rootPointer)
      negrescoLabSetResolvedTargetCategory(resolved)
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


def classify_root_peer_state(raw: str | None) -> str:
    """Accept only a fixed class-family code, never a Java View class name."""
    if not isinstance(raw,str) or len(raw)>64:
        return "root-peer-unconfirmed"
    return raw if raw in ROOT_PEER_ALLOWED else "root-peer-unconfirmed"


def read_debug_root_peer_state(adb, package: str) -> str:
    if not isinstance(package,str) or not re.fullmatch(r"[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+",package):
        return "root-peer-unconfirmed"
    try:
        raw=adb("shell","run-as",package,"cat","files/"+ROOT_PEER_FILE,timeout=15,check=False)
    except Exception:
        return "root-peer-unconfirmed"
    return classify_root_peer_state(raw if isinstance(raw,str) else None)


def classify_root_pointer_state(raw: str | None) -> str:
    """Read only allowed pointer-events mode code from private Debug."""
    if not isinstance(raw,str) or len(raw)>64:
        return "root-pointer-unconfirmed"
    return raw if raw in ROOT_POINTER_ALLOWED else "root-pointer-unconfirmed"


def read_debug_root_pointer_state(adb, package: str) -> str:
    if not isinstance(package,str) or not re.fullmatch(r"[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+",package):
        return "root-pointer-unconfirmed"
    try:
        raw=adb("shell","run-as",package,"cat","files/"+ROOT_POINTER_FILE,timeout=15,check=False)
    except Exception:
        return "root-pointer-unconfirmed"
    return classify_root_pointer_state(raw if isinstance(raw,str) else None)


def classify_resolved_target_state(raw: str | None) -> str:
    """Only exact native touch-target codes are allowed to leave app private storage."""
    if not isinstance(raw,str) or len(raw)>64:
        return "rn-target-unconfirmed"
    return raw if raw in RN_TARGET_ALLOWED else "rn-target-unconfirmed"


def read_debug_resolved_target_state(adb, package: str) -> str:
    if not isinstance(package,str) or not re.fullmatch(r"[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+",package):
        return "rn-target-unconfirmed"
    try:
        raw=adb("shell","run-as",package,"cat","files/"+RN_TARGET_FILE,timeout=15,check=False)
    except Exception:
        return "rn-target-unconfirmed"
    return classify_resolved_target_state(raw if isinstance(raw,str) else None)


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

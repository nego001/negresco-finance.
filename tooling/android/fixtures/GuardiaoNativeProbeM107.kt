package com.negresco.finance

import android.app.Activity
import android.graphics.Rect
import android.os.Build
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import java.io.PrintWriter
import java.util.ArrayDeque

// Disposable Debug-only helper. Never dispatch events, read text or write storage.
internal object GuardiaoNativeProbeM107 {
    private const val MARKER = "NEGRESCO_LAB_M107_NATIVE "
    private val prefixes = listOf(
        "negresco-lab-rn-page-home-pressin-",
        "negresco-lab-quick-pix-layout-",
        "negresco-lab-tab-home-yoga-",
        "negresco-lab-tab-pix-yoga-",
        "negresco-lab-tab-negresco-yoga-"
    )

    private fun kind(v: View): String {
        val name = v.javaClass.name
        return when (name) {
            "com.facebook.react.views.view.ReactViewGroup" -> "react-viewgroup"
            "com.facebook.react.ReactRootView" -> "react-root"
            "com.facebook.react.runtime.ReactSurfaceView" -> "react-surface"
            "android.widget.FrameLayout" -> "android-frame"
            "android.widget.LinearLayout" -> "android-linear"
            "android.view.ViewGroup" -> "android-viewgroup"
            "android.view.View" -> "android-view"
            else -> when {
                name.startsWith("com.facebook.react.devsupport.") -> "react-devsupport"
                name.startsWith("expo.modules.") -> "expo-module"
                name.startsWith("androidx.") -> "androidx"
                else -> "other-class"
            }
        }
    }

    private fun chain(v: View): List<View> {
        val result = ArrayList<View>()
        var item: View? = v
        while (item != null) {
            if (result.size >= 128 || result.any { it === item }) error("chain")
            result.add(item)
            item = item.parent as? View
        }
        return result
    }

    private fun bounds(v: View): Rect? {
        val rect = Rect()
        return if (v.isShown && v.getGlobalVisibleRect(rect) && !rect.isEmpty) rect else null
    }

    private fun report(activity: Activity): String {
        if (Build.VERSION.SDK_INT != 35 || !BuildConfig.DEBUG ||
            Looper.myLooper() != Looper.getMainLooper() || !activity.hasWindowFocus())
            return "scope-unconfirmed"
        val root = activity.window.peekDecorView() ?: return "root-unconfirmed"
        val queue = ArrayDeque<View>()
        val all = ArrayList<View>()
        queue.add(root)
        while (queue.isNotEmpty()) {
            if (all.size >= 20000) return "limit-unconfirmed"
            val v = queue.removeFirst()
            all.add(v)
            if (v is ViewGroup) {
                for (i in 0 until v.childCount) queue.add(v.getChildAt(i))
            }
        }
        val groups = prefixes.map { prefix ->
            all.filter { v ->
                val tag = v.getTag(com.facebook.react.R.id.react_test_id) as? String
                tag?.startsWith(prefix) == true
            }
        }
        if (groups.any { it.size != 1 }) return "anchors-unconfirmed"
        val anchors = groups.map { it.single() }
        if (anchors.toSet().size != prefixes.size) return "anchors-unconfirmed"
        val chains = anchors.map { chain(it) }
        val common = chains.first().firstOrNull { a -> chains.all { c -> c.any { it === a } } }
            ?: return "subtree-unconfirmed"
        val pix = anchors[3]
        val target = bounds(pix) ?: return "target-unconfirmed"
        val cx = target.centerX()
        val cy = target.centerY()
        val hits = all.filter { v ->
            v !== pix && v.isEnabled && v.isClickable &&
                chain(v).none { it === common } &&
                chains.none { c -> c.any { it === v } } &&
                bounds(v)?.contains(cx, cy) == true
        }
        if (hits.isEmpty()) return "no-native-candidate"
        if (hits.size != 1) return "multiple-native-candidates"
        val hit = hits.single()
        val parent = hit.parent as? View ?: return "parent-unconfirmed"
        val h = bounds(hit) ?: return "geometry-unconfirmed"
        val p = bounds(parent) ?: return "geometry-unconfirmed"
        // Dimensions are private transient dump fields, never logcat or public output.
        return "unique-native-candidate ${kind(hit)} ${kind(parent)} ${h.width()} ${h.height()} ${p.width()} ${p.height()}"
    }

    fun dump(activity: Activity, prefix: String, writer: PrintWriter) {
        val value = try { report(activity) } catch (_: Exception) { "probe-unconfirmed" }
        writer.println(prefix + MARKER + value)
    }
}

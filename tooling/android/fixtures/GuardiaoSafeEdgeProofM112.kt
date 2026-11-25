package com.negresco.finance

import android.app.Activity
import android.graphics.Rect
import android.os.Build
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import java.io.PrintWriter
import java.util.ArrayDeque
import kotlin.math.max

// Disposable Debug proof only: no input, storage, network, raw geometry or text output.
internal object GuardiaoSafeEdgeProofM112 {
    private val anchors = listOf(
        "negresco-lab-rn-page-home-pressin-",
        "negresco-lab-tab-home-yoga-",
        "negresco-lab-tab-pix-yoga-",
        "negresco-lab-tab-negresco-yoga-"
    )

    private fun frame(view: View): Rect? {
        if (!view.isShown || view.width <= 0 || view.height <= 0) return null
        val xy = IntArray(2)
        view.getLocationOnScreen(xy)
        val visible = Rect()
        if (!view.getGlobalVisibleRect(visible) ||
            visible.width() != view.width || visible.height() != view.height) return null
        return Rect(xy[0], xy[1], xy[0] + view.width, xy[1] + view.height)
    }

    @Suppress("DEPRECATION")
    private fun safeRect(decor: View): Rect? {
        val outer = frame(decor) ?: return null
        val insets = decor.rootWindowInsets ?: return null
        if (insets.isConsumed) return null
        val edges = if (Build.VERSION.SDK_INT >= 30) {
            val i = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            intArrayOf(i.left, i.top, i.right, i.bottom)
        } else {
            val c = insets.displayCutout
            intArrayOf(
                max(insets.systemWindowInsetLeft, c?.safeInsetLeft ?: 0),
                max(insets.systemWindowInsetTop, c?.safeInsetTop ?: 0),
                max(insets.systemWindowInsetRight, c?.safeInsetRight ?: 0),
                max(insets.systemWindowInsetBottom, c?.safeInsetBottom ?: 0)
            )
        }
        if (edges.any { it < 0 } || edges.all { it == 0 }) return null
        if (edges[0].toLong() + edges[2] >= outer.width() ||
            edges[1].toLong() + edges[3] >= outer.height()) return null
        return Rect(outer.left + edges[0], outer.top + edges[1],
            outer.right - edges[2], outer.bottom - edges[3])
    }

    private fun classify(activity: Activity): String {
        if (!BuildConfig.DEBUG || Build.VERSION.SDK_INT !in setOf(28, 29, 35) ||
            Looper.myLooper() != Looper.getMainLooper() || !activity.hasWindowFocus())
            return "scope-unconfirmed"
        val decor = activity.window.peekDecorView() ?: return "decor-unconfirmed"
        val safe = safeRect(decor) ?: return "safe-rectangle-unconfirmed"
        val queue = ArrayDeque<View>()
        val all = ArrayList<View>()
        queue.add(decor)
        while (queue.isNotEmpty()) {
            if (all.size >= 20000) return "view-limit-unconfirmed"
            val v = queue.removeFirst()
            all.add(v)
            if (v is ViewGroup) for (i in 0 until v.childCount) queue.add(v.getChildAt(i))
        }
        fun tag(v: View): String? = v.getTag(com.facebook.react.R.id.react_test_id) as? String
        if (all.any { tag(it)?.startsWith("negresco-lab-rn-page-pix-pressin-") == true })
            return "home-unconfirmed"
        val matches = anchors.map { prefix -> all.filter { tag(it)?.startsWith(prefix) == true } }
        if (matches.any { it.size != 1 }) return "anchors-unconfirmed"
        val views = matches.map { it.single() }
        if (views.toSet().size != 4 || views.drop(1).any { !it.isEnabled || !it.isClickable })
            return "anchors-unconfirmed"
        val rects = views.map { frame(it) ?: return "anchor-frame-unconfirmed" }
        if (rects.any { !safe.contains(it) }) return "outside-safe-edges"
        if (rects.drop(1).any { it.top < rects[0].bottom }) return "vertical-order-unconfirmed"
        for (i in 1..3) for (j in i+1..3) {
            if (Rect.intersects(rects[i], rects[j])) return "tab-overlap-unconfirmed"
        }
        return "inside-safe-edges"
    }

    fun dump(activity: Activity, prefix: String, writer: PrintWriter) {
        val result = try { classify(activity) } catch (_: Exception) { "proof-unconfirmed" }
        writer.println(prefix + "NEGRESCO_LAB_M112_SAFE_EDGES " + result)
    }
}

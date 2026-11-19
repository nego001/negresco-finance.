package com.negresco.a11ypersistent.lab;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.ViewTreeObserver;
import android.widget.TextView;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Fixed-content, own-package Activity. The readiness latch is observational only. */
public final class ProbeActivity extends Activity {
  private static volatile ProbeActivity active;
  private final CountDownLatch visible = new CountDownLatch(1);
  private volatile boolean resumed;
  private volatile boolean focused;
  private volatile boolean laidOut;

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    active = this;
    TextView label = new TextView(this);
    label.setText("Synthetic accessibility reference");
    setContentView(label);
    getWindow().getDecorView().getViewTreeObserver().addOnGlobalLayoutListener(
      new ViewTreeObserver.OnGlobalLayoutListener() {
        @Override public void onGlobalLayout() { recordVisibleIfReady(); }
      });
  }

  @Override protected void onResume() {
    super.onResume();
    resumed = true;
    recordVisibleIfReady();
  }

  @Override public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) focused = true;
    recordVisibleIfReady();
  }

  private void recordVisibleIfReady() {
    View decor = getWindow().getDecorView();
    if (decor.getWidth() > 0 && decor.getHeight() > 0) laidOut = true;
    if (resumed && !isFinishing() && hasWindowFocus() && decor.isShown()
        && decor.getWidth() > 0 && decor.getHeight() > 0) {
      visible.countDown();
    }
  }

  static ProbeActivity current() { return active; }

  boolean awaitVisible(long timeoutMillis) throws InterruptedException {
    return visible.await(timeoutMillis, TimeUnit.MILLISECONDS);
  }

  /** Fixed diagnostic category, never window details or accessibility content. */
  String readinessFailureCategory() {
    if (!resumed) return "not-resumed";
    if (!focused) return "no-focus";
    if (!laidOut) return "no-layout";
    return "not-ready";
  }

  @Override protected void onDestroy() {
    if (active == this) active = null;
    super.onDestroy();
  }
}

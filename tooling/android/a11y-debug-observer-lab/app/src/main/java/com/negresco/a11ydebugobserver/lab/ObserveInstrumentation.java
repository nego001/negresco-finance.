package com.negresco.a11ydebugobserver.lab;

import android.app.Activity;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.os.Bundle;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.concurrent.TimeoutException;

/**
 * Disposable instrumented observer: do not launch an Activity, inject any input,
 * read UI text, request permissions, or interact with PDFs or financial data.
 * Only a fixed boolean package-equality test ever leaves each root.
 */
public final class ObserveInstrumentation extends Instrumentation {
  private static final String DEBUG_PACKAGE = "com.negresco.finance";
  private String mode = "unconfirmed";

  @Override public void onCreate(Bundle args) {
    super.onCreate(args);
    if (args != null) mode = args.getString("mode", "unconfirmed");
    start();
  }

  @Override public void onStart() {
    Bundle result = new Bundle();
    result.putString("mode", mode);
    result.putString("idle", "unconfirmed");
    String verdict = "unconfirmed";
    try {
      if (!"idle".equals(mode)) throw new IllegalArgumentException("not allowlisted");
      UiAutomation session = getUiAutomation();
      if (session == null) throw new IllegalStateException("no automation session");
      try {
        // ONE bounded event-idle check, BEFORE the three root reads.
        session.waitForIdle(1000L, 5000L);
        result.putString("idle", "idle-observed");
      } catch (TimeoutException timeout) {
        result.putString("idle", "idle-timeout");
        throw timeout;
      }
      int present = 0;
      for (int i = 1; i <= 3; i++) {
        AccessibilityNodeInfo root = null;
        String state = "unconfirmed";
        try {
          root = session.getRootInActiveWindow();
          if (root == null) {
            state = "null";
          } else if (DEBUG_PACKAGE.contentEquals(root.getPackageName())) {
            state = "present";
            present++;
          } else {
            // Do not reveal any foreign package, label, bounds or node details.
            state = "foreign";
          }
        } finally {
          if (root != null) root.recycle();
        }
        result.putString("sample" + i, state);
      }
      verdict = present == 3 ? "all-present" : "some-unconfirmed";
    } catch (Exception ignored) {
      // A failure is never converted to a usable root or successful verdict.
      verdict = "unconfirmed";
    } finally {
      result.putString("verdict", verdict);
      finish(Activity.RESULT_OK, result);
    }
  }
}

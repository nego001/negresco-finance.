package com.negresco.a11ypersistent.lab;
import android.app.Activity;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.content.Intent;
import android.os.Bundle;
import android.view.accessibility.AccessibilityNodeInfo;
/** Standalone self-instrumented synthetic app, never the finance app. */
public final class ProbeInstrumentation extends Instrumentation {
  @Override public void onCreate(Bundle data) { super.onCreate(data); start(); }
  @Override public void onStart() {
    UiAutomation session = null;
    Bundle report = new Bundle();
    String verdict = "unconfirmed";
    try {
      Intent intent = new Intent(getTargetContext(), ProbeActivity.class);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getTargetContext().startActivity(intent);
      waitForIdleSync();
      session = getUiAutomation();
      if (session != null) {
        int present = 0;
        for (int i = 1; i <= 3; i++) {
          AccessibilityNodeInfo root = null;
          String status = "unconfirmed";
          try {
            root = session.getRootInActiveWindow();
            status = root == null ? "null" : "present";
            if (root != null) present++;
          } finally {
            if (root != null) root.recycle();
          }
          report.putString("sample" + i, status);
        }
        verdict = present == 3 ? "all-present" : "some-null";
      }
    } catch (Exception ignored) {
      verdict = "unconfirmed";
    } finally {
      report.putString("verdict", verdict);
      // Instrumentation.finish closes its owned UiAutomation connection.
      // No hidden API: android.jar does not expose UiAutomation.destroy().
      finish(Activity.RESULT_OK, report);
    }
  }
}

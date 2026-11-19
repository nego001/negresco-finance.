package com.negresco.a11ypersistent.lab;

import android.app.Activity;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.content.Intent;
import android.os.Bundle;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.concurrent.TimeoutException;

/** Synthetic self-instrumentation only; never targets the finance application. */
public final class ProbeInstrumentation extends Instrumentation {
  private String mode = "unconfirmed";

  @Override public void onCreate(Bundle data) {
    super.onCreate(data);
    if (data != null) mode = data.getString("mode", "unconfirmed");
    start();
  }

  @Override public void onStart() {
    Bundle report = new Bundle();
    String verdict = "unconfirmed";
    report.putString("mode", mode);
    report.putString("readiness", "unconfirmed");
    report.putString("idle", "unconfirmed");
    try {
      boolean syncedLaunch = "synced".equals(mode) || "synced-idle".equals(mode);
      if (!"baseline".equals(mode) && !"stabilized".equals(mode) && !syncedLaunch) {
        throw new IllegalArgumentException("invalid synthetic mode");
      }
      Intent intent = new Intent(getTargetContext(), ProbeActivity.class);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      ProbeActivity launched = null;
      if (syncedLaunch) {
        // Public API: obtain the actual Activity created in this instrumentation process.
        Activity started = startActivitySync(intent);
        if (started instanceof ProbeActivity) launched = (ProbeActivity) started;
      } else {
        getTargetContext().startActivity(intent);
        waitForIdleSync();
      }

      if ("stabilized".equals(mode) || syncedLaunch) {
        ProbeActivity activity = syncedLaunch ? launched : ProbeActivity.current();
        if (activity == null) {
          report.putString("readiness", "activity-missing");
          throw new IllegalStateException("synthetic Activity missing");
        }
        if (!activity.awaitVisible(10000L)) {
          report.putString("readiness", activity.readinessFailureCategory());
          throw new IllegalStateException("synthetic window not ready");
        }
        report.putString("readiness", "ready");
      } else {
        report.putString("readiness", "not-requested");
      }

      // Exactly one UiAutomation connection and three non-retried observations.
      UiAutomation session = getUiAutomation();
      if (session != null) {
        if ("synced-idle".equals(mode)) {
          // Public API waits for accessibility EVENT quietness, not proof of an active root.
          // One bounded wait before any root read; no retry after a missing root.
          try {
            session.waitForIdle(1000L, 5000L);
            report.putString("idle", "idle-observed");
          } catch (TimeoutException timeout) {
            report.putString("idle", "idle-timeout");
            throw timeout;
          }
        } else {
          report.putString("idle", "not-requested");
        }
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
      // finish() owns and closes the instrumented UiAutomation session.
      finish(Activity.RESULT_OK, report);
    }
  }
}

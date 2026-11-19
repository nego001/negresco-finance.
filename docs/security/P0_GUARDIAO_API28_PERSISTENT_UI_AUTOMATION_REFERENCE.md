# P0 #126: synthetic-only persistent UiAutomation reference

Previous Android9 matrix #44232211291 ended 1 PASS / 1 BLOCK; the BLOCK exhibited a null root while window focus later pointed to the app. CI #44232211047 passed 1588 tests.

This separate reference compiles ONE standalone package com.negresco.a11ypersistent.lab, testOnly, without requested permissions, networking, exported Activity or financial data. Its synthetic Activity displays fixed text. Instrumentation targets ONLY its own package, obtains ONE UiAutomation connection and calls getRootInActiveWindow THREE times without retries, gestures, screenshots, XML or text extraction. Root nodes are recycled and only present/null status is emitted.

CI builds with Android SDK tools and disposable one-day local key, then installs on two clean API28 emulators. The Python lab refuses to execute if com.negresco.finance is installed, and always attempts uninstall. Raw instrumentation output remains private and is checked for exactly three present samples, all-present verdict, and code -1. Any other outcome is BLOCK.

An all-present result would demonstrate only persistent access to the root of a SYNTHETIC reference Activity. It cannot prove safe PDF/chooser navigation or repair the original Release Print issue. Neither main nor app source nor the historical APK is touched. P0 #120/#126 OPEN; PR #125 Draft; approvedForProduction=false, stableReleaseAllowed=false.


## 19/11/2026: synchronized synthetic Activity versus accessibility-event idle

API28 matrix [#44446905086](https://github.com/nego001/negresco-finance./actions/runs/44446905086), commit `a7671ba`, finished **1 PASS / 1 BLOCK**: both `synced` trials confirmed `readiness=ready`; one showed `PPP` and the other `NNN`. Thus synchronous Activity creation and valid focus/layout are not sufficient to guarantee accessibility roots. This is not an APK Release PDF or navigation result. CI `#44446905151` had 1,597 contracts PASS; remaining required jobs must be checked before declaring full CI success.

The next disposable, own-package `synced-idle` variant compares a **single bounded** call to public `UiAutomation.waitForIdle(1000, 5000)` immediately after obtaining the one automation session and *before* any root access. Only `idle-observed` with the three consistent present roots (`PPP`) may PASS. An idle timeout, missing field, root null or inconsistent verdict remains BLOCK. Idle is event-stream quietness, **not proof that any accessibility window exists**. No added root attempts, gestures, prints, downloads, financial data, real APK, or branch promotion. The two new emulator trials are independent, not retries of past failed trials; avoid causal inference from cross-run comparisons.

P0 #120/#126 remain OPEN; PR #125 Draft; `main` and historical Release untouched; `approvedForProduction=false`, `stableReleaseAllowed=false`.

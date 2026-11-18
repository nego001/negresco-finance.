# API28 P0 #126 | Accessibility windows after null-root

## Verified inputs — 18 November 2026

The CI for commit `dd2f1ed`, [#44229679004](https://github.com/nego001/negresco-finance./actions/runs/44229679004), ended SUCCESS with **1583/1583 tests**. The three independent Android 9 emulators [#44229597906](https://github.com/nego001/negresco-finance./actions/runs/44229597906) ended 0 PASS/3 BLOCK. All three had `dump-exit=zero stdout=empty stderr=null-root`; the later read-only focus sample returned `window-focus-app` in every case. In trial 1, PDF A had been independently verified before the pre-return BLOCK. Trials 2 and 3 blocked earlier. The failure never authorized Home or PDF.

AOSP `DumpCommand.java` revision 17fac436d78f6ac642386a245fb4fdb7243a91a4 explicitly calls `UiAutomation.getRootInActiveWindow()`, writes `null root node` to stderr and returns if that node is null, before producing the XML file:
https://android.googlesource.com/platform/frameworks/uiautomator/+/17fac436d78f6ac642386a245fb4fdb7243a91a4/cmds/uiautomator/src/com/android/commands/uiautomator/DumpCommand.java

In AOSP Android Pie's `AccessibilityManagerService.dump()`, the accessibility service prints the header `ACCESSIBILITY MANAGER (dumpsys accessibility)` and lists `Window[...]` records when its accessibility window list is available:
https://android.googlesource.com/platform/frameworks/base/+/pie-release/services/accessibility/java/com/android/server/accessibility/AccessibilityManagerService.java

## New isolated diagnostic

Only **after the first `null-root`** is observed by the existing wrapper, sample once `adb shell dumpsys accessibility` with timeout 8 s and no retry, following the existing post-error window-focus query. Only one of three categories is printed: `accessibility-windows-listed`, `accessibility-windows-not-listed` or `accessibility-windows-unconfirmed`. No raw service output, app IDs, XML, text, window names, window counts, paths, error strings or hashes are logged. No additional UIAutomator or navigation actions occur.

The service dump is NOT atomic with the earlier `getRootInActiveWindow()` call. Even a listed accessibility window afterward cannot prove that the root was available at failure time. A missing listing is not necessarily a literal zero windows; security filtering or service conditions may affect the dump. This experiment distinguishes Windows-manager focus from the *separately tracked accessibility-window inventory*, not active-root availability.

No app, APK, timeout, PDF payload, export mechanism, strict two-snapshot navigation gate or release status is changed. Two isolated Android 9 API28 trials run the exact existing test-only Debug-signed APK SHA-256 `0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4`. P0 #120 (historical Release print without chooser) and #126 (navigation/observability) OPEN, PR #125 Draft, main unchanged, `approvedForProduction=false`, `stableReleaseAllowed=false`.

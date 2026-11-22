# M65 — Android 9 Debug native bootstrap and Metro transport triage

## Frozen evidence before M65

The [M64 Android run #45025070942](https://github.com/nego001/negresco-finance./actions/runs/45025070942), commit `6f41e36`, ended **BLOCK** after a successful disposable Debug build and an independently verified package-specific UiAutomation root (`debug-focused`, `idle-observed`, `PPP`). Its single UIAutomator snapshot reported:
- `debug-metro-transport=device-no-metro-connection-observed` from a private relay observed **before** any post-PPP shell probes;
- `debug-targetids=tabs-all-missing`, `debug-home-marker=home-marker-absent`;
- `debug-home-static=home-static-none`, `debug-app-structure=app-no-text-or-clickables`;
- `debug-app-resourceids=app-resource-ids-present`.

Thus the Android window belongs to the package but **the React Native Home was not attested**. No click or PDF was attempted. Neither that category nor a root PPP establishes whether the problem is Android network permission, the Metro reverse route, a JS/native boot error or an Expo lifecycle. This is NOT a demonstrated UI layout failure, PDF fix or production readiness.

The M64 contract-only correction [`d8e106a`](https://github.com/nego001/negresco-finance./commit/d8e106a3d3309cd49d6dfe870e55e287eaf94681) reached [CI #45025246189](https://github.com/nego001/negresco-finance./actions/runs/45025246189) **SUCCESS, 1,625/1,625 contracts PASS**. All mandatory native/security jobs succeeded; optional emulator jobs in the general CI were skipped. This does not override the Android M64 BLOCK.

## Pre-registered M65 (separate branch)

Use the *same untouched* disposable Android9/API28 Debug app and separate no-permission `testOnly` observer from M64. Do not edit `apps/mobile`, the original Release or production properties. Keep the private offline Metro, one bounded event-idle wait and three non-retried `getRootInActiveWindow()` reads with expected `PPP`, verified foreground/PID, and original Debug APK SHA/signature/permissions policy. Anything before PPP that fails is BLOCK.

**After verified PPP**, the private relay emits its existing category from the app-observation window FIRST. Later shell-UID transport probes must NEVER be counted as application HTTP requests. The new M65 callback then reads only fixed categorical results from existing, security-reviewed collectors:
- `debug-internet-permission`: `internet-permission-granted`, `not-declared`, `not-granted`, `unconfirmed` (derived from the package manager's INTERNET permission; never publish package dumps);
- `debug-native-bootstrap`: native startup hint `native-cleartext-denied`, `native-internet-permission-denied`, `native-dns-unreachable`, `native-connection-refused`, `native-connection-timeout`, `native-js-bundle-load-error`, `native-js-runtime-error`, or `native-startup-unconfirmed`. Only restricted Android logging tags are scanned privately in RAM; no raw logcat or exception is emitted. This is a hint, not automatic causality.
- `debug-adb-reverse`: `adb-reverse-confirmed` only if the exact 8081-to-18081 localhost mapping appears once; `absent` or `unconfirmed` otherwise. No other ADB routes reported.
- `debug-metro-host`: allowlisted host-property classification with any unknown value redacted.
- `debug-device-loopback` / `debug-device-alias`: fixed status-only routes from Android shell if `toybox nc` exists; otherwise explicit `probe-tool-unavailable`.
- `debug-shell-loopback` / `debug-shell-alias`: Java `app_process` probes from shell UID against only static local Metro status endpoints; only `shell-metro-status-reachable`, `shell-route-unconfirmed`, or `shell-probe-unavailable` are returned. Its disposable non-APK JAR is removed. **Shell-UID reachability never proves app-UID reachability.**

Only after those passive system checks does the M64 callback take **one** UIAutomator hierarchy snapshot, derive its fixed Home, tab-ID and structure categories, then delete the temporary `/sdcard/negresco_ui.xml` in `finally`. Cleanup failure invalidates the entire UI result. No additional UI snapshot, touch, swipe, BACK, retry, arbitrary HTTP host, screenshot, PDF, test account or financial data is permitted.

**M65 PASS remains at least as strict as M64**: correct app foreground and unchanged PID, verified observer `PPP`, exactly three unique bounded safe clickable bottom tabs (`tabs-present-bounded`), a unique Home marker, all three fixed Home content markers, and XML cleanup. Permissions/transport success alone NEVER overrides a missing or unsafe UI; any failure or unconfirmed UI state = **BLOCK**.

M65 is designed to distinguish likely failure stages, not to claim that a successful /status shell probe causes JavaScript startup. If all boot/route channels look healthy but Metro still sees no app request, investigate the Debug native entrypoint/React lifecycle in a separate branch; never patch production UI geometry on that basis alone.

## Safety status

P0 #120 and #126 remain OPEN. PR #125 remains Draft. `approvedForProduction=false`, `stableReleaseAllowed=false`. No merge, OTA, production signing/release, private account access, payment, user-device instrumentation or synthetic PDF in M65.
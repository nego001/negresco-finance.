# M64 — Android 9 Debug Home native-readiness census (no UI gestures)

## Known, independently verified evidence

The original M63 run [#44826635036](https://github.com/nego001/negresco-finance./actions/runs/44826635036) on commit `996e43f` concluded **BLOCK**. Its disposable Debug app was in foreground with PID stable, and external UiAutomation observed `idle-observed`, `all-present` and **PPP**. One independent native UIAutomator snapshot recorded:
- `debug-targetids=tabs-all-missing`: none of the three known Debug bottom tab testIDs appeared;
- `debug-home-marker=home-marker-absent`: no matching Debug RN Home header testID appeared.

The app did have package-owned nodes in the native hierarchy (the `no-debug-package-nodes` category was not returned). Thus the finding does **not** mean no app window existed; nor does it prove the React Native Home UI had loaded. This result cannot authorize a click, prevent a native observer PASS, or establish the PDF #120 root cause. M63 contracts: **1620/1620 PASS**. Its general CI [#44826634906](https://github.com/nego001/negresco-finance./actions/runs/44826634906) was **FAIL**, with `authority-postgres-lab` blocked by Gradle dependency resolution for `kotlin-gradle-plugins-bom:2.0.21`; a source-code/business regression was not established.

## M64 preregistered diagnostic

Use one new disposable Android 9/API28 emulator. Preserve the same independently compiled no-permission testOnly observer, Debug-only app manifest/permissions integrity, hash check, local Metro reverse relay, focus/PID gates, one bounded `UiAutomation.waitForIdle(1000,5000)`, and three non-retried package-specific root reads `PPP`. A missing root or wrong/foreign foreground is BLOCK before the native screenshot-free census.

Only after the PPP gate, the runner obtains **one** native UIAutomator hierarchy in volatile memory and computes the same M63 `debug-targetids` and `debug-home-marker` categories from this snapshot. From this exact same snapshot, additionally compare only three predefined, public UI string constants from `App.tsx` in app-owned TextView nodes: `PAINEL PRINCIPAL`, `MODO PRÉVIA` and `Acesso rápido`. Output only `debug-home-static`:
- `home-static-all`: all three found exactly once;
- `home-static-partial`: one or two matched exactly;
- `home-static-none`: none matched;
- `home-static-duplicate`: any matched more than once;
- `home-static-unconfirmed`: snapshot invalid, missing or cleanup failed.

Also emit two independent categorical signals:
- `debug-app-structure`: `app-text-and-clickable`, `app-text-only`, `app-clickable-only`, `app-no-text-or-clickables`, or `app-structure-unconfirmed`, based strictly on whether package-owned TextView nodes and enabled clickable nodes exist (no arbitrary content read or returned);
- `debug-app-resourceids`: `app-resource-ids-present`, `app-resource-ids-absent`, or `app-resource-ids-unconfirmed`, based only on existence of a nonempty ID, never its value.

Finally, the original private Metro relay reports its own preexisting **fixed-category only** transport status as `debug-metro-transport`, e.g. `device-debug-bundle-http-200`, `device-no-metro-connection-observed` or an inconclusive status. It does not print requests, URLs, headers, responses, JavaScript, stack traces, PIDs or sensitive user data. A transport success does not prove JS rendered or authorize a UI operation.

**The PASS threshold is deliberately stronger, not weaker:** only `tabs-present-bounded`, `home-marker-unique` **AND** `home-static-all` after PPP, PID/focus stability, original strict bottom geometry bounds and successful XML deletion. Any other status is BLOCK; fail closed after any error without retrying the snapshot, extending a timeout or tapping the screen. Delete the raw temporary `/sdcard/negresco_ui.xml` in a `finally` block even when parsing fails; cleanup failure invalidates all diagnostics. Do not upload any artifacts.

The diagnostic can help distinguish a bundle still unavailable / RN Home not yet exposed from React Native's `testID` visibility mismatch. It cannot conclusively prove either cause from one snapshot. Source-level layout edits must wait until this differential evidence is inspected. Even `home-static-all` with absent testIDs does not pass geometry.

## Safety and unfinished work

One new Debug-only observation does not validate the original historical Release, PDF/chooser, 2-cycle navigation, physical devices, accessibility for end users or account/payment safety. No PDF, bank information, test boleto, navigation gestures, Back, screenshot, raw XML/logcat, application permissions, production signing, release APK or update to `main`.

P0 #120 and #126 remain OPEN, PR #125 remains Draft, `approvedForProduction=false` and `stableReleaseAllowed=false`. No merge, OTA or publication.
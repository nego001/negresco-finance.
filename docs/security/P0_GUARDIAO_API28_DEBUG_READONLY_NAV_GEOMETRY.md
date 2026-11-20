# M62 — API28 Debug-only passive navigation geometry after independently verified root

## Prior evidence

- M60 [#44450094336](https://github.com/nego001/negresco-finance./actions/runs/44450094336) confirmed one read-only external Debug root observation on Android9: `debug-focused`, `idle-observed`, `PPP`, stable PID.
- M61 [#44452096423](https://github.com/nego001/negresco-finance./actions/runs/44452096423) independently reproduced this observation **2/2 PASS** in two clean Android9 emulators, each `PPP`. This verifies only the observer's root availability on those devices. CI contract-correction [#44452322576](https://github.com/nego001/negresco-finance./actions/runs/44452322576) completed SUCCESS, **1610/1610 contracts PASS**.
- P0 #126 remains OPEN: the historical original Release's three bottom targets have previously appeared thin or unusable under UIAutomator, even prior to PDF; P0 #120 remains OPEN: PDF can remain pending without chooser.

## M62 prospective single-run gate

Create a fresh Android 9/API28 emulator and a disposable Debug APK of Negresco Finance with private Metro loopback, no accounts or real data. The app is started only once at Home. Build a second no-permission, testOnly APK as an *external*, instrumentation-only observer. It requires focus and PID stable; exactly one `UiAutomation.waitForIdle(1000,5000)` then three non-retried roots, all from the Debug package (`PPP`). Anything else BLOCKs and the geometry callback is not called.

Only *after* the independent PPP proof, collect exactly ONE UIAutomator hierarchy snapshot in the memory of the disposable runner, evaluate strictly the three known Debug testIDs `negresco-lab-tab-home`, `negresco-lab-tab-pix`, `negresco-lab-tab-negresco`, and discard the snapshot. This is the same Debug UI testID encoding used by the existing root/Yoga/window diagnostics, not a new product API. Do NOT log raw XML, labels, text, UI attributes, coordinates, taps, screenshots, identity tokens, PID, HTTP, exceptions or PDFs.

For each target, validate: exactly one node, exact Debug app package, clicked/enabled attributes, bounded nonzero rectangle within physical viewport and bottom safe area, eligible width/height, three distinct non-overlapping rectangles. Reuse the existing strict `safe_ancestor_constraint_category`, no inferred tap positions. Expose **only one fixed category**:
- `three-bounded`: all three eligible, distinct, clickable, package-matched and nonoverlapping, allowing an M62 *read-only geometry PASS*;
- `three-thin`: all three too short;
- `three-unsafe`: otherwise invalid or inconsistent geometry;
- `targets-overlap`, `nodes-missing-or-duplicate`, `package-unconfirmed`, `clickability-unconfirmed`, `geometry-unconfirmed`: fixed BLOCK reasons.

Any category other than `three-bounded` must BLOCK. Verify the Debug PID and foreground package remain stable after the passive snapshot. A `PPP` observation **must never override** an unsafe or missing geometry classification, and the experiment must never attempt a click, gesture, chooser, or second PDF. The one snapshot is not retried after a thin/missing result. A thin or ambiguous result is valuable diagnostic evidence, not a regression of the verified external root observer.

## Limits / isolation

One Android9 Debug-only run cannot prove user-facing accessibility, the original Release's geometry, successful navigation, share chooser, PDF #120, or reliability under repeated state transitions. Even if M62 passes, the next separate task is physical Android validation and an independent synthetic PDF receiver proof before any change to safety gates.

P0 #120 and #126 stay **OPEN**. PR #125 stays **Draft**. `approvedForProduction=false`; `stableReleaseAllowed=false`. No signing for production, merge, OTA, account or financial value, original Release modification or permission relaxation. No PDF is created in M62.


## Temporary UIAutomator XML cleanup hardening

The inherited `base.xml_nodes()` reader uses a temporary on-device file `/sdcard/negresco_ui.xml`. M62 explicitly deletes it with a bounded ADB operation in a `finally` block, whether parsing succeeds or fails. Failure to confirm cleanup changes the category to `geometry-unconfirmed` and **BLOCKs** the experiment, even if bounds appeared eligible. The XML is never printed, uploaded, persisted in GitHub artifacts or shared outside the ephemeral emulator. This is a change solely to the isolated Debug laboratory and does not alter source code or production permissions.

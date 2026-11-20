# M63 — Android 9 Debug target-ID presence diagnosis (single passive snapshot)

## Observed blocker from M62

The original [M62 Android 9 run #44756506936](https://github.com/nego001/negresco-finance./actions/runs/44756506936), commit `202919b`, concluded **FAIL/BLOCK** despite successful Debug APK build and external root observation:

- `debug-observer-preflight=debug-focused`
- `debug-external-idle=idle-observed`
- `debug-external-root=all-present`
- `debug-external-pattern=PPP`
- **`debug-nav-geometry=nodes-missing-or-duplicate`**
- `BLOCK (LAB): Android9 Debug passive tab geometry not attested`

This category proves **only** that at least one of three exact Debug navigation `testID` matches was not unique in the single `uiautomator dump` snapshot. It does NOT establish whether IDs were absent, duplicated or unexposed to UIAutomator, and does NOT prove the buttons visually disappeared or the UI bounds are actually thin. Never infer a layout fix from this result. The independent native root probe and UIAutomator dump use different access paths; `PPP` is a precondition, not a substitute for the UIAutomator hierarchy.

Both [M62 CI #44756506400](https://github.com/nego001/negresco-finance./actions/runs/44756506400) and the independent [cleanup CI #44757008207](https://github.com/nego001/negresco-finance./actions/runs/44757008207) completed **SUCCESS, 1615/1615 contracts PASS**. The M62 runner did not explicitly delete its temporary on-emulator `/sdcard/negresco_ui.xml`; the disposable emulator was destroyed and no artifact was uploaded. The cleanup-hardening commit `5f0b6e0` added mandatory deletion to the single-snapshot gate, without touching the product. M63 inherits that security constraint.

## Pre-registered M63 (diagnostic only)

Use a fresh disposable Android9/API28 emulator and newly built Debug app plus a separate no-permission, `testOnly` external observer. It launches only once and must prove the exact app package in foreground, the same PID before/after, a single bounded `UiAutomation.waitForIdle(1000,5000)` and exactly three non-retried `getRootInActiveWindow()` roots belonging to that Debug package (`PPP`). Failure at any stage is BLOCK; no navigation, input or PDF can take place.

**After the independent PPP only**, take exactly ONE private UIAutomator snapshot, without retries, into volatile memory; inspect solely package equality, three known Debug tab `testID` patterns (`home`, `pix`, `negresco`), and the fixed Debug Home resource-ID prefix `negresco-lab-rn-page-home-`. Never inspect node text/content descriptions, export arbitrary IDs, capture screenshots, use gestures, or publish XML, bounds, PID or app data.

Log only a bounded diagnosis `debug-targetids`:
- `no-debug-package-nodes`: the dump has no nodes from the Debug app package despite observer PPP;
- `tabs-all-missing`, `tabs-two-missing`, `tabs-one-missing`: exactly 3, 2, or 1 expected tab IDs absent, with other Debug nodes present;
- `tabs-duplicate`: one or more expected IDs occurs more than once (dominant over missing);
- `tabs-present-bounded`: exactly one of each tab ID; all three satisfy the original strict independent geometry constraints, clickable/enabled, package-correct, distinct and nonoverlapping;
- `tabs-present-thin`: all three IDs found but all rectangles too short;
- `tabs-present-unsafe`: all IDs found, but geometry remains unsafe or unconfirmed for another reason;
- `snapshot-unconfirmed`: input invalid, parsing failed, missing screen size, cleanup failed or other unconfirmed state.

Separate fixed `debug-home-marker` category: `home-marker-absent`, `home-marker-unique`, `home-marker-duplicate`, or `home-marker-unconfirmed`; this checks ONLY exact known resource-ID prefix, never UI text. The presence of a Home marker cannot approve navigation.

**Pass gate is unchanged:** only `tabs-present-bounded` may PASS; any other category remains BLOCK, even when external root was `PPP`. The two category strings are diagnostic only. In particular, do not loosen `safe_ancestor_constraint_category`, retry a failed snapshot, tap inferred coordinates or claim a PDF fix.

The temporary raw XML path `/sdcard/negresco_ui.xml` must be deleted from the emulator in `finally` after the single snapshot, including when classification fails. If cleanup cannot be confirmed, emit only `snapshot-unconfirmed` and BLOCK. The runner is ephemeral; no artifacts or raw output are uploaded. The existing Debug app, observer Java, raw XML reader and strict geometry function are unmodified.

## Security, next decision

If the M63 result is absent/duplicate, investigate how the known Debug view IDs are exposed through UIAutomator versus the external UiAutomation root, before proposing visual layout changes. If all three are present but thin/unsafe, investigate native touch targets and Yoga/window insets within a separate Debug-only experiment, still without clicks. Do not combine incompatible outcomes or equate one snapshot with user-facing operability.

P0 #120 and #126 remain OPEN; PR #125 stays Draft; `approvedForProduction=false`; `stableReleaseAllowed=false`. `main`, original historical Release APK, production signing and user devices are untouched. No PDF, no financial records, no transactions, no merge, no OTA.

# M68 — staging ONLY: pure, fail-closed Debug Home ↔ Pix preview target classifier

## Why the gate is staged separately

M66 [Android9 #45037362267](https://github.com/nego001/negresco-finance./actions/runs/45037362267) passed the strict initial native accessibility and bottom-tab geometry at a fixed 30-second first observation in a disposable Debug APK. M67 [matrix #45047183173](https://github.com/nego001/negresco-finance./actions/runs/45047183173) independently repeats this observation in two fresh API28 emulators; the current status when this staging artifact was authored was **trial 1 SUCCESS, trial 2 pending**. Neither observation covers any navigation or a second screen, and no Release bug is considered repaired.

The next potential experiment — two controlled, *synthetic preview-only* tab taps Home → Pix → Home — needs independent authorizations before any action. **M68 commits the pure candidate guard and tests only; it does NOT execute a tap, instrument an app, install an APK, change the workflow or run an Android emulator.** Staging is on a new independent branch from M67; it does not alter M67 while trials are running.

## Pure preflight candidate, not a tap permission

`guardiao_api28_debug_nav_preview_guard.py` has no ADB, I/O, subprocess, XML dump, logs or navigation calls. It is a deterministic classifier over caller-provided, in-memory native node dictionaries; its only result is a fixed `blocked-ambiguous-or-unsafe` with no target, or a **private in-memory** `eligible-candidate-only` with a center location. The center must NEVER be logged, stored, returned to the user, used without independent fresh focus/PID/accessibility evidence, or mistaken for proof that an actual tap was delivered.

It requires all of: bounded valid viewport; source/target exactly Home or Pix and different; one app-owned source-page Debug header marker and no destination-page marker; exactly one node for each three known bottom-tab Debug `testID` patterns, each in the exact Debug package, clickable, enabled, and selected/unselected as expected for source; non-degenerate rectangle eligible under the **unchanged** original `safe_ancestor_constraint_category`; all three rectangles distinct and nonoverlapping. Its candidate center is rejected if *any* other enabled clickable node (including foreign package overlay) geometrically covers it, or if a clickable occluder's bounds cannot be validated. Malformed node types/IDs, duplicate or missing markers, ambiguous selection, thin/oversized/outside viewport, overlap, occlusion or a mismatched page cause BLOCK.

The classifier deliberately makes **no** claim about native ancestor hit-testing, React Native event routing, app rendering after a touch, WebView/PDF behavior, or timing reliability. Geometry is a necessary but insufficient condition; full two-step navigation must require fresh post-action semantic page evidence, stable package/PID and fail-closed behavior in a separately reviewed synthetic-only Android workflow. No adaptive retries or bypass of root/geometry gates are allowed.

A fixture-only Node test executes isolated Python fixture cases for both directions and for absent, duplicate, wrong-selected, foreign-package, overlapping, thin, occluded, malformed and invalid viewport inputs. Neither fixtures nor classifier interact with a device, financial account or application.

## Safety

The user-facing Android application and production Release remain untouched. P0 #120 and #126 remain OPEN and PR #125 stays Draft; `approvedForProduction=false`, `stableReleaseAllowed=false`. **No PDF**, no navigation input, no bank data, no payment, no screenshot, no APK installation, no merge, no OTA or Release. Only when the M67 matrix is fully evaluated should a separate reviewed Android navigation workflow be considered.

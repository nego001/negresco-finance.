# M85b — corrected isolated branch preflight for the M85 root hit-order ablation

## M85 attempted, but no Android geometry tested

M84 [Android #45313895684](https://github.com/nego001/negresco-finance./actions/runs/45313895684) **2/2 PASS**, with two successive same-PID synthetic Home→Pix→Home preview cycles and post-run external PPP per emulator after removing only `labBottomBounds` and `labNavBounds` styles in disposable Debug checkouts; [CI M84 #45313895581](https://github.com/nego001/negresco-finance./actions/runs/45313895581) **SUCCESS, 1,717/1,717 contracts PASS**. M83 similarly completed 3/3 Android jobs with native contracts 1,713/1,713; historic M77/M79/M81 navigation / XML snapshot BLOCKs remain recorded.

Original M85 [Android #45315991591](https://github.com/nego001/negresco-finance./actions/runs/45315991591), commit `5c7bc13`, **FAIL in both jobs at the first source preflight stage**, *before compiling or starting any Android app*. This was not a navigation geometry finding: the M85 workflow called M84's command-line patcher under M85 `GITHUB_REF`; the M84 patcher intentionally allows only its **own** isolated M84 branch and correctly BLOCKed. Neither emulator reached the instrumented root hit-order comparison, no tap or XML capture occurred; never classify this as a successful M85 test or a root geometry failure. The original M85 failure stays recorded. A separate original M85 CI run does not repair the native result.

## Corrected M85b scope and unmodified test target

M85b replaces **only the two blocked temporary-checkout patch steps** with one branch-scoped atomic-in-preparation patcher. It imports the pre-existing *pure* `guardiao_api28_debug_legacy_nav_variant_m84.transform` for exactly the two M84 style removals, then the pre-existing *pure* `guardiao_api28_debug_root_hitorder_ablation_m85.transform` for exactly one additional root `s.labAndroidRootHitOrder` reference removal. It checks both transformations in memory before writing the single ephemeral checkout `App.tsx` once. The explicit `GITHUB_REF` must match **only** this M85b branch; no broad branch allowance, file symlink, fallback patch or content guessing. Any failed source check BLOCKs, no compilation or device action.

The resulting transient Debug source is **byte-for-byte identical to the originally intended M85 experimental input**. All other project code, root Android `paddingBottom`, remaining navigation styles, Metro, zero-permission observer, exactly one existing XML read/dump/cat per snapshot with mandatory cleanup, strict M64/M68 geometry, input authorizations, same PID, fixed delays, and PPP are unchanged.

The original M85 native run was not rerun. **Two newly registered fresh independent Android9/API28 Debug emulators** (`trial: [1, 2]`, `fail-fast: false`) each independently require two consecutive synthetic Home→Pix→Home preview cycles, with at most four strictly geometry-gated taps per emulator and an external `PPP` post-check. No retries, extra snapshots, BACK/swipes, longer timeout, PDF, screenshot, private logs, actual financial data or payments. Both must succeed for the experimental functional PASS. On any BLOCK retain the failure; do not weaken a touch guard.

Unlike original pinned Release, these tests use ephemeral Debug. Even successful comparison does **not** prove original Release's bottom geometry or native PDF chooser problem resolved.

## Hard safety gates

Original historical SHA-pinned Release APK SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` immutable. P0 #120 (native PDF / chooser hang) and #126 (original Release thin nav bounds) remain OPEN, PR #125 Draft/unmerged; `approvedForProduction=false`, `stableReleaseAllowed=false`. No `main` edit, Release rebuild, signing, OTA, public distribution, real Pix/account/payment.

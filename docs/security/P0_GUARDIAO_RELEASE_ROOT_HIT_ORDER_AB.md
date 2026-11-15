# LAB P0 | Root hit-order Android Release-mode candidate

**Not a production fix.** A separate navigation issue is tracked in
[#126](https://github.com/nego001/negresco-finance./issues/126);
the intermittent native PDF hang remains independently blocked in
[#120](https://github.com/nego001/negresco-finance./issues/120).

## Grounded comparison

Android9 Debug [#43672315365](https://github.com/nego001/negresco-finance./actions/runs/43672315365)
confirmed real Home↔Pix navigation in the same PID after applying
`labAndroidRootHitOrder:{zIndex:4,elevation:4}` to the root
`SafeAreaView`, **only under __DEV__**. This was a Debug-only observation,
not proof that zIndex is the sole cause.

The Release-mode candidate [#43759014244](https://github.com/nego001/negresco-finance./actions/runs/43759014244)
already showed a point-sized Início label and too-thin clickable
ancestor **before exporting** any PDF. Increasing the lower bar and tab
minimum heights (76dp and 60dp) did not fix Home navigation in this
Release-mode candidate. A was a valid synthetic PDF but Home before
B remained blocked, so B/C/D were not run.

## Controlled new variable

In branch `lab/p01-guardiao-release-root-hit-order-v1`, apply the
already existing `labAndroidRootHitOrder` to Android Release-mode
**without** also moving the Debug-only `paddingBottom` variation into
Release. The previously applied 76dp/60dp touch-target minima remain
unchanged. No handler, PDF, life-cycle state, payments, API configuration,
native window flags or stable signing is modified.

**Required acceptance:** TypeScript and contracts PASS, a new
DEBUG-SIGNED Release-mode APK produced with a NEW SHA, independent
Android9 native evidence of bounded bottom-tab geometry, Home
navigation and successful independent PDF receipts A–D in unchanged
PID. Even 4/4 in this new candidate does NOT validate the historical
immutable APK nor eliminate its intermittent print bug.

**No blind touch, force-stop, app-data clearing, OTA, main merge,
production release, signing secrets or financial transactions.**
P0 #120 OPEN and #126 OPEN, PR #125 DRAFT,
`approvedForProduction=false`, `stableReleaseAllowed=false`.

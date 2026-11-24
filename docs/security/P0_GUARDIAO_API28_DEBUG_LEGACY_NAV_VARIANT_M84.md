# M84 — two-style-only counterfactual of Android9 Debug bottom-navigation geometry

## Evidence, including unfixed failures

Original **SHA-pinned Release APK** #126 still exhibits thin / invalid accessibility geometry near the bottom bar, **before PDF export**. Its source was historically described as `bottom` height 76 and `nav` width 31%, marginVertical 6. Original Release PDF/chooser hang remains separately OPEN as P0 #120; no connection proven.

The current Debug app (and M83 HEAD) applies `style={[s.bottom,s.labBottomBounds]}` with `labBottomBounds:{minHeight:76,flexShrink:0}`, plus `style={[s.nav,s.labNavBounds,page===x.name&&s.navSelected]}` with `labNavBounds:{height:60,minHeight:60,flexShrink:0}`. This is a **potential visual geometry distinction**, not proof that either style caused original Release's thin hierarchy. Other differences, including Debug instrumentation, root style and API/native builds, remain. This is therefore **not** a faithful reproduction of original pinned Release.

- M77 [Android #45100825061](https://github.com/nego001/negresco-finance./actions/runs/45100825061) FAIL; M79 [#45106969309](https://github.com/nego001/negresco-finance./actions/runs/45106969309) FAIL; M81 [#45114233347](https://github.com/nego001/negresco-finance./actions/runs/45114233347) FAIL in a first-cycle UI XML parser read. Keep those failures as recorded.
- M82 [#45182221415](https://github.com/nego001/negresco-finance./actions/runs/45182221415) 2/2 independent Android9 Debug jobs PASS, [CI #45182221041](https://github.com/nego001/negresco-finance./actions/runs/45182221041) SUCCESS, 1,710/1,710 contracts.
- M83 [Android #45311941046](https://github.com/nego001/negresco-finance./actions/runs/45311941046) **3/3 fresh independent Android9 Debug jobs PASS**, two same-PID cycles each and post-run `PPP`. [CI #45311940931](https://github.com/nego001/negresco-finance./actions/runs/45311940931) **FAIL** despite **1,713/1,713 contracts PASS**, because unrelated native-lock-android-lab Gradle dependency fetch hit multiple upstream Maven HTTP 429 responses. A failed-job-only rerun was requested, no M83 native Android trials were repeated. The M83 source's Debug UI remains a distinct build from original Release; success does not close #126.

## Registered M84 experiment

M84 compares the existing M83 fully working Debug branch to an isolated **counterfactual Debug-only style variant**: *before disposable test-project prebuild*, a tiny fail-closed script changes **exactly two** occurrences in `apps/mobile/App.tsx` in the ephemeral GitHub Actions checkout:
- `style={[s.bottom,s.labBottomBounds]}` → `style={s.bottom}`
- `style={[s.nav,s.labNavBounds,page===x.name&&s.navSelected]}` → `style={[s.nav,page===x.name&&s.navSelected]}`

No committed application source is changed. All original root padding, React Native hierarchy, UI content, other style/layout, native build, zero-permission observer, Expat code-only parser, geometry classifier, size, PID, focus and semantic checks stay **unchanged**. The style patch refuses any missing, duplicate or premodified source and requires GitHub Actions `GITHUB_REF` of this isolated branch. It is *not* a production/release fix or proposal.

Two **separate fresh Android9/API28 Debug emulators** (`trial: [1, 2]`, `fail-fast: false`). Exactly two bounded same-process synthetic Home→Pix→Home preview cycles per emulator are planned; the existing strict **fail-closed** M64/M68 geometry is allowed to reject immediately if smaller/ambiguous targets appear. **At most four original guarded preview taps per emulator**, never touches from default/predefined coordinates, retries, longer waits/timeouts, gesture recovery, BACK/swipes, extra UIAutomator read, screenshot or raw UI log. Mandatory XML deletion, original fixed categorical `debug-nav-snapshot` diagnostics and external `PPP` remain mandatory. No PDF, actual Pix, bank account or real input.

If both emulators PASS, this small style subtraction did not make **this Debug fixture** fail at its observed states; it does not prove the styles irrelevant to original Release. If either BLOCKs, preserve the exact failure and compare fixed categorical geometry stage with original M83 PASS. A BLOCK can come from environment or XML parsing, too, so no causal proof solely from a changed style and two emulator trials. No Android reruns to force green. Do not claim a passing CI or Release certification based on static contracts.

## Production boundaries

Original SHA-pinned Release SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` unchanged. P0 #126 thin bottom-bar geometry OPEN; independent P0 #120 PDF/chooser hang OPEN. PR #125 Draft/unmerged, `approvedForProduction=false`, `stableReleaseAllowed=false`; no main merge, original Release rebuild/signing, OTA/public distribution, personal financial data, payment or Pix transaction.

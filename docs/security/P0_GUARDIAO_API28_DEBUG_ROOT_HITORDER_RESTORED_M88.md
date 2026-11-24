# M88 — root hit-order restoration control (independent A/B/A), Debug-only

## Historical evidence — do not erase failures

Original pinned Release SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` remains immutable. P0 #126 original Release bottom-tab invalid geometry and independent P0 #120 native PDF / chooser hang OPEN, PR #125 Draft/unmerged; `approvedForProduction=false`, `stableReleaseAllowed=false`.

Historical M77/M79/M81 API28 native FAIL remain retained. M83 [Android #45311941046](https://github.com/nego001/negresco-finance./actions/runs/45311941046) 3/3 fresh Debug emulators PASS, with two same-PID synthetic Home→Pix→Home preview cycles and external PPP each; unrelated first M83 CI dependency HTTP 429 was retained despite a separate CI-only retry.

M84 [Android #45313895684](https://github.com/nego001/negresco-finance./actions/runs/45313895684) **2/2 independent Debug PASS**, each two safe same-PID cycles and final PPP, after the original two bottom-nav min-height style overrides were removed only in ephemeral Debug checkouts. [CI #45313895581](https://github.com/nego001/negresco-finance./actions/runs/45313895581) SUCCESS 1,717/1,717 tests.

Original M85 and M86 jobs were 2/2 source-preflight FAIL due their CLI hard-coded branch check, **never reached Android**. M85b [Android #45316200284](https://github.com/nego001/negresco-finance./actions/runs/45316200284) **2/2 first-cycle FAIL** when one additional root `zIndex/elevation` style reference was removed, after a geometry-qualified Pix command returned and the next XML snapshot parsed and cleaned. M86b [Android #45318019956](https://github.com/nego001/negresco-finance./actions/runs/45318019956) **2/2 true Debug FAIL** with `post-pix-home-still-visible` under the same counterfactual, corrected [CI #45318267773](https://github.com/nego001/negresco-finance./actions/runs/45318267773) SUCCESS 1,735/1,735 contracts on a separate test/docs-only SHA.

M87 [Android #45320070801](https://github.com/nego001/negresco-finance./actions/runs/45320070801) **2/2 independent true first-cycle Debug FAIL** under the same three-style subtraction, each showing all three Home markers and `debug-nav-touch-chain=touch-chain-root-not-marked` from one already-required, successfully parsed and cleaned post-Pix UI snapshot. The absence of the root touch flag is *not proof that no native event occurred*. [Corrected CI #45320840491](https://github.com/nego001/negresco-finance./actions/runs/45320840491) SUCCESS 1,740/1,740 tests, on a test/docs-only SHA; original M87 CI had two inherited static fixture failures, not retroactively reclassified. None establishes a component hit receiver, original Release causality, or PDF repair.

## One-variable restoration, no new input or UI query

M88 is an A/B/A reversal of M87's **single extra root style subtraction** while preserving all M87 observability code, existing conditions and independent two-emulator workflow. It starts from M87's already-validated corrected test/docs baseline, with no changes to `apps/mobile/App.tsx` in Git. The only temporary Debug checkout edit for M88 calls the original **pure M84 transform**, which subtracts exactly these two known app style overrides:
- `style={[s.bottom,s.labBottomBounds]}` → `style={s.bottom}`
- `style={[s.nav,s.labNavBounds,page===x.name&&s.navSelected]}` → `style={[s.nav,page===x.name&&s.navSelected]}`

Unlike M87, the **one** existing `,Platform.OS==='android'&&s.labAndroidRootHitOrder` remains in the root `SafeAreaView` style array, restoring `zIndex/elevation` behavior. All other app source (including Android root paddingBottom), Debug testID flags, native observer, guards and navigation remain unchanged. The M88 script requires exact `GITHUB_REF=refs/heads/lab/p01-guardiao-api28-debug-root-hitorder-restored-m88-v1`, `GITHUB_ACTIONS=true`, unique original source anchors, regular nonsymlinked app file and confirms content after its single ephemeral write. It imports only `guardiao_api28_debug_legacy_nav_variant_m84.transform`, NEVER M84's branch-restricted CLI, and fails closed on unexpected input.

The M88 workflow is an **exact M87 workflow copy** apart from branch, labels/concurrency and this one strictly scoped preparation command. Two independent fresh Android9/API28 disposable Debug emulators (`trial: [1, 2]`, `fail-fast: false`) each must still pass the original external PPP, strict M64/M68 native geometry, same PID/focus, fixed 2s waits and unchanged at most four geometry-gated Home→Pix→Home synthetic taps over two consecutive cycles, with final external PPP. The M87 post-Pix touch-chain classifier remains present and is executed only if Home still shows after Pix, entirely in memory from the same already-required private snapshot. No additional UI reads/XML, ADB, tap, retry, wait, logcat, screenshot, PDF, bank or real Pix/payment.

**Acceptance**: both fresh Android trials each explicitly finish two original guarded Home→Pix→Home cycles in one PID and external PPP PASS; required CI overall SUCCESS separately. If either fails, retain native FAIL forever; no rerun to turn green. If both PASS, the Debug A/B/A strengthens the association between root hit-order and touch navigation under these controlled conditions, but **does not prove original pinned Release repair**, excludes alternate device/build effects or authorize production.

## Release gate

P0 #120 and #126 remain OPEN; PR #125 Draft/unmerged; `approvedForProduction=false`, `stableReleaseAllowed=false`. No main merge, Release rebuild/signing, OTA, public APK or real Pix/payment.

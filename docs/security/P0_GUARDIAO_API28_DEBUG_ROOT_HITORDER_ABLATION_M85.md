# M85 — registered Debug-only root hit-order ablation (following M84)

## Evidence before touching the experimental branch

- Original pinned Release APK SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` remains immutable and its original geometry issue #126 and native PDF/chooser hang #120 remain OPEN. No proof of a causal fix.
- Historical M77, M79 and M81 Debug native FAIL remain on record, including M81's first-cycle XML `ParseError`; M82 and M83 later PASSES do not erase these.
- M83 [Android #45311941046](https://github.com/nego001/negresco-finance./actions/runs/45311941046): 3/3 independent API28 Debug emulators SUCCESS, two same-PID Home→Pix→Home preview cycles and external PPP each. Corrected [CI #45311940931](https://github.com/nego001/negresco-finance./actions/runs/45311940931) SUCCESS on attempt 2, **1,713/1,713 contracts PASS**; original attempt 1 had upstream Maven HTTP 429 in an unrelated native-lock compile job.
- M84 [Android #45313895684](https://github.com/nego001/negresco-finance./actions/runs/45313895684): 2/2 independent API28 Debug emulators SUCCESS, each with two same-PID guarded synthetic Home→Pix→Home preview cycles and external PPP after subtracting **both** `labBottomBounds` and `labNavBounds` overrides only in the temporary checkout. [CI #45313895581](https://github.com/nego001/negresco-finance./actions/runs/45313895581) SUCCESS first attempt, **1,717/1,717 contracts PASS**. The two minimum-size style overrides were not needed for *these observed Debug trials*, not a general conclusion.
- Prior candidate Release-mode root-hit-order [doc](P0_GUARDIAO_RELEASE_ROOT_HIT_ORDER_AB.md) states Android9 Debug navigation after `labAndroidRootHitOrder:{zIndex:4,elevation:4}` was observed PASS in [#43672315365](https://github.com/nego001/negresco-finance./actions/runs/43672315365), but root hit-order was not isolated as the sole cause. Separate root-bottom-inset and Release-mode candidate A/B experiments have been run; their binaries and conditions differ from historical Release.

## Precisely one additional variable

M85 starts from the M84 successful source and keeps M84's **two-style-only subtraction** in an ephemeral checkout. Only **after** that protected M84 patch succeeds, the new strict patcher removes exactly one additional root style reference from the very same temporary file:

`SafeAreaView` style array loses `,Platform.OS==='android'&&s.labAndroidRootHitOrder`, while retaining `s.root`, existing `paddingTop` and Android `paddingBottom`, all nested UI, `s.bottom` and `s.nav` original styles. The `labAndroidRootHitOrder` constant remains in source, just is not applied to root. No other tracked application code edits; GitHub branch adds only workflow, two-purpose-scope patcher, tests and this document. No public APK or commit mutation to `apps/mobile/App.tsx`.

Because the earlier M84 style removals remain, **M84 vs M85 differs only in the root hit-order modifier**, under otherwise shared Debug source and workflow. This is not equivalent to original Release, which differs in signing, build mode, runtime/legacy navigation and binary bytes.

## Safety, acceptance and interpretation

Two **independent fresh Android9/API28 disposable Debug emulator jobs** (`trial: [1, 2]`, `fail-fast: false`) reuse exactly the M84 emulator matrix, build, permissions, zero-permission external observer, same-PID and foreground checks, M64/M68 strict geometry, target uniqueness, one unchanged XML dump/cat per existing snapshot, mandatory deletion, fixed preflight and 2-second settlements, same **at most four strictly gated preview taps per emulator**, two Home→Pix→Home cycles, PPP post-check, fixed allowlisted XML exception category on BLOCK. **No timeout, waits, touch, snapshot, XML/position/raw log, screenshot, retry, BACK/swipe, PDF or input change**. A guard can and must BLOCK if the layout becomes thin/ambiguous; do not relax it or retry native jobs to obtain green results.

Acceptance only if both Android jobs independently report exactly two bounded-cycle PASS markers, one same-PID two-cycle PASS and postrun PPP PASS **and** required CI jobs all conclude SUCCESS. Any FAIL/BLOCK is preserved; a PASS only means root hit-order removal was not necessary for these particular Debug fixtures. A FAIL might implicate this style under fixed conditions, **but cannot alone establish root cause** of original Release behavior or XML intermittency. Physical tests, original Release hash validation, independent PDF receiver and review are still needed.

**Production remains blocked**: #120 OPEN, #126 OPEN, PR #125 Draft/unmerged, `approvedForProduction=false`, `stableReleaseAllowed=false`. No `main` merge, original Release rebuild/signing, OTA, publication, real Pix, bank account or payment.

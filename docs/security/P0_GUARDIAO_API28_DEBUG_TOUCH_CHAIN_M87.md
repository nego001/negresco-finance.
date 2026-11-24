# M87 — pure event-flag classification from same post-Pix UI snapshot

## Grounded history

P0 #126 historical original Release thin/invalid bottom navigation geometry and separate P0 #120 original native PDF/chooser hang remain OPEN. PR #125 Draft/unmerged; `approvedForProduction=false`, `stableReleaseAllowed=false`. Original pinned Release SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` untouched.

M77, M79, M81 earlier Debug native FAIL remain recorded, including M81's XML parse BLOCK. M83 [Android #45311941046](https://github.com/nego001/negresco-finance./actions/runs/45311941046) 3/3 Debug PASS, two same-PID Home→Pix→Home preview cycles and independent PPP per emulator. M84 [Android #45313895684](https://github.com/nego001/negresco-finance./actions/runs/45313895684) 2/2 Debug PASS after removing two bottom-nav size overrides in temporary source checkout; CI M84 SUCCESS 1,717/1,717 contracts. Original M85 and M86 Android workflows each FAIL 2/2 **at source preflight** due wrongly invoking older branch-scoped CLI, no Android finding. M85b [Android #45316200284](https://github.com/nego001/negresco-finance./actions/runs/45316200284) 2/2 true first-cycle FAIL after subtracting root hit-order zIndex/elevation in addition to the same two bottom styles, with Pix touch command returned and `snapshot-attested`. M86b [Android #45318019956](https://github.com/nego001/negresco-finance./actions/runs/45318019956) 2/2 true first-cycle FAIL with same temporary source, both emitting `post-pix-home-still-visible` from the existing valid post-Pix snapshot after Pix input command. Neither proved a Pix transition, nor returned Home, nor completed a cycle. Corrected M86b test/document-only [CI #45318267773](https://github.com/nego001/negresco-finance./actions/runs/45318267773) SUCCESS **1,735/1,735 contracts**; original M86b CI source SHA had two brittle static tests FAIL. This history is not retroactively green.

## Single new diagnostic with zero added device operations

The source-defined Debug header `testID` ALREADY encodes four boolean flags: Pix `onPressIn`, Pix `nav` callback, root `onTouchStart`, footer `onTouchStart`, with existing `negresco-lab-rn-page-home-pressin-(yes/no)-call-(yes/no)-rootstart-(yes/no)-bottomstart-(yes/no)` prefix. The flag absence **does not prove a native event never occurred**.

M87 copies exactly the M86b independent two-emulator API28 Debug workflow, with labels/branch/concurrency and branch-scope patch command adjusted. The dedicated M87 patcher checks exact `GITHUB_REF` against its workflow branch and calls the **pure M86b transformation**, never its CLI. The resulting temporary Debug app source is byte-for-byte identical to M86b; no tracked `apps/mobile/App.tsx` change or any extra code in the app. All original strict geometry/hit bounds, semantic gates, fixed timing, same PID/focus, external PPP, mandatory UI XML cleanup and at most four strictly approved taps per emulator remain identical.

Only **after** the existing post-Pix XML read has already been cleaned, the original Pix content check has failed, and M86b's pure classifier said `post-pix-home-still-visible`, the new PURE `classify_home_visible(nodes)` uses exactly **the same nodes**, accepts exactly one own-package source-defined header testID and parses only the four yes/no flags. No ADB, logcat, XML captures/reads, waiting, retry, tapping, screenshots, PDF, text, node IDs, PID, coordinates or user data are logged. Output is a single fixed category only on overall BLOCK:
- `touch-chain-header-unconfirmed` if missing/duplicate/malformed.
- `touch-chain-marker-sequence-unresolved` for mutually inconsistent flag progression.
- `touch-chain-root-not-marked`, `touch-chain-root-marked-bottom-not-marked`, `touch-chain-bottom-marked-pressin-not-marked`, `touch-chain-pressin-marked-nav-not-marked` classify the deepest recorded callback flag only, without assuming why the next flag was absent.
- `touch-chain-nav-marked-home-still-visible` if all four flags are recorded although Home remains observed.
- `not-started` on earlier/unrelated failure.

Emit fixed allowlisted `debug-nav-touch-chain=...` **only in the existing failure-only stage ledger**. A PASS still demands two complete same-PID Home→Pix→Home cycles and independent PPP per emulated Android9/API28 trial. An unsafe/missing source header never becomes a touch authorization. A BLOCK remains FAIL; **do not rerun failed emulators to chase green**.

## Release and finance prohibitions

Even a strong Debug touch-chain signal cannot establish the original pinned Release's native event routing or fix the original PDF hang. P0 #120 and #126 remain OPEN; PR #125 Draft/unmerged; `approvedForProduction=false`, `stableReleaseAllowed=false`. No main merge, release rebuild/signing, OTA, public APK, real Pix/payment or banking information.

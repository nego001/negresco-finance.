# M80 — strict diagnostic inside existing Android9 Debug snapshot boundary

## Frozen evidence

M75 [Android #45095257508](https://github.com/nego001/negresco-finance./actions/runs/45095257508) BLOCK after first-cycle Home input before Home proof. M76 [#45098940659](https://github.com/nego001/negresco-finance./actions/runs/45098940659) one emulator PASS with two complete same-PID cycles. M77 [#45100825061](https://github.com/nego001/negresco-finance./actions/runs/45100825061) FAIL (1/2 emulators PASS; other failed before second Pix). M78 [#45102362226](https://github.com/nego001/negresco-finance./actions/runs/45102362226) 2/2 PASS; its CI #45102362293 had 1,692/1,692 contracts PASS.

**M79 final** [Android #45106969309](https://github.com/nego001/negresco-finance./actions/runs/45106969309) **FAIL**: trial 2 completed two same-PID cycles; trials 1 and 3 completed only the first. Trial 1 second-cycle `debug-nav-last-checkpoint=home-attested` and `debug-nav-pre-pix=pre-pix-snapshot-unconfirmed`. Trial 3 second-cycle `debug-nav-last-checkpoint=home-input-command-returned` and `debug-nav-home-return=post-home-snapshot-unconfirmed`. Both point to an unconfirmed private snapshot but do NOT establish UIAutomator, screen-size, XML deletion, tap delivery or app cause. The standalone [CI #45106969249](https://github.com/nego001/negresco-finance./actions/runs/45106969249) completed **SUCCESS with 1,695/1,695 contracts**. Do not erase M79 FAIL.

## M80 protocol

Two separate disposable Android 9/API28 emulators (`trial: [1, 2]`, `fail-fast: false`), two sequential synthetic Home→Pix→Home preview cycles per emulator in the **same PID**. Keep the original `PPP` external preflight, fixed 30-second initial settle, fixed two 2-second intervals per cycle, the original strict M64/M68 geometry, content, app focus, PID, and private XML cleanup. At most two original preview tap commands per cycle, four per emulator. **No retries**, no new snapshots, screen reads, touches, BACK, swipes, timeout extensions, screenshots, data, PDF, QR, payments or Release rebuild.

The single existing `private_snapshot()` wraps its original **one** `BASE.screen_size()`, **one** `BASE.xml_nodes()` and **one** mandatory `BASE.adb("shell", "rm", "-f", "/sdcard/negresco_ui.xml", timeout=15)` with phase-only attribution. The cleanup attempt remains in a `finally`, even if another stage failed. A cleanup failure takes precedence over any earlier read failure and still raises. Diagnostic `debug-nav-snapshot` prints **only on BLOCK** after category allowlisting:
- `not-started` — no private snapshot reached
- `snapshot-screen-size-unconfirmed` — screen-size read failed
- `snapshot-ui-tree-unconfirmed` — UIAutomator read failed
- `snapshot-shape-unconfirmed` — original shape/viewport validity check failed
- `snapshot-cleanup-unconfirmed` — mandatory XML deletion failed
- `snapshot-attested` — last private snapshot and cleanup passed; any BLOCK is outside that snapshot

The last category is an observation, never a PASS override. A label describes only where execution stopped, not why the underlying system failed. Never print XML, content, bounds, PID, screenshot, path output, exception details or logcat. Unit fixtures assert successful read and every error branch, one deletion attempted, and no new operations.

M80 PASS requires **both** native jobs SUCCESS and the exact two per-cycle PASS markers, final two-cycle same-PID PASS and post-run `PPP`, plus separate CI SUCCESS. Any BLOCK remains FAIL; no rerun to hide it.

## Release boundary

P0 #120 intermittent original-Release native PDF/chooser freeze and P0 #126 original SHA-pinned Release navigation geometry are OPEN. PR #125 Draft/unmerged; `approvedForProduction=false`, `stableReleaseAllowed=false`. No main merge, Release APK, signing, OTA, public distribution, real Pix/account/payment/financial data.

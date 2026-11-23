# M78 — reason-coded second-cycle pre-Pix failure, unchanged navigation and safety

## Frozen evidence

M76 [Android #45098940659](https://github.com/nego001/negresco-finance./actions/runs/45098940659) PASS two synthetic Debug cycles on one emulator and same PID. M77 [Android #45100825061](https://github.com/nego001/negresco-finance./actions/runs/45100825061) FAIL overall: trial 1 PASS both cycles, trial 2 completed first cycle then BLOCK in second at `home-attested` / `debug-nav-home-return=not-started`. This points to an unconfirmed step after the second-cycle Home census and before the next Pix-candidate checkpoint, **not** an established touch delivery or lifecycle root cause. M77 [CI #45100825065](https://github.com/nego001/negresco-finance./actions/runs/45100825065) had a separate 1,687/1,688 contract failure on a case-sensitive documentation phrase. Both original FAIL verdicts remain historical facts.

## Pre-registered M78 experiment

Keep M77's two independent disposable Android9/API28 x86_64 emulators and `trial: [1, 2]`, `fail-fast: false`. Each independently builds a Debug-only APK and zero-permission observer, passes fixed `PPP` preflight, and must run exactly **two** consecutive Home→Pix→Home preview cycles in **one PID**. The M78 workflow is byte-identical to M77 except branch and descriptive names, with identical strict geometric / semantic / process / focus / cleanup requirements.

The only runtime difference is **passive attribution around M72's already-executed gate after Home census and before Pix input**, in `guardiao_api28_debug_nav_preview_two_step_lab.py`. Do not change its order, observations, ADB commands, arguments, strict target policy, timings or PASS conditions:
- `not-started`: M78 pre-Pix logic not reached
- `pre-pix-process-or-focus-unconfirmed`: existing PID/focus observation failed
- `pre-pix-snapshot-unconfirmed`: existing single UIAutomator snapshot or mandatory deletion failed
- `pre-pix-classifier-unconfirmed`: original pure selection raised without confirmation
- `pre-pix-target-unconfirmed`: original selection returned ineligible or no safe center
- `pre-pix-target-attested`: original Pix target guard passed (does **not** mean Pix tap occurred)

On BLOCK only, append `debug-nav-pre-pix` as one fixed allowlisted string alongside original M76 Home-return reason and M75 cycle checkpoint. Never print exception text, XML, screenshot, raw UI, PID, coordinates, geometry dimensions or financial content; no new XML reads. No retries, no larger timeout, no BACK, swipes or coordinate guesses; preserve a maximum of four guarded preview taps per emulator, two per cycle, with the existing two fixed 2-second waits per cycle and `PPP` preflight.

**PASS gate remains strict:** both emulators must each emit `PASS (LAB): two guarded Home-Pix-Home Debug preview cycles, one PID`, both jobs SUCCESS, and separate CI contracts SUCCESS. A trial BLOCK remains M78 FAIL regardless of other success; a category diagnoses only the boundary, not root cause.

## Production boundary

P0 #120 (intermittent original-Release PDF/chooser hang) and P0 #126 (original SHA-pinned Release navigation geometry across synthetic PDF cycles) remain OPEN. PR #125 Draft and unmerged. `approvedForProduction=false` and `stableReleaseAllowed=false`. This is synthetic Debug preview only, no PDF, data or Pix transaction; no main merge, Release APK rebuild, signing, OTA or distribution.

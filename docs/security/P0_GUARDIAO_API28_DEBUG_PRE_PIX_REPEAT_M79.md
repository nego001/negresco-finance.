# M79 — preregistered three independent Android9 Debug two-cycle samples

## Frozen evidence and reason for experiment

- M75 [Android #45095257508](https://github.com/nego001/negresco-finance./actions/runs/45095257508) BLOCK after first-cycle Home input command, before final Home semantic attestation.
- M76 [Android #45098940659](https://github.com/nego001/negresco-finance./actions/runs/45098940659) PASS in one independent Android9 emulator, with exactly two consecutive Debug Home→Pix→Home preview cycles in one PID.
- M77 [Android #45100825061](https://github.com/nego001/negresco-finance./actions/runs/45100825061) **FAIL overall**: trial 1 completed two cycles, trial 2 completed the first cycle but BLOCK on second at `home-attested` before Pix candidate attestation. Its `debug-nav-home-return=not-started` did not identify the pre-Pix root cause.
- M78 [Android #45102362226](https://github.com/nego001/negresco-finance./actions/runs/45102362226), fixed SHA `607185c9`: **SUCCESS** in both independent trials. Each trial logs two cycle-level PASS records, one final `PASS (LAB): two guarded Home-Pix-Home Debug preview cycles, one PID` and a successful post-run `PPP` read-only check. CI [#45102362293](https://github.com/nego001/negresco-finance./actions/runs/45102362293) **SUCCESS**, **1,692/1,692 contracts PASS** with required jobs green; optional generic emulator jobs SKIPPED.
- M78 did **not** reproduce M77's original second-cycle BLOCK, so there is no observed failing `debug-nav-pre-pix` category in M78. This does not establish why M77 failed.

## Strict M79 test protocol

Three **separate fresh Android9/API28 emulator jobs** (`trial: [1, 2, 3]`, `fail-fast: false`) each run the **unchanged M78 workflow and runtime** other than workflow display names, trigger branch, isolated concurrency and matrix size. The exact same disposable Debug APK compilation, zero-permission test-only observer, external `PPP`, existing fixed 30-second initial settle and two fixed 2-second waits per cycle, no retries, no extra touches or snapshots, no BACK/swipes, strict M64/M68 geometry + semantic checks, same-PID/focus checks and mandatory temporary XML cleanup apply. The original M78 `debug-nav-home-return` and `debug-nav-pre-pix` fixed-category diagnostics remain unchanged. No `apps/mobile` change, PDF export, QR, financial input or real Pix payment is involved.

Each emulator must independently prove exactly two consecutive synthetic `Início→Pix→Início` cycles in the same PID; at most four bounded preview input taps **per emulator**. **All three jobs must conclude SUCCESS**, and each must log `PASS (LAB): two guarded Home-Pix-Home Debug preview cycles, one PID` after two individual cycle PASS markers and an external `PPP` post-check. Any one FAIL/BLOCK, skipped/cancelled trial or unresolved CI failure means M79 **not approved**; do not rerun individual failed trials to conceal the failure. Test-only matrix expansion is planned in advance as a reproducibility investigation, not production or a statistical reliability guarantee. No root cause is assumed.

## Production remains blocked

P0 #120 intermittent native PDF/chooser in original SHA-pinned Release remains OPEN. P0 #126 Release bottom navigation/geometry around synthetic PDF remains OPEN. PR #125 Draft/unmerged. `approvedForProduction=false` and `stableReleaseAllowed=false`; no merge to main, no Release APK rebuild/signing, OTA, data collection, public distribution, payment or real financial account.

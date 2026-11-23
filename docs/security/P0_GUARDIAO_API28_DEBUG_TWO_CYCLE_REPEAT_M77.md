# M77 — independent reproducibility of two consecutive Debug Home-Pix-Home cycles

## Evidence frozen before the experiment

- **M75 Android9/API28** [#45095257508](https://github.com/nego001/negresco-finance./actions/runs/45095257508), commit `6695ae7`: **FAIL/BLOCK** in first Home return after `home-input-command-returned`, before first cycle was attested. Second cycle never began. A returned ADB command did not prove tap delivery.
- **M76 Android9/API28** [#45098940659](https://github.com/nego001/negresco-finance./actions/runs/45098940659), commit `3fbbe51`: **SUCCESS**. The native job log records two occurrences of `PASS (LAB): exactly two bounded preview taps Home-Pix-Home, same Debug PID` followed by `PASS (LAB): two guarded Home-Pix-Home Debug preview cycles, one PID`, and a successful post-run external PPP observation. One fresh emulator, one Debug process, two consecutive synthetic cycles; no PDF.
- **M76 contract-only correction** [#45099133335](https://github.com/nego001/negresco-finance./actions/runs/45099133335), commit `59e074b`: **SUCCESS**, 1,685/1,685 contract tests PASS and all required CI jobs SUCCESS (optional generic emulator jobs skipped). This branch descends from M76 and changes two test files only, not application or runtime navigation.
- One M76 PASS does not establish the root cause of M75's BLOCK. A separate M75 failure and a M76 pass may be related to environment or nondeterminism, but attribution is not supported.

## M77 preregistered protocol

Run **two independent disposable Android9/API28 Google APIs x86_64 emulators**, `trial: [1, 2]` with `fail-fast: false`. Each emulator separately compiles its own Debug APK and zero-permission synthetic observer, verifies the denied-permission and loopback policies, checks one external `PPP` window sequence, then runs **two consecutive** synthetic `Início → Pix → Início` cycles **within that emulator's same Debug PID**.

The new workflow is **byte-identical to M76** except its workflow name, trigger branch, concurrency group, job / step labels, and a two-entry matrix with fail-fast disabled. The Python runner, original M68 strict target guard, M64 Home census, M76 categorical Home-return observer, fixed waits, exactly 2 navigation taps per cycle / at most 4 per emulator, snapshot count, geometry / semantics / process-focal checks and mandatory private XML cleanup remain **unchanged**. No added retries, no retries after BLOCK, swipes, BACK recovery, screenshot, raw UI collection, coordinates, PID values or financial content logs; no PDF or payment.

**PASS criteria:** both independent matrix jobs must complete SUCCESS, and **each** log must contain `PASS (LAB): two guarded Home-Pix-Home Debug preview cycles, one PID`. A failure of either matrix job leaves M77 **FAIL/BLOCK**; no success can be inferred from the other job. If either job is skipped/cancelled, M77 is not 2/2 PASS. Distinguish build / infrastructure failures from Android navigation results. Before logs and required CI run conclude, report only prepared or running, never PASS.

## Production boundary

This is Debug-only synthetic preview reproducibility, not a fix or certification of original SHA-pinned Release. [P0 #126](https://github.com/nego001/negresco-finance./issues/126) (Release bottom bounds / navigation around synthetic PDF) and [P0 #120](https://github.com/nego001/negresco-finance./issues/120) (intermittent native PDF/chooser hang) remain **OPEN**. PR #125 remains **Draft** and unmerged; `approvedForProduction=false`, `stableReleaseAllowed=false`. No `main` update, Release APK rebuild, signing, OTA, published APK, real account, Pix transaction or payment.

## M77 actual outcome (post-run; verdict remains FAIL)

[M77 Android #45100825061](https://github.com/nego001/negresco-finance./actions/runs/45100825061), HEAD `20d5c2b`, completed **FAIL**. Trial 1 was SUCCESS with two complete Home-Pix-Home Debug preview cycles on the same PID; trial 2 was FAIL/BLOCK, despite completing its first cycle, at `debug-nav-active-cycle=second`, `debug-nav-last-complete-cycle=first`, `debug-nav-last-checkpoint=home-attested`, `debug-nav-home-return=not-started`. Therefore M77 did not establish 2/2 repeatability; no tap or root-cause inference is made for the failed second-cycle pre-Pix gate.

[M77 CI #45100825065](https://github.com/nego001/negresco-finance./actions/runs/45100825065) completed FAIL because one documentation text assertion searched for the exact lower-case string `no retries` while the doc used `No added retries`. Contracts 1,687/1,688 PASS, others required CI jobs SUCCESS, generic emulator jobs SKIPPED. This post-run doc change only supplies an explicit lower-case assertion phrase; it is not a repair of the M77 Android BLOCK. No Android retest or production decision can be implied by the corrected documentation.

# M76 — fixed-category Android9 Debug Home-return diagnostic after M75 BLOCK

## Frozen evidence from M75

[M75 Android #45095257508](https://github.com/nego001/negresco-finance./actions/runs/45095257508), commit `6695ae7`, completed **FAIL/BLOCK**. The disposable Debug APK and zero-permission external observer compiled, followed by `debug-focused`, `idle-observed`, `PPP`, `tabs-present-bounded`, `home-marker-unique`, `home-static-all`, `app-text-and-clickable`. The allowlisted failure record was **`debug-nav-active-cycle=first`**, **`debug-nav-last-complete-cycle=none`**, **`debug-nav-last-checkpoint=home-input-command-returned`**. This means the first guarded Pix demonstration page and Home-return candidate were attested and the input command returned. The first cycle's final Home semantic/geometric/process proof **did not complete**. It does **not** prove that the touch was received or establish why final Home was not attested. The second cycle was never attempted. M72 and both M73 one-cycle tests had previously passed independently; they do not override this distinct two-cycle failure.

[M75 CI #45095257466](https://github.com/nego001/negresco-finance./actions/runs/45095257466) had **1,680/1,680 contracts PASS** but its `authority-postgres-lab` job failed during an independent **Gradle dependency fetch**, repeatedly receiving **HTTP 429 Too Many Requests from Maven Central** while resolving Kotlin Gradle plugin 2.0.21 metadata. The PostgreSQL schema smoke itself had passed earlier in that job. This is distinct from Android navigation and not evidence of a PostgreSQL semantic defect. A one-job rerun of the failed job was requested; record its outcome separately.

## M76 preregistered surgical diagnostic

Create one new isolated Android9/API28 **Debug** disposable build in a fresh emulator. Use the original M75 workflow verbatim except branch, workflow/job names and isolated concurrency. **Do not modify `apps/mobile` or the original Release.** The modified Python runner preserves the same external `UiAutomation.waitForIdle(1000L,5000L)` and exactly three `PPP` roots, 30-second fixed initial settle, no permission changes, the same original M64 Home census, unchanged M68 pure guard, same **at most two preview tab touches per cycle and four per two-cycle attempt**, exactly two fixed 2-second settling intervals per cycle, exactly the same UIAutomator snapshot count, no retry, and the same cleanup / focus / PID / geometry / semantic guards.

The only addition is a pure `return_diag.classify()` function and fixed categorical attribution for the **existing final Home check after a return-to-Home input command**. On any failure, alongside the existing `debug-nav-active-cycle`, `debug-nav-last-complete-cycle`, and `debug-nav-last-checkpoint`, report exactly one `debug-nav-home-return` in this fixed allowlist:
- `not-started`, `home-input-command-returned`;
- `post-home-process-or-focus-unconfirmed` (PID/focus check failed);
- `post-home-snapshot-unconfirmed` (single snapshot or mandatory deletion failed);
- `post-home-classifier-unconfirmed` (one read-only classifier raised);
- `post-home-tabs-unconfirmed`, `post-home-marker-unconfirmed`, `post-home-static-unconfirmed`, `post-home-structure-unconfirmed`, `post-home-candidate-unconfirmed` (first strict native gate not confirmed);
- `post-home-attested` (all native Home checks passed, before final process/ledger gate).

The pure classifier **never** authorizes a failed state, weakens the gate or changes what is a PASS. Invalid categories are mapped to a fixed unconfirmed literal; no exceptions, coordinates, dimensions, raw UI texts, XML, screenshots, HTTP requests, debug secrets, PIDs or APKs are printed or uploaded. Failed deletion of temporary XML is treated as `post-home-snapshot-unconfirmed` and BLOCK, never PASS.

M76 can be called a **two-cycle Debug preview PASS** only if both sequential synthetic cycles finish and the original fixed `PASS (LAB): two guarded Home-Pix-Home Debug preview cycles, one PID` is printed after all checks. A BLOCK with a detailed category is diagnostic evidence, **not** automatic proof of tap delivery or a root cause; no retry or longer timeout is allowed to convert it into PASS.

## Non-negotiable production gate

The [historical P0 #126](https://github.com/nego001/negresco-finance./issues/126) concerns original SHA-pinned **Release** bottom geometry across synthetic **PDF** cycles; [P0 #120](https://github.com/nego001/negresco-finance./issues/120) independently concerns an intermittent native PDF/chooser freeze. A Debug preview run is neither. Both issues remain OPEN, PR #125 remains Draft/unmerged, `approvedForProduction=false` and `stableReleaseAllowed=false`. No `main` changes, Release signing, OTA, payment, QR, real account connection or production distribution.

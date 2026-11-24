# M83 — registered three-emulator repeat of M82 parser-code diagnostics

## Frozen evidence (do not overwrite historical FAIL)

- M75: first-cycle post-Home navigation confirmation BLOCK.
- M76: one disposable Android9 emulator completed two consecutive same-PID synthetic preview cycles.
- M77 [Android #45100825061](https://github.com/nego001/negresco-finance./actions/runs/45100825061): overall FAIL; one of two independent emulators BLOCK before second Pix target.
- M78 [Android #45102362226](https://github.com/nego001/negresco-finance./actions/runs/45102362226): 2/2 independent emulators PASS; CI 1,692/1,692 PASS.
- M79 [Android #45106969309](https://github.com/nego001/negresco-finance./actions/runs/45106969309): overall FAIL; 1/3 emulator PASS, two snapshot BLOCKs during second cycle; CI 1,695/1,695 PASS.
- M80 [Android #45109110065](https://github.com/nego001/negresco-finance./actions/runs/45109110065): 2/2 emulators PASS; original CI 1,694/1,700 (six legacy static syntax failures), separate test-only corrected CI #45110224330 **1,700/1,700 PASS**.
- M81 [Android #45114233347](https://github.com/nego001/negresco-finance./actions/runs/45114233347): overall **FAIL**. Trial 1 BLOCK in first cycle after `pix-input-command-returned`; existing XML parser raised `snapshot-ui-xml-parse-unconfirmed`; trial 2 completed both cycles. Corrected CI [#45114290138](https://github.com/nego001/negresco-finance./actions/runs/45114290138) **SUCCESS on attempt 2**, with **1,705/1,705 contracts PASS** and the single failed upstream PostgreSQL Gradle Maven HTTP 429 job rerun successfully; native M81 failure was **never rerun**.
- M82 [Android #45182221415](https://github.com/nego001/negresco-finance./actions/runs/45182221415), HEAD `af2c66d`: **2/2 independent Android9 Debug emulators SUCCESS**, each with exactly two bounded guarded Home→Pix→Home preview cycles in the **same process** and external `PPP` post-check. [CI #45182221041](https://github.com/nego001/negresco-finance./actions/runs/45182221041) **SUCCESS**, **1,710/1,710 contracts PASS**, all required jobs SUCCESS. Neither M82 emulator reproduced M81's XML parse failure, so M82 yielded no observed parser error code; no root cause established.

## M83 exact protocol

Use **three preregistered independent fresh Android 9/API28 x86_64 disposable Debug emulator jobs** with `trial: [1, 2, 3]`, `fail-fast: false`. This workflow is **exactly the original M82 workflow** except its name, isolated branch, isolated concurrency group, trial label, matrix expansion and step label. The original runner, M82 allowlisted pure Expat `ParseError.code` classifier, M64/M68 geometry, semantic checks, same-PID/focus checks, fixed preflight and waits, permissions, command timeouts and XML deletion are untouched. No extra UIAutomator dumps, ADB commands, screenshots, logs of raw content, retries, BACK/swipes, recovery or relaxed threshold. The original XML tree remains temporary and deleted after each original read, including exceptions.

Each fresh emulator is predeclared to run **two** consecutive synthetic Home→Pix→Home preview cycles in **one** Debug PID. Exactly two geometrically proven preview taps per cycle, at most four per emulator. The initial external accessibility proof and post-run `PPP` remain required. If XML parsing fails, M82's **existing fixed allowlisted parser-code category** may be printed only on overall BLOCK; never XML text, exception message, parser position, coordinates, actual PID, screenshot, app content, PDF or financial data.

**Acceptance decision:** all three independent Android jobs must conclude SUCCESS and have exactly two cycle PASS markers, one two-cycle/same-PID PASS and independent `PPP` post-check each. A single FAIL/BLOCK, skipped/cancelled trial, or unresolved overall CI failure means M83 **not approved**; do not rerun failed Android trials to obtain a favorable result. The expanded experiment is limited evidence on reproducibility, not a mathematical or production reliability guarantee. Every historical M77/M79/M81 FAILURE is retained without reinterpretation.

## Release prohibition

Issues #120 (original SHA-pinned Release PDF/chooser intermittent hang) and #126 (original Release bottom-bar accessibility geometry) remain OPEN. PR #125 remains Draft/unmerged. `approvedForProduction=false`, `stableReleaseAllowed=false`. No modifications to `main`, application or original Release APK SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`, no signing, OTA, distribution, real Pix transaction or payment.

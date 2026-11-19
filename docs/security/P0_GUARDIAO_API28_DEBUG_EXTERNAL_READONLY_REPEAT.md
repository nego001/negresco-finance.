# M61 — Independent repeat of Android 9 read-only Debug root observation

## Frozen prerequisite (completed before the repeat)

[Debug observer workflow #44450094336](https://github.com/nego001/negresco-finance./actions/runs/44450094336), commit `a5e6a76`: **SUCCESS** in one new Android 9/API28 emulator. Disposable real Negresco Finance Debug APK SHA and permission gates passed; independent `testOnly`, no-permission observer APK built. The Debug app was the foreground package with stable PID before/after the observation. Exactly one bounded UiAutomation event-idle wait followed by three non-retried root reads reported `idle-observed / all-present / PPP`. No PDF, chooser, payment, UI tap/swipe, screenshots, raw hierarchy or financial data were collected. This is observational feasibility, not proof of reliability or P0 repair.

The contract-only correction [`544411e`](https://github.com/nego001/negresco-finance./commit/544411e309c437910562dd1336f06dafc0cf41d6) changed only a case-sensitive documentation assertion. Matching [CI #44450804939](https://github.com/nego001/negresco-finance./actions/runs/44450804939) closed SUCCESS, **1,606/1,606 contracts PASS** and all mandatory CI jobs successful.

## Prospective M61 reproducibility experiment

Two additional independent emulator runs of the same untouched original observer and Debug source, using Android API28 and separate fresh emulator snapshots. This new, isolated branch changes only the repeat workflow, its contract, and this policy note; it does not change the app source, observer Java, runner Python, tests from M60, the historical Release APK or `main`.

The workflow matrix is precisely **2 trials** (`trial: [1,2]`) with `fail-fast: false` so a failing job cannot suppress the other result. Each test compiles its own Debug and SDK-only observer APK and starts a fresh emulator. All original security gates are unchanged.

**Pre-registered pass rule:** each trial independently requires a disposable Debug app in foreground with PID stable, one UiAutomation connection, one `waitForIdle(1000L, 5000L)`, exactly three non-retried `getRootInActiveWindow()` calls, valid `INSTRUMENTATION_CODE=-1` and three roots belonging to the exact Debug package (`PPP`). A null root (`N`), foreign root (`F`), missing/inconsistent status, timeout, focus/PID change, permissions failure or emulator infrastructure failure is **BLOCK**, not a PASS or an excluded outlier. Never automatically rerun a failed trial or silently extend timeout.

**Reporting:** record PASS/BLOCK and fixed idle, verdict and P/N/F mask from both jobs, keeping infrastructure failures separate from root availability. Only if both independently show `PPP` does M61 satisfy its *read-only repeat* gate (2/2). Even **2/2 PASS does not prove a statistically reliable behavior, geometry of the navigation tabs, correct chooser or PDF export**. No claim that `waitForIdle` is causal: these repeats have no randomized control arm and only two samples. If any job BLOCKs, document its stage and investigate without erasing the previous result.

Next independent gate, after M61: inspect only the known, synthetic Debug navigation testIDs and bounded rectangle categories in the Home screen, without touching controls or reading arbitrary text; then separately evaluate PDF A/B via an independently verified synthetic receiver. No PDF is generated in M61.

P0 #120 and #126 remain OPEN. PR #125 stays Draft. `approvedForProduction=false`, `stableReleaseAllowed=false`. No release build, real financial data, bank authorization, user device, merge, OTA or publication.

# M74 staging — two consecutive preview navigation cycles in one Android9 Debug PID

## Evidence and remaining gap

[M72 Android #45052688937](https://github.com/nego001/negresco-finance./actions/runs/45052688937) ended **SUCCESS** and attested one synthetic, guarded `Início → Pix → Início` sequence on a clean API28 Debug emulator, with fixed 30-second initial settling, root `PPP`, three bounded native bottom targets, explicit Pix/Home semantic content, at most two guarded touches, PID/focus preserved and raw snapshot cleanup. [M72 CI #45052688905](https://github.com/nego001/negresco-finance./actions/runs/45052688905) was SUCCESS, **1,665/1,665** contracts PASS.

[M73 Android matrix #45062694751](https://github.com/nego001/negresco-finance./actions/runs/45062694751) and [CI #45062694749](https://github.com/nego001/negresco-finance./actions/runs/45062694749) were launched on commit `10ee210` to repeat that *one-cycle* experiment independently on two fresh Android9 emulators. At the time M74 staging was authored, both Android jobs were **in progress**. The M73 contracts job passed **1,670/1,670**, but no claim of 2/2 Android PASS is possible until both trials finish and logs support it.

The [P0 #126](https://github.com/nego001/negresco-finance./issues/126) is not closed by one preview-navigation PASS or even by two fresh-run passes: the original SHA-pinned Release had unsafe bottom-tab bounds before its first synthetic PDF and a blocked return in a *second PDF cycle in the same process*. The separate [P0 #120](https://github.com/nego001/negresco-finance./issues/120) is an intermittent native PDF/chooser freeze. No preview navigation test by itself proves that PDF flow or that original Release.

## Staging only; no new Android workflow or execution

M74 adds a small new Python wrapper, pure fixture/static tests and this policy, on a **separate lab branch**. **No new Android workflow calls the wrapper yet**, and this stage sends no touches to an emulator. Do not run M74 Android until M73 has been reviewed, including failed trials.

The wrapper, if separately authorized later on a disposable API28 Debug build, would delegate to the **unchanged M72 guarded navigation routine** exactly twice, sequentially, in one observer callback and the same Debug process:
- One fixed 30-second settle before any root observation in the unchanged external observer; one bounded `UiAutomation.waitForIdle(1000,5000)` and precisely three package-specific `PPP` reads.
- Initial Debug PID and foreground must be valid; the baseline PID must match before and after **each** cycle, never restarting the app, clearing its data or relaunching it between cycles.
- For each of exactly `first` and `second`, start a fresh pure monotonic StageLedger. The M72 runner itself performs an initial Home census with three non-degenerate, safe, clickable bottom tabs, then a fresh M68 guard authorization and exactly one Pix demo tab tap, a fixed 2-second pause, a private snapshot proving Pix preview content, a fresh guard authorization and exactly one Home tap, another fixed 2-second pause and a final snapshot proving Home again.
- All M72 native snapshots delete their ephemeral XML on the disposable emulator even if a check errors. Any missing marker, PID/focus mismatch, unsafe bounds/selection, overlay, stage violation or cleanup failure remains BLOCK; **no retry or recovery tap**.
- A later authorized two-cycle run would therefore perform **at most four** guarded demo tab taps and no other touch. It must prove both completed cycles and the one persistent PID before a final PASS.
- On failure, print **only fixed allowlisted categories** for active cycle, last fully completed cycle and last verified navigation checkpoint, then BLOCK. An ADB input-command-returned stage is *not* proof of delivered touch. No raw errors, app text, coordinates, IDs, PID, logs, screenshot, PDF or artifact upload.

M74 is an intermediate preview-navigation design, **not** the original two-PDF-cycle test and **not** a production approval. Do not confuse a successful Debug preview with the historical Release or close #120/#126. Subsequent work still requires the SHA-pinned original Release, independent synthetic PDF receipts, safe navigation between PDFs, physical-device evidence and human review.

## Mandatory safety

PR #125 remains Draft/unmerged. P0 #120 and #126 remain OPEN. `approvedForProduction=false`, `stableReleaseAllowed=false`. No `main` change, production signing, release APK, OTA, data entry, bank connection, Pix payment or real user instrumentation.

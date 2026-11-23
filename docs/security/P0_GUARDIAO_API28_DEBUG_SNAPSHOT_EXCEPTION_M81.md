# M81 — pure exception classification of existing API28 Debug XML snapshots

## Prior evidence and scope

- M75 [Android #45095257508](https://github.com/nego001/negresco-finance./actions/runs/45095257508) blocked before an attested Home return.
- M76 [#45098940659](https://github.com/nego001/negresco-finance./actions/runs/45098940659) passed two cycles on one API28 Debug emulator.
- M77 [#45100825061](https://github.com/nego001/negresco-finance./actions/runs/45100825061) failed one of two emulators before second Pix.
- M78 [#45102362226](https://github.com/nego001/negresco-finance./actions/runs/45102362226) passed two of two emulators.
- M79 [#45106969309](https://github.com/nego001/negresco-finance./actions/runs/45106969309) failed two of three emulators: second-cycle pre-Pix snapshot unconfirmed in trial 1, post-Home snapshot unconfirmed in trial 3. This remains a true FAIL, not erased by later success. Its CI #45106969249 succeeded with 1,695/1,695.
- M80 original [Android #45109110065](https://github.com/nego001/negresco-finance./actions/runs/45109110065) completed SUCCESS **2/2** independent API28 Debug emulators, each performing **two** same-PID synthetic Home→Pix→Home cycles with external `PPP` proof. M80 original [CI #45109110013](https://github.com/nego001/negresco-finance./actions/runs/45109110013) failed six **legacy static syntax assertions**, 1,694/1,700 passed. Separate test-only correction [`c3361ee`](https://github.com/nego001/negresco-finance./commit/c3361ee64f935a73c8cd7596b65ca4a807a95f61), [CI #45110224330](https://github.com/nego001/negresco-finance./actions/runs/45110224330) **SUCCESS: 1,700/1,700 PASS**. This is not a fix of intermittent native navigation or Release PDF.

## M81 registered protocol

M80 had no failing snapshots to classify. M81 adds **pure exception classification only**, inside the already-required `BASE.xml_nodes()` exception handler in `private_snapshot()`. The original `guardiao_pdf_ui_emulator_smoke.xml_nodes` source reads the Android hierarchy using a single `adb shell uiautomator dump` (original timeout 35), a single `adb exec-out cat` (original timeout 12), an XML parser and a local node visitor. **These calls, their arguments, timeouts, order, raw-value handling and output remain unchanged**. M81 only inspects an exception that was **already thrown**; no new ADB, XML, screenshot, file access, timer, attempt, retry, gesture or permission is added. The mandatory `rm -f` after the read still executes **exactly once**, including on failure, and its failure takes priority.

Recognized error categories, never raw exception text:
- `snapshot-ui-dump-timeout`: exception identifies timeout of existing `adb shell uiautomator dump`
- `snapshot-ui-dump-command-failed`: original bounded command wrapper reported nonzero exit of `uiautomator`
- `snapshot-ui-file-timeout`: timeout in existing `adb exec-out cat`
- `snapshot-ui-file-command-failed`: original wrapper reported nonzero `cat` exit
- `snapshot-ui-xml-parse-unconfirmed`: XML parser rejected the already-read UI tree
- `snapshot-ui-tree-unconfirmed`: every other exception; no guesses

Categories are added to M80's allowlist, and still printed only on overall navigation **BLOCK**. Matching RuntimeError messages only internally against **two exact hardcoded command prefixes and numeric exit codes**; never logs, serializes or exports messages, raw XML, screenshots, PIDs, coordinates, app strings, command output, PDF or financial data. A time-out classification identifies the failing command, **not** a proven root cause.

Two **independent disposable Android9/API28 x86_64 Debug emulator jobs** (`trial: [1, 2]`, `fail-fast: false`) reuse M80's exact workflows and safety gates except branch, workflow labels and concurrency. Each must finish **two** strictly guarded Home→Pix→Home synthetic preview cycles in **one** unchanged Debug PID, with original strict M64/M68 bounds and semantic checks, fixed startup wait and 2-second settles, one synthetic observer with external `PPP`, exactly two guarded preview taps per cycle (at most four per emulator), no BACK/swipes or unsafe touch. Every BLOCK is final, no retries, no broader timing.

**PASS only if** both Android jobs end SUCCESS and each logs two cycle markers, final same-PID two-cycle marker and post-run `PPP`, with separate CI SUCCESS. A failure remains failure even if the other job passes, and no successful test can prove original Release safety or solve the P0s. Keep failures and cancellations in historical record.

## Production boundaries

Original SHA-pinned Release APK SHA-256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` stays immutable. P0 #126 original Release bottom tab geometry and P0 #120 intermittent native PDF/chooser remain OPEN; PR #125 stays Draft, unmerged. `approvedForProduction=false`, `stableReleaseAllowed=false`. No main changes, Release build, signing, OTA, public distribution, real Pix/payment, account data, PDF generation or upload.

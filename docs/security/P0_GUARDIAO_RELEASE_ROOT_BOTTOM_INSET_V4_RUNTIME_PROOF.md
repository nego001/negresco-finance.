# Android 9 | fourth Release-mode candidate: Android root bottom inset A/B

## Identity and isolation
- Source build: [#43772274643](https://github.com/nego001/negresco-finance./actions/runs/43772274643), source commit `494ce5e`.
- Exact assembled APK SHA-256 (from build job log): `3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6`.
- The APK's reported signing DN is `CN=Android Debug`, even though it was compiled in Release mode.
- This is **NOT** the immutable historical Release SHA `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`. No existing installation/data should be replaced.
- Artifact: `negresco-finance-v313-security-preview`, ID `14185142814`; immutable candidate download run-id `43772274643`.
- Source application change isolated on `lab/p01-guardiao-release-root-bottom-inset-v1`: Android root now has the previously Debug-only bottom inset in experimental Release-mode; existing Android root hit-order and minimum tab heights remain. No PDF/payment handlers changed in this test harness.

## A/B acceptance
Two independent, disposable Android9/API28 emulators use **identical pinned APK bytes**, no rebuild or production app changes:
1. `home_only`: Two UIAutomator geometry observations on initial Home (no PDF or tap). Require Home label on a bounded bottom-band rectangle; nondegenerate clickable ancestor; both sibling tabs regular; same app PID.
2. `same_pid`: Four invalid-input synthetic PDFs A/B/C/D with independent receiver, text/page validation and cache cleanup. Between each PDF, permit exactly one geometry-qualified Home action. No force-stop, recovery BACK/swipe, reinstall or data clear after initial installation; require unchanged app PID.

Both tracks reject missing or ambiguous geometry. A PDF A PASS alone never authorizes Home or PDF B. Print hang issue #120 and bottom navigation issue #126 remain independent. Results are **PENDING** until actual emulator jobs finish; a green build or static CI is not functional evidence.

## Locks
PR #125 DRAFT/unmerged. Issues #120 and #126 OPEN. `approvedForProduction=false`; `stableReleaseAllowed=false`. No OTA, merge, publishing, release signing, real payment/Pix, customer PDF, or private-data logging.

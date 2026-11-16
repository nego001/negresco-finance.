# P0 #120 | API26 comparison for the same disposable v4 candidate APK

The v4 Release-mode candidate with Android Debug certificate had a [complete API28 integrated PASS](https://github.com/nego001/negresco-finance./actions/runs/43777952185): PDF A/B/C/D, 3 same-process Home returns and scoped three-tab attestation. The [three independent API28 repeats](https://github.com/nego001/negresco-finance./actions/runs/43780147915) were all **SUCCESS**: 12 more fully verified synthetic PDFs and 9 more same-process Home returns.

**This branch targets Android 8/API26**, with the exact same candidate APK and no app rebuild:
- Artifact from [build #43772274643](https://github.com/nego001/negresco-finance./actions/runs/43772274643), SHA-256 `3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6`, Android Debug signature. The immutable historical Release **is not this APK**.
- Reuse original strict single-PDF synthetic fixture replay: exactly the same user-synthetic 48-character input and UI/chooser timeout, one native PDF action, independent debug receiver, PDF render, each-page semantic extraction and cache cleanup. Reject any failure as BLOCK.
- This comparator checks strict receipt schema with `api=26`, without lying to or spoofing the device API, and verifies fresh APK hash/certificate again.
- Strict read-only receipts, no PDF/URIs/HTML, account data, screenshot, UI XML or native exception logs, no payment or production action.
- This is one PDF on a clean API26 emulator, **not** a second same-PID four-PDF replay. A negative result isolates an API difference in the candidate and warrants investigation; a positive result is *not* proof that the historical immutable Release is fixed.

Original historical APK SHA `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` is unavailable (artifact expired), so direct historical A/B cannot be performed. Keep #120/#126 OPEN, PR #125 DRAFT/unmerged; `approvedForProduction=false`, `stableReleaseAllowed=false`. No publication, merge, OTA, public APK, real financial input, payment or stable release signing.

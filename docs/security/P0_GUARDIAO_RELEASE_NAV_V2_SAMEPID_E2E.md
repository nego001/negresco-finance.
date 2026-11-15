# P0 | Layout-corrected Release-mode candidate: four independent receipts in one live PID

This experiment uses ONLY the distinct candidate built from commit `9daa890`,
workflow [#43752538618](https://github.com/nego001/negresco-finance./actions/runs/43752538618),
with SHA-256 `d054b0ab314104bf61354d5826194313e290ee41b9ef93cd77aaea842809f5d6`. It is **Release-mode, Android Debug-signed, and
strictly test-only**. It is neither the original SHA-pinned Release APK nor a
production or stable signing identity.

## Why

Previous same-PID trial [#43751102206](https://github.com/nego001/negresco-finance./actions/runs/43751102206)
failed **after** PDF A passed: Home on the start of cycle B had a point-sized
touch target. This is a navigation test failure, not a second PDF hang.
The corrected App.tsx now applies fixed bottom-navigation min-heights
(76dp bar; 60dp tabs) even without `__DEV__`; it has compiled and passed
TypeScript and full CI. **Native layout correctness remains unproved until
the emulator runs.**

## New strict test

- Reverify the exact new APK SHA and the Debug-only signing certificate.
- Install the candidate once on a clean API28 Android9 emulator.
- Export four separate synthetic invalid-input PDFs in cycles A–D, always
  using the independent receiver and semantic PDF verification.
- Navigate back to the Home tab three times with the **existing bounded
  geometry tests**, unchanged. Preserve one live app PID, never force-stop,
  reinstall or clear application data after cycle A.
- Fail with an explicit BLOCK if Home geometry, receipt, PDF, PID, installation
  or cleanup is not proven. Never assume 4/4 from a green unit test.

**No raw XML, PDF, payment information, source private logs or real banking
data is exported. No APK upload, new release, OTA, merging, production
approval or replacement of historical SHA `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`.**

P0 #120 OPEN, PR #125 DRAFT, `approvedForProduction=false`,
`stableReleaseAllowed=false`.

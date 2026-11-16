# Android 9 | Strict scoped three-tab proof and four synthetic PDFs in one process

## Existing independent evidence
- [v4 #43775009438](https://github.com/nego001/negresco-finance./actions/runs/43775009438): same PID PDF A/B/C/D **PASS** with independent receiver, semantic extraction, clean cache and three safe Home returns; legacy home_only **FAILURE** due global Pix name ambiguity.
- [Read-only scoped Home #43776549700](https://github.com/nego001/negresco-finance./actions/runs/43776549700): **SUCCESS**, `scoped-three-tabs-verified` twice. Three tabs are individually bounded, unique in the footer, correctly ordered and non-overlapping. No gesture was performed by this separate job.
- [Static CI #43776692147](https://github.com/nego001/negresco-finance./actions/runs/43776692147): **SUCCESS**, 1,447/1,447 contracts; source fixture expectation corrected without weakening fail-closed geometry.

## New integrated A/B proof
This independently triggered job uses the **same v4 APK SHA-256** `3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6` from [build #43772274643](https://github.com/nego001/negresco-finance./actions/runs/43772274643), `CN=Android Debug`; does not rebuild app or replace historical Release.
- Before first synthetic PDF on initial Home: two strict scoped three-tab snapshots, same PID.
- Before and after each of the **three existing Home returns**: two complete snapshots. Fail before any Home touch if geometry missing, overlapped, wrongly ordered or duplicated.
- Reuse the unchanged four-cycle PDF runner. Receiver, semantic checks, cache cleanup, single-PID proof, no app reinstall remain mandatory.
- No *additional* tap, swipes, BACK, print actions or fallback added. Existing bounded Home return method is invoked only after scoped proof. All wrappers restored in finally.
- Any missing first-Home callback, return count, process identity, PDF or cleanup is BLOCK; no partial pass.
- Even a positive result only establishes this **test candidate** under API28, not the historical immutable Release, Android device field validation or product approval.

## Locks
Issue #120 (old native PDF hang) and #126 (legacy footer) still OPEN. PR #125 DRAFT/unmerged. `approvedForProduction=false`; `stableReleaseAllowed=false`. No real payments/Pix, client data, OTA, stable signing, merge, production publication or original Release swap.

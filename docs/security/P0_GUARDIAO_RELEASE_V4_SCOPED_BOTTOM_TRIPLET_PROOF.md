# Android 9 v4 | scoped bottom triplet, passive experimental proof

## Grounded observation
[Initial v4 E2E #43775009438](https://github.com/nego001/negresco-finance./actions/runs/43775009438) has `home_only=FAILURE` and separate `same_pid=SUCCESS` with four synthetic PDFs and three safe Home returns. [Passive sibling audit #43775789259](https://github.com/nego001/negresco-finance./actions/runs/43775789259) confirmed `Pix-all=multiple` and `Pix-bottom-eligible=one`; Negresco is one globally and bottom-eligible. The older classifier rejects globally duplicated Pix labels without considering exact parent geometry. **This does not prove general navigation safety.**

## Isolated experimental verifier
This branch adds a new, **read-only** independent Android 9 home-only probe. It never modifies the APK, app layout, production verifier, original tests, old Release, or PDF flow.
- Pin exact candidate v4 build #43772274643, hash `3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6` and `CN=Android Debug`.
- Require two independent observations matching in the same PID, with one bottom-aligned Início/Pix/Negresco TextView each, one unique enabled clickable parent from the app for each, nondegenerate contained labels, nonoverlap, correct horizontal order, same vertical row and no clickable overlay over a parent center.
- Only unrelated content shortcuts outside the footer are ignored. Duplicate footer labels, shared parents, missing parent, foreign package, overlay, invalid layout or inconsistent snapshots BLOCK.
- Never perform tab taps, PDF actions, BACK/swipe, screenshot, XML/UI dump disclosure, OTA, merge or production release. Only print fixed, non-private categories.
- A PASS is **geometry observation only**. It is not a production navigation authorization or a waiver of the historic home-only fail and issue #120.

**Issues #120 and #126 OPEN; PR #125 DRAFT.** `approvedForProduction=false`, `stableReleaseAllowed=false`. No real financial values, Pix payments, or stable signing.

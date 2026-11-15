# Android9 Release-mode root bottom inset | isolated A/B

The v3 root hit-order candidate SHA `64a119ca30e482ea85122a2f381be89b78b798318b496b5c4661aab9515cf2fc` was tested in [#43771363711](https://github.com/nego001/negresco-finance./actions/runs/43771363711). Both jobs failed closed: `home_only` saw point-sized Home label and too-small ancestor **without a PDF**; `same_pid` confirmed PDF A at an independent receiver, but blocked before PDF B on point-sized Home, short ancestor, thin sibling tabs and three repeated thin snapshots. B/C/D never exported.

Previous Android9 Debug navigation successes ([#43672315365](https://github.com/nego001/negresco-finance./actions/runs/43672315365)) combined root zIndex/elevation **and** reserved bottom inset. Release v3 carried zIndex/elevation and the same 76dp/60dp nav minima but not the reserved root bottom inset.

This branch changes **only** the root paddingBottom guard from `__DEV__ && Android` to `Android`, preserving the existing `StatusBar.currentHeight ?? 24` value. No Android input workaround, keyboard BACK, second print, navigation handler, financial logic or APK historical SHA changes. The new candidate is test-only and must be SHA-pinned plus Debug-signed before any API28 emulator verification.

No claim this fixes Release navigation. Success requires native accessible bounds, same-PID Home and independent synthetic PDF receipts, not just passing contracts. Original immutable APK SHA `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` remains unavailable and unaffected. #120/#126 OPEN, PR125 DRAFT, approvedForProduction=false, stableReleaseAllowed=false. No OTA, merge, stable signing or payments.

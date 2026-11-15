# Android 9 | root hit-order A/B with exact third Release-mode candidate

- Source candidate build: [#43763628055](https://github.com/nego001/negresco-finance./actions/runs/43763628055), commit `1a96f40`.
- SHA-256: `64a119ca30e482ea85122a2f381be89b78b798318b496b5c4661aab9515cf2fc`; signature **CN=Android Debug** despite Release-mode compilation. Not the historical immutable Release.
- Changes relative to failed v2: Android root now receives existing `labAndroidRootHitOrder` zIndex/elevation also without `__DEV__`. Other existing 76/60 dp nav minima remain, Debug-only root inset remains Debug-only.

A/B evidence:
- Prior v2 on API28 showed `point-only`, `height-too-small` and `three-tabs-thin` **before** the first PDF, and failed Home navigation before PDF B even though PDF A passed. See [#43759014244](https://github.com/nego001/negresco-finance./actions/runs/43759014244).
- Historical API28 Debug navigation succeeded after the hit-order experiment: [#43672315365](https://github.com/nego001/negresco-finance./actions/runs/43672315365).
- No evidence yet that the same change fixes the Release-mode candidate. Test the runtime, not source only.

Two **independent API28 emulators** evaluate the same pinned v3 bytes without rebuild:
1. `home_only`: launch Home, read two bounded UIA snapshots, require a full-sized `Início` label + clickable ancestor + two sibling tabs, stable PID, no taps or PDF; log fixed categories only. A failure means even initial geometry remains unsupported.
2. `same_pid`: four consecutive invalid-input synthetic PDFs, independent receiver and semantic PDF validation, three strict Home navigation returns, single PID, no app reinstall or data clearing. Any unsafe Home bounds fail the job, no workaround.

All checks fail closed; a successfully downloaded candidate APK stays **test-only** and cannot replace historical SHA `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`.
P0 PDF issue #120 OPEN, navigation issue #126 OPEN, PR #125 DRAFT,
`approvedForProduction=false`, `stableReleaseAllowed=false`.
No payment, financial data, production Release, OTA, stable signing or merge.

# M71 staging — categorical last-verified checkpoint for guarded Debug preview navigation

## Scope and evidence

The [M69 Android9 navigation run #45049052547](https://github.com/nego001/negresco-finance./actions/runs/45049052547) ended **BLOCK** after an independently verified `idle-observed / PPP` and strict Home census (`tabs-present-bounded`, `home-marker-unique`, `home-static-all`). The original runner's single generic BLOCK message did **not** reveal whether the initial Pix candidate was rejected, a command was sent, the Pix page rendered, or Home returned. The [M69 CI #45049052382](https://github.com/nego001/negresco-finance./actions/runs/45049052382) was SUCCESS with **1650/1650** contracts, but contract success does not override the Android BLOCK.

The [M70 read-only first-Pix candidate lab #45051256896](https://github.com/nego001/negresco-finance./actions/runs/45051256896) is an independent experiment to discriminate the first target's rejection conditions **without a tap**. When this M71 staging was created, its emulator was still in `assembleDebug`; no M70 native category had been established. Do not infer M70 PASS or run more gestures to compensate for a pending test.

## Staging only — no new Android workflow

On a separate branch, prepare a **pure, fixed-category last-verified-checkpoint ledger** for the existing guarded M69 runner, for optional use after M70 is interpreted. The branch adds only (1) the deterministic no-I/O ledger, (2) fixed checkpoints in the old runner without adding a UI read, touch, retry or timeout, (3) negative static and pure-fixture tests, and (4) this policy note. **There is no new Android workflow**, so committing these files does not launch any M71 emulator or tap.

The monotone ledger accepts only the immediately next allowlisted checkpoint:
- `preflight-pending`: external `PPP` or Home callback not yet attested;
- `home-attested`: initial Home census succeeded;
- `pix-candidate-attested`: fresh strict in-memory M68 guard accepted Pix;
- `pix-input-command-returned`: one checked ADB input command returned; **not** proof of physical delivery or UI transition;
- `pix-preview-content-attested`: fixed public Pix preview text checked in one new snapshot;
- `home-candidate-attested`: same strict guard accepted Home as a return target;
- `home-input-command-returned`: one checked Home input command returned; **not** proof of physical delivery;
- `home-return-content-attested`: final Home census from the final snapshot succeeded;
- `sequence-complete`: final PID/foreground stable and all other M69 gates succeeded.

If any step errors, the runner would emit only `debug-nav-last-checkpoint=<one literal fixed category>` followed by its existing generic BLOCK. **No error text, raw UI, XML, logcat, screen dimensions, coordinates, package IDs, process IDs, app values, payment data, PDF bytes or HTTP data** are emitted. A missing checkpoint signifies that the next operation was not proved; it does not establish which internal subcondition failed or whether a touch was delivered.

The modified runner retains exactly the original M69 operations: the fixed 30-second startup settle before `PPP`, one initial Home census, at most two geometrically authorized preview-only taps (Home → Pix → Home), fixed 2-second pauses, three more private snapshots, XML deletion on every snapshot, and stable PID/focus checks. The ledger cannot alter control flow, determine target geometry, invoke Android, authorize a click or override BLOCK. No adaptive retries, relaxed selected-state assertions, marker bypasses, or disabled security checks.

## Safety and next decisions

Only consider adding a separate, explicitly reviewed Android workflow for the stage-ledger runner **after** reviewing the M70 native first-candidate category. Even if a future run returns `sequence-complete`, it would establish just one disposable Android9 Debug preview-navigation sequence, **not** a PDF fix or readiness of the original Release.

P0 #120 and #126 remain OPEN, PR #125 stays Draft/unmerged, `approvedForProduction=false`, `stableReleaseAllowed=false`. No new gesture runs, APKs, signing, OTA, production merge, real Pix, bank data or payments as part of M71 staging. `main` and SHA-pinned historical Release remain untouched.

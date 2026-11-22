# M70 — Android9 Debug first Pix tap candidate preflight, read-only

## Confirmed M69 outcome

The [M69 Android workflow #45049052547](https://github.com/nego001/negresco-finance./actions/runs/45049052547), commit `c58024d5cd127584826ad296c1bbfca9ac2ffca8`, completed **FAIL/BLOCK**. The external no-permission observer saw `debug-focused`, `idle-observed`, `PPP`. The first native Home census passed `tabs-present-bounded`, `home-marker-unique`, `home-static-all` and `app-text-and-clickable`, then the workflow printed `BLOCK (LAB): guarded Debug Home-Pix-Home navigation not attested`.

**That log does not identify which check failed after the Home census, or whether the first or second tap was issued.** Treating this failure as a confirmed Pix touch defect would be unsupported. [M69 CI #45049052382](https://github.com/nego001/negresco-finance./actions/runs/45049052382) concluded **SUCCESS, 1,650/1,650 contracts** and all required jobs; that test suite is distinct from the failed emulator navigation.

M67's two independent [read-only Android9 trials #45047183173](https://github.com/nego001/negresco-finance./actions/runs/45047183173) both passed initial Debug Home content and safe bottom-tab geometry, not interaction. They cannot override the M69 navigation BLOCK.

## M70: preregistered next diagnostic

Build one new disposable Android9/API28 Debug app and independent zero-permission testOnly observer, identical to M69. Preserve the fixed **30-second** pre-first-observation settling, build SHA/policy/permission gates, private localhost-only Metro, package-specific `PPP` roots, stable app PID and focus.

After the independent external root proof, run the same fail-closed Home census and obligatory XML cleanup, then take **one fresh read-only UIAutomator snapshot**. It must also delete its temporary raw XML with a bounded `finally` operation; cleanup failure is BLOCK. The M70 code does not call `input tap`, swipe, BACK, PDF, payment or any method that sends a touch to the device. A single attempt only, no retries.

It compares only known Debug `testID` prefixes, package identity, `enabled`, `clickable`, `selected` flags and bounds **in memory**, using the same original strict geometry function and unchanged pure M68 navigation candidate selector. It emits **only one** fixed categorical `debug-nav-first-candidate`:
- `source-marker-missing-or-duplicate` or `destination-marker-unexpected` for page identity inconsistencies;
- `tab-id-missing-or-duplicate`, `tab-package-mismatch`, `tab-not-clickable-or-enabled`, `tab-selected-state-mismatch` for native node problems;
- `tab-bounds-invalid`, `tab-geometry-unsafe`, `tab-targets-overlap`, `clickable-occluder-or-unknown` for invalid/ambiguous geometry or clickable overlays;
- `snapshot-unconfirmed` for any invalid input, exception, cleanup/focus/PID failure, or other inconclusive situation;
- `candidate-eligible` ONLY when the unchanged strict pure M68 selector independently accepts the first Pix candidate.

No raw XML, arbitrary UI text, resource ID strings, coordinates, dimensions, PID, logcat, HTTP requests, screenshot, APK or artifact may be emitted. A `candidate-eligible` is **NOT approval for production or proof of delivered touch**; it only means the initial native candidate appears eligible under this read-only snapshot.

M70 reports PASS only for `candidate-eligible` after PPP, Home census, both cleanups and PID/focus, and all other categories BLOCK. A PASS narrows the M69 failure to its actual navigation path or later checks but does NOT establish exactly where M69 failed or whether a tap was delivered; a BLOCK identifies a potentially unsafe preflight to examine without relaxing any protection.

## Safety

P0 #120 and #126 remain OPEN; PR #125 Draft/unmerged. `approvedForProduction=false`; `stableReleaseAllowed=false`. No release APK, OTA, merge, data, bank connection, Pix transfer, synthetic PDF or gesture. `main` and historical original Release remain unchanged.

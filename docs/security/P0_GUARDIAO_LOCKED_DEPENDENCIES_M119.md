# M119 — dependency lock candidate

M118 Android #45678493765 job 139432378840 SUCCESS: 2/2 first Analyze taps, 2/2 independently verified PDFs, exact app-owned final share marker with app already focused, two guarded Home returns and unchanged PID. CI #45678493647: 6/6 required, 1870/1870 contracts. Chooser observed in 5–15s then under 5s; native renderer exit not observed in window (not evidence of a leak). No physical-device or Release claim.

The tracked tree has no npm lockfile. M119 preserves exact M117 functional candidate, resolving a first mobile lockfile in a disposable CI checkout. Public npm registry HTTPS tarballs and integrity metadata only, exact direct dependencies, safe-area-context 5.6.0. Clean npm ci with scripts disabled, unchanged lock SHA256 and TypeScript validation. No APK. Only the validated public dependency lock metadata is retained as an artifact, not any app data or PDF. This first resolution does not prove equality with historical M118 transitive dependency graph or runtime behavior; those need subsequent locked-build QA. No package lock committed yet. Four new contracts expected.

Original Release protected; #120/#126 open, #125 Draft; approvedForProduction=false, stableReleaseAllowed=false. No main edit, signing, publication, OTA or real financial data.

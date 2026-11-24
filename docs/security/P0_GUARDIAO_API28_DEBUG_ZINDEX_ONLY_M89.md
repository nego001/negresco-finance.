# M89 — one-property root style counterfactual (Debug only)

## M88 final evidence (24/11/2026)
[M88 Android #45321852818](https://github.com/nego001/negresco-finance./actions/runs/45321852818) **2/2 PASS** (jobs 138202019320 and 138202018768). Both logs attest two guarded Home→Pix→Home cycles in one PID and external package-only root pattern PPP. [M88 CI #45321852910](https://github.com/nego001/negresco-finance./actions/runs/45321852910) six required jobs SUCCESS; contracts 1,744/1,744, zero failures/skips. Three optional PR-only emulator jobs skipped. M84 2/2 PASS; M85b, M86b and M87 each 2/2 FAIL without root priority. M87 missing root touch flag does not establish a native hit receiver. Historical failures retained.

## Experiment
M88 retained `labAndroidRootHitOrder:{zIndex:4,elevation:4},` while subtracting two bottom-nav size overrides in temporary Debug source. M89 reuses the pure M88 transform and changes only the exact root definition to `labAndroidRootHitOrder:{zIndex:4},`. Unique root reference and all diagnostics retained. No committed app source edit. Own-branch CI-only preflight rejects ambiguous, premodified or missing source. Two new independent API28 emulators, same strict geometry, bounded synthetic preview input, same PID, XML cleanup and final PPP. No extra reads, taps, retries, waits, screenshots, PDF or payment. Any failure retained; preflight/build failure is not a native navigation finding.

2/2 native PASS shows zIndex alone suffices under these Debug conditions, not universally. Valid setup followed by failure suggests elevation or interaction may matter; separate elevation-only experiment could discriminate further. Mixed results inconclusive. No Release causality or PDF repair established.

## Production guard
Original Release SHA256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` immutable. P0 #120 and #126 OPEN, PR #125 Draft/unmerged, approvedForProduction=false, stableReleaseAllowed=false. No main edit, production build, signing, OTA, publication or real financial data.

# M115 — first Analyze tap before repeat PDF

## M114 final
[Android #45661129750](https://github.com/nego001/negresco-finance./actions/runs/45661129750), API28 job 139370925943 SUCCESS. 2/2 PDFs with independent receiver, nonblank page rendering, semantic text and SHA checks, cache/capture cleanup; guarded Home return, same PID, native-render-completed, chooser under-5s twice. Both cycles first Analyze result not observed and existing label-center retry succeeded. Renderer exit not observed in window; not proof of resource leak. [CI #45661129436](https://github.com/nego001/negresco-finance./actions/runs/45661129436) 6/6 required, 1,854/1,854 contracts. No inference of Release fix.

## M115
Exact M114 app/package and build; disposable runner only selects existing prefer_label=True for initial Analyze tap and removes bounded retry/associated seven reverse scrolls. Same visible result observation, initial timeout and fail-closed gate; one tap per analysis, no second attempt, no PDF if result unobserved. Existing PDF button/chooser/receiver/semantic checks and same-process return unchanged. Hypothesis: first inherited clickable ancestor versus label center contributed to missing result; keyboard focus or viewport/other factors remain possible. Success shows single-tap observation with this harness, not root cause or universal touch fix. Four additional contracts expected. No change to application beyond exact M114 temporary control, no PDF upload or real data.

## Production guard
Original Release SHA256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` immutable. P0 #120 and #126 OPEN, PR #125 Draft/unmerged, approvedForProduction=false, stableReleaseAllowed=false. No main edit, production build, signing, OTA, publication or actual financial data.

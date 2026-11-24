# M97 — API35 display shape diagnostic (Debug only)

## M96 final
[M96 Android #45481087730](https://github.com/nego001/negresco-finance./actions/runs/45481087730): API29 PASS job 138754115879, initial PPP and two geometry-guarded Home-Pix-Home cycles in one PID, all focus checks and post-cycle PID/focus passed. API35 BLOCK job 138754116249, exact source prep, APK validation, install, launch, settle and PID passed; m96-focus=default-display-unconfirmed before initial PPP, no Pix tap. Header recognized but default-display gate not satisfied. Exact structural cause unknown; not a native navigation failure. [CI #45481087344](https://github.com/nego001/negresco-finance./actions/runs/45481087344) 6/6 required jobs SUCCESS, 1,776/1,776 contracts. Preserve API29 success and API35 block.

## M97
One fresh API35 job only; exact M96 app, SDK and display focus control, add five fixed categories only within original default-display failure branch: no-display-header, default-header-missing, duplicate-default-header, multiple-display-headers, default-header-format-unconfirmed. Category precedence explicit; original decision unchanged. No raw display IDs, suffixes, package data or window output. Same existing one displays read, timeout, focus/PID/geometry gates, initial PPP and two-cycle runner. No new device calls, reads, taps, waits, retries, fallback, PDF, payment, screenshots or uploads. Synthetic fixtures prove original classifier decisions unchanged. No tracked app/observer changes. If original gate passes, existing navigation runs; otherwise diagnostic block, not functional failure. Do not accept additional header shapes until justified by evidence.

## Production guard
Original Release SHA256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` immutable. P0 #120 and #126 OPEN, PR #125 Draft/unmerged, approvedForProduction=false, stableReleaseAllowed=false. No main edit, production build, signing, OTA, publication or actual financial data.

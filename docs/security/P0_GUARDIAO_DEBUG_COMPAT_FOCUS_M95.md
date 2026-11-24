# M95 — compatibility focus diagnostic (Debug only)

## M94 outcome
[M94 Android #45473887228](https://github.com/nego001/negresco-finance./actions/runs/45473887228), API29 job 138728809666 and API35 job 138728808920 both FAILURE. Both passed exact prep, disposable APK security, Metro, relay, installation, launch, fixed settling and PID gate. Last label m94-preflight-next=focus; no focus confirmation, no observer instrumentation or initial PPP attested, no Pix tap. This isolates the attempted focus operation, not the reason. [CI #45473887434](https://github.com/nego001/negresco-finance./actions/runs/45473887434) six required jobs SUCCESS; 1,768/1,768 contracts.

## M95
Exact M94 control, one fresh job per API29/API35; replace only the original focus helper in disposable checkout with the same command, timeout, first eligible marker, length and exact original regex decision. Emit only fixed categories: command-timeout, command-error, empty-response, missing-marker, oversized-marker, null-marker, app-token-nonmatching, nonmatching-marker, original-match. Nonmatching does not establish another app has focus. Exceptions re-raised; no fallback, retry, new read, input, wait, raw dump or exception text. Original focus predicate remains authoritative, including subsequent checks. Same app transform, navigation guard and SDK equality. No tracked app or observer edits. If focus passes, original navigation proceeds unchanged. Initial PPP before cycles, PID/focus checks afterward. No screenshots/PDF/payment/upload. Preserve M93/M94 blocks and classify separately from functional failure.

## Production guard
Original Release SHA256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` immutable. P0 #120 and #126 OPEN, PR #125 Draft/unmerged, approvedForProduction=false, stableReleaseAllowed=false. No main edit, production build, signing, OTA, publication or actual financial data.

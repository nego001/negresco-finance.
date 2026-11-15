# P0 candidate API28 Home geometry before/after PDF

Original historical SHA and original Release remain unavailable and unmodified.

[Candidate v2 #43754710778](https://github.com/nego001/negresco-finance./actions/runs/43754710778)
ended **FAILURE**: cycle A was a fully validated PDF with independent receiver.
Cycle B reached a live app in foreground but the unique Home TextView was
point-sized, the clickable ancestor too short and both sibling tabs thin.
`home-layout-recheck=three-observations-thin`. B/C/D did not export PDFs.
Increasing bottom tab `minHeight` to 60dp for Release mode DID NOT solve
this navigation block.

The post-share diagnostic also reported contradictory input-method visibility
(`ime-pair=view-only-shown`) with no focused editable node, so **the keyboard
is a possibility, not a confirmed cause**. Blind BACK, tap, swipe, process
restart or data clear must NOT be added as a workaround.

## Read-only next step

Branch `lab/p01-guardiao-release-home-geometry-phase-probe-v1` wraps the
**unchanged** candidate v2 same-PID replay and observes strictly categorized
Home label/ancestor shapes and IME state at:
- initial Home in the first cycle;
- immediately before the first PDF export;
- after the independent receiver has returned;
- when the existing runner begins the Home return for cycle B.

No captures are uploaded. If existing Home navigation fails, workflow still
FAILS. A category is a diagnostic and **never** a touch permission or proof
of a stable original Release. A controlled, single-variable experiment on
Android window/IME handling can be evaluated after evidence exists.

Release original SHA:
`29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a`.

P0 #120 OPEN; PR #125 DRAFT;
`approvedForProduction=false`; `stableReleaseAllowed=false`.
No production, OTA, financial operations or unreviewed installation.

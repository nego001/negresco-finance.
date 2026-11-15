# P0 Preview Release: safe bottom-navigation hit targets

**State: experimental candidate, NOT original-APK repair.**

A historical same-process test of the current DEBUG-SIGNED Release-mode candidate
[#43751102206](https://github.com/nego001/negresco-finance./actions/runs/43751102206)
finished **FAILURE**. Cycle A exported and validated the PDF, and the
candidate stayed alive. On returning to Home for cycle B, native UI evidence
showed the Início label but a point-sized / too-thin bottom touch rectangle.
The lab refused to tap. Cycles B, C and D **never produced receipts**. This is
a **navigation geometry block**, not evidence that the next native PDF hung.

Comparison of App.tsx identified a difference: the parent bar's
\`labBottomBounds: {minHeight:76,flexShrink:0}\` and each nav touch target's
\`labNavBounds: {height:60,minHeight:60,flexShrink:0}\` were applied only
under \`__DEV__\`. In this branch we apply these two **already defined**
fixed bounds to both Debug and Release-mode previews. The rest of the root
layout, guarding logic, financial analysis and PDF export remain untouched.
Accessibility roles, labels and existing native layout checks remain in
place.

**Not proof of a fix:** the Release-mode Android UI must still be measured
at runtime after compiling a new, distinct candidate. The archived original
Release SHA256 is NOT replaced or altered. A subsequent test must first
verify the new candidate's hash/signing and safe Home target, then verify
consecutive PDF receipts in the same live PID with the existing independent
receiver. No unbounded taps, fake receipts, bypasses, original Release
rebuild, production deployment, payments, public apk release or OTA.

Gates remain \`approvedForProduction=false\` and
\`stableReleaseAllowed=false\`; P0 #120 remains open and PR #125 Draft.

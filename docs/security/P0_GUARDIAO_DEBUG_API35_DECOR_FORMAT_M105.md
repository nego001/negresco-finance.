# M105 — bounded DecorView format extension (Debug only)

## M104 final
[M104 Android #45548193208](https://github.com/nego001/negresco-finance./actions/runs/45548193208) job 138982756108 FAILURE before first touch. Initial PPP and Home census passed, single covering ViewGroup remains outside anchor subtree. Native read reached decor-unconfirmed; class and parent unconfirmed; no Pix tap. The exact raw header is unknown and was not retained. [CI #45548193157](https://github.com/nego001/negresco-finance./actions/runs/45548193157) 6/6 required SUCCESS, 1,810/1,810 contracts.

## M105
Exact M104 native read after the original rejection, only root header predicate extended. AOSP DecorView.toString() in the public master source (https://android.googlesource.com/platform/frameworks/base.git/+/master/core/java/com/android/internal/policy/DecorView.java) returns super.toString() with a title suffix; legacy short format documented by OWASP (https://mas.owasp.org/MASTG/techniques/android/MASTG-TECH-0177/). Accept existing legacy form OR full exact com.android.internal.policy.DecorView using existing strict VIEW grammar and literal MainActivity suffix. Source supports the alternative grammar, not proof it is the observed API35 format. Other classes, titles, malformed flags, wrong indentation and ambiguous matches remain rejected. No new raw output, no extra read, no new command or gesture, no waits/retry, no PDF/payment, no change to size matching, scope, eligibility or app. Retain m104-native categories for direct comparison. Four new contracts; exact source/workflow delta checked. No tracked application or existing lab edit.

## Production guard
Original Release SHA256 `29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a` immutable. P0 #120 and #126 OPEN, PR #125 Draft/unmerged, approvedForProduction=false, stableReleaseAllowed=false. No main edit, production build, signing, OTA, publication or actual financial data.

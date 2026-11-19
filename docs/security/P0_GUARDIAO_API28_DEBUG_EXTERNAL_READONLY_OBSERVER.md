# P0 #126 — Android 9 Debug external, read-only UiAutomation observation (isolated)

## Scope and why this exists

Previous same-HEAD synthetic-only A/B matrix [#44448573345](https://github.com/nego001/negresco-finance./actions/runs/44448573345), commit \`93818e6\`:
- synchronous Activity launch without event-idle wait: 2/3 PASS; remaining trial readiness=ready but root mask NNN → BLOCK;
- same source and emulator configuration with one \`UiAutomation.waitForIdle(1000L, 5000L)\`: 3/3 PASS (PPP) in independent trials;
- small observational sample, NOT proof of causality, reliability, a PDF fix or safe navigation.

CI [#44448573355](https://github.com/nego001/negresco-finance./actions/runs/44448573355) had **1,599/1,599 contracts PASS**, but \`native-lock-android-lab\` failed resolving external Gradle/Kotlin dependencies. CI is NOT green; do not label it approved.

## New experiment (Debug-only, not original Release)

A separate **testOnly, no-permission, no-Activity** observer APK runs one self-instrumented \`UiAutomation\` connection. It does NOT instrument the finance APK itself, nor inject actions or call any payment, share, chooser or PDF method.

This experiment may run ONLY in a fresh disposable Android9/API28 emulator, on a newly built debuggable APK from repository source and its loopback-only private Metro bundle. The runner refuses any pre-existing \`com.negresco.finance\` or observer install (no account data, no inherited app state). The Debug APK manifest is sanitized, no denied permissions are accepted, the debug signature/SHA is checked locally, and the observer is built using Android SDK tools with a one-day disposable key. Original APK Release and \`main\` are never modified. No APK is uploaded.

Precondition: one intentional launch via shell Monkey's LAUNCHER category, no UI taps/swipes; fixed five-second initial settling interval; foreground package and one process PID confirmed. This proves only foreground identity, **not that the home screen has finished rendering**. If foreground cannot be established, BLOCK without observing roots.

The observer has no Activity and launches no UI. It performs exactly ONE bounded accessibility event idle wait, \`waitForIdle(1000L, 5000L)\`, and then exactly THREE non-retried \`getRootInActiveWindow()\` calls. It only checks whether the root's package equals the known freshly-built Debug package. Internal status is **P** for correct package, **N** for null, and **F** for a foreign window. No node text, content description, geometry, XML, screenshot, raw logcat, package of an unrelated window, token, financial data, URI or exception detail leaves memory. Each root is recycled. Raw instrumentation stdout remains private and is parsed strictly; logs contain fixed categories only.

An observation PASS requires all of:
1. API28, Debug APK integrity and clean emulator preflight;
2. foreground finance Debug package and a unique PID before observation;
3. strict instrumentation termination code -1, mode idle, idle-observed and complete, internally consistent three-root sample list;
4. exactly **PPP** (all three roots report *the Debug app package*);
5. same PID and foreground package after instrumentation.

Any missing or contradictory evidence (N/F, timeout, no PID, app focus change, incomplete result, infrastructure error) is BLOCK. A PASS here attests only that an external read-only observer could access the active Debug window at one point. It **does not validate geometry, clicking, PDF generation, chooser availability, print hang, navigation, accessibility for end users or product safety**. It does not carry approval or change the existing strict UIAutomator gates.

## Non-goals, future gates and security

- No PDF is created or shared and no synthetic boleto value is entered in this experiment.
- No payment, personal account, saved bank data, user permissions, network requests from the app beyond Debug loopback Metro, production signing, release artifact, OTA, merge or upload.
- Next independent stages require exact three-tab geometry, safe focus/root identity across transitions, PDF A/B with independently verified synthetic receiver, API26/28 equivalence, physical Android validation, and human review. These must use separate evidence; this observation cannot satisfy them.
- P0 #120 and #126 remain OPEN. PR #125 stays Draft. \`approvedForProduction=false\` and \`stableReleaseAllowed=false\`. The historical Release SHA and \`main\` stay immutable. Never turn a failing sample or CI dependency failure into PASS.

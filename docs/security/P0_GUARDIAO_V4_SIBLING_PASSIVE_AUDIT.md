# Android 9 | v4 passive sibling-label diagnostic

Source candidate `494ce5e`, build [#43772274643](https://github.com/nego001/negresco-finance./actions/runs/43772274643), **APK SHA-256** `3f41e039ef519de16858df94e57b81f7133154e928071557fd9a6057fa3ca9c6` and `CN=Android Debug`.

v4 home-only job [#43775009438](https://github.com/nego001/negresco-finance./actions/runs/43775009438) yielded `home-label-bounded`, `on-bottom-band`, `geometry-eligible`, but `siblings-missing-or-ambiguous`. All three categories are required: **Home failed and must stay BLOCK**.

The historical `safe_sibling_tab_height_category()` requires exactly one enabled TextView in the **entire** UI tree named `Pix` and one named `Negresco`. App Home also has a separate quick-link labeled `Pix`; this can create unrelated duplicate labels. This is a hypothesis, not yet a verified cause for v4.

This new independently triggered **read-only** `home_only` emulator samples exact known labels as categorical counts (`none/one/multiple`) and independently counts candidate labels that have one clickable enabled same-package parent with fully contained label and eligible bottom geometry. It does not export raw XML, coordinates, text values, screenshots, paths, PID, or user data, and **does not select or touch** a candidate. It still runs the original full `VALID` proof gate and fails closed even when the diagnostic finds a unique bounded parent. No application code, historic tests, gesture gates, original SHA or production flags changed.

If diagnostic indicates duplicate `Pix` labels but one bounded bottom candidate, investigate a safe, independent verifier change with explicit negative overlap/duplicate tests before authorizing any navigation. If no unique bottom candidate, inspect layout rather than weakening the gate. PDF and same-PID track remains separate and unchanged.

No merge, OTA, stable signing, real payments/Pix, customer data or publication. #120/#126 open, PR125 Draft, `approvedForProduction=false`, `stableReleaseAllowed=false`.

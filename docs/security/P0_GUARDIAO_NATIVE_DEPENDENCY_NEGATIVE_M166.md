# M166 — offline negative controls for M164

Prepared on M164 110e786987eb0005c057be66e71d2684ab765bbf. M164 differential 45932387349 passed 1963/1963 twice, no affected files; static contracts passed. Actual M164 Gradle graph gate and M165 Android15 runtime still pending. Do not activate until M164 mandatory CI is terminal, because new pushes cancel older CI.

M166 builds nine local synthetic Maven metadata graphs using the same Gradle wrapper and M164 init script. Clean graph must pass; direct/transitive SQLCipher, direct biometric, unresolved edge, missing/drifted Debug controls, missing Release control and empty Release graph must fail with the specific expected M164 reason, not an arbitrary Gradle error. Offline, temporary fixtures, no Android APK or dependency installation in the product, no raw output. A Node test checks fixture generation; the actual nine Gradle calls require CI. No production security claim. Expected 1964 contracts. M165 is separate and not modified.

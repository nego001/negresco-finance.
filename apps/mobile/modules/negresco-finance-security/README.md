# Negresco Finance Android local Expo module (diagnostic only)

This local Expo module exposes **exactly one read-only method**:
`NegrescoFinanceSecurityV1.getIntegrationInfo()`.

- Android class: `com.negresco.finance.security.NegrescoFinanceSecurityV1Module`.
- The only exported result is a static status describing **no security
  integration**: financial storage, key release, migration, SQLCipher and
  hardware-authorized key access all remain **false**.
- No key, record, personal data, filesystem path, biometric token, API call,
  database connection, transaction or write method is present.
- Presence of this module, compilation or a positive diagnostic **does not**
  establish Android Keystore authorization, native biometrics or SQLCipher.
- The JS settings screen must continue to treat even a forged `ready: true`
  response as **read-only / blocked**.

## Verification

The GitHub Android test-candidate workflow runs `expo prebuild` and Gradle
to compile the module in a disposable CI environment; an APK produced there
remains an **unsigned-for-production / Debug-signed test artifact**, never
automatically installed or published as a stable release.

Before merging: build+verify an exact native revision and run physical QA on
a test device with invented data. Do not migrate the installed user's app,
do not infer release signing compatibility and do not connect data operations
or the security lab modules without completing the Phase 1 trust gates.

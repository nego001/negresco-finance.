#!/usr/bin/env bash
# The emulator-runner executes script lines in separate /bin/sh processes.
# Keep the whole upgrade ceremony inside ONE Bash process.
# Never run this against an actual USB device or production storage.
set -euo pipefail

OLD="previous/Negresco-Finance-V3.1-candidate.apk"
NEW="$(find candidate -type f -name '*.apk' -print -quit)"
test -s "$OLD"
test -n "$NEW" && test -s "$NEW"
test "$(adb devices | awk '$2=="device" {n++} END {print n+0}')" -eq 1
test "$(adb devices | grep -c 'emulator-.*device')" -eq 1

# Re-check the exact bytes and matching package identities at the use site.
echo "f70ba5107c24e4e59c423ba898f281d9cc8aebc8852f4a0f999cb5923d1c0077  $NEW" | sha256sum -c -
BUILD_TOOLS="$(find "${ANDROID_HOME:?}"'/build-tools' -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
AAPT="$BUILD_TOOLS/aapt"
SIGNER="$BUILD_TOOLS/apksigner"
test -x "$AAPT" && test -x "$SIGNER"
"$AAPT" dump badging "$OLD" | grep -F "package: name='com.negresco.finance' versionCode='33'"
"$AAPT" dump badging "$NEW" | grep -F "package: name='com.negresco.finance' versionCode='34'"
"$SIGNER" verify --print-certs "$OLD" > /tmp/negresco-old-cert.txt
"$SIGNER" verify --print-certs "$NEW" > /tmp/negresco-new-cert.txt
get_cert() {
  sed -nE 's/.*certificate SHA-256 digest: ([0-9a-fA-F]{64}).*/\1/p' "$1" | head -n 1 | tr '[:upper:]' '[:lower:]'
}
OLD_CERT="$(get_cert /tmp/negresco-old-cert.txt)"
NEW_CERT="$(get_cert /tmp/negresco-new-cert.txt)"
test -n "$OLD_CERT" && test "$OLD_CERT" = "$NEW_CERT" || {
  echo "::error::APK signatures differ, update test blocked."
  exit 1
}

# Do NOT uninstall, clear data, factory-reset or touch an actual phone.
adb install "$OLD"
adb shell pm path com.negresco.finance | grep -F 'package:'
adb shell dumpsys package com.negresco.finance > /tmp/negresco-before-upgrade.txt
grep -m 1 'versionCode=33' /tmp/negresco-before-upgrade.txt
adb install -r "$NEW"
adb shell pm path com.negresco.finance | grep -F 'package:'
adb shell dumpsys package com.negresco.finance > /tmp/negresco-after-upgrade.txt
grep -m 1 'versionCode=34' /tmp/negresco-after-upgrade.txt
echo "PASS: emulator PackageManager accepted 3.1.2 to 3.1.3 update with matching signatures."
echo "NO CLAIM: user data, backup, biometric migration or actual Samsung install were tested."

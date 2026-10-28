#!/usr/bin/env bash
set -euo pipefail
# LAB ONLY. Build an independent Java Android receiver using the installed SDK.
# No Maven, Gradle, npm, financial app rebuild, external permissions or data.
ROOT="tooling/android/pdf-receiver-lab"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
test -n "$SDK"
TOOLS="$SDK/build-tools/35.0.0"
JAR="$SDK/platforms/android-35/android.jar"
for tool in aapt aapt2 d8 zipalign apksigner; do
  test -x "$TOOLS/$tool" || { echo "::error::Missing Android SDK tool: $tool"; exit 1; }
done
test -s "$JAR"
command -v javac >/dev/null
command -v keytool >/dev/null
command -v zip >/dev/null
command -v openssl >/dev/null
SOURCE="$ROOT/app/src/main/java/com/negresco/pdfreceiver/lab/ReceiverActivity.java"
MANIFEST="$ROOT/app/src/main/AndroidManifest.xml"
test -s "$SOURCE" && test -s "$MANIFEST"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/classes" "$WORK/dex"
javac -source 8 -target 8 -Xlint:-options -classpath "$JAR" -d "$WORK/classes" "$SOURCE"
"$TOOLS/d8" --min-api 26 --lib "$JAR" --output "$WORK/dex" \
  "$WORK/classes/com/negresco/pdfreceiver/lab/ReceiverActivity.class"
test -s "$WORK/dex/classes.dex"
"$TOOLS/aapt2" link -o "$WORK/unsigned.apk" -I "$JAR" \
  --manifest "$MANIFEST" --min-sdk-version 26 --target-sdk-version 28 \
  --version-code 1 --version-name 0.0.1-lab
(
  cd "$WORK/dex"
  zip -q -u "$WORK/unsigned.apk" classes.dex
)
"$TOOLS/zipalign" -f -p 4 "$WORK/unsigned.apk" "$WORK/aligned.apk"
PASS="$(openssl rand -hex 16)"
keytool -genkeypair -alias disposable -keyalg RSA -keysize 2048 \
  -keystore "$WORK/disposable.jks" -storepass "$PASS" -keypass "$PASS" \
  -validity 1 -dname 'CN=Disposable PDF Receiver Lab' -noprompt >/dev/null 2>&1
OUTPUT="$ROOT/app/build/outputs/apk/debug/app-debug.apk"
mkdir -p "$(dirname "$OUTPUT")"
"$TOOLS/apksigner" sign --min-sdk-version 26 --ks "$WORK/disposable.jks" \
  --ks-key-alias disposable --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --out "$OUTPUT" "$WORK/aligned.apk"
"$TOOLS/apksigner" verify --min-sdk-version 26 --verbose "$OUTPUT" >/dev/null
test -s "$OUTPUT"
"$TOOLS/aapt" dump badging "$OUTPUT" | grep -F "package: name='com.negresco.pdfreceiver.lab'" >/dev/null
"$TOOLS/aapt" dump badging "$OUTPUT" | grep -F "sdkVersion:'26'" >/dev/null
if "$TOOLS/aapt" dump permissions "$OUTPUT" | grep -Fq 'uses-permission:'; then
  echo "::error::Receiver APK must have zero Android permissions"
  exit 1
fi
echo "PASS (LAB): permissionless, freshly debug-signed receiver compiled using Android SDK only"

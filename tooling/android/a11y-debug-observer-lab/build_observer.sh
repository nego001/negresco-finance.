#!/usr/bin/env bash
set -euo pipefail
ROOT=tooling/android/a11y-debug-observer-lab
BT="$ANDROID_HOME/build-tools/35.0.0"
JAR="$ANDROID_HOME/platforms/android-35/android.jar"
for t in aapt aapt2 d8 zipalign apksigner; do test -x "$BT/$t"; done
test -s "$JAR"
for t in javac keytool openssl zip; do command -v "$t" >/dev/null; done
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/classes" "$TMP/dex"
SRC="$ROOT/app/src/main/java/com/negresco/a11ydebugobserver/lab"
javac -source 8 -target 8 -Xlint:-options -classpath "$JAR" -d "$TMP/classes" \
  "$SRC/ObserveInstrumentation.java"
"$BT/d8" --min-api 28 --lib "$JAR" --output "$TMP/dex" \
  "$TMP/classes/com/negresco/a11ydebugobserver/lab/"*.class
test -s "$TMP/dex/classes.dex"
"$BT/aapt2" link -o "$TMP/unsigned.apk" -I "$JAR" \
  --manifest "$ROOT/app/src/main/AndroidManifest.xml" \
  --min-sdk-version 28 --target-sdk-version 28 --version-code 1 \
  --version-name 0.0.1-lab
(cd "$TMP/dex" && zip -q -u "$TMP/unsigned.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$TMP/unsigned.apk" "$TMP/aligned.apk"
PASS="$(openssl rand -hex 16)"
keytool -genkeypair -alias disposable -keyalg RSA -keysize 2048 \
  -keystore "$TMP/disposable.jks" -storepass "$PASS" -keypass "$PASS" \
  -validity 1 -dname 'CN=Disposable Debug Observer Lab' -noprompt >/dev/null 2>&1
OUT="$ROOT/app/build/outputs/apk/debug/a11y-debug-observer-lab.apk"
mkdir -p "$(dirname "$OUT")"
"$BT/apksigner" sign --min-sdk-version 28 --ks "$TMP/disposable.jks" \
  --ks-key-alias disposable --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --out "$OUT" "$TMP/aligned.apk"
"$BT/apksigner" verify --min-sdk-version 28 --verbose "$OUT" >/dev/null
"$BT/aapt" dump badging "$OUT" | grep -F "package: name='com.negresco.a11ydebugobserver.lab'" >/dev/null
"$BT/aapt" dump badging "$OUT" | grep -F "sdkVersion:'28'" >/dev/null
if "$BT/aapt" dump permissions "$OUT" | grep -Fq 'uses-permission:'; then
  echo 'BLOCK (LAB): debug observer requested Android permissions'
  exit 1
fi
echo 'PASS (LAB): no-permission synthetic debug observer APK built'

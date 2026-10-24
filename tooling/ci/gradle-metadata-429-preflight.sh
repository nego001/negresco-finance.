#!/usr/bin/env bash
# Retry ONLY third-party Gradle metadata resolution errors caused by HTTP 429.
# The PostgreSQL assertions and Kotlin verification tasks run separately ONCE.
set -euo pipefail
if (( $# != 1 )); then
  echo "usage: $0 <relative-gradle-project-directory>" >&2
  exit 64
fi
project="$1"
if [[ ! -f "$project/build.gradle.kts" && ! -f "$project/build.gradle" ]]; then
  echo "BLOCK: Gradle project does not exist: $project" >&2
  exit 64
fi
log="$(mktemp)"
trap 'rm -f "$log"' EXIT
for attempt in 1 2 3; do
  if gradle -p "$project" help --no-daemon >"$log" 2>&1; then
    cat "$log"
    echo "PASS: Gradle dependency metadata resolved (attempt $attempt)"
    exit 0
  fi
  cat "$log" >&2
  if ! grep -Eiq 'Received status code[[:space:]]+429|HTTP[^[:cntrl:]]*429|Too Many Requests' "$log"; then
    echo "BLOCK: Gradle error was not a retryable dependency HTTP 429" >&2
    exit 1
  fi
  if (( attempt == 3 )); then
    echo "BLOCK: Gradle dependency resolution still returns HTTP 429 after 3 bounded attempts" >&2
    exit 1
  fi
  echo "WARN: upstream Gradle dependency HTTP 429; retrying metadata only (attempt $attempt/3)" >&2
  sleep "$(( attempt * 3 ))"
done
exit 1

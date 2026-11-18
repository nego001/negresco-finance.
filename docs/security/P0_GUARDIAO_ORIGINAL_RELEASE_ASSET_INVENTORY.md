# P0 #120 — offline inventory of historical Release APK metadata

## Current custody evidence, checked on 17 November 2026

The immutable historical Release APK has SHA-256 29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a. The four historical GitHub Actions runs checked, 40617164086, 42155990322, 40808040078 and 40620699584, all report zero available artifacts. In the current GitHub API Release listing there are 23 releases, 76 assets and 23 APK assets with digests. None of the 23 direct APK asset digests matches the historical SHA.

This inventory says nothing conclusive about other backups, ZIP archives, devices, or old artifacts that have expired. No APK was downloaded or recovered.

## Reproducible safe metadata-only classifier

The new tooling/android/guardiao_original_release_asset_manifest_lab.py reads a local GitHub Releases JSON previously exported by an authorized operator. It has no network, Android, upload, archive unpacking, installation, or writes. It rejects malformed or incomplete assets, missing APK SHA, oversized input, symlinks, hardlinks and ambiguous duplicate matches.

It reports only STATUS (LAB): original-apk-not-in-release-asset-metadata, STATUS (LAB): candidate-asset-metadata-only-bytes-unverified, or BLOCK (LAB): release-asset-inventory-unconfirmed. A matching metadata digest is not verified executable bytes. The existing guardiao_verify_original_apk_offline.py must inspect a locally authorized copy of the real APK before any identity claim.

Do not substitute the experimental Debug v5 SHA for the historical Release. P0 #120 native Print hang and P0 #126 Android9 navigation/accessibility stay OPEN separately. PR #125 remains Draft, main unchanged, approvedForProduction=false, stableReleaseAllowed=false. No payments, real financial inputs, OTA, production release or signing.

# M132 — moderate candidate compatibility plan

M131 #45735410575: 13 moderate findings, two direct advisory packages and 11 propagated-only packages. glob 13.0.7 advisory 1244013 range >=9.0.0 <=14.0.1; minimatch 9.0.9 and 10.2.6 advisory 1244623 range >=7.0.0 <11.0.1. Six Expo parents require glob ^13.0.0; affected minimatch parents require ^9.0.0 or ^10.2.2. M130 contracts #139626854381: 1897/1897, no failures. M129 Android runtime #45734618505 still compiling at preparation.

M132 reads the exact tracked remediated lock and queries published stable versions; checks every affected parent range; reports first higher nonaffected version and package engine/dependency/export metadata. No override, install, package change or production approval. Outside-range versions need actual Expo compatibility validation. Two new static contracts expected. No APK, signing, publication, OTA or main change. #120/#126 remain open; approvedForProduction=false, stableReleaseAllowed=false.

package com.negresco.finance.security

import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey

/**
 * PHASE 1: typed parsing for a FUTURE private DataStore reader.
 *
 * This pure classifier never creates a DataStore, performs I/O, mutates a
 * record, or returns enabled/revision to JS. It is intentionally NOT exported
 * by NegrescoFinanceSecurityV1Module and cannot authenticate a session.
 *
 * An intact preference tuple may be a replayed/forged snapshot. Therefore
 * even VALID_UNTRUSTED is NOT sufficient to grant access or migrate data.
 */
internal object NativeLockTypedSnapshotClassifier {
  private val version = intPreferencesKey("negresco.lock.protocol_version")
  private val enabled = booleanPreferencesKey("negresco.lock.enabled")
  private val revision = longPreferencesKey("negresco.lock.revision")
  private val disablePending = booleanPreferencesKey("negresco.lock.disable_pending")
  private const val EXPECTED_VERSION = 1

  fun classify(snapshot: Preferences): String = try {
    val v = snapshot[version]
    val e = snapshot[enabled]
    val r = snapshot[revision]
    val p = snapshot[disablePending]
    if (v == null && e == null && r == null && p == null)
      return "MISSING_REQUIRES_VERIFIED_MIGRATION"
    if (v == null || e == null || r == null || r < 0L)
      return "INVALID_LOCKED"
    if (v != EXPECTED_VERSION)
      return "UNSUPPORTED_VERSION_LOCKED"
    if (p == true && !e)
      return "INVALID_LOCKED"
    if (p == true)
      return "PENDING_DISABLE_LOCKED"
    // e=false may have originated from a legitimate earlier UX, but this
    // alone is not a verified opt-out and grants NO access to any data.
    "VALID_UNTRUSTED"
  } catch (_: ClassCastException) {
    // A preference stored under the right name with the wrong type is
    // malformed, not a reason to crash or disable protection.
    "INVALID_LOCKED"
  }
}

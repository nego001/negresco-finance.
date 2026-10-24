package com.negresco.finance.security

/**
 * DEBUG-only fail-closed inspection of disposable QA residue names.
 *
 * The clear result is NOT a biometric, Keystore, SQLCipher or financial
 * authorization. It only permits the subsequent manual Debug QA steps.
 * Any failure to enumerate either source returns HOLD, not empty data.
 */
internal object SyntheticDebugQaOrphanInspection {
  internal enum class Decision {
    QA_FIXTURES_CLEAR,
    HOLD_ORPHANED_DEBUG_QA_RESIDUE,
    HOLD_INSPECTION_UNAVAILABLE
  }

  fun inspect(
    readAliases: () -> Collection<String>,
    readCache: () -> Collection<String>?
  ): Decision {
    val aliases = try { readAliases() }
      catch (_: Exception) { return Decision.HOLD_INSPECTION_UNAVAILABLE }
    val folders = try { readCache() }
      catch (_: Exception) { return Decision.HOLD_INSPECTION_UNAVAILABLE }
      ?: return Decision.HOLD_INSPECTION_UNAVAILABLE

    return if (SyntheticDebugQaOrphanResidueGate.isClear(aliases, folders)) {
      Decision.QA_FIXTURES_CLEAR
    } else {
      Decision.HOLD_ORPHANED_DEBUG_QA_RESIDUE
    }
  }
}

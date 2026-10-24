package com.negresco.finance.security

/**
 * Phase 1: native-only epoch fence for non-authoritative DataStore diagnostics.
 *
 * Activity lifecycle signals can invalidate in-flight diagnostic reads.
 * This is NOT a biometric or cryptographic authorization gate: neither this
 * class nor the Expo module can EVER grant a financial session, enable or
 * disable the lock, unwrap a key, or approve migration.
 *
 * All methods synchronize on one monitor, preventing a stale diagnostic
 * completion from becoming "current" after pause / user-leave / destruction.
 */
internal class NativeLockLifecycleFence {
  private var generation: Long = 0L
  private var foreground: Boolean = false
  private var destroyed: Boolean = false

  private fun invalidate() {
    if (generation == Long.MAX_VALUE) {
      destroyed = true
      foreground = false
    } else {
      generation += 1L
    }
  }

  @Synchronized fun onForeground() {
    if (destroyed) return
    invalidate()
    if (!destroyed) foreground = true
  }

  @Synchronized fun onBackground() {
    foreground = false
    invalidate()
  }

  @Synchronized fun onDestroyed() {
    foreground = false
    destroyed = true
    invalidate()
  }

  /**
   * A token only identifies one foreground period for an internal read.
   * It is not secret, not exported and not an authentication capability.
   */
  @Synchronized fun beginDiagnosticEpoch(): Long? =
    if (foreground && !destroyed) generation else null

  @Synchronized fun isStillDiagnosticEpoch(epoch: Long): Boolean =
    foreground && !destroyed && generation == epoch
}

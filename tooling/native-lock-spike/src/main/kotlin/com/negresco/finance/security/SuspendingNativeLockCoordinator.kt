package com.negresco.finance.security

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Isolated, coroutine-aware coordinator for a future Android-only entrypoint.
 *
 * This is NOT registered with Expo and is NOT a KeyStore authorization layer.
 * All biometric decisions must originate from a trusted native prompt.
 *
 * DISABLE deliberately remains denied: DataStore persistence and Activity
 * onStop are not yet one native, lifecycle-linearizable transaction. Allowing
 * opt-out through this coordinator would reintroduce the final-commit race.
 */
internal fun interface SuspendedStrongBiometry {
  suspend fun authenticate(action: LockAction): Boolean
}

internal class SuspendingNativeLockCoordinator(
  private val repository: DataStoreLockRecordRepository,
  private val requireLiveObservation: Boolean = false,
  private val biometric: SuspendedStrongBiometry
) {
  private val requestMutex = Mutex()
  private val lifecycleGuard = Any()
  private var generation = 0L
  private var foreground = false
  private var unlocked = false
  private var unlockedRevision: Long? = null
  private var lastObservedRecord: LockRecord? = null
  // In the Android lab, the first healthy Flow emission is mandatory before
  // authentication. A terminal Flow error permanently fails closed for the
  // Activity lifetime. Only constructing a new Activity owner can restart.
  private var observationReady = !requireLiveObservation
  private var observationFailed = false

  /**
   * A synchronous, revocation-only sink for the DataStore Flow collector.
   * Notifications cannot grant access. Different persisted records, disabled
   * protection, missing data and I/O/decoding errors revoke any old grant.
   * Called by the Activity-owned collector, never by a JS bridge.
   *
   * The Flow is asynchronous: authorization is ALSO checked by read()/snapshot().
   */
  internal fun onPersistentStateChanged(event: NativeLockObservation): Boolean =
    synchronized(lifecycleGuard) {
      val record = (event as? NativeLockObservation.Record)?.value
      // Error or missing data latches failure. No later observation can
      // silently resurrect authentication after a broken stream.
      if (record == null ||
          record.version != LOCK_RECORD_VERSION || record.revision < 0L) {
        observationReady = false
        observationFailed = true
      } else if (!observationFailed) {
        observationReady = true
      }

      // A valid native mutation must advance the revision. A lower revision
      // or a different record at the SAME revision is a local rollback /
      // tampering signal. Latch the failure for this Activity lifetime.
      val last = lastObservedRecord
      val rollback = record != null && last != null &&
        (record.revision < last.revision ||
          (record.revision == last.revision && record != last))
      if (rollback) {
        observationReady = false
        observationFailed = true
      }
      val changed = last != null && last != record
      val invalid = !observationReady || record?.enabled == false ||
        record?.disablePending == true ||
        (unlocked && unlockedRevision != record?.revision)
      val wasUnlocked = unlocked
      if (changed || invalid) {
        generation++
        unlocked = false
        unlockedRevision = null
      }
      lastObservedRecord = record
      wasUnlocked && !unlocked
    }

  /** Called synchronously by Android lifecycle callbacks, never delayed. */
  fun onForeground() = synchronized(lifecycleGuard) {
    foreground = true
    // A new foreground never restores the previous unlocked session.
  }

  /** Synchronous revocation even while a biometric prompt or write suspends. */
  fun onBackground() = synchronized(lifecycleGuard) {
    generation++
    foreground = false
    unlocked = false
    unlockedRevision = null
  }

  fun lockNow() = synchronized(lifecycleGuard) {
    generation++
    unlocked = false
    unlockedRevision = null
  }

  private fun beginTicket(): Long? = synchronized(lifecycleGuard) {
    if (foreground && observationReady && !observationFailed) generation else null
  }

  private fun stillValid(ticket: Long): Boolean = synchronized(lifecycleGuard) {
    foreground && observationReady && !observationFailed && generation == ticket
  }

  /** No suspend point is allowed between final validation and unlock. */
  private fun finishUnlocked(ticket: Long, revision: Long): LockResult = synchronized(lifecycleGuard) {
    if (!foreground || !observationReady || observationFailed || generation != ticket) LockResult.STALE
    else {
      unlockedRevision = revision
      unlocked = true
      LockResult.SUCCESS
    }
  }

  /**
   * A successful prompt belongs to one DataStore revision. Any modification,
   * invalid record or storage failure revokes that session, not just the UI
   * returned by this read. Recovery requires a fresh native authentication.
   */
  suspend fun snapshot(): LockSnapshot {
    val record = try { repository.read() }
      catch (cancelled: CancellationException) { throw cancelled }
      catch (_: Exception) {
        return synchronized(lifecycleGuard) {
          generation++
          unlocked = false
          unlockedRevision = null
          LockSnapshot(true, false, -1L, false, true)
        }
      }
    return synchronized(lifecycleGuard) {
      // A direct read can race an observer delivery. Reject local rollback
      // even if the Flow has not emitted it yet; never return unlocked.
      val last = lastObservedRecord
      if (record != null && last != null &&
          (record.revision < last.revision ||
           (record.revision == last.revision && record != last))) {
        observationReady = false
        observationFailed = true
      }
      if (!observationReady || observationFailed) {
        generation++
        unlocked = false
        unlockedRevision = null
        LockSnapshot(true, false, -1L, false, true)
      } else if (record == null) {
        generation++
        unlocked = false
        unlockedRevision = null
        LockSnapshot(true, false, -1L, true, false)
      } else {
        if (!record.enabled || record.disablePending ||
            (unlocked && unlockedRevision != record.revision)) {
          generation++
          unlocked = false
          unlockedRevision = null
        }
        LockSnapshot(record.enabled,
          foreground && unlocked && unlockedRevision == record.revision &&
            record.enabled && !record.disablePending,
          record.revision, false, false)
      }
    }
  }

  /**
   * One native prompt at a time. A stale result is never promoted to a
   * session, even if the app was backgrounded and foregrounded again.
   */
  suspend fun unlock(): LockResult = requestMutex.withLock {
    val ticket = beginTicket() ?: return@withLock LockResult.DENIED
    val before = try { repository.read() } catch (cancelled: CancellationException) { throw cancelled }
      catch (_: Exception) {
      return@withLock LockResult.STORAGE_ERROR
    } ?: return@withLock LockResult.MIGRATION_REQUIRED
    if (!before.enabled || before.disablePending) return@withLock LockResult.DENIED

    val authenticated = try { biometric.authenticate(LockAction.UNLOCK) }
      catch (cancelled: CancellationException) { throw cancelled }
      catch (_: Exception) { false }
    if (!authenticated) return@withLock LockResult.DENIED
    if (!stillValid(ticket)) return@withLock LockResult.STALE

    val after = try { repository.read() } catch (cancelled: CancellationException) { throw cancelled }
      catch (_: Exception) {
      return@withLock LockResult.STORAGE_ERROR
    } ?: return@withLock LockResult.MIGRATION_REQUIRED
    if (!after.enabled || after.disablePending || after.revision != before.revision)
      return@withLock LockResult.STALE
    finishUnlocked(ticket, after.revision)
  }

  /**
   * Enabling adds protection; an interrupted commit may leave enabled=true.
   * If onStop races with persistence, no UI session is granted.
   */
  suspend fun enable(): LockResult = requestMutex.withLock {
    val ticket = beginTicket() ?: return@withLock LockResult.DENIED
    val before = try { repository.read() } catch (cancelled: CancellationException) { throw cancelled }
      catch (_: Exception) {
      return@withLock LockResult.STORAGE_ERROR
    } ?: return@withLock LockResult.MIGRATION_REQUIRED
    if (before.enabled || before.disablePending) return@withLock LockResult.DENIED
    val authenticated = try { biometric.authenticate(LockAction.ENABLE) }
      catch (cancelled: CancellationException) { throw cancelled }
      catch (_: Exception) { false }
    if (!authenticated) return@withLock LockResult.DENIED
    if (!stillValid(ticket)) return@withLock LockResult.STALE
    val committed = try { repository.enableIfCurrent(before.revision) }
      catch (_: StaleNativeLockRevision) { return@withLock LockResult.STALE }
      catch (_: AlreadyEnabledNativeLock) { return@withLock LockResult.STALE }
      catch (cancelled: CancellationException) { throw cancelled }
      catch (_: Exception) { return@withLock LockResult.STORAGE_ERROR }
    if (!committed.enabled || committed.revision != before.revision + 1L)
      return@withLock LockResult.STORAGE_ERROR
    finishUnlocked(ticket, committed.revision)
  }

  /**
   * Phase 1 of a future native opt-out, intentionally NOT exposed by the
   * Android Activity adapter. Requires a native biometric prompt. Even a
   * successful result is PREPARED, not DISABLED. Any crash, cancellation or
   * background event leaves the persisted lock enabled.
   *
   * The final commit to enabled=false remains NOT IMPLEMENTED.
   */
  suspend fun prepareDisableForLab(): LockResult = requestMutex.withLock {
    val ticket = beginTicket() ?: return@withLock LockResult.DENIED
    val before = try { repository.read() }
      catch (cancelled: CancellationException) { throw cancelled }
      catch (_: Exception) { return@withLock LockResult.STORAGE_ERROR }
      ?: return@withLock LockResult.MIGRATION_REQUIRED
    if (!before.enabled || before.disablePending) return@withLock LockResult.DENIED

    val authenticated = try { biometric.authenticate(LockAction.DISABLE) }
      catch (cancelled: CancellationException) { throw cancelled }
      catch (_: Exception) { false }
    if (!authenticated) return@withLock LockResult.DENIED
    if (!stillValid(ticket)) return@withLock LockResult.STALE

    val prepared = try { repository.prepareDisable(before.revision) }
      catch (_: StaleNativeLockRevision) { return@withLock LockResult.STALE }
      catch (cancelled: CancellationException) { throw cancelled }
      catch (_: Exception) { return@withLock LockResult.STORAGE_ERROR }

    // Revokes the old UI grant regardless of later observer scheduling.
    // An onStop while updateData was suspended must not be acknowledged as
    // successfully prepared, even though the durable marker stays PROTECTED.
    val sessionStillValid = stillValid(ticket)
    lockNow()
    if (!prepared.enabled || !prepared.disablePending ||
        prepared.revision != before.revision + 1L)
      return@withLock LockResult.STORAGE_ERROR
    if (!sessionStillValid) return@withLock LockResult.STALE
    // Never report a completed opt-out, even after a durable preparation.
    LockResult.PREPARED
  }

  /** Remains unavailable until commit and lifecycle revocation are linearizable. */
  suspend fun disable(): LockResult = LockResult.DENIED
}

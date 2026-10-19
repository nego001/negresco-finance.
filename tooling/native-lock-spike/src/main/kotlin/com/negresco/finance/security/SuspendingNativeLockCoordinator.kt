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
  private val biometric: SuspendedStrongBiometry
) {
  private val requestMutex = Mutex()
  private val lifecycleGuard = Any()
  private var generation = 0L
  private var foreground = false
  private var unlocked = false
  private var unlockedRevision: Long? = null

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
    if (foreground) generation else null
  }

  private fun stillValid(ticket: Long): Boolean = synchronized(lifecycleGuard) {
    foreground && generation == ticket
  }

  /** No suspend point is allowed between final validation and unlock. */
  private fun finishUnlocked(ticket: Long, revision: Long): LockResult = synchronized(lifecycleGuard) {
    if (!foreground || generation != ticket) LockResult.STALE
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
      if (record == null) {
        generation++
        unlocked = false
        unlockedRevision = null
        LockSnapshot(true, false, -1L, true, false)
      } else {
        if (!record.enabled || (unlocked && unlockedRevision != record.revision)) {
          generation++
          unlocked = false
          unlockedRevision = null
        }
        LockSnapshot(record.enabled,
          foreground && unlocked && unlockedRevision == record.revision && record.enabled,
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
    if (!before.enabled) return@withLock LockResult.DENIED

    val authenticated = try { biometric.authenticate(LockAction.UNLOCK) }
      catch (cancelled: CancellationException) { throw cancelled }
      catch (_: Exception) { false }
    if (!authenticated) return@withLock LockResult.DENIED
    if (!stillValid(ticket)) return@withLock LockResult.STALE

    val after = try { repository.read() } catch (cancelled: CancellationException) { throw cancelled }
      catch (_: Exception) {
      return@withLock LockResult.STORAGE_ERROR
    } ?: return@withLock LockResult.MIGRATION_REQUIRED
    if (!after.enabled || after.revision != before.revision)
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
    if (before.enabled) return@withLock LockResult.DENIED
    val authenticated = try { biometric.authenticate(LockAction.ENABLE) }
      catch (cancelled: CancellationException) { throw cancelled }
      catch (_: Exception) { false }
    if (!authenticated) return@withLock LockResult.DENIED
    if (!stillValid(ticket)) return@withLock LockResult.STALE
    val committed = try { repository.compareAndSet(before.revision, true) }
      catch (_: StaleNativeLockRevision) { return@withLock LockResult.STALE }
      catch (cancelled: CancellationException) { throw cancelled }
      catch (_: Exception) { return@withLock LockResult.STORAGE_ERROR }
    if (!committed.enabled || committed.revision != before.revision + 1L)
      return@withLock LockResult.STORAGE_ERROR
    finishUnlocked(ticket, committed.revision)
  }

  /** Remains unavailable until commit and lifecycle revocation are linearizable. */
  suspend fun disable(): LockResult = LockResult.DENIED
}

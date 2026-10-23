package com.negresco.finance.security

import android.app.Service
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import android.os.Process
import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants
import android.util.AtomicFile
import java.io.File
import java.nio.file.AccessDeniedException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.security.MessageDigest
import java.util.UUID

/**
 * DEBUG-ONLY isolated-process crash fixture; absent in Release.
 *
 * Kills ONLY its own dedicated :negresco_synthetic_journal process, never
 * the main app. No actual finances, lock preferences or production migration.
 * Every path is derived from a validated test UUID in noBackupFilesDir.
 */
class SyntheticJournalCrashWorkerService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private val dispatcher = Messenger(object : Handler(Looper.getMainLooper()) {
    override fun handleMessage(message: Message) {
      val reply = message.replyTo ?: return
      val data = message.data
      val token = data.getString("token") ?: return
      val mode = data.getString("mode") ?: return
      val result = performFixture(token, mode)
      val outgoing = Message.obtain().apply {
        this.data = android.os.Bundle().apply {
          putString("result", result)
          putInt("workerPid", Process.myPid())
        }
      }
      try { reply.send(outgoing) } catch (_: Exception) { }
      // Real SIGKILL after the IPC response is queued, not failWrite().
      // This does not claim to simulate a power outage.
      handler.postDelayed({ Process.killProcess(Process.myPid()) }, 200L)
    }
  })

  override fun onBind(intent: Intent?): IBinder = dispatcher.binder

  private fun sha(bytes: ByteArray): String =
    MessageDigest.getInstance("SHA-256").digest(bytes)
      .joinToString("") { "%02x".format(it.toInt() and 0xff) }

  private fun writeAtomic(file: File, payload: ByteArray) {
    val atomic = AtomicFile(file)
    val stream = atomic.startWrite()
    try {
      stream.write(payload)
      atomic.finishWrite(stream)
    } catch (error: Exception) {
      atomic.failWrite(stream)
      throw error
    }
  }

  private fun fixtureRecord(sequence: Long, step: String): ByteArray {
    val payload = "v1|$sequence|$step"
    return "$payload|${sha(payload.toByteArray(Charsets.UTF_8))}"
      .toByteArray(Charsets.UTF_8)
  }

  /**
   * Check the directory and every name touched by AtomicFile, including its
   * .new/.bak siblings. This is a defensive Debug fixture check, not an
   * atomic directory capability or protection against hostile TOCTOU writers.
   */
  private fun hasReservedSymlink(sandbox: File): Boolean {
    if (Files.isSymbolicLink(sandbox.toPath())) return true
    val reserved = listOf(
      ".synthetic-test-owner",
      "synthetic-migration.witness",
      "synthetic-migration.witness.new",
      "synthetic-migration.witness.bak",
      "synthetic-migration.journal",
      "synthetic-migration.journal.new",
      "synthetic-migration.journal.bak"
    )
    return reserved.any { Files.isSymbolicLink(File(sandbox, it).toPath()) }
  }

  /**
   * Refuse existing hard-linked checkpoint/owner files, including AtomicFile
   * sidecars. lstat reads link counts without following symlinks. Only ENOENT
   * is permitted for an absent sidecar; other stat errors fail closed.
   *
   * This preflight does NOT close a TOCTOU window against a hostile writer.
   */
  private fun hasReservedHardlink(sandbox: File): Boolean {
    val reserved = listOf(
      ".synthetic-test-owner",
      "synthetic-migration.witness",
      "synthetic-migration.witness.new",
      "synthetic-migration.witness.bak",
      "synthetic-migration.journal",
      "synthetic-migration.journal.new",
      "synthetic-migration.journal.bak"
    )
    return reserved.any { name ->
      try {
        val stat = Os.lstat(File(sandbox, name).absolutePath)
        !OsConstants.S_ISREG(stat.st_mode) || stat.st_nlink > 1L
      } catch (error: ErrnoException) {
        error.errno != OsConstants.ENOENT
      } catch (_: Exception) {
        true
      }
    }
  }

  /**
   * Pin the owner marker inode before reading the UUID. O_NOFOLLOW prevents
   * following a last-component symlink even if it changes after preflight;
   * fstat validates the opened descriptor, not a second pathname lookup.
   * The containing directory and AtomicFile names are still path-based.
   */
  private fun validOwnerFromDescriptor(owner: File, token: String): Boolean {
    val expected = token.toByteArray(Charsets.UTF_8)
    val fd = try {
      Os.open(owner.absolutePath,
        OsConstants.O_RDONLY or OsConstants.O_CLOEXEC or OsConstants.O_NOFOLLOW, 0)
    } catch (_: Exception) { return false }
    try {
      val stat = Os.fstat(fd)
      if (!OsConstants.S_ISREG(stat.st_mode) ||
          stat.st_nlink != 1L || stat.st_size != expected.size.toLong()) return false
      val actual = ByteArray(expected.size)
      var offset = 0
      while (offset < actual.size) {
        val count = Os.read(fd, actual, offset, actual.size - offset)
        if (count <= 0) return false
        offset += count
      }
      return actual.contentEquals(expected)
    } catch (_: Exception) {
      return false
    } finally {
      try { Os.close(fd) } catch (_: Exception) { }
    }
  }

  private fun performFixture(token: String, mode: String): String {
    // No caller-supplied paths. A UUID plus disposable owner sentinel bind
    // the worker to one single-purpose synthetic directory.
    val parsed = try { UUID.fromString(token) } catch (_: Exception) { return "DENY_TOKEN" }
    if (parsed.toString() != token) return "DENY_TOKEN"
    // Fault-injection modes create only disposable links within this sandbox,
    // after the first checkpoint is committed. Never accept arbitrary paths.
    val injectOwnerSymlink = mode == "INJECT_OWNER_SYMLINK_BEFORE_OPEN_FIXTURE_ONLY"
    val injectLateSymlink = mode == "INJECT_LATE_SYMLINK_FIXTURE_ONLY"
    val injectLateHardlink = mode == "INJECT_LATE_HARDLINK_FIXTURE_ONLY"
    if (mode !in setOf(
        "AFTER_WITNESS", "DURING_JOURNAL", "AFTER_BOTH",
        "INJECT_LATE_SYMLINK_FIXTURE_ONLY", "INJECT_LATE_HARDLINK_FIXTURE_ONLY",
        "INJECT_OWNER_SYMLINK_BEFORE_OPEN_FIXTURE_ONLY"))
      return "DENY_MODE"
    val sandbox = File(noBackupFilesDir, "negresco_synthetic_atomic_$token")
    val owner = File(sandbox, ".synthetic-test-owner")
    // Resolve no user-provided arbitrary paths; reject even dangling links.
    if (hasReservedSymlink(sandbox)) return "DENY_PATH_ALIAS"
    if (hasReservedHardlink(sandbox)) return "DENY_HARDLINK"
    // Test-only interleaving: move the real owner marker and swap its old
    // name for a symlink pointing at the identical UUID bytes. A pathname
    // read would accept this; O_NOFOLLOW on the open must reject it.
    if (injectOwnerSymlink) {
      try {
        val stashed = File(sandbox, ".synthetic-owner-moved-for-test")
        Files.move(owner.toPath(), stashed.toPath())
        Files.createSymbolicLink(owner.toPath(), stashed.toPath())
      } catch (_: Exception) {
        return "DENY_WORKER_IO"
      }
    }
    val validOwner = try {
      Files.isDirectory(sandbox.toPath(), LinkOption.NOFOLLOW_LINKS) &&
        validOwnerFromDescriptor(owner, token)
    } catch (_: Exception) { false }
    if (!validOwner) return "DENY_SANDBOX"
    val journalBytes = fixtureRecord(2L, "SOURCE_BACKED_UP")
    val witnessPayload = "w1|2|SOURCE_BACKED_UP|${sha(journalBytes)}"
    val witnessBytes = "$witnessPayload|${sha(witnessPayload.toByteArray(Charsets.UTF_8))}"
      .toByteArray(Charsets.UTF_8)
    return try {
      writeAtomic(File(sandbox, "synthetic-migration.witness"), witnessBytes)
      // Deterministic hostile-file rehearsal only. The first alias check
      // happened BEFORE the witness commit. Inject a new alias afterward and
      // require the second check to stop us before touching the journal.
      val lateAlias = File(sandbox, "synthetic-migration.journal.new").toPath()
      if (injectLateSymlink) {
        Files.createSymbolicLink(lateAlias, owner.toPath())
      } else if (injectLateHardlink) {
        try {
          Files.createLink(lateAlias, owner.toPath())
        } catch (_: AccessDeniedException) {
          return "DENY_PLATFORM_HARDLINK"
        }
      }
      if (hasReservedSymlink(sandbox)) return "DENY_PATH_ALIAS"
      if (hasReservedHardlink(sandbox)) return "DENY_HARDLINK"
      when (mode) {
        "AFTER_WITNESS" -> "WITNESS_COMMITTED_THEN_PROCESS_KILLED"
        "DURING_JOURNAL" -> {
          // Leave an actual uncommitted AtomicFile .new descriptor. SIGKILL
          // closes it without calling either finishWrite or failWrite.
          val opened = AtomicFile(File(sandbox, "synthetic-migration.journal")).startWrite()
          opened.write(journalBytes, 0, journalBytes.size / 2)
          "PARTIAL_JOURNAL_THEN_PROCESS_KILLED"
        }
        else -> {
          writeAtomic(File(sandbox, "synthetic-migration.journal"), journalBytes)
          "BOTH_FILES_COMMITTED_THEN_PROCESS_KILLED"
        }
      }
    } catch (_: Exception) {
      "DENY_WORKER_IO"
    }
  }
}

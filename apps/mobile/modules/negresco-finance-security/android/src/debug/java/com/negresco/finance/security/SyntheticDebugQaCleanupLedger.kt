package com.negresco.finance.security

import java.io.File

/**
 * DEBUG-only bookkeeping for cleanup of disposable QA material.
 *
 * A failed deletion retains the identifier/path for retry; a deletion
 * that throws cannot silently certify the test session as cleaned.
 * Never used by the production Expo module or by financial storage.
 */
internal object SyntheticDebugQaCleanupLedger {
  internal data class Result(
    val alias: String?,
    val directory: File?,
    val complete: Boolean
  )

  fun cleanup(
    alias: String?,
    directory: File?,
    deleteAlias: (String) -> Boolean,
    deleteDirectory: (File) -> Boolean
  ): Result {
    var aliasLeft = alias
    var directoryLeft = directory
    if (alias != null) {
      val removed = try { deleteAlias(alias) } catch (_: Exception) { false }
      if (removed) aliasLeft = null
    }
    if (directory != null) {
      val removed = try { deleteDirectory(directory) } catch (_: Exception) { false }
      if (removed) directoryLeft = null
    }
    return Result(
      alias = aliasLeft,
      directory = directoryLeft,
      complete = aliasLeft == null && directoryLeft == null
    )
  }
}

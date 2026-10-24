package com.negresco.finance.security

/**
 * DEBUG-only crash-residue inspection, not recovery and never a grant.
 *
 * Process death discards Activity fields while test-only Keystore aliases and
 * SQLCipher cache folders can survive. Block new QA, NEVER delete by broad
 * prefix automatically or mistake the absence of memory handles for cleanup.
 */
internal object SyntheticDebugQaOrphanResidueGate {
  private const val ALIAS_PREFIX = "negresco_debug_sqlcipher_"
  private const val FOLDER_PREFIX = "negresco_qa_sqlcipher_"

  fun isClear(keystoreAliases: Collection<String>, cacheEntries: Collection<String>): Boolean =
    keystoreAliases.none { it.startsWith(ALIAS_PREFIX) } &&
      cacheEntries.none { it.startsWith(FOLDER_PREFIX) }
}

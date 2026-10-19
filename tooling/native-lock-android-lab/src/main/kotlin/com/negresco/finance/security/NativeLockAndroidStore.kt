package com.negresco.finance.security

import android.content.Context
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import java.io.File

/**
 * Android-only process singleton for the experimental NativeLock DataStore.
 *
 * This has NO Expo registration, JS functions or biometric authorization.
 * Never construct two DataStores for this file within one process.
 * The native migration and authentication gate MUST be completed before use.
 */
internal object NativeLockAndroidStore {
  private const val FILE_NAME = "negresco_native_lock.preferences_pb"
  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

  @Volatile private var instance: DataStoreLockRecordRepository? = null

  fun get(context: Context): DataStoreLockRecordRepository {
    return instance ?: synchronized(this) {
      instance ?: run {
        val application = context.applicationContext
        val store = PreferenceDataStoreFactory.create(scope = scope) {
          File(application.filesDir, "datastore/$FILE_NAME")
        }
        DataStoreLockRecordRepository(store).also { instance = it }
      }
    }
  }
}

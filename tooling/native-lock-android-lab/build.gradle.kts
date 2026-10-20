plugins {
  id("com.android.library") version "8.8.2"
  kotlin("android") version "2.0.21"
}

android {
  namespace = "com.negresco.finance.nativelock.lab"
  compileSdk = 35
  defaultConfig { minSdk = 26 }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  sourceSets.getByName("main").java.srcDir("../native-lock-spike/src/main/kotlin")
}

dependencies {
  implementation("androidx.datastore:datastore-preferences:1.2.1")
  implementation("androidx.biometric:biometric:1.1.0")
  implementation("androidx.fragment:fragment-ktx:1.8.6")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}

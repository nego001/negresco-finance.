plugins {
  id("com.android.library") version "8.8.2"
  kotlin("android") version "2.0.21"
}

android {
  namespace = "com.negresco.finance.sqlcipher.lab"
  compileSdk = 35
  defaultConfig { minSdk = 26 }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  sourceSets.getByName("main").java.srcDir("../native-lock-spike/src/main/kotlin")
}

dependencies {
  // Official Zetetic replacement for deprecated android-database-sqlcipher.
  // Exact versions are pinned for isolated laboratory reproducibility.
  implementation("net.zetetic:sqlcipher-android:4.19.1")
  implementation("androidx.sqlite:sqlite:2.7.0")
  implementation("androidx.datastore:datastore-preferences:1.2.1")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}

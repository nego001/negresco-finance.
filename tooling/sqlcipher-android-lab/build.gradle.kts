plugins {
  id("com.android.library") version "8.10.1"
  kotlin("android") version "2.2.10"
}

android {
  namespace = "com.negresco.finance.sqlcipher.lab"
  compileSdk = 36
  defaultConfig {
    minSdk = 26
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }
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
  androidTestImplementation("junit:junit:4.13.2")
  androidTestImplementation("androidx.test:runner:1.6.2")
  androidTestImplementation("androidx.test.ext:junit:1.2.1")
}

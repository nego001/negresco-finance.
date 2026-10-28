plugins {
  id("com.android.application") version "8.8.2"
}

android {
  namespace = "com.negresco.pdfreceiver.lab"
  compileSdk = 35

  defaultConfig {
    applicationId = "com.negresco.pdfreceiver.lab"
    minSdk = 26
    targetSdk = 28
    versionCode = 1
    versionName = "0.0.1-lab"
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
}

plugins {
  kotlin("jvm") version "2.0.21"
}

repositories {
  google()
  mavenCentral()
}

dependencies {
  // Portable (Android-free) DataStore contract. Not linked into apps/mobile.
  implementation("androidx.datastore:datastore-preferences-core:1.2.1")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
}

tasks.register<JavaExec>("policyCheck") {
  group = "verification"
  description = "Run offline Kotlin lock policy scenarios (not Android QA)"
  dependsOn(tasks.named("testClasses"))
  classpath = sourceSets["test"].runtimeClasspath
  mainClass.set("com.negresco.finance.security.NativeLockCoordinatorTestKt")
}

tasks.named("check") {
  dependsOn("policyCheck")
}

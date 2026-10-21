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
  // JVM/CI-only PostgreSQL driver for SEC-05E transaction rehearsal.
  // Never packaged into apps/mobile or an Android APK.
  testImplementation("org.postgresql:postgresql:42.7.4")
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

tasks.register<JavaExec>("pgBoundProofCheck") {
  group = "verification"
  description = "Disposable PostgreSQL+Ed25519 proof-only ACID lab, NOT a backend"
  dependsOn(tasks.named("testClasses"))
  classpath = sourceSets["test"].runtimeClasspath
  mainClass.set("com.negresco.finance.security.SyntheticJdbcBoundProofRehearsalTestKt")
}

tasks.register<JavaExec>("pgRekeyCasCheck") {
  group = "verification"
  description = "Disposable SEC-05K PostgreSQL CAS persistence and fresh JVM idempotency lab, NOT an authority service"
  dependsOn(tasks.named("testClasses"))
  classpath = sourceSets["test"].runtimeClasspath
  mainClass.set("com.negresco.finance.security.SyntheticJdbcRekeyCasPersistenceLabTestKt")
}

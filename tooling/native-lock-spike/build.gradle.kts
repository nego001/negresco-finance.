plugins {
  kotlin("jvm") version "2.0.21"
}

repositories {
  mavenCentral()
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

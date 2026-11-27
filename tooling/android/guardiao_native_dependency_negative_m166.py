#!/usr/bin/env python3
"""M166: exercise the real Gradle M164 guard, entirely synthetic Maven metadata."""
import pathlib
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

GUARD = pathlib.Path(__file__).resolve().with_name("guardiao_native_release_dependency_m164.gradle")
TASK = ":negresco-finance-security:verifyDiagnosticDependencyIsolationM164"
DATA = ("androidx.datastore", "datastore-preferences", "1.2.1")
SQL = ("net.zetetic", "sqlcipher-android", "4.19.1")
BIO = ("androidx.biometric", "biometric", "1.1.0")
RELAY = ("lab.fixture", "relay", "1")
OTHER = ("lab.fixture", "unrelated", "1")
MISSING = ("lab.fixture", "missing", "1")
DRIFT = ("net.zetetic", "sqlcipher-android", "4.19.0")
PASS = "PASS (LAB): native diagnostic Release graph excludes Zetetic and AndroidX biometric; Debug and DataStore controls present"

def pom(repo, coordinate, dependencies=()):
    group, artifact, version = coordinate
    root = ET.Element("project")
    for tag, value in (("modelVersion", "4.0.0"), ("groupId", group),
                       ("artifactId", artifact), ("version", version), ("packaging", "pom")):
        ET.SubElement(root, tag).text = value
    if dependencies:
        deps = ET.SubElement(root, "dependencies")
        for dependency in dependencies:
            node = ET.SubElement(deps, "dependency")
            for tag, value in zip(("groupId", "artifactId", "version"), dependency):
                ET.SubElement(node, tag).text = value
    dest = repo / pathlib.Path(*group.split(".")) / artifact / version
    dest.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(root).write(dest / f"{artifact}-{version}.pom", encoding="utf-8", xml_declaration=True)

def fixture(root, release, debug):
    repo = root / "repo"
    for coord in (DATA, SQL, BIO, OTHER, DRIFT):
        pom(repo, coord)
    pom(repo, RELAY, (SQL,))
    (root / "settings.gradle").write_text(
        "rootProject.name = 'm166-fixture'\ninclude ':negresco-finance-security'\n", encoding="utf-8")
    module = root / "negresco-finance-security"
    module.mkdir()
    declarations = []
    for config, coordinates in (("releaseRuntimeClasspath", release), ("debugRuntimeClasspath", debug)):
        for coordinate in coordinates:
            declarations.append(f"    {config} '{':'.join(coordinate)}'")
    (module / "build.gradle").write_text(
        "repositories { maven { url = rootProject.file('repo'); metadataSources { mavenPom() } } }\n"
        "configurations {\n"
        "    releaseRuntimeClasspath { canBeResolved = true; canBeConsumed = false }\n"
        "    debugRuntimeClasspath { canBeResolved = true; canBeConsumed = false }\n"
        "}\ndependencies {\n" + "\n".join(declarations) + "\n}\n", encoding="utf-8")

def cases():
    good_debug = (DATA, SQL, BIO)
    return (
        ("clean", (DATA,), good_debug, None),
        ("direct-sqlcipher", (DATA, SQL), good_debug, "QA dependency reached Release module graph"),
        ("transitive-sqlcipher", (DATA, RELAY), good_debug, "QA dependency reached Release module graph"),
        ("direct-biometric", (DATA, BIO), good_debug, "QA dependency reached Release module graph"),
        ("unresolved-edge", (DATA, MISSING), good_debug, "unresolved dependency edge"),
        ("missing-debug-control", (DATA,), (DATA, SQL), "Debug positive controls missing or drifted"),
        ("drifted-debug-control", (DATA,), (DATA, DRIFT, BIO), "Debug positive controls missing or drifted"),
        ("missing-release-control", (OTHER,), good_debug, "Release DataStore control missing or drifted"),
        ("empty-release", (), good_debug, "empty module graph"),
    )

def main():
    if len(sys.argv) != 2:
        raise SystemExit("M166 requires existing Gradle wrapper path")
    wrapper = pathlib.Path(sys.argv[1]).resolve(strict=True)
    if not wrapper.is_file() or not GUARD.is_file():
        raise SystemExit("M166 missing wrapper or guard")
    for name, release, debug, expected in cases():
        with tempfile.TemporaryDirectory(prefix="negresco-m166-") as tmp:
            root = pathlib.Path(tmp)
            fixture(root, release, debug)
            result = subprocess.run(
                [str(wrapper), "--offline", "--no-daemon", "--console=plain",
                 "--project-dir", str(root), "-I", str(GUARD), TASK],
                cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, timeout=150, check=False)
            if expected is None:
                ok = result.returncode == 0 and PASS in result.stdout
            else:
                ok = result.returncode != 0 and f"M164 BLOCK: {expected}" in result.stdout and PASS not in result.stdout
            if not ok:
                # No arbitrary Gradle output, environment or local paths in evidence.
                raise SystemExit(f"M166 BLOCK: unexpected result for {name}")
            print(f"PASS (LAB): M166 synthetic graph {name}", flush=True)
    print("PASS (LAB): M166 nine real Gradle graph cases; no Android app build", flush=True)

if __name__ == "__main__":
    main()

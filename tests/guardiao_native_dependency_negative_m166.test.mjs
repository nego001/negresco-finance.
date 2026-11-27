import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
test('M166 synthetic graph fixture covers direct and transitive leaks, unresolved and missing controls',()=>{
  const path='tooling/android/guardiao_native_dependency_negative_m166.py';
  const code=readFileSync(path,'utf8');
  const workflow=readFileSync('.github/workflows/ci.yml','utf8');
  assert.match(workflow,/python3 "\$GITHUB_WORKSPACE\/tooling\/android\/guardiao_native_dependency_negative_m166\.py" "\$PWD\/android\/gradlew"/);
  assert.match(code, /"\-\-offline", "\-\-no-daemon"/);
  assert.match(code, /result\.returncode != 0 and f"M164 BLOCK: \{expected\}" in result\.stdout and PASS not in result\.stdout/);
  assert.match(code, /pom\(repo, RELAY, \(SQL,\)\)/);
  assert.match(code, /TemporaryDirectory/);
  const p=spawnSync('python3',['-B','-c',[
    'import sys,tempfile,pathlib,xml.etree.ElementTree as E',
    "sys.path.insert(0,'tooling/android')",
    'import guardiao_native_dependency_negative_m166 as m',
    'assert len(m.cases())==9',
    'assert len({c[0] for c in m.cases()})==9',
    'assert sum(c[3] is None for c in m.cases())==1',
    'with tempfile.TemporaryDirectory() as t:',
    ' r=pathlib.Path(t); m.fixture(r,(m.DATA,m.RELAY),(m.DATA,m.SQL,m.BIO))',
    " x=E.parse(r/'repo/lab/fixture/relay/1/relay-1.pom')",
    " assert x.findtext('dependencies/dependency/groupId')=='net.zetetic'",
    " assert x.findtext('dependencies/dependency/artifactId')=='sqlcipher-android'",
    ` assert "releaseRuntimeClasspath 'lab.fixture:relay:1'" in (r/'negresco-finance-security/build.gradle').read_text()`,
  ].join('\n')],{encoding:'utf8',timeout:15000});
  assert.equal(p.status,0,p.stderr);
});

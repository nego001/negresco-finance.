import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const source=readFileSync('tooling/android/guardiao_original_release_asset_digest_audit.py','utf8');

test('immutable Release metadata inventory is offline and cannot promote production',()=>{
 assert.match(source,/EXPECTED_SHA256 = "29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"/);
 assert.match(source,/approvedForProduction=false stableReleaseAllowed=false/);
 assert.match(source,/candidate-metadata-only-bytes-unverified/);
 assert.match(source,/no-match-in-provided-metadata/);
 assert.doesNotMatch(source,/urllib|requests|http\.client|urlopen|download|subprocess|upload-artifact/);
});

test('only exact Release APK digests are candidates, never production or missing-all proof',()=>{
 const code=[
 'import sys,json,tempfile',
 'from pathlib import Path',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_original_release_asset_digest_audit as x',
 'expected="sha256:"+x.EXPECTED_SHA256',
 'def snap(digest):return [{"tag_name":"test","assets":[{"name":"preview.apk","digest":digest},{"name":"note.txt","digest":None}]}]',
 'assert x.classify(snap("sha256:"+"b"*64))==("no-match-in-provided-metadata",1,1)',
 'assert x.classify(snap(expected))==("candidate-metadata-only-bytes-unverified",1,1)',
 'assert x.classify([{"tag_name":"test","assets":[]}])==("no-apk-assets-in-provided-metadata",1,0)',
 'for case in ([],{},[{"tag_name":"test"}],snap("BAD"),snap("SHA256:"+x.EXPECTED_SHA256),snap("sha256:"+"b"*63),[{"tag_name":"test","assets":[{"name":"preview.apk"}]}]):',
 ' assert x.classify(case)[0]=="invalid-or-incomplete-metadata",case',
 'with tempfile.TemporaryDirectory() as d:',
 ' p=Path(d)/"metadata.json"',
 ' p.write_text(json.dumps(snap(expected)))',
 ' assert x.audit_file(p)[0]=="candidate-metadata-only-bytes-unverified"',
 ' p.unlink();p.symlink_to("missing.json")',
 ' assert x.audit_file(p)[0]=="invalid-or-incomplete-metadata"',
 ' p.unlink();p.write_text("{")',
 ' assert x.audit_file(p)[0]=="invalid-or-incomplete-metadata"',
 'print("PASS: immutable Release metadata labels never assert verified APK bytes")'
 ].join('\n');
 const p=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:20000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS: immutable Release metadata labels never assert verified APK bytes/);
});

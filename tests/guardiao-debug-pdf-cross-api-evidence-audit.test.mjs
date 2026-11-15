import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const source=readFileSync('tooling/android/guardiao_debug_pdf_cross_api_evidence_audit.py','utf8');

test('API26/API28 log verifier is bounded, offline and cannot attest original Release',()=>{
  assert.match(source,/MAX_BYTES = 2_000_000/);
  assert.match(source,/MAX_LINES = 16_000/);
  assert.match(source,/approvedForProduction=false stableReleaseAllowed=false/);
  assert.match(source,/debug-pdf-evidence-markers-ordered-only/);
  assert.doesNotMatch(source,/requests|urllib|subprocess|os\.system|upload-artifact|print\(log\)/);
});

test('synthetic ordered receipts require exact cycles, Home placements and terminal marker',()=>{
 const py=[
 'import sys,tempfile',
 'from pathlib import Path',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_pdf_cross_api_evidence_audit as x',
 'ts="2026-11-15T16:00:00.0000000Z "',
 'def sequence(api):',
 ' cycles,final=x.ALLOWED[api]',
 ' events=[]',
 ' for index,cycle in enumerate(cycles):',
 '  if index: events.append(x.HOME)',
 '  events.extend((x.SEMANTIC,"PASS (LAB): same-PID synthetic PDF receipt cycle "+cycle+" verified"))',
 ' events.append(final)',
 ' return events',
 'def text(events):return "\\n".join(ts+event for event in events)+"\\n"',
 'for api in (26,28):',
 ' events=sequence(api)',
 ' assert x.evidence(text(events),api)==(x.ORDERED,len(x.ALLOWED[api][0]),len(x.ALLOWED[api][0])-1)',
 ' for broken in (events[:-1], events+events[-1:], events[:2]+events[3:], events[:3]+events[2:3]+events[3:], events[:-1]+[x.API28_FINAL if api==26 else x.API26_FINAL]):',
 '  assert x.evidence(text(broken),api)[0]==x.BLOCKED',
 ' assert x.evidence(text(events+["BLOCK (LAB): failed"]),api)[0]==x.BLOCKED',
 ' assert x.evidence(text(["PASS (LAB): same-PID synthetic PDF receipt cycle z verified"]+events),api)[0]==x.BLOCKED',
 ' assert x.evidence(text(events),28 if api==26 else 26)[0]==x.BLOCKED',
 'with tempfile.TemporaryDirectory() as d:',
 ' p=Path(d)/"log.txt"',
 ' p.write_text(text(sequence(26)),encoding="utf8")',
 ' assert x.audit_file(p,26)==(x.ORDERED,3,2)',
 ' p.unlink();p.symlink_to("missing.txt")',
 ' assert x.audit_file(p,26)[0]==x.BLOCKED',
 'assert x.evidence("invalid",True)[0]==x.BLOCKED',
 'assert x.evidence("x"*(x.MAX_BYTES+1),26)[0]==x.BLOCKED',
 'print("PASS: explicit API26/API28 ordered receipt evidence gates")'
 ].join('\n');
 const p=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:15000});
 assert.equal(p.status,0,'offline Debug PDF evidence sequence contract failed');
 assert.match(p.stdout,/PASS: explicit API26\/API28 ordered receipt evidence gates/);
});

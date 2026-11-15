import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const src=readFileSync('tooling/android/guardiao_original_release_phase_differential.py','utf8');
test('Release differential is offline and never certifies original APK or production',()=>{
 assert.match(src,/MAX_BYTES = 500_000/);
 assert.match(src,/approvedForProduction=false stableReleaseAllowed=false/);
 assert.match(src,/release-chooser-timeout-app-foreground-log-only/);
 assert.match(src,/release-verified-receiver-stages-log-only/);
 assert.doesNotMatch(src,/urllib|requests|subprocess|print\(log\)|print\(line\)|assembleRelease/i);
});
test('A and C success, B chooser timeout, API26 control and malformed logs are separated',()=>{
 const code=[
 'import sys,tempfile',
 'from pathlib import Path',
 'from datetime import datetime,timedelta,timezone',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_original_release_phase_differential as x',
 'start=datetime(2026,11,6,3,28,0,tzinfo=timezone.utc)',
 'def mk(seconds,word):',
 ' return (start+timedelta(seconds=seconds)).isoformat(timespec="microseconds").replace("+00:00","Z")+" "+word',
 'def good(api,delay):',
 ' receiver=f"PASS (LAB): Android API {api} receiver read actual PDF, rendered every nonblank page and deleted cache"',
 ' return "\\n".join([mk(0,x.TAP),mk(delay,x.CHOOSER),mk(delay+2,receiver),mk(delay+2.1,x.SEMANTIC),mk(delay+3,x.RECEIPT)])',
 'def stuck():',
 ' return "\\n".join([mk(0,x.TAP),mk(1,x.ALIVE),mk(15,x.ALIVE),mk(64.998364,x.TIMEOUT),mk(65.03,x.BLOCK)])',
 'for api,seconds in ((26,1.160678),(28,1.295059),(28,6.549624)):',
 ' assert x.classify(good(api,seconds),api)==(x.SUCCESS,f"{seconds:.2f}")',
 'fail=stuck()',
 'assert x.classify(fail,28)==(x.STUCK,"65.00")',
 'for bad in (good(28,1).replace(x.RECEIPT,"NO RECEIPT"),good(28,1).replace(x.TAP,x.CHOOSER),good(28,1).replace(x.SEMANTIC,"NO SEMANTIC"),good(28,1)+"\\n"+mk(40,x.TIMEOUT),fail.replace(x.BLOCK,"NO BLOCK"),fail.replace(x.ALIVE,"NO ALIVE"),fail+"\\n"+mk(70,x.CHOOSER)):',
 ' assert x.classify(bad,28)[0]==x.UNKNOWN',
 'assert x.classify(fail,26)[0]==x.UNKNOWN',
 'assert x.classify(good(28,1),26)[0]==x.UNKNOWN',
 'assert x.classify(good(28,1),True)[0]==x.UNKNOWN',
 'assert x.classify("x"*(x.MAX_BYTES+1),28)[0]==x.UNKNOWN',
 'with tempfile.TemporaryDirectory() as d:',
 ' p=Path(d)/"log.txt";p.write_text(good(26,1.160678))',
 ' assert x.classify_file(p,26)==(x.SUCCESS,"1.16")',
 ' p.unlink();p.symlink_to("missing")',
 ' assert x.classify_file(p,26)[0]==x.UNKNOWN',
 'print("PASS: historical immutable Release stage differential remains fail-closed")'
 ].join('\n');
 const p=spawnSync('python3',['-c',code],{encoding:'utf8',timeout:20000});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/PASS: historical immutable Release stage differential remains fail-closed/);
});

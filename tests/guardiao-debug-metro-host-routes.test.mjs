import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const probe=readFileSync('tooling/android/guardiao_debug_metro_host_routes.py','utf8');
const runner=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');

const synthetic=`
import sys
sys.path.insert(0, 'tooling/android')
import guardiao_debug_metro_host_routes as p
assert p.classify_property(None)=='metro-host-property-unconfirmed'
assert p.classify_property('')=='metro-host-property-unset'
assert p.classify_property('localhost:8081')=='metro-host-property-device-loopback'
assert p.classify_property('10.0.2.2:8081')=='metro-host-property-emulator-alias'
assert p.classify_property('private.example.invalid:8081')=='metro-host-property-other-redacted'
assert p.classify_probe(None,tool_available=False)=='probe-tool-unavailable'
assert p.classify_probe('HTTP/1.0 200 OK\\r\\n\\r\\npackager-status:running',tool_available=True)=='metro-status-reachable'
assert p.classify_probe('HTTP/1.0 503 Error',tool_available=True)=='route-unconfirmed'
assert p.classify_probe('HTTP/1.0 200 OK',tool_available=True)=='route-unconfirmed'
try:
    p.probe_route('8.8.8.8',available=True)
    raise AssertionError('non-local route was accepted')
except ValueError: pass
commands=[]
def stub(args,timeout=15):
    commands.append(tuple(args))
    if args[:2]==['shell','getprop']: return '10.0.2.2'
    if args[:2]==['shell','toybox']: return 'cat ls nc uptime'
    if args[:3]==['shell','sh','-c']:
        if '10.0.2.2 8081' in args[3]:
            return 'HTTP/1.0 200 OK\\r\\n\\r\\npackager-status:running'
        return 'HTTP/1.0 503 Unavailable'
    raise AssertionError('unexpected adb command')
p._adb=stub
assert p.fixed_route_categories()==(
    'metro-host-property-emulator-alias',
    'route-unconfirmed',
    'metro-status-reachable',
)
assert len([c for c in commands if c[:3]==('shell','sh','-c')])==2
print('PASS: synthetic Android host aliases classified without raw output')
`;

test('Android Metro host-route diagnostic only emits fixed categories',()=>{
  const r=spawnSync('python3',['-c',synthetic],{encoding:'utf8',timeout:15000});
  assert.equal(r.status,0,r.stderr);
  assert.equal(r.stdout.trim(),'PASS: synthetic Android host aliases classified without raw output');
});

test('host-route checks are read-only, fixed-address and post-failure only',()=>{
  assert.match(probe,/EMULATOR_HOST = "10\.0\.2\.2"/);
  assert.match(probe,/DEVICE_LOOPBACK = "127\.0\.0\.1"/);
  assert.match(probe,/if host not in \(DEVICE_LOOPBACK, EMULATOR_HOST\)/);
  assert.match(probe,/if not available:\s+return "probe-tool-unavailable"/);
  assert.match(probe,/MAX_OUTPUT = 16_384/);
  assert.match(runner,/host_routes\.fixed_route_categories\(\)/);
  assert.match(runner,/Android Debug Metro emulator alias/);
  const start=runner.indexOf('def run() -> None:');
  const body=runner.slice(start);
  assert.ok(body.indexOf('except Exception:')<body.indexOf('host_routes.fixed_route_categories()'));
  assert.doesNotMatch(probe,/print\(|logging\.|write_text|write_bytes|screencap|logcat|upload_file|requests\.|urllib|https?:\/\/|settings put|setprop|input keyevent/i);
});

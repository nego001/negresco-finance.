import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const probe=readFileSync('tooling/android/guardiao_debug_metro_transport_probe.py','utf8');
const runner=readFileSync('tooling/android/guardiao_pdf_debug_metro_lab.py','utf8');
const py=`
import http.client
import http.server
import socket
import threading
import sys
sys.path.insert(0, "tooling/android")
import guardiao_debug_metro_transport_probe as p

class Synthetic(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        status = 503 if "fail.bundle" in self.path else 200
        payload = b"synthetic-javascript-only"
        self.send_response(status)
        self.send_header("Content-Type", "application/javascript")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
    def log_message(self, *args):
        pass

upstream=http.server.HTTPServer(("127.0.0.1",0),Synthetic)
worker=threading.Thread(target=upstream.serve_forever,daemon=True)
worker.start()
p.METRO_PORT=upstream.server_address[1]
p.LISTEN_PORT=0
try:
    relay=p.PrivateMetroRelay()
    assert relay.category()=="device-no-metro-connection-observed"
    relay.start()
    try:
        port=relay._server.server_address[1]
        def fetch(path):
            client=http.client.HTTPConnection("127.0.0.1",port,timeout=5)
            client.request("GET",path)
            resp=client.getresponse()
            status=resp.status
            body=resp.read()
            client.close()
            return status,body
        assert fetch("/status")[0]==200
        assert relay.category()=="device-http-request-without-bundle"
        # A read-only network preflight cannot count as app-initiated traffic.
        stale_epoch=relay._connection()
        relay.reset_after_preflight()
        relay._http_request(stale_epoch,is_bundle=True)
        relay._bundle_response(stale_epoch,True)
        assert relay.category()=="device-no-metro-connection-observed"
        assert fetch("/node_modules/expo/AppEntry.bundle?platform=android")[0]==200
        assert relay.category()=="device-debug-bundle-http-200"
    finally:
        relay.stop()

    bad=p.PrivateMetroRelay()
    bad.start()
    try:
        port=bad._server.server_address[1]
        client=http.client.HTTPConnection("127.0.0.1",port,timeout=5)
        client.request("GET","/fail.bundle?platform=android")
        response=client.getresponse()
        assert response.status==503
        response.read()
        client.close()
        assert bad.category()=="device-debug-bundle-http-non200"
    finally:
        bad.stop()
finally:
    upstream.shutdown()
    upstream.server_close()
print("PASS: synthetic loopback relay categorized bundle HTTP without saving bytes")
`;

test('isolated relay forwards synthetic HTTP and emits only fixed bundle categories',()=>{
 const r=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:25000});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'PASS: synthetic loopback relay categorized bundle HTTP without saving bytes');
});

test('relay is local to both endpoints and never prints, writes or uploads traffic',()=>{
 assert.match(probe,/LISTEN_HOST = "127\.0\.0\.1"/);
 assert.match(probe,/METRO_HOST = "127\.0\.0\.1"/);
 assert.match(probe,/LISTEN_PORT = 18081/);
 assert.match(probe,/METRO_PORT = 8081/);
 assert.match(probe,/MAX_HEADER_SAMPLE = 2048/);
 assert.match(probe,/MAX_CONNECTION_SECONDS = 240/);
 assert.match(probe,/def reset_after_preflight\(self\)/);
 assert.match(probe,/if epoch != self\._epoch:/);
 const before=runner.indexOf('report_android_local_metro("before-app")');
 const reset=runner.indexOf('relay.reset_after_preflight()',before);
 const runLab=runner.indexOf('semantic.run_lab()',reset);
 assert.ok(before>=0 && reset>before && runLab>reset,'reset relay after all preflight probes, before app start');

 assert.match(probe,/outgoing\.sendall\(piece\)/);
 assert.doesNotMatch(probe,/\bprint\(|logging\.|write_text|write_bytes|open\(|os\.system|subprocess|requests\.|urllib|https:\/\/|upload_file|screencap/i);
 assert.match(runner,/relay = transport\.PrivateMetroRelay\(\)/);
 assert.match(runner,/base\.adb\("reverse", f"tcp:\{BUNDLE_PORT\}", f"tcp:\{transport\.LISTEN_PORT\}"\)/);
 assert.match(runner,/Android Debug bundle transport/);
 assert.match(runner,/relay\.stop\(\)/);
});

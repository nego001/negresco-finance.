import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const w=readFileSync('.github/workflows/guardiao-zero-finding-runtime-m136.yml','utf8');
test('M136 pins M135 exact candidate and retains Debug-only two-PDF runtime',()=>{for(const s of ['run-id: 45736752784','f66d6fd261dea4c82332bf0499058a039774da9dcaa77a6e3c30934e702a7c28','61bf3916e30b74d248040f236fcb1e9a36e484aadb2331a461509c206849becd','cffad2d13820674a183eaf7bd40ff53316c5ac07f7595fce4baa34828e630bbe','api-level: 28','guardiao_debug_pdf_two_same_pid_lab.py','guardiao_moderate_smoke_m134.mjs','M136_LOCK_END'])assert.ok(w.includes(s),s);assert.ok(!w.includes('assembleRelease')&&!w.includes('contents: write')&&!w.includes('upload-artifact'))});

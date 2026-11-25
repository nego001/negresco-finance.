import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-safe-edge-proof-m112.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-nav-modes-m113.yml','utf8');
const oldScript=readFileSync('tooling/android/guardiao_debug_safe_edge_proof_m112.py','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_nav_modes_m113.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_NAV_MODES_M113.md','utf8');
const apply=(s,pairs)=>{for(const [a,b] of pairs){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}return s;};
test('M113 exact M112 app and geometry proof with two isolated API35 navigation modes',()=>{
 assert.equal(current,apply(old,[["Guardiao Debug safe edge proof M112","Guardiao Debug nav modes M113"],["lab/p01-guardiao-debug-safe-edge-proof-m112-v1","lab/p01-guardiao-debug-nav-modes-m113-v1"],["guardiao-debug-safe-edge-proof-m112-","guardiao-debug-nav-modes-m113-"],["M112 API ${{ matrix.api }} - safe edge proof","M113 API 35 - ${{ matrix.mode }}"],["        api: [28, 29, 35]","        api: [35]\n        mode: [gestural, threebutton]"],["guardiao_debug_safe_edge_proof_m112.py apply","guardiao_debug_nav_modes_m113.py apply"],["guardiao_debug_safe_edge_proof_m112.py install","guardiao_debug_nav_modes_m113.py install"],["      - name: Verify unchanged guarded Pix cycles on selected Android API\n        env:\n          M93_EXPECTED_API: ${{ matrix.api }}","      - name: Verify exact navigation mode and unchanged guarded Pix cycles\n        env:\n          M93_EXPECTED_API: ${{ matrix.api }}\n          M113_NAV_MODE: ${{ matrix.mode }}"],["script: python3 tooling/android/guardiao_api28_debug_nav_two_cycles_staging_lab.py","script: python3 tooling/android/guardiao_debug_nav_mode_runner_m113.py"]]));
 assert.equal(patch,apply(oldScript,[["lab/p01-guardiao-debug-safe-edge-proof-m112-v1","lab/p01-guardiao-debug-nav-modes-m113-v1"],["from guardiao_debug_safe_edge_proof_m112 import report_after_block","from guardiao_debug_nav_modes_m113 import report_after_block"],["from guardiao_debug_safe_edge_proof_m112 import attest_final_edges","from guardiao_debug_nav_modes_m113 import attest_final_edges"]]));
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, os, subprocess, time',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_nav_mode_runner_m113 as m',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M113 mode proof requires unique enabled exact overlay',()=>run([
 'a=m.PREFIX+"gestural"; b=m.PREFIX+"threebutton"',
 'raw="[x] "+a+"\\n[ ] "+b',
 'assert m.mode_proven(raw,"gestural")',
 'assert not m.mode_proven(raw,"threebutton")',
 'assert not m.mode_proven(raw+"\\n[x] "+b,"gestural")',
 'assert not m.mode_proven(raw+"\\n[x] "+a,"gestural")',
 'assert not m.mode_proven("[x] "+a+"_wide_back","gestural")',
 'assert not m.mode_proven(raw,"other")'
]));
test('M113 strict scope and one mode change, checks before and after original runner',()=>run([
 'os.environ.update(GITHUB_ACTIONS="true",GITHUB_REF=m.LAB_REF,M93_EXPECTED_API="35",M113_NAV_MODE="gestural")',
 'calls=[]',
 'def adb(*a):',
 ' calls.append(a)',
 ' if a[-1]=="ro.kernel.qemu": return "1"',
 ' if a[-1]=="ro.build.version.sdk": return "35"',
 ' if a[-1]=="get-current-user": return "0"',
 ' if a[-1]=="android": return "[x] "+m.PREFIX+"gestural"',
 ' if a[-1]=="navigation_mode": return "2"',
 ' return ""',
 'm.adb=adb',
 'time.sleep=lambda n:calls.append(("sleep",n))',
 'subprocess.run=lambda a,**kw:calls.append(("runner",tuple(a),kw))',
 'm.run()',
 'assert calls[3]==("shell","cmd","overlay","enable-exclusive","--category","--user","0",m.PREFIX+"gestural")',
 'assert calls[4]==("sleep",5)',
 'assert calls[5:7]==calls[8:10]',
 'assert calls[7]==("runner",(sys.executable,m.STAGING),{"check":True,"timeout":900})',
 'assert len(calls)==10',
 'os.environ["M93_EXPECTED_API"]="28"',
 'try: m.run(); raise AssertionError("must reject")',
 'except RuntimeError: pass',
 'assert len(calls)==10'
]));
test('M113 preserves M112 evidence and production gates',()=>{
 for(const x of ["M112","1,846/1,846","6/6 cycles","same PID","no PDF","API28","API29","API35","#120","#126","Draft","approvedForProduction=false","stableReleaseAllowed=false","29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a"]) assert.ok(doc.includes(x),x);
});

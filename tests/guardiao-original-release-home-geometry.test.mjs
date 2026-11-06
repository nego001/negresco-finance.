import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const script=readFileSync('tooling/android/guardiao_original_release_same_process_lab.py','utf8');
function check(lines){
  const p=spawnSync('python3',['-c',lines.join('\n')],{encoding:'utf8',timeout:15000});
  assert.equal(p.status,0,p.stderr);
  assert.match(p.stdout,/PASS: bounded home geometry diagnostic/);
}

test('fixed categorical IME, tab position and Android viewport probes',()=>{
  check([
    'import sys',
    "sys.path.insert(0,'tooling/android')",
    'import guardiao_original_release_same_process_lab as x',
    'assert x.safe_home_tab_band(100,100,1080,960)=="upper"',
    'assert x.safe_home_tab_band(100,600,1080,960)=="middle"',
    'assert x.safe_home_tab_band(100,875,1080,960)=="lower"',
    'assert x.safe_home_tab_band(100,950,1080,960)=="bottom-edge"',
    'assert x.safe_home_tab_band(100,1300,1080,960)=="outside-screen"',
    'assert x.safe_home_axis_category(100,1300,1080,960)=="y-after"',
    'assert x.safe_home_axis_category(100,-1,1080,960)=="y-before"',
    'assert x.safe_home_axis_category(-1,620,1080,960)=="x-before"',
    'assert x.safe_home_axis_category(2000,620,1080,960)=="x-after"',
    'assert x.safe_home_axis_category(2000,1300,1080,960)=="both-outside"',
    'assert x.safe_home_axis_category(100,620,1080,960)=="within-screen-not-footer"',
    'assert x.safe_home_axis_category(100,620,0,960)=="screen-unconfirmed"',
    'assert x.safe_ime_category("mInputShown=true mIsInputViewShown=true")=="shown"',
    'assert x.safe_ime_category("mInputShown=false")=="hidden"',
    'assert x.safe_ime_category("mInputShown=true mIsInputViewShown=false")=="ambiguous"',
    'assert x.safe_ime_category("private text")=="unconfirmed"',
    'wm="Physical size: 1080x960\\nOverride size: 1080x800"',
    'assert x.safe_wm_override_category(wm,135,620)=="override-would-pass"',
    'assert x.safe_wm_override_category(wm,135,100)=="override-still-outside"',
    'assert x.safe_wm_override_category("Physical size: 1080x960",135,620)=="physical-only"',
    'assert x.safe_wm_override_category("other details",135,620)=="unconfirmed"',
    'print("PASS: bounded home geometry diagnostic")'
  ]);
});

test('unsafe home tab is never tapped and only safe categories leave the process',()=>{
  check([
    'import sys,io,contextlib',
    "sys.path.insert(0,'tooling/android')",
    'import guardiao_original_release_same_process_lab as x',
    'x.observed_single_app_pid=lambda: "321"',
    'x.base.screen_size=lambda: (1080,960)',
    'x.base.xml_nodes=lambda: [{"text":"Início","class":"android.widget.TextView","enabled":"true","bounds":"[100,600][170,640]"}]',
    'calls=[]',
    'def fake_adb(*args,**kwargs):',
    '  calls.append(args)',
    '  if args==("shell","dumpsys","input_method"): return "mInputShown=true\\nmIsInputViewShown=true\\nSENSITIVE"',
    '  if args==("shell","wm","size"): return "Physical size: 1080x960\\nOverride size: 1080x800\\nSECRET"',
    '  raise AssertionError("unsafe command")',
    'x.base.adb=fake_adb',
    'out=io.StringIO()',
    'with contextlib.redirect_stdout(out):',
    '  try: x.restore_home_tab_in_same_process("321")',
    '  except RuntimeError as e: assert str(e)=="same-process home tab outside bounded bottom bar"',
    '  else: raise AssertionError("unsafe tab approved")',
    'assert calls==[("shell","dumpsys","input_method"),("shell","wm","size")],calls',
    's=out.getvalue()',
    'assert "home-position-band=middle axis=within-screen-not-footer ime=shown viewport=override-would-pass" in s,s',
    'for secret in ("1080","800","620","SENSITIVE","SECRET","[100,600]"): assert secret not in s,s',
    'print("PASS: bounded home geometry diagnostic")'
  ]);
});

test('original strict touch rejection is unchanged',()=>{
  assert.match(script,/emit_home_geometry_diagnostic\(x, y, width, height\)/);
  assert.match(script,/raise RuntimeError\("same-process home tab outside bounded bottom bar"\)/);
  assert.match(script,/if not \(x2 > x1 and y2 > y1/);
  assert.doesNotMatch(script,/print\([^\n]*(?:raw|bounds|dumpsys|str\(error\)|repr\(error\))/);
});

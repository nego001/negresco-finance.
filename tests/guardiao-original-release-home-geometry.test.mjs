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
    'assert x.safe_bounds_shape("[0,0][0,0]",1080,960)=="point-only"',
    'assert x.safe_bounds_shape("[20,20][20,40]",1080,960)=="zero-area"',
    'assert x.safe_bounds_shape("[2000,1300][2200,1500]",1080,960)=="offscreen"',
    'assert x.safe_bounds_shape("[10,850][140,900]",1080,960)=="on-bottom-band"',
    'assert x.safe_bounds_shape("[10,100][140,200]",1080,960)=="onscreen-other-band"',
    'assert x.safe_bounds_shape("[90,90][10,10]",1080,960)=="reversed"',
    'assert x.safe_bounds_shape("SENSITIVE",1080,960)=="unconfirmed"',
    'assert x.safe_ancestor_geometry({"bounds":"[0,0][0,0]","_tap_bounds":"[10,850][140,900]"},1080,960)=="on-bottom-band"',
    'assert x.safe_ancestor_geometry({"bounds":"[0,0][0,0]","_tap_bounds":"[0,0][0,0]"},1080,960)=="same-as-label"',
    'assert x.safe_ancestor_geometry({"bounds":"[0,0][0,0]"},1080,960)=="not-provided"',
    'assert x.safe_ancestor_constraint_category("UNSAFE",1080,960)=="bounds-unconfirmed"',
    'assert x.safe_ancestor_constraint_category("[0,800][320,900]",0,960)=="viewport-unconfirmed"',
    'assert x.safe_ancestor_constraint_category("[0,800][0,900]",1080,960)=="bounds-degenerate"',
    'assert x.safe_ancestor_constraint_category("[0,800][1500,900]",1080,960)=="bounds-offscreen"',
    'assert x.safe_ancestor_constraint_category("[0,500][320,900]",1080,960)=="top-outside-bottom-tab"',
    'assert x.safe_ancestor_constraint_category("[0,800][320,955]",1080,960)=="bottom-too-low"',
    'assert x.safe_ancestor_constraint_category("[0,800][70,900]",1080,960)=="width-too-small"',
    'assert x.safe_ancestor_constraint_category("[0,800][600,900]",1080,960)=="width-too-large"',
    'assert x.safe_ancestor_constraint_category("[0,800][320,819]",1080,960)=="height-too-small"',
    'assert x.safe_ancestor_constraint_category("[0,690][320,900]",1080,960)=="height-too-large"',
    'assert x.safe_ancestor_constraint_category("[0,800][320,900]",1080,960)=="geometry-eligible"',
    'h={"text":"Início","class":"android.widget.TextView","enabled":"true","package":"com.test","_tap_bounds":"[0,800][310,815]"}',
    'p={"text":"Pix","class":"android.widget.TextView","enabled":"true","package":"com.test","_tap_bounds":"[320,800][650,815]"}',
    'n={"text":"Negresco","class":"android.widget.TextView","enabled":"true","package":"com.test","_tap_bounds":"[660,800][1000,815]"}',
    'assert x.safe_sibling_tab_height_category(h,[h,p,n],1080,960)=="siblings-both-thin"',
    'assert x.safe_sibling_tab_height_category(h,[h,dict(p,_tap_bounds="[320,800][650,870]"),dict(n,_tap_bounds="[660,800][1000,870]")],1080,960)=="siblings-both-regular"',
    'assert x.safe_sibling_tab_height_category(h,[h,p,dict(n,_tap_bounds="[660,800][1000,870]")],1080,960)=="siblings-mixed-height"',
    'assert x.safe_sibling_tab_height_category(h,[h,p],1080,960)=="siblings-missing-or-ambiguous"',
    'assert x.safe_sibling_tab_height_category(h,[h,p,p,n],1080,960)=="siblings-missing-or-ambiguous"',
    'assert x.safe_sibling_tab_height_category(h,[h,dict(p,package="other"),n],1080,960)=="siblings-package-mismatch"',
    'assert x.safe_sibling_tab_height_category(h,[h,dict(p,_tap_bounds="PRIVATE"),n],1080,960)=="siblings-bounds-unconfirmed"',
    'assert x.safe_sibling_tab_height_category(h,[h,dict(p,_tap_bounds="[320,800][3000,815]"),n],1080,960)=="siblings-offscreen-or-degenerate"',
    'assert x.safe_sibling_tab_height_category(h,[h,p,dict(n,_tap_bounds=p["_tap_bounds"])],1080,960)=="siblings-shared-region"',
    'assert x.safe_sibling_tab_height_category(dict(h,package=""),[h,p,n],1080,960)=="package-unconfirmed"',
    'assert x.safe_sibling_tab_height_category(h,[h,p,n],0,960)=="viewport-unconfirmed"',
    'label={"text":"Início","class":"android.widget.TextView","enabled":"true","package":"com.negresco.test","bounds":"[0,0][0,0]","_tap_bounds":"[0,800][320,900]"}',
    'ancestor={"class":"android.view.View","clickable":"true","enabled":"true","package":"com.negresco.test","bounds":"[0,800][320,900]","_tap_bounds":"[0,800][320,900]"}',
    'assert x.safe_clickable_ancestor_attestation(label,[label,ancestor],1080,960)=="ancestor-associated-unique-bounded"',
    'assert x.safe_clickable_ancestor_attestation(label,[label,ancestor,dict(ancestor)],1080,960)=="ancestor-not-unique-clickable"',
    'assert x.safe_clickable_ancestor_attestation(label,[label,dict(ancestor,enabled="false")],1080,960)=="ancestor-not-unique-clickable"',
    'assert x.safe_clickable_ancestor_attestation(label,[label,dict(ancestor,package="other")],1080,960)=="ancestor-package-unconfirmed"',
    'assert x.safe_clickable_ancestor_attestation(label,[label,ancestor,{"bounds":"[0,700][500,910]","clickable":"true"}],1080,960)=="ancestor-overlapped"',
    'assert x.safe_clickable_ancestor_attestation(dict(label,bounds="[10,800][90,840]"),[ancestor],1080,960)=="label-not-point-only"',
    'assert x.safe_clickable_ancestor_attestation(dict(label,_tap_bounds="[0,500][800,900]"),[ancestor],1080,960)=="ancestor-not-bounded-bottom-tab"',
    'assert x.safe_ime_category("mInputShown=true mIsInputViewShown=true")=="shown"',
    'assert x.safe_ime_flag_pair("mInputShown=true mIsInputViewShown=false")=="input-only-shown"',
    'assert x.safe_ime_window_registration("mInputMethodWindow=null")=="ime-window-not-listed"',
    'assert x.safe_ime_window_registration("mInputMethodWindow=Window{abc u0 InputMethod}")=="ime-window-listed"',
    'assert x.safe_ime_window_registration("sensitive private")=="ime-window-unconfirmed"',
    'assert x.safe_ime_window_registration("mInputMethodWindow=null\\nmInputMethodWindow=null")=="ime-window-unconfirmed"',
    'assert x.safe_window_focus_category("mCurrentFocus=Window{abc u0 com.negresco.sample/.Main}","com.negresco.sample")=="window-focus-app"',
    'assert x.safe_window_focus_category("mCurrentFocus=Window{abc u0 InputMethod}","com.negresco.sample")=="window-focus-ime-named"',
    'assert x.safe_window_focus_category("mCurrentFocus=Window{abc u0 ChooserActivity}","com.negresco.sample")=="window-focus-chooser"',
    'assert x.safe_window_focus_category("mCurrentFocus=Window{abc u0 com.external/.Private}","com.negresco.sample")=="window-focus-other"',
    'assert x.safe_window_focus_category("mCurrentFocus=null","com.negresco.sample")=="window-focus-null"',
    'assert x.safe_window_focus_category("mCurrentFocus=Window{SENSITIVE}","")=="window-focus-unconfirmed"',
    'assert x.safe_ime_flag_pair("mInputShown=false mIsInputViewShown=true")=="view-only-shown"',
    'assert x.safe_ime_flag_pair("mInputShown=true mIsInputViewShown=true")=="both-shown"',
    'assert x.safe_ime_flag_pair("mInputShown=false mIsInputViewShown=false")=="both-hidden"',
    'assert x.safe_ime_flag_pair("mInputShown=true")=="ime-flags-missing"',
    'assert x.safe_ime_flag_pair("mInputShown=true mInputShown=false mIsInputViewShown=true")=="ime-flags-conflicting"',
    'node={"package":"com.test"}',
    'edit={"class":"android.widget.EditText","package":"com.test","focused":"true","text":"SECRET"}',
    'assert x.safe_focused_edit_category(node,[edit])=="app-editable-focused"',
    'assert x.safe_focused_edit_category(node,[dict(edit,package="external")])=="other-editable-focused"',
    'assert x.safe_focused_edit_category(node,[edit,edit])=="multiple-editables-focused"',
    'assert x.safe_focused_edit_category(node,[])=="no-focused-node"',
    'assert x.safe_focused_edit_category({},[edit])=="focus-package-unconfirmed"',
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
    '  if args==("shell","dumpsys","window","windows"): return "mInputMethodWindow=Window{abc u0 InputMethod}\\nmCurrentFocus=Window{abc u0 ChooserActivity}\\nPRIVATE"',
    '  if args==("shell","wm","size"): return "Physical size: 1080x960\\nOverride size: 1080x800\\nSECRET"',
    '  raise AssertionError("unsafe command")',
    'x.base.adb=fake_adb',
    'out=io.StringIO()',
    'with contextlib.redirect_stdout(out):',
    '  try: x.restore_home_tab_in_same_process("321")',
    '  except RuntimeError as e: assert str(e)=="same-process home tab outside bounded bottom bar"',
    '  else: raise AssertionError("unsafe tab approved")',
    'assert calls==[("shell","dumpsys","input_method"),("shell","dumpsys","window","windows"),("shell","wm","size")],calls',
    's=out.getvalue()',
    'assert "home-position-band=middle axis=within-screen-not-footer label-shape=onscreen-other-band clickable-ancestor-shape=not-provided ancestor-constraint=bounds-unconfirmed sibling-height=package-unconfirmed ancestor-attestation=label-not-point-only ime=shown ime-pair=both-shown focus=focus-package-unconfirmed ime-window=ime-window-listed window-focus=window-focus-unconfirmed viewport=override-would-pass" in s,s',
    'for secret in ("1080","800","620","SENSITIVE","SECRET","PRIVATE","[100,600]"): assert secret not in s,s',
    'print("PASS: bounded home geometry diagnostic")'
  ]);
});

test('original strict touch rejection is unchanged',()=>{
  assert.match(script,/emit_home_geometry_diagnostic\(x, y, width, height, tabs\[0\], nodes\)/);
  assert.match(script,/raise RuntimeError\("same-process home tab outside bounded bottom bar"\)/);
  assert.match(script,/if not \(x2 > x1 and y2 > y1/);
  assert.doesNotMatch(script,/print\([^\n]*(?:raw|bounds|dumpsys|str\(error\)|repr\(error\))/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const old=readFileSync('.github/workflows/guardiao-debug-api35-decor-format-m105.yml','utf8');
const current=readFileSync('.github/workflows/guardiao-debug-api35-view-format-m106.yml','utf8');
const oldScript=readFileSync('tooling/android/guardiao_debug_api35_decor_format_m105.py','utf8');
const patch=readFileSync('tooling/android/guardiao_debug_api35_view_format_m106.py','utf8');
const doc=readFileSync('docs/security/P0_GUARDIAO_DEBUG_API35_VIEW_FORMAT_M106.md','utf8');
const apply=(s,pairs)=>{for(const [a,b] of pairs){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}return s;};
test('M106 exact M105 workflow and source except private flag and rejection categories',()=>{
 assert.equal(current,apply(old,[["Guardiao Debug API35 decor format M105","Guardiao Debug API35 view format M106"],["lab/p01-guardiao-debug-api35-decor-format-m105-v1","lab/p01-guardiao-debug-api35-view-format-m106-v1"],["guardiao-debug-api35-decor-format-m105-","guardiao-debug-api35-view-format-m106-"],["M105 API ${{ matrix.api }} - decor format","M106 API ${{ matrix.api }} - view format"],["Apply exact M104 native tree with decor format extension","Apply exact M105 native tree with view format categories"],["guardiao_debug_api35_decor_format_m105.py apply","guardiao_debug_api35_view_format_m106.py apply"]]));
 assert.equal(patch,apply(oldScript,[["M105: exact M104 native read with bounded DecorView format extension.","M106: exact M105 native read with bounded private flag extension."],["lab/p01-guardiao-debug-api35-decor-format-m105-v1","lab/p01-guardiao-debug-api35-view-format-m106-v1"],["from guardiao_debug_api35_decor_format_m105 import report_after_block","from guardiao_debug_api35_view_format_m106 import report_after_block"],["[A-Z.]{9}) [A-Z.]{8}","[A-Z.]{9}) [A-Z.]{3}[A-Z.p][A-Z.]{4}"],["def parse_native(raw):","def view_format_category(line):\n    \"\"\"Fixed first rejected line category, never its contents.\"\"\"\n    prefix = re.match(r\"^[A-Za-z0-9_.$]+\\{[0-9a-fA-F]+ \", line)\n    if prefix is None:\n        return \"view-prefix-unconfirmed\"\n    fields = line[prefix.end():].split(\" \", 2)\n    if len(fields) != 3:\n        return \"view-fields-unconfirmed\"\n    if re.fullmatch(r\"[A-Z.]{9}\", fields[0]) is None:\n        return \"view-public-flags-unconfirmed\"\n    if re.fullmatch(r\"[A-Z.]{3}[A-Z.p][A-Z.]{4}\", fields[1]) is None:\n        return \"view-private-flags-unconfirmed\"\n    if re.match(r\"-?[0-9]{1,6},-?[0-9]{1,6}--?[0-9]{1,6},-?[0-9]{1,6}(?: |})\", fields[2]) is None:\n        return \"view-bounds-unconfirmed\"\n    return \"view-suffix-unconfirmed\"\n\n\ndef parse_native(raw):"],["        if not m or len(views)>=20000:\n            return \"view-format-unconfirmed\", []","        if len(views)>=20000:\n            return \"view-limit-unconfirmed\", []\n        if not m:\n            return view_format_category(line.strip()), []"],["M105 exact API35 required","M106 exact API35 required"],["unrecognized M105 branch","unrecognized M106 branch"],["M105 exact M104 native tree with decor format extension","M106 exact M105 native tree with view format categories"],["M105 scoped decor format not attested","M106 scoped view format not attested"]]));
});
const run=(lines)=>{
 const r=spawnSync('python3',['-c',[
 'import sys, ast, io, contextlib, os',
 "sys.path.insert(0,'tooling/android')",
 'import guardiao_debug_api35_view_format_m106 as m',
 'import guardiao_debug_api35_decor_format_m105 as p',
 ...lines].join('\n')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
};
test('M106 AOSP prepressed flag only in fourth private position',()=>run([
 'lines=["ACTIVITY com.negresco.finance/.MainActivity abc pid=123","  View Hierarchy:","    DecorView@abc[MainActivity]","      android.widget.FrameLayout{abc V.E...... ........ 0,0-100,200}","        com.facebook.react.views.view.ReactViewGroup{def V.E...C.. ........ 0,0-50,60}","  Other state:"]',
 'raw="\\n".join(lines)',
 'expected=("unique-size-pair-candidate","react-viewgroup","android-frame")',
 'assert m.classify_native(raw,(50,60),(100,200))==p.classify_native(raw,(50,60),(100,200))==expected',
 'modern=raw.replace("V.E...C.. ........","V.E...C.. ...p....")',
 'assert p.parse_native(modern)[0]=="view-format-unconfirmed"',
 'assert m.classify_native(modern,(50,60),(100,200))==expected',
 'for flags in ("p.......","..p.....","....p...","...q...."):',
 ' assert m.parse_native(modern.replace("...p....",flags))[0]=="view-private-flags-unconfirmed"',
 'assert m.parse_native(raw.replace("V.E...C..","bad"))[0]=="view-public-flags-unconfirmed"',
 'assert m.parse_native(raw.replace("0,0-50,60","bounds"))[0]=="view-bounds-unconfirmed"',
 'assert m.parse_native(raw.replace("0,0-50,60}","0,0-50,60} unknown"))[0]=="view-suffix-unconfirmed"',
 'assert m.parse_native(raw.replace("com.facebook.react.views.view.ReactViewGroup{def","private invalid {def"))[0]=="view-prefix-unconfirmed"',
 'assert m.parse_native(raw.replace("DecorView@abc","unknown"))[0]=="decor-unconfirmed"'
]));
test('M106 retains exact guard rejection, one read, private fixed output',()=>run([
 'orig=m.NAV.read_text(encoding="utf-8")',
 'out=m.nav_transform(orig)',
 'ast.parse(out)',
 'assert out.replace(m.NEW,m.OLD)==orig',
 'assert out.replace("guardiao_debug_api35_view_format_m106","guardiao_debug_api35_decor_format_m105")==p.nav_transform(orig)',
 'import guardiao_api28_debug_external_a11y_readonly_lab as observer',
 'calls=[]',
 'observer.debug_pid=lambda:"123"',
 'observer.debug_focus=lambda:True',
 'observer.BASE.adb=lambda *args,**kwargs: calls.append((args,kwargs)) or ""',
 'm.private_sizes=lambda nodes: ((50,60),(100,200))',
 'os.environ.update(GITHUB_ACTIONS="true",GITHUB_REF=m.LAB_REF,M93_EXPECTED_API="35")',
 'stream=io.StringIO()',
 'with contextlib.redirect_stdout(stream): m.report_after_block([], "123")',
 'assert calls==[(("shell","dumpsys","activity","top"),{"timeout":22})]',
 'assert "m104-native=response-unconfirmed" in stream.getvalue()',
 'os.environ["GITHUB_REF"]=p.LAB_REF',
 'with contextlib.redirect_stdout(stream): m.report_after_block([], "123")',
 'assert len(calls)==1'
]));
test('M106 preserves M105 evidence and production gates',()=>{
 for(const x of ['M105','1,814/1,814','view-format-unconfirmed','no Pix tap','#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a']) assert.ok(doc.includes(x),x);
 assert.ok(!current.includes('assembleRelease'));
 assert.ok(!current.includes('upload-artifact'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=readFileSync('tooling/android/guardiao_api28_debug_nav_preview_guard.py','utf8');
const policy=readFileSync('docs/security/P0_GUARDIAO_API28_DEBUG_NAV_PREVIEW_GUARD.md','utf8');

test('M68 staging helper is pure: it cannot access ADB, capture UI, issue touches or print coordinates',()=>{
 assert.match(source,/def select_preview_target\(/);
 assert.match(source,/safe_ancestor_constraint_category/);
 assert.match(source,/geometry\.TARGETS/);
 assert.match(source,/selected/);
 assert.match(source,/clickable/);
 assert.match(source,/if source == target|or source == target/);
 assert.doesNotMatch(source,/\.adb\(|subprocess|os\.system|xml_nodes\(|getRootInActiveWindow|instrument|input", "tap|swipe|pressKey|print\(|logcat|uiautomator dump|time\.sleep/);
});

test('synthetic pure fixtures block missing, duplicate, selected mismatch, overlap, foreign package and covering sibling',()=>{
 const program=[
  'import sys',"sys.path.insert(0,'tooling/android')",
  'import guardiao_api28_debug_nav_preview_guard as m',
  "ids=m.TARGETS",
  "rects=['[16,620][132,685]','[144,620][260,685]','[272,620][388,685]']",
  "def make(source='home'):",
  " items=[{'package':m.PACKAGE,'resource-id':m.PAGE_IDS[source]+'no-call-no','bounds':'[0,10][400,50]','enabled':'false','clickable':'false'}]",
  " for i,ident in enumerate(ids):",
  "  items.append({'package':m.PACKAGE,'resource-id':m.PACKAGE+':id/'+ident,'enabled':'true','clickable':'true','selected':'true' if ident==m.TARGET_NAMES[source] else 'false','bounds':rects[i]})",
  " return items",
  "p=make('home')",
  "assert m.select_preview_target(p,400,800,'home','pix')[0]==m.ELIGIBLE",
  "assert m.select_preview_target(make('pix'),400,800,'pix','home')[0]==m.ELIGIBLE",
  "assert m.select_preview_target(p,400,800,'home','home')==(m.BLOCK,None)",
  "assert m.select_preview_target(p[:-1],400,800,'home','pix')==(m.BLOCK,None)",
  "assert m.select_preview_target(p+[p[1]],400,800,'home','pix')==(m.BLOCK,None)",
  "foreign=[dict(n) for n in p];foreign[2]['package']='com.foreign.app'",
  "assert m.select_preview_target(foreign,400,800,'home','pix')==(m.BLOCK,None)",
  "invalid=[dict(n) for n in p];invalid[2]['selected']='true'",
  "assert m.select_preview_target(invalid,400,800,'home','pix')==(m.BLOCK,None)",
  "overlap=[dict(n) for n in p];overlap[2]['bounds']='[100,620][220,685]'",
  "assert m.select_preview_target(overlap,400,800,'home','pix')==(m.BLOCK,None)",
  "thin=[dict(n) for n in p];thin[2]['bounds']='[144,620][260,628]'",
  "assert m.select_preview_target(thin,400,800,'home','pix')==(m.BLOCK,None)",
  "occluded=p+[{'package':m.PACKAGE,'resource-id':'','enabled':'true','clickable':'true','bounds':'[155,631][250,674]'}]",
  "assert m.select_preview_target(occluded,400,800,'home','pix')==(m.BLOCK,None)",
  "foreign_cover=p+[{'package':'com.other.app','resource-id':'','enabled':'true','clickable':'true','bounds':'[155,631][250,674]'}]",
  "assert m.select_preview_target(foreign_cover,400,800,'home','pix')==(m.BLOCK,None)",
  "malformed=[dict(n) for n in p];malformed[2]['resource-id']=None",
  "assert m.select_preview_target(malformed,400,800,'home','pix')==(m.BLOCK,None)",
  "assert m.select_preview_target(p,400,800,[], 'pix')==(m.BLOCK,None)",
  "missing=[dict(n) for n in p];missing[0]['resource-id']='not-home'",
  "assert m.select_preview_target(missing,400,800,'home','pix')==(m.BLOCK,None)",
  "assert m.select_preview_target(p,0,800,'home','pix')==(m.BLOCK,None)",
  "assert m.select_preview_target('bad',400,800,'home','pix')==(m.BLOCK,None)",
  "print('PASS (LAB): M68 pure two-step navigation safety preflight fixtures')"
 ].join('\n');
 const r=spawnSync('python3',['-c',program],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PASS \(LAB\): M68 pure two-step navigation safety preflight fixtures/);
});

test('M68 policy holds test-only classification separate from executing taps and production approval',()=>{
 for(const value of ['#120','#126','Draft','approvedForProduction=false','stableReleaseAllowed=false','M67','BLOCK','no tap','No PDF'])
   assert.ok(policy.includes(value),value);
});

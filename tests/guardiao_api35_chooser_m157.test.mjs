import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
test('M157 exact chooser target rejects wrong package, ambiguous, disabled, invalid and overlapping targets',()=>{const py=['import sys',"sys.path.insert(0,'tooling/android')",'import guardiao_api35_chooser_m157 as m',"p={'package':'com.android.intentresolver','clickable':'true','enabled':'true','bounds':'[100,300][300,500]','_tap_bounds':'[100,300][300,500]'}","n={'package':p['package'],'enabled':'true','text':m.LABEL,'bounds':'[120,350][280,410]','_tap_bounds':p['bounds']}","assert m.inspect([p,n],400,800)[0]=='target-exact'","assert m.inspect([p,{**n,'package':'evil'}],400,800)[0]=='target-not-observed'","assert m.inspect([p,{**n,'enabled':'false'}],400,800)[0]=='target-disabled'","assert m.inspect([p,n,{**n,'_tap_bounds':'[0,0][100,100]'}],400,800)[0]=='target-ambiguous'","assert m.inspect([p,n,{**p,'bounds':'[110,340][290,420]','_tap_bounds':'[110,340][290,420]'}],400,800)[0]=='target-overlapped'","assert m.inspect([n],400,800)[0]=='target-parent-unconfirmed'","assert m.inspect([{'package':p['package'],'enabled':'true','scrollable':'true','bounds':'[0,200][400,700]'}],400,800)[2]==(0,200,400,700)","assert m.inspect([],400,800)[2] is None"].join('\n');const x=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:30000});assert.equal(x.status,0,x.stderr)});
test('M157 leaves actual receipt and PID proof unchanged, wraps only exact chooser lookup and restores original',()=>{const p=readFileSync('tooling/android/guardiao_integrated_release_m157.py','utf8');assert.match(p,/if needle == chooser.LABEL:/);assert.match(p,/return chooser.find_receiver\(\)/);assert.match(p,/candidate.BASE.wait_visible = original_wait/);assert.match(p,/scoped.run\(\)/);const w=readFileSync('.github/workflows/guardiao-integrated-release-m157.yml','utf8');assert.match(w,/api-level: 35/);assert.doesNotMatch(w,/upload-artifact|secrets\.|contents: write|workflow_dispatch:|gh release/);});

// M162: distinct exact labels require one wholly safe group and a verified off-band group.
test('M162 duplicate chooser groups are only resolved with unique fully in-band label and verified off-band geometry',()=>{const py=['import sys',"sys.path.insert(0,'tooling/android')",'import guardiao_api35_chooser_m157 as m',"p={'package':'com.android.intentresolver','clickable':'true','enabled':'true','bounds':'[100,300][300,500]','_tap_bounds':'[100,300][300,500]'}","n={'package':p['package'],'enabled':'true','text':m.LABEL,'bounds':'[120,350][280,410]','_tap_bounds':p['bounds']}","q={**p,'bounds':'[100,20][300,90]','_tap_bounds':'[100,20][300,90]'}","z={**n,'bounds':'[120,30][280,60]','_tap_bounds':q['bounds']}","assert m.inspect([p,n,q,z],400,800)[:2]==('target-exact',n)","assert m.inspect([p,n,z],400,800)[0]=='target-ambiguous'","assert m.inspect([p,n,q,{**z,'enabled':'false'}],400,800)[0]=='target-disabled'","assert m.inspect([p,n,q,{**z,'bounds':'[120,30][280,120]'}],400,800)[0]=='target-ambiguous'","r={**p,'bounds':'[100,520][300,650]','_tap_bounds':'[100,520][300,650]'}","s={**n,'bounds':'[120,550][280,590]','_tap_bounds':r['bounds']}","assert m.inspect([p,n,r,s],400,800)[0]=='target-ambiguous'","o={**p,'bounds':'[110,340][290,420]','_tap_bounds':'[110,340][290,420]'}","assert m.inspect([p,n,q,z,o],400,800)[0]=='target-overlapped'","assert m.inspect([p,n,q,z,{**n,'bounds':'[130,360][270,400]'}],400,800)[0]=='target-label-ambiguous'"].join('\n');const x=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:30000});assert.equal(x.status,0,x.stderr)});

// M165 records only a fixed reason and preserves the original denial tuple.
test('M165 API35 ambiguity detail distinguishes parent, label and safe-band failures without granting a target',()=>{const py=['import sys',"sys.path.insert(0,'tooling/android')",'import guardiao_api35_chooser_m157 as m',"p={'package':'com.android.intentresolver','clickable':'true','enabled':'true','bounds':'[100,300][300,500]','_tap_bounds':'[100,300][300,500]'}","n={'package':p['package'],'enabled':'true','text':m.LABEL,'bounds':'[120,350][280,410]','_tap_bounds':p['bounds']}","q={**p,'bounds':'[100,20][300,150]','_tap_bounds':'[100,20][300,150]'}","z={**n,'bounds':'[120,30][280,60]','_tap_bounds':q['bounds']}","def check(nodes,reason):"," seen=[]"," assert m.inspect(nodes,400,800,on_ambiguity=seen.append)==('target-ambiguous',None,None)"," assert seen==[reason], seen","check([p,n,{**z,'_tap_bounds':'bad'}],'invalid-parent-bounds')","check([p,n,z],'missing-clickable-parent')","check([p,n,q,{**q},z],'duplicate-clickable-parent')","check([p,n,q,{**z,'bounds':'bad'}],'invalid-label-bounds')","check([p,n,q,{**z,'bounds':'[90,30][280,60]'}],'label-outside-parent')","check([p,n,q,{**z,'bounds':'[120,30][280,120]'}],'partial-or-mixed-band')","r={**p,'bounds':'[100,520][300,650]','_tap_bounds':'[100,520][300,650]'}","s={**n,'bounds':'[120,550][280,590]','_tap_bounds':r['bounds']}","check([p,n,r,s],'multiple-in-band-groups')","u={**p,'bounds':'[100,710][300,780]','_tap_bounds':'[100,710][300,780]'}","v={**n,'bounds':'[120,720][280,750]','_tap_bounds':u['bounds']}","check([q,z,u,v],'no-in-band-group')","tiny={**p,'bounds':'[100,20][110,90]','_tap_bounds':'[100,20][110,90]'}","t={**z,'bounds':'[101,30][109,60]','_tap_bounds':tiny['bounds']}","check([p,n,tiny,t],'unsafe-parent-size')","seen=[]","assert m.inspect([p,n,q,z],400,800,on_ambiguity=seen.append)[:2]==('target-exact',n)","assert seen==[]"].join('\n');const x=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:30000});assert.equal(x.status,0,x.stderr)});

test('M167 permits bounded scroll-only exploration for the observed duplicate reason, never returns ambiguous target',()=>{
  const py=[
    'import sys',
    "sys.path.insert(0,'tooling/android')",
    'import guardiao_api35_chooser_m157 as m',
    "p={'package':'com.android.intentresolver','clickable':'true','enabled':'true','bounds':'[100,300][300,500]','_tap_bounds':'[100,300][300,500]'}",
    "n={'package':p['package'],'enabled':'true','text':m.LABEL,'bounds':'[120,350][280,410]','_tap_bounds':p['bounds']}",
    "q={**p,'bounds':'[100,520][300,650]','_tap_bounds':'[100,520][300,650]'}",
    "z={**n,'bounds':'[120,550][280,590]','_tap_bounds':q['bounds']}",
    "r={'package':p['package'],'enabled':'true','scrollable':'true','bounds':'[0,200][400,700]'}",
    'dup=[p,n,q,z,r]; exact=[p,n,r]',
    "assert m.ambiguity_scroll_region(dup,400,800,'multiple-in-band-groups')==(0,200,400,700)",
    "assert m.ambiguity_scroll_region(dup+[dict(r)],400,800,'multiple-in-band-groups') is None",
    "assert m.ambiguity_scroll_region(dup,400,800,'missing-clickable-parent') is None",
    "assert m.inspect(dup,400,800)==('target-ambiguous',None,None)",
    'm.receiver_registered=lambda:True',
    'm.base.chooser_present=lambda:True',
    'm.base.screen_size=lambda:(400,800)',
    'm.time.sleep=lambda _:None',
    'def exercise(snapshots,expected,max_swipes):',
    ' calls=[]; it=iter(snapshots)',
    ' m.base.xml_nodes=lambda:next(it)',
    ' def adb(*args,**kwargs):',
    "  if args[:3]==('shell','getprop','ro.build.version.sdk'): return '35'",
    "  assert args[:3]==('shell','input','swipe'),args",
    '  calls.append(args); return ""',
    ' m.base.adb=adb',
    ' try: result=m.find_receiver()',
    ' except RuntimeError: result=None',
    ' assert result==expected,(result,expected)',
    ' assert len(calls)==max_swipes,calls',
    ' for call in calls:',
    '  x0,y0,x1,y1=map(int,call[3:7])',
    '  assert 0<x0==x1<400 and 200<y0<700 and 200<y1<700',
    ' return calls',
    'exercise([dup,exact,exact],n,1)',
    'calls=exercise([dup,dup,dup],None,2)',
    'assert int(calls[0][4])>int(calls[0][6]) and int(calls[1][4])<int(calls[1][6])',
    'exercise([dup+[dict(r)]],None,0)',
    'exercise([[p,n,z,r]],None,0)',
    'exercise([[r],dup,dup,dup],None,3)',
    'exercise([exact,dup,exact,exact],n,1)',
  ].join('\n');
  const x=spawnSync('python3',['-B','-c',py],{encoding:'utf8',timeout:30000});
  assert.equal(x.status,0,x.stderr);
});

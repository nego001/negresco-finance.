import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const runner=readFileSync('tooling/android/guardiao_debug_touch_delivery_lab.py','utf8');
const workflow=readFileSync('.github/workflows/guardiao-debug-quick-pix-comparator.yml','utf8');
const primary=readFileSync('.github/workflows/guardiao-debug-touch-delivery-lab.yml','utf8');
const app=readFileSync('apps/mobile/App.tsx','utf8');

test('isolated Android API28 comparator cannot become Release or change original workflow',()=>{
 assert.match(workflow,/guardiao-debug-quick-pix-comparator\.yml/);
 assert.match(workflow,/api-level: 28/);
 assert.match(workflow,/assembleDebug/);
 assert.match(workflow,/--quick-pix-comparator/);
 assert.match(workflow,/permissions:\n  contents: read/);
 assert.match(workflow,/guardiao-debug-quick-pix-\$\{\{ github\.ref \}\}/);
 assert.doesNotMatch(workflow,/assembleRelease|eas build|upload-artifact|payments/);
 assert.match(primary,/script: python3 tooling\/android\/guardiao_debug_touch_delivery_lab\.py\n/);
 assert.doesNotMatch(primary,/--quick-pix-comparator/);
});
test('quick Pix comparison is a single fail-closed demo shortcut gesture',()=>{
 assert.match(app,/accessibilityLabel=\{'Abrir '\+x\.name\}/);
 assert.match(runner,/def safe_quick_pix_point\(/);
 assert.match(runner,/def quick_pix_target_gate_category\(/);
 assert.match(runner,/def quick_pix_alternate_clear_point\(/);
 assert.match(runner,/def quick_pix_alternate_block_category\(/);
 assert.match(runner,/Quick Pix alternate block first=/);
 assert.match(runner,/quick-alt-whole-target-covered/);
 assert.match(runner,/quick-alt-all-probes-obstructed/);
 assert.match(runner,/quick-alt-peer-bounds-unconfirmed/);
 assert.match(runner,/quick-alt-target-too-small/);
 assert.match(runner,/quick-alt-center-conflict/);
 assert.match(runner,/quick-alt-clean-point-inconsistent/);
 assert.match(runner,/quick-target-eligible-alternate/);
 assert.match(runner,/positions=\(\(1,1\),\(3,1\),\(1,3\),\(3,3\)/);
 assert.match(runner,/if dx<40 or dy<40 or len\(nodes\)>3000:/);
 assert.match(runner,/if not unrelated_center:/);
 assert.match(runner,/x1\+8<=px<x2-8/);
 assert.match(runner,/if ancestors>8:/);
 assert.match(runner,/def quick_pix_hierarchy_nodes\(/);
 assert.match(runner,/def quick_pix_peer_is_proven_ancestor\(/);
 assert.match(runner,/def quick_pix_peer_relationship_category\(/);
 assert.match(runner,/quick-peer-path-unconfirmed/);
 assert.match(runner,/quick-peer-duplicate-path/);
 assert.match(runner,/quick-peer-ancestor-bounds-conflict/);
 assert.match(runner,/quick-peer-clickable-descendant/);
 assert.match(runner,/quick-peer-clickable-sibling/);
 assert.match(runner,/quick-peer-unrelated/);
 assert.match(runner,/return quick_pix_peer_relationship_category\(target,node,bounds,other\)/);
 assert.match(runner,/target_path\.startswith\(peer_path\+"\/"\)/);
 assert.match(runner,/quick-target-eligible-ancestor/);
 assert.match(runner,/quick-too-many-ancestors/);
 assert.match(runner,/first_nodes=quick_pix_hierarchy_nodes\(\)/);
 assert.match(runner,/second_nodes=quick_pix_hierarchy_nodes\(\)/);
 assert.match(runner,/first_gate!=second_gate/);
 assert.match(runner,/Quick Pix preflight first=/);
 assert.match(runner,/quick-label-absent/);
 assert.match(runner,/quick-label-ambiguous/);
 assert.match(runner,/quick-target-not-interactive/);
 assert.match(runner,/quick-target-bounds-unconfirmed/);
 assert.match(runner,/quick-target-outside-window-band/);
 assert.match(runner,/quick-target-near-bottom-nav/);
 assert.match(runner,/quick-tabs-placement-unconfirmed/);
 assert.match(runner,/quick-tabs-not-unique/);
 assert.match(runner,/quick-tabs-bounds-unconfirmed/);
 assert.match(runner,/quick-overlap-bottom-tab/);
 assert.match(runner,/quick-peer-bounds-unconfirmed/);
 assert.match(runner,/quick-target-eligible/);
 assert.match(runner,/def quick_pix_comparator\(/);
 assert.match(runner,/n\.get\("content-desc"\)=="Abrir Pix"/);
 assert.match(runner,/len\(matches\)!=1/);
 assert.doesNotMatch(runner,/y2<int\(height\*\.78\)/);
 assert.match(runner,/nav_top=min\(nav_top,bar\[1\]\)/);
 assert.match(runner,/if nav_top<int\(height\*\.60\):/);
 assert.match(runner,/if y2>=nav_top-8:/);
 assert.match(runner,/if nav_top<int\(height\*\.60\) or y2>=nav_top-8:/);
 assert.match(runner,/first is None or first!=second/);
 assert.match(runner,/mode==\("--quick-pix-comparator",\)/);
 assert.match(runner,/native=="native-page-pix-pressin-no-call-yes"/);
 assert.match(runner,/category!="quick-pix-nav-confirmed"/);
 assert.match(runner,/MAX_GESTURES = 2/);
 const quick=runner.split('def quick_pix_comparator() -> None:')[1].split('\n\ndef run() -> None:')[0];
 assert.equal((quick.match(/"input","tap"/g)||[]).length,1);
 assert.doesNotMatch(quick,/swipe|exportLocalPdf|performClick|reportPdf/);
});

test('synthetic safe-band contract tests actual tab boundary and rejects offscreen/overlap',()=>{
 const script="import sys\nsys.path.insert(0,'tooling/android')\nimport guardiao_debug_touch_delivery_lab as t\np='com.negresco.finance'\ndef node(label,box,rid='',click='true'):\n return {'content-desc':label,'package':p,'bounds':box,'resource-id':rid,'clickable':click,'enabled':'true'}\ntabs=[node('',f'[{i*100},890][{(i+1)*100},960]','negresco-lab-tab-'+name) for i,name in enumerate(('home','pix','negresco'))]\ngood=node('Abrir Pix','[120,720][180,770]')\nnodes=[good,*tabs]\nassert t.quick_pix_target_gate_category(nodes,400,1000,p)=='quick-target-eligible'\nassert t.safe_quick_pix_point(nodes,400,1000,p)==(150,745)\nbottom=node('Abrir Pix','[120,850][180,900]')\nassert t.quick_pix_target_gate_category([bottom,*tabs],400,1000,p)=='quick-target-near-bottom-nav'\nassert t.safe_quick_pix_point([bottom,*tabs],400,1000,p) is None\ntop=node('Abrir Pix','[120,3][180,60]')\nassert t.quick_pix_target_gate_category([top,*tabs],400,1000,p)=='quick-target-outside-window-band'\nassert t.safe_quick_pix_point([top,*tabs],400,1000,p) is None\noverlap=node('Other','[145,710][190,765]')\nassert t.quick_pix_target_gate_category([good,overlap,*tabs],400,1000,p)=='quick-peer-path-unconfirmed'\nassert t.safe_quick_pix_point([good,overlap,*tabs],400,1000,p) is None\nassert t.safe_quick_pix_point([good,good,*tabs],400,1000,p) is None\nassert t.quick_pix_target_gate_category([good,good,*tabs],400,1000,p)=='quick-label-ambiguous'\nprint('safe-dynamic-band-contract-pass')";
 const r=spawnSync('python3',['-I','-S','-B','-c',script],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,'synthetic safe-band contract failed');
 assert.match(r.stdout,/safe-dynamic-band-contract-pass/);
});

test('ancestor-aware comparator allows only proven containing XML ancestors',()=>{
 const script="import sys\nsys.path.insert(0,'tooling/android')\nimport guardiao_debug_touch_delivery_lab as t\np='com.negresco.finance'\ndef node(label,box,rid='',path='',click='true'):\n return {'content-desc':label,'package':p,'bounds':box,'resource-id':rid,\n         'clickable':click,'enabled':'true','_quick_path':path}\ntabs=[node('',f'[{i*100},890][{(i+1)*100},960]',\n           'negresco-lab-tab-'+name,'0/0/'+str(i))\n      for i,name in enumerate(('home','pix','negresco'))]\ntarget=node('Abrir Pix','[120,720][180,770]',path='0/2/1/3')\nancestor=node('','[100,690][195,785]',path='0/2/1')\nwrong=node('','[100,690][195,785]',path='0/5/1')\nnodes=[target,ancestor,*tabs]\nassert t.quick_pix_target_gate_category(nodes,400,1000,p)=='quick-target-eligible-ancestor'\nassert t.safe_quick_pix_point(nodes,400,1000,p)==(150,745)\nassert t.quick_pix_target_gate_category([target,wrong,*tabs],400,1000,p)=='quick-peer-unrelated'\nassert t.safe_quick_pix_point([target,wrong,*tabs],400,1000,p) is None\nassert not t.quick_pix_peer_is_proven_ancestor(target,wrong,(120,720,180,770),(100,690,195,785))\nassert t.quick_pix_target_gate_category([target,*tabs],400,1000,p)=='quick-target-eligible'\nbad=node('','[130,720][160,760]',path='0/2')\nassert t.safe_quick_pix_point([target,bad,*tabs],400,1000,p) is None\nassert t.quick_pix_target_gate_category([target,bad,*tabs],400,1000,p)=='quick-peer-ancestor-bounds-conflict'\nmissing=node('','[100,690][195,785]')\nassert t.safe_quick_pix_point([target,missing,*tabs],400,1000,p) is None\nassert t.quick_pix_target_gate_category([target,missing,*tabs],400,1000,p)=='quick-peer-path-unconfirmed'\nchild=node('','[130,730][165,760]',path='0/2/1/3/0')\nassert t.quick_pix_target_gate_category([target,child,*tabs],400,1000,p)=='quick-peer-clickable-descendant'\nassert t.safe_quick_pix_point([target,child,*tabs],400,1000,p) is None\nsibling=node('','[130,730][165,760]',path='0/2/1/4')\nassert t.quick_pix_target_gate_category([target,sibling,*tabs],400,1000,p)=='quick-peer-clickable-sibling'\nassert t.safe_quick_pix_point([target,sibling,*tabs],400,1000,p) is None\nsame=node('','[130,730][165,760]',path='0/2/1/3')\nassert t.quick_pix_target_gate_category([target,same,*tabs],400,1000,p)=='quick-peer-duplicate-path'\nassert t.safe_quick_pix_point([target,same,*tabs],400,1000,p) is None\nprint('confirmed-ancestor-only-contract-pass')";
 const r=spawnSync('python3',['-I','-S','-B','-c',script],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,'strict ancestor relation synthetic contract failed');
 assert.match(r.stdout,/confirmed-ancestor-only-contract-pass/);
});

test('bounded pre-gesture probe selects one clean point but never bypasses overlapping controls',()=>{
 const script="import sys\nsys.path.insert(0,'tooling/android')\nimport guardiao_debug_touch_delivery_lab as t\np='com.negresco.finance'\ndef node(label,box,rid='',path=''):\n return {'content-desc':label,'package':p,'bounds':box,\n         'resource-id':rid,'clickable':'true','enabled':'true',\n         '_quick_path':path}\ntabs=[node('',f'[{i*100},890][{(i+1)*100},960]',\n    'negresco-lab-tab-'+name,'0/5/'+str(i))\n    for i,name in enumerate(('home','pix','negresco'))]\ntarget=node('Abrir Pix','[120,720][200,800]',path='0/2/1/3')\nsmall=node('','[155,754][166,766]',path='0/4/1')\nnodes=[target,small,*tabs]\nassert t.quick_pix_target_gate_category(nodes,400,1000,p)=='quick-target-eligible-alternate'\nassert t.safe_quick_pix_point(nodes,400,1000,p)==(140,740)\nbig=node('','[110,710][210,810]',path='0/4/1')\nassert t.quick_pix_target_gate_category([target,big,*tabs],400,1000,p)=='quick-peer-unrelated'\nassert t.safe_quick_pix_point([target,big,*tabs],400,1000,p) is None\nsibling=node('','[155,754][166,766]',path='0/2/1/4')\nassert t.quick_pix_target_gate_category([target,sibling,*tabs],400,1000,p)=='quick-peer-clickable-sibling'\nassert t.safe_quick_pix_point([target,sibling,*tabs],400,1000,p) is None\ndescendant=node('','[155,754][166,766]',path='0/2/1/3/0')\nassert t.safe_quick_pix_point([target,descendant,*tabs],400,1000,p) is None\nunknown=node('','invalid',path='0/4/1')\nassert t.safe_quick_pix_point([target,small,unknown,*tabs],400,1000,p) is None\nprint('alternate-single-safe-point-contract-pass')";
 const r=spawnSync('python3',['-I','-S','-B','-c',script],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,'alternate point synthetic contract failed');
 assert.match(r.stdout,/alternate-single-safe-point-contract-pass/);
 const quick=runner.split('def quick_pix_comparator() -> None:')[1].split('\n\ndef run() -> None:')[0];
 assert.equal((quick.match(/"input","tap"/g)||[]).length,1);
 assert.match(quick,/first is None or first!=second/);
 assert.match(quick,/first_gate!=second_gate/);
});

test('passive alternate blocker categories do not authorize gestures',()=>{
 const script="import sys\nsys.path.insert(0,'tooling/android')\nimport guardiao_debug_touch_delivery_lab as t\np='com.negresco.finance'\ndef n(label,box,path,click='true'):\n return {'content-desc':label,'package':p,'bounds':box,'_quick_path':path,\n         'clickable':click,'enabled':'true'}\ntabs=[n('',f'[{100*i},890][{100*(i+1)},960]',f'0/5/{i}') for i in range(3)]\ntarget=n('Abrir Pix','[120,720][200,800]','0/2/1')\nsmall=n('','[155,754][166,766]','0/4/1')\nbig=n('','[110,710][210,810]','0/4/1')\nassert t.quick_pix_alternate_block_category([target,big,*tabs],400,1000,p)=='quick-alt-whole-target-covered'\nassert t.quick_pix_alternate_block_category([target,small,*tabs],400,1000,p)=='quick-alt-clean-point-inconsistent'\nassert t.safe_quick_pix_point([target,small,*tabs],400,1000,p)==(140,740)\nunknown=n('','not-a-rectangle','0/4/2')\nassert t.quick_pix_alternate_block_category([target,small,unknown,*tabs],400,1000,p)=='quick-alt-peer-bounds-unconfirmed'\nassert t.safe_quick_pix_point([target,small,unknown,*tabs],400,1000,p) is None\nsibling=n('','[155,754][166,766]','0/2/2')\nassert t.quick_pix_alternate_block_category([target,sibling,*tabs],400,1000,p)=='quick-alt-center-conflict'\nassert t.safe_quick_pix_point([target,sibling,*tabs],400,1000,p) is None\nassert t.quick_pix_alternate_block_category([target,*tabs],400,1000,p)=='quick-alt-no-unrelated-center'\nprint('passive-alternate-categories-pass')";
 const r=spawnSync('python3',['-I','-S','-B','-c',script],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,'passive alternate blocker classifier failed');
 assert.match(r.stdout,/passive-alternate-categories-pass/);
 const tap=runner.split('def quick_pix_comparator() -> None:')[1].split('\n\ndef run() -> None:')[0];
 assert.equal((tap.match(/"input","tap"/g)||[]).length,1);
});

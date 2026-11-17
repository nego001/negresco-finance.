import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const w=readFileSync('.github/workflows/guardiao-v5-api28-home-cardinality-snapshots.yml','utf8'), p=readFileSync('tooling/android/guardiao_v5_api28_home_cardinality_snapshots_lab.py','utf8');

test('four isolated Android9 jobs use pinned v5 Debug APK and no release actions',()=>{
 for(const item of ['lab/p01-guardiao-v5-api28-home-cardinality-snapshots-v1','trial: [1, 2, 3, 4]',
 'api: [28]','run-id: 43789332636','fail-fast: false',
 '0eb3d43a1190c60c8f5cd55f0b9d7a276026e6959886b9cdf3d2d07a4ffb30f4',
 'CN=Android Debug','sha256sum --check --strict',
 'script: python3 tooling/android/guardiao_v5_api28_home_cardinality_snapshots_lab.py','persist-credentials: false',
 'contents: read','actions: read']){
  assert.ok(w.includes(item),item);
 }
 assert.doesNotMatch(w,/contents: write|continue-on-error: true|assembleRelease|assembleDebug|upload-artifact|workflow_dispatch:|pull_request:|schedule:|secrets\./i);
});
test('uses existing UI snapshot, original verdict, and restores wrapper on all paths',()=>{
 for(const item of ['original = prior.classify_footer_labels',
 'return original(nodes, width, height)',
 'prior.classify_footer_labels = classify_read_only',
 'prior.classify_footer_labels = original','prior.run()',
 'home.safe_bounds_shape(','scoped.BASE.PACKAGE']){
  assert.ok(p.includes(item),item);
 }
 const start=p.indexOf('def classify('),end=p.indexOf('\ndef run()',start);
 assert.ok(start>=0&&end>start);
 assert.doesNotMatch(p.slice(start,end),/\.adb\(|\.xml_nodes\(|input", "tap"|input", "swipe"|print\(|sleep\(/);
 assert.doesNotMatch(p,/print\(nodes\)|print\(node\)|print\(raw\)/);
});
test('distinguishes absent, duplicate, out-of-band and valid Home label with synthetic nodes',()=>{
 const src=[
 "import sys",
 "sys.path.insert(0,'tooling/android')",
 "import guardiao_v5_api28_home_cardinality_snapshots_lab as d",
 "pkg=d.scoped.BASE.PACKAGE",
 "def node(name,y1=620,y2=670): return {'package':pkg,'class':'android.widget.TextView','enabled':'true','text':name,'bounds':f'[20,{y1}][110,{y2}]'}",
 "good=[node('Início'),node('Pix'),node('Negresco')]",
 "assert d.classify(good,400,800)==('one','one','one','one','on-bottom-band')",
 "assert d.classify(good[1:],400,800)==('none','none','one','one','not-single')",
 "assert d.classify(good+[node('Início')],400,800)==('many','many','one','one','not-single')",
 "assert d.classify([node('Início',100,150)]+good[1:],400,800)==('one','none','one','one','onscreen-other-band')",
 "assert d.classify(good+[node('Pix',100,150)],400,800)==('one','one','one','one','on-bottom-band')",
 "assert d.classify(None,400,800)==('unconfirmed',)*5",
 "print('PASS (LAB): Home cardinality fixed categories')"
 ].join('\n');
 const z=spawnSync('python3',['-c',src],{encoding:'utf8',timeout:20000});
 assert.equal(z.status,0,z.stderr);
 assert.match(z.stdout,/PASS \(LAB\): Home cardinality fixed categories/);
});
test('refuses dynamic SHA or runtime override',()=>{
 const z=spawnSync('python3',['tooling/android/guardiao_v5_api28_home_cardinality_snapshots_lab.py','override'],{encoding:'utf8',timeout:20000});
 assert.equal(z.status,1,z.stderr);
 assert.match(z.stderr,/BLOCK \(LAB\): Android9 Home label cardinality unverified/);
});

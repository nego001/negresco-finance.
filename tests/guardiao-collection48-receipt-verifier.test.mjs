import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync, symlinkSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const verifier='tooling/android/verify_collection48_receipt.py';
const workflow=readFileSync('.github/workflows/guardiao-android-collection48-pdf-text-lab.yml','utf8');
const receiptName='guardiao-android-real-pdf-text-receipt.json';
const fixture={
  allPagesRendered:true, api:26,
  apkSha256:'29e248742e365c4dd7a8c668a23153d43a89b8be02828620bbc5851775986b4a',
  approvedForProduction:false, chromeReferenceUsed:false, guardiaoOpened:true,
  nativePdfSemanticTextVerified:true, nonblankPages:1, pdfActionTriggered:true,
  pdfPageCount:1, pdfPages:1, pdfSizeBytes:39209, privateCaptureDeleted:true,
  realAndroidApkPdf:true,
  receivedPdfSha256:'5237c5347162d6ac74498df9512375c52ef31d617ca2aa9f07785ee85e65b73f',
  receiverCacheClean:true, receiverPdfRead:true, renderedFirstPage:true,
  schemaVersion:2, scope:'SHA_PINNED_ANDROID_APP_SYNTHETIC_PDF_TEXT',
  sourceFixture:'synthetic-48-collection-reference-invalid',
  stableReleaseAllowed:false, syntheticInput:true,
  systemChooserObserved:true, textPagesVerified:1
};
function cli(api, path){
  return spawnSync('python3',[verifier,String(api),path],{encoding:'utf8'});
}
function withTemp(fn){
  const dir=mkdtempSync(join(tmpdir(),'negresco-metadata-fixture-'));
  try{return fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}
}
function jsonAt(dir,content){
  const file=join(dir,receiptName);
  writeFileSync(file,typeof content==='string'?content:JSON.stringify(content));
  return file;
}
function asZip(dir,entries){
  const path=join(dir,'artifact.zip');
  const generator='import sys,zipfile\nwith zipfile.ZipFile(sys.argv[1],"w",compression=zipfile.ZIP_DEFLATED) as z:\n    for i in range(2,len(sys.argv),2):\n        z.write(sys.argv[i+1],arcname=sys.argv[i])\n';
  const args=['-c',generator,path,...entries.flatMap(([name,file])=>[name,file])];
  const p=spawnSync('python3',args,{encoding:'utf8'});
  assert.equal(p.status,0,'synthetic ZIP construction');
  return path;
}
function assertBlock(result){
  assert.equal(result.status,1);
  assert.match(result.stderr,/^BLOCK \(LAB\): synthetic Android receipt rejected\s*$/);
  assert.equal(result.stdout,'');
}

test('fixed synthetic receipts for Android 8 and Android 9 pass the independent metadata gate',()=>{
  for(const api of [26,28])withTemp(dir=>{
    const file=jsonAt(dir,{...fixture,api});
    const result=cli(api,file);
    assert.equal(result.status,0);
    assert.match(result.stdout,/^PASS \(LAB\): bounded synthetic Android receipt metadata verified/);
    assert.equal(result.stderr,'');
  });
});

test('only one JSON metadata file is accepted inside a ZIP artifact',()=>withTemp(dir=>{
  const file=jsonAt(dir,fixture);
  const zip=asZip(dir,[[receiptName,file]]);
  assert.equal(cli(26,zip).status,0);
  assertBlock(cli(28,zip));
}));

for(const [name,change] of [
  ['wrong API',(r)=>{r.api=28;}],
  ['spoofed PDF hash',(r)=>{r.receivedPdfSha256='z'.repeat(64);}],
  ['wrong APK',(r)=>{r.apkSha256='0'.repeat(64);}],
  ['unchecked pages',(r)=>{r.textPagesVerified=0;}],
  ['blank page',(r)=>{r.nonblankPages=0;}],
  ['schema substitution',(r)=>{r.schemaVersion=3;}],
  ['fake fixture',(r)=>{r.sourceFixture='possibly-payable-input';}],
  ['permitted production',(r)=>{r.approvedForProduction=true;}],
  ['no cache deletion',(r)=>{r.privateCaptureDeleted=false;}],
  ['numeric boolean',(r)=>{r.receiverCacheClean=1;}],
  ['non-integral bytes',(r)=>{r.pdfSizeBytes=1.5;}],
  ['malformed hex',(r)=>{r.receivedPdfSha256='A'.repeat(64);}],
  ['additional sensitive field',(r)=>{r.lineDigitavel='sensitive value';}],
  ['dropped provenance',(r)=>{delete r.realAndroidApkPdf;}],
])test('rejects '+name,()=>withTemp(dir=>{
  const modified=structuredClone(fixture);change(modified);
  assertBlock(cli(26,jsonAt(dir,modified)));
}));

test('rejects duplicate JSON keys, including an override of the Android API',()=>withTemp(dir=>{
  const original=JSON.stringify(fixture);
  const tampered=original.replace('"api":26','"api":26,"api":28');
  assert.notEqual(tampered,original);
  assertBlock(cli(26,jsonAt(dir,tampered)));
}));

test('rejects unsupported PDF or UI files appended to a ZIP',()=>withTemp(dir=>{
  const good=jsonAt(dir,fixture);
  const suspicious=join(dir,'document.pdf');
  writeFileSync(suspicious,'%PDF- lab only');
  const archive=asZip(dir,[[receiptName,good],['document.pdf',suspicious]]);
  assertBlock(cli(26,archive));
}));

test('rejects path-traversal artifact names and malformed ZIP payloads',()=>withTemp(dir=>{
  const good=jsonAt(dir,fixture);
  assertBlock(cli(26,asZip(dir,[['../'+receiptName,good]])));
  const broken=join(dir,'not-a-zip.zip');
  writeFileSync(broken,'not a zip');
  assertBlock(cli(26,broken));
}));

test('rejects trailing ZIP overlay even if Python zipfile can read the entry',()=>withTemp(dir=>{
  const good=jsonAt(dir,fixture);
  const archive=asZip(dir,[[receiptName,good]]);
  writeFileSync(archive,Buffer.concat([readFileSync(archive),Buffer.from('synthetic-overlay-not-a-receipt')]));
  assertBlock(cli(26,archive));
}));

test('rejects invisible data inside a DEFLATE stream that ordinary Python zipfile accepts',()=>withTemp(dir=>{
  const good=jsonAt(dir,fixture);
  const archive=asZip(dir,[[receiptName,good]]);
  const mutate=spawnSync('python3',['-c',"import sys,zipfile,struct\np=sys.argv[1]\nwith zipfile.ZipFile(p) as z:\n    entry=z.infolist()[0]\n    central=z.start_dir\n    assert entry.flag_bits == 0\ndata=bytearray(open(p,'rb').read())\nstart=30+len(entry.filename.encode('ascii'))+len(entry.extra)\nend=start+entry.compress_size\nhidden=b'synthetic-hidden-deflate-overlay'\npatched=bytearray(data[:end]+hidden+data[end:])\nstruct.pack_into('<I',patched,18,entry.compress_size+len(hidden))\nstruct.pack_into('<I',patched,central+len(hidden)+20,entry.compress_size+len(hidden))\nstruct.pack_into('<I',patched,len(patched)-22+16,central+len(hidden))\nwith open(p,'wb') as f:\n    f.write(patched)\nwith zipfile.ZipFile(p) as z:\n    assert z.read(z.infolist()[0])\n",archive],{encoding:'utf8'});
  assert.equal(mutate.status,0,'fixture proves Python zipfile accepts hidden deflate bytes');
  assertBlock(cli(26,archive));
}));

test('rejects hidden ZIP comments that could contain private content',()=>withTemp(dir=>{
  const good=jsonAt(dir,fixture);
  const zip=asZip(dir,[[receiptName,good]]);
  const py='import sys,zipfile\nwith zipfile.ZipFile(sys.argv[1],"a") as z:\n    z.comment=b"hidden-private-payload"\n';
  const edit=spawnSync('python3',['-c',py,zip],{encoding:'utf8'});
  assert.equal(edit.status,0);
  assertBlock(cli(26,zip));
}));

test('rejects ZIP self-extracting prefixes or data before the first entry',()=>withTemp(dir=>{
  const good=jsonAt(dir,fixture);
  const zip=asZip(dir,[[receiptName,good]]);
  const bytes=readFileSync(zip);
  writeFileSync(zip,Buffer.concat([Buffer.from('hidden-preamble'),bytes]));
  assertBlock(cli(26,zip));
}));

test('receipt opening is descriptor-bound, nofollow and size-bounded',()=>{
  const source=readFileSync(verifier,'utf8');
  assert.match(source,/os\.O_NOFOLLOW/);
  assert.match(source,/fd = os\.open\(path, flags\)/);
  assert.match(source,/info = os\.fstat\(fd\)/);
  assert.match(source,/stat\.S_ISREG\(info\.st_mode\)/);
  assert.match(source,/source\.read\(limit \+ 1\)/);
  assert.match(source,/os\.close\(fd\)/);
  assert.doesNotMatch(source,/path\.read_bytes\(\)|path\.open\("rb"\)/);
});

test('oversized JSON and ZIP fail closed before parsing',()=>withTemp(dir=>{
  const json=jsonAt(dir,'x'.repeat(4097));
  assertBlock(cli(26,json));
  const zip=join(dir,'oversized.zip');
  writeFileSync(zip,Buffer.alloc(1048577));
  assertBlock(cli(26,zip));
}));

test('rejects symlinks, JSON with wrong name and other file types',()=>withTemp(dir=>{
  const good=jsonAt(dir,fixture);
  const link=join(dir,'linked.zip');
  symlinkSync(good,link);
  assertBlock(cli(26,link));
  const renamed=join(dir,'unreviewed.json');
  writeFileSync(renamed,JSON.stringify(fixture));
  assertBlock(cli(26,renamed));
}));

test('branch-only CI runs strict metadata verification before uploading any receipt',()=>{
  assert.match(workflow,/lab\/p01-guardiao-arrecadacao48-receipt-audit-v1/);
  assert.match(workflow,/python3 tooling\/android\/verify_collection48_receipt\.py \$\{\{ matrix\.api \}\} guardiao-android-real-pdf-text-receipt\.json/);
  assert.ok(workflow.indexOf('verify_collection48_receipt.py')<workflow.indexOf('actions/upload-artifact@v4'));
  assert.match(workflow,/permissions:\s*\n  contents: read\s*\n  actions: read/);
  assert.match(workflow,/retention-days: 2/);
  assert.doesNotMatch(workflow,/contents: write|workflow_dispatch|secrets\.|eas update|expo publish|gh release|adb pull/);
});

test('Android startup checkpoints are bounded, category-only and precede fixture interaction',()=>{
  const runner=readFileSync('tooling/android/guardiao_pdf_ui_emulator_smoke.py','utf8');
  const markers=[
    'STAGE (LAB): audited APK integrity verified',
    'STAGE (LAB): emulator API',
    'STAGE (LAB): isolated Android receiver installed',
    'STAGE (LAB): private synthetic one-shot gate prepared',
    'STAGE (LAB): stale receiver receipt cleared',
    'STAGE (LAB): SHA-pinned Android app installed',
    'STAGE (LAB): Android launcher accepted synthetic app launch',
    'STAGE (LAB): app home observed',
    'STAGE (LAB): Guardião navigation tapped',
    'STAGE (LAB): synthetic input label observed'
  ];
  let position=-1;
  for (const marker of markers){
    const next=runner.indexOf(marker);
    assert.ok(next>position, 'ordered non-sensitive startup checkpoint: '+marker);
    position=next;
  }
  assert.match(runner,/BLOCK STAGE \(LAB\): app home not observed after bounded launch wait/);
  assert.match(runner,/json\.dumps\(safe_environment_summary\(\), sort_keys=True\)/);
  assert.doesNotMatch(runner,/print\([^\n]*FIXTURE/);
  assert.doesNotMatch(runner,/print\([^\n]*populated\.get/);
});

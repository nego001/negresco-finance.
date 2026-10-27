import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {discardUnsharedPrintPdf,isOwnedPrintPdfUri} from '../apps/mobile/guardiao/pdfCache.ts';
import {exportPdfWithLifecycleGuard} from '../apps/mobile/guardiao/pdfExport.ts';

const root='file:///data/user/0/com.negresco.finance/cache/';
const uuid='12345678-1234-4123-a123-123456789abc';
const owned=root+'Print/'+uuid+'.pdf';
const d=()=>{let resolve=()=>{};const promise=new Promise(ok=>{resolve=ok;});return {promise,resolve};};

test('only precise Expo Print UUID filename below app-private cache is owned',()=>{
  assert.equal(isOwnedPrintPdfUri(owned,root),true);
  assert.equal(isOwnedPrintPdfUri(root+'Print/'+uuid.toUpperCase()+'.PDF',root),true);
});
test('cache cleanup refuses file traversal, lookalike prefixes, documents and arbitrary URLs',()=>{
  for(const uri of [
    root,root+'Print/',root+'Print/../../Preferences/prefs.pdf',root+'Print/not-a-uuid.pdf',
    root+'Print/'+uuid+'.pdf.bak',root+'Print/'+uuid+'.pdf?download=1',
    root+'Print/'+uuid+'.pdf#fragment',root+'Print/%2e%2e/prefs.pdf',
    root+'Print/'+uuid+'.pdf/../../other.pdf',
    root+'Elsewhere/'+uuid+'.pdf',
    'file:///data/user/0/com.negresco.finance/cache2/Print/'+uuid+'.pdf',
    'file:///data/user/0/com.negresco.finance/files/Print/'+uuid+'.pdf',
    'file:///data/user/0/another.app/cache/Print/'+uuid+'.pdf',
    'https://example.com/'+uuid+'.pdf',
    'content://downloads/'+uuid+'.pdf','',
    null,undefined,{},123
  ])assert.equal(isOwnedPrintPdfUri(uri,root),false,String(uri));
});
test('cache cleanup rejects invalid or unavailable private cache roots',()=>{
  for(const base of [null,undefined,'','/data/user/0/com.negresco.finance/cache/',
    'file://data/user/0/com.negresco.finance/cache/','file:///data/user/0/com.negresco.finance/cache',
    root+'%2f',root+'?query/',root+'#fragment/',123])
    assert.equal(isOwnedPrintPdfUri(owned,base),false,String(base));
});
test('safe deletion removes a single eligible PDF exactly once',async()=>{
  const seen=[];
  assert.equal(await discardUnsharedPrintPdf(owned,root,async uri=>{seen.push(uri);}),true);
  assert.deepEqual(seen,[owned]);
});
test('invalid input never invokes native delete',async()=>{
  let calls=0;
  assert.equal(await discardUnsharedPrintPdf(root+'Print/wrong.pdf',root,async()=>{calls++;}),false);
  assert.equal(calls,0);
});
test('filesystem deletion failure remains a non-disclosure, best-effort result',async()=>{
  assert.equal(await discardUnsharedPrintPdf(owned,root,async()=>{throw Error('fake filesystem unavailable');}),false);
});
test('a canceled PDF after print completion is deleted if not shared',async()=>{
  const job=d(),seen=[],token={active:true};
  const task=exportPdfWithLifecycleGuard({
    html:'<h1>synthetic</h1>',print:()=>job.promise,
    sharingAvailable:async()=>true,share:async()=>{throw Error('must never share');},
    isCurrent:()=>token.active,
    discardUnsharedFile:uri=>discardUnsharedPrintPdf(uri,root,async candidate=>{seen.push(candidate);})
  });
  token.active=false;job.resolve({uri:owned});
  assert.equal(await task,'cancelled');
  assert.deepEqual(seen,[owned]);
});
test('a canceled PDF during share availability is deleted before native chooser',async()=>{
  const job=d(),token={active:true},seen=[],calls=[];
  const task=exportPdfWithLifecycleGuard({
    html:'<h1>synthetic</h1>',print:async()=>({uri:owned}),
    sharingAvailable:()=>job.promise,share:async()=>{calls.push('share');},
    isCurrent:()=>token.active,
    discardUnsharedFile:uri=>discardUnsharedPrintPdf(uri,root,async candidate=>{seen.push(candidate);})
  });
  await Promise.resolve();token.active=false;job.resolve(true);
  assert.equal(await task,'cancelled');
  assert.deepEqual(calls,[]);assert.deepEqual(seen,[owned]);
});
test('unavailable chooser attempts safe cleanup without false sharing',async()=>{
  const seen=[];
  const r=await exportPdfWithLifecycleGuard({
    html:'<h1>synthetic</h1>',print:async()=>({uri:owned}),
    sharingAvailable:async()=>false,share:async()=>{throw Error('unexpected share');},
    isCurrent:()=>true,
    discardUnsharedFile:uri=>discardUnsharedPrintPdf(uri,root,async candidate=>{seen.push(candidate);})
  });
  assert.equal(r,'unavailable');assert.deepEqual(seen,[owned]);
});
test('successfully entered native chooser always retains the source PDF',async()=>{
  const seen=[];
  assert.equal(await exportPdfWithLifecycleGuard({
    html:'<h1>synthetic</h1>',print:async()=>({uri:owned}),
    sharingAvailable:async()=>true,share:async()=>{},
    isCurrent:()=>true,
    discardUnsharedFile:async uri=>{seen.push(uri);return true;}
  }),'shared');
  assert.deepEqual(seen,[]);
});
test('native chooser failure also retains PDF; receiver may still hold access',async()=>{
  const seen=[];
  assert.equal(await exportPdfWithLifecycleGuard({
    html:'<h1>synthetic</h1>',print:async()=>({uri:owned}),
    sharingAvailable:async()=>true,share:async()=>{throw Error('native chooser failed');},
    isCurrent:()=>true,
    discardUnsharedFile:async uri=>{seen.push(uri);return true;}
  }),'failed');
  assert.deepEqual(seen,[]);
});
test('cleanup failure cannot resurrect a stale share or crash export',async()=>{
  const p=await exportPdfWithLifecycleGuard({
    html:'<h1>synthetic</h1>',print:async()=>({uri:owned}),
    sharingAvailable:async()=>false,share:async()=>{throw Error('must not call');},
    isCurrent:()=>true,
    discardUnsharedFile:async()=>{throw Error('synthetic cache write error');}
  });
  assert.equal(p,'unavailable');
});
test('malformed or non-cache printer URI never gets deleted',async()=>{
  const seen=[];
  const p=await exportPdfWithLifecycleGuard({
    html:'<h1>synthetic</h1>',print:async()=>({uri:'file:///private/unknown.pdf'}),
    sharingAvailable:async()=>false,share:async()=>{},
    isCurrent:()=>true,
    discardUnsharedFile:uri=>discardUnsharedPrintPdf(uri,root,async candidate=>{seen.push(candidate);})
  });
  assert.equal(p,'unavailable');assert.deepEqual(seen,[]);
});
test('mobile integration uses direct Expo SDK 54 filesystem dependency and idempotent delete',()=>{
  const p=JSON.parse(readFileSync('apps/mobile/package.json','utf8'));
  const app=readFileSync('apps/mobile/App.tsx','utf8');
  assert.equal(p.dependencies['expo-file-system'],'~19.0.24');
  assert.match(app,/import \* as FileSystem from 'expo-file-system\/legacy'/);
  assert.match(app,/discardUnsharedFile:uri=>discardUnsharedPrintPdf\(uri,FileSystem\.cacheDirectory/);
  assert.match(app,/fileUri=>FileSystem\.deleteAsync\(fileUri,\{idempotent:true\}\)/);
  assert.deepEqual(JSON.parse(readFileSync('apps/mobile/app.json','utf8')).expo.android.blockedPermissions,
    ['android.permission.SYSTEM_ALERT_WINDOW','android.permission.WRITE_EXTERNAL_STORAGE','android.permission.READ_EXTERNAL_STORAGE','android.permission.READ_MEDIA_IMAGES']);
});

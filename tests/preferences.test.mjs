import test from 'node:test';
import assert from 'node:assert/strict';
import {decodePreferences,encodePreferences,defaultPreferences,createPreferenceWriteQueue,PREFERENCES_STORAGE_KEY} from '../apps/mobile/preferences.ts';
test('defaults for missing, invalid and malicious-looking settings',()=>{
 for(const raw of [null,'','not json','[]','null','{"assistantStyle":"hacked","accent":"true"}']){
 const p=decodePreferences(raw);
 assert.equal(p.accent,false);assert.equal(p.assistantStyle,'acolhedora');
 }
});
test('round trip stores only the intended visual preferences',()=>{
 const p={accent:true,compact:true,fontLarge:true,reducedMotion:true,assistantStyle:'objetiva'};
 assert.deepEqual(decodePreferences(encodePreferences(p)),p);
});
test('does not inherit unknown fields',()=>{
 const p=decodePreferences('{"accent":true,"token":"secret","assistantStyle":"objetiva"}');
 assert.equal('token' in p,false);assert.equal(p.accent,true);
});

test('visual settings writes stay ordered when an older write is slow',async()=>{
 let releaseFirst;
 const calls=[];let persisted=null;
 const queue=createPreferenceWriteQueue({setItem:async(key,value)=>{
  assert.equal(key,PREFERENCES_STORAGE_KEY);
  calls.push(value);
  if(calls.length===1)await new Promise(resolve=>{releaseFirst=resolve;});
  persisted=value;
 }});
 const first=queue.save({...defaultPreferences,accent:true});
 const second=queue.save({...defaultPreferences,accent:false,compact:true});
 await Promise.resolve();
 assert.equal(calls.length,1);
 releaseFirst();
 await Promise.all([first,second]);
 assert.equal(calls.length,2);
 assert.equal(decodePreferences(persisted).compact,true);
 assert.equal(decodePreferences(persisted).accent,false);
});
test('a failed preferences write does not block a later successful update',async()=>{
 let attempts=0,persisted=null;
 const queue=createPreferenceWriteQueue({setItem:async(_key,value)=>{
  if(++attempts===1)throw new Error('disk unavailable');
  persisted=value;
 }});
 await assert.rejects(queue.save(defaultPreferences),/disk unavailable/);
 await queue.save({...defaultPreferences,assistantStyle:'objetiva'});
 assert.equal(decodePreferences(persisted).assistantStyle,'objetiva');
});

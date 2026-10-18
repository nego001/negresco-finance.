import test from 'node:test';
import assert from 'node:assert/strict';
import {decodePreferences,encodePreferences,defaultPreferences} from '../apps/mobile/preferences.ts';
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

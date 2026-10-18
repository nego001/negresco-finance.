import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeHistory} from '../apps/mobile/guardiao/history.ts';
test('history handles invalid records',()=>{assert.deepEqual(sanitizeHistory('invalid'),[]);assert.deepEqual(sanitizeHistory('{}'),[]);});
test('history strips unexpected private fields',()=>{const rows=sanitizeHistory(JSON.stringify([{id:'1',date:'today',kind:'BANK',valid:true,digits:47,fullBoleto:'sensitive'}]));assert.equal(rows.length,1);assert.equal('fullBoleto' in rows[0],false);});

test('history is bounded to twelve records',()=>{const rows=Array.from({length:40},(_,i)=>({id:String(i),date:'today',kind:'BANK',valid:true,digits:47}));assert.equal(sanitizeHistory(JSON.stringify(rows)).length,12);});

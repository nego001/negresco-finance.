import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeHistory,createHistoryWriteQueue} from '../apps/mobile/guardiao/history.ts';
test('history handles invalid records',()=>{assert.deepEqual(sanitizeHistory('invalid'),[]);assert.deepEqual(sanitizeHistory('{}'),[]);});
test('history strips unexpected private fields',()=>{const rows=sanitizeHistory(JSON.stringify([{id:'1',date:'today',kind:'BANK',valid:true,digits:47,fullBoleto:'sensitive'}]));assert.equal(rows.length,1);assert.equal('fullBoleto' in rows[0],false);});

test('history is bounded to twelve records',()=>{const rows=Array.from({length:40},(_,i)=>({id:String(i),date:'today',kind:'BANK',valid:true,digits:47}));assert.equal(sanitizeHistory(JSON.stringify(rows)).length,12);});

test('queued history deletion waits for a pending save and removes its data',async()=>{
 let releaseSave;
 const calls=[];
 let savedValue=null;
 const store={
  getItemAsync:async()=>savedValue,
  setItemAsync:async(_,value)=>{calls.push('save:start');await new Promise(resolve=>{releaseSave=resolve;});savedValue=value;calls.push('save:done');},
  deleteItemAsync:async()=>{calls.push('delete');savedValue=null;},
 };
 const queue=createHistoryWriteQueue(store);
 const save=queue.save([{id:'1',date:'today',kind:'BANK',valid:true,digits:47}]);
 const clear=queue.clear();
 // Let the first queued operation start before inspecting ordering.
 await Promise.resolve();
 assert.deepEqual(calls,['save:start']);
 releaseSave();
 await Promise.all([save,clear]);
 assert.deepEqual(calls,['save:start','save:done','delete']);
 assert.equal(savedValue,null);
});

test('failed secure storage write does not prevent a future deletion',async()=>{
 let cleared=false;
 const queue=createHistoryWriteQueue({
  getItemAsync:async()=>null,
  setItemAsync:async()=>{throw new Error('temporary storage failure');},
  deleteItemAsync:async()=>{cleared=true;},
 });
 await assert.rejects(queue.save([{id:'1',date:'today',kind:'BANK',valid:true,digits:47}]));
 await queue.clear();
 assert.equal(cleared,true);
});

test('history retains safe summaries of invalid-length inspections',()=>{
 const entries=[
  {id:'a',date:'today',kind:'FORMATO DESCONHECIDO',valid:false,digits:46},
  {id:'b',date:'today',kind:'FORMATO DESCONHECIDO',valid:false,digits:0},
 ];
 assert.deepEqual(sanitizeHistory(JSON.stringify(entries)),entries);
});
test('history rejects impossible numeric lengths and hidden original values',()=>{
 const entries=[
  {id:'invalid',date:'today',kind:'BANK',valid:false,digits:1000},
  {id:'valid',date:'today',kind:'FORMATO DESCONHECIDO',valid:false,digits:3,originalBoleto:'123'},
 ];
 const cleaned=sanitizeHistory(JSON.stringify(entries));
 assert.equal(cleaned.length,1);
 assert.equal('originalBoleto' in cleaned[0],false);
});

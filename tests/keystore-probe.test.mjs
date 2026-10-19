import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runKeystoreProbe,KEYSTORE_PROBE_KEY,KEYSTORE_PROBE_SERVICE} from '../apps/mobile/security/keystoreProbe.ts';

const auth={
 hasHardwareAsync:async()=>true,
 isEnrolledAsync:async()=>true,
 getEnrolledLevelAsync:async()=>3
};
const syntheticStore=()=>{
 let value=null;
 const calls=[];
 const store={
  isAvailableAsync:async()=>true,
  setItemAsync:async(key,v,opt)=>{
   calls.push(['set',key,opt]);
   value=v;
  },
  getItemAsync:async(key,opt)=>{
   calls.push(['get',key,opt]);
   return value;
  },
  deleteItemAsync:async(key,opt)=>{
   calls.push(['delete',key,opt]);
   value=null;
  }
 };
 return {store,calls,read:()=>value};
};

test('keystore probe is opt-in, authenticated, synthetic, and cleans up',async()=>{
 const {store,calls,read}=syntheticStore();
 const res=await runKeystoreProbe(store,auth,'android');
 assert.equal(res.status,'passed');
 assert.equal(read(),null);
 assert.deepEqual(calls.map(c=>c[0]),['set','get','delete']);
 assert.equal(calls[0][1],KEYSTORE_PROBE_KEY);
 assert.equal(calls[0][2].requireAuthentication,true);
 assert.equal(calls[1][2].requireAuthentication,true);
 assert.equal(calls[0][2].keychainService,KEYSTORE_PROBE_SERVICE);
 assert.equal(calls[1][2].keychainService,KEYSTORE_PROBE_SERVICE);
 assert.doesNotMatch(res.message,/certifica o SQLCipher/i);
 assert.match(res.message,/NÃO certifica/i);
});

test('weak biometrics, device PIN only and unavailable SecureStore never write',async()=>{
 for(const level of [0,1,2]){
  const {store,calls}=syntheticStore();
  const res=await runKeystoreProbe(store,{...auth,getEnrolledLevelAsync:async()=>level},'android');
  assert.equal(res.status,'unavailable');
  assert.equal(calls.length,0);
 }
 const {store,calls}=syntheticStore();
 assert.equal((await runKeystoreProbe(store,auth,'ios')).status,'unavailable');
 assert.equal(calls.length,0);
});

test('cancelled authentication and missing protected marker never pass',async()=>{
 const {store,calls}=syntheticStore();
 store.getItemAsync=async()=>null;
 assert.equal((await runKeystoreProbe(store,auth,'android')).status,'failed');
 assert.equal(calls.at(-1)[0],'delete');

 const x=syntheticStore();
 x.store.getItemAsync=async()=>{throw Error('cancelled')};
 assert.equal((await runKeystoreProbe(x.store,auth,'android')).status,'failed');
 assert.equal(x.read(),null);
});

test('failed cleanup fails closed even after authenticated read',async()=>{
 const {store}=syntheticStore();
 store.deleteItemAsync=async()=>{throw Error('delete failed')};
 const result=await runKeystoreProbe(store,auth,'android');
 assert.equal(result.status,'failed');
 assert.match(result.message,/não conseguiu apagar/);
});

test('failed write attempts cleanup without leaking a false pass',async()=>{
 const {store,calls}=syntheticStore();
 store.setItemAsync=async()=>{throw Error('failure')};
 const result=await runKeystoreProbe(store,auth,'android');
 assert.equal(result.status,'failed');
 assert.deepEqual(calls.map(c=>c[0]),['delete']);
});

test('keystore test is manual from unlocked settings and does not run on startup',()=>{
 const app=readFileSync(new URL('../apps/mobile/App.tsx',import.meta.url),'utf8');
 assert.match(app,/runKeystoreProbe\(SecureStore,LocalAuthentication,Platform\.OS\)/);
 assert.match(app,/if\(localLock\.status!=='unlocked'\|\|keystoreProbeBusy\)return/);
 assert.match(app,/onPress=\{checkKeystore\}/);
 assert.doesNotMatch(app,/useEffect\(\(\)=>\{\s*runKeystoreProbe/);
});

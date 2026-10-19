import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 LOCAL_LOCK_PREF_KEY,LOCAL_LOCK_ENABLED,LOCAL_LOCK_DISABLE_PENDING,LOCAL_LOCK_DISABLED,
 LOCAL_LOCK_OPTOUT_JOURNAL_KEY,LOCAL_LOCK_OPTOUT_PENDING,
 parseLocalLockPreference,parseLocalLockWithJournal,persistBiometricOptOut,isStrongBiometryAvailable,
 canFinishAuthentication,shouldCoverAndLockOnState,shouldInvalidateLocalSession
} from '../apps/mobile/security/localLockPolicy.ts';

test('existing devices have opt-in UI lock disabled by default',()=>{
 assert.equal(LOCAL_LOCK_PREF_KEY,'negresco.local_lock.v1');
 assert.equal(parseLocalLockPreference(null),false);
 assert.equal(parseLocalLockPreference('enabled'),true);
 assert.equal(parseLocalLockPreference(LOCAL_LOCK_DISABLE_PENDING),true);
 assert.equal(parseLocalLockPreference(LOCAL_LOCK_DISABLED),false);
 assert.throws(()=>parseLocalLockPreference('off'),/Unknown/);
 assert.throws(()=>parseLocalLockPreference('malformed'),/Unknown/);
});
test('only enrolled strong biometrics may authenticate; weak recognition is denied',()=>{
 assert.equal(isStrongBiometryAvailable(true,true,3),true);
 for(const [hardware,enrolled,level] of [[false,true,3],[true,false,3],[true,true,2],[true,true,1]]){
  assert.equal(isStrongBiometryAvailable(hardware,enrolled,level),false);
 }
});
test('late successful authentication is rejected after background or new epoch',()=>{
 assert.equal(canFinishAuthentication(true,4,4,'active'),true);
 assert.equal(canFinishAuthentication(true,4,5,'active'),false);
 assert.equal(canFinishAuthentication(true,4,4,'background'),false);
 assert.equal(canFinishAuthentication(true,4,4,'inactive'),false);
 assert.equal(canFinishAuthentication(false,4,4,'active'),false);
});
test('screen shield covers app on inactive and background; not when foreground',()=>{
 assert.equal(shouldCoverAndLockOnState('background'),true);
 assert.equal(shouldCoverAndLockOnState('inactive'),true);
 assert.equal(shouldCoverAndLockOnState('active'),false);
});
test('native biometrics never silently fall back or persist a secret',()=>{
 const hook=readFileSync(new URL('../apps/mobile/security/useLocalAppLock.ts',import.meta.url),'utf8');
 const app=readFileSync(new URL('../apps/mobile/App.tsx',import.meta.url),'utf8');
 assert.match(hook,/biometricsSecurityLevel:'strong'/);
 assert.match(hook,/disableDeviceFallback:true/);
 assert.match(hook,/LocalAuthentication\.authenticateAsync/);
 assert.match(hook,/AsyncStorage\.setItem\(LOCAL_LOCK_PREF_KEY,'enabled'\)/);
 assert.doesNotMatch(hook,/AsyncStorage\.setItem\([^\n]*[Pp]assword/);
 assert.match(app,/LocalLockScreen/);
 assert.match(app,/localLock\.status==='off'\|\|localLock\.status==='unlocked'/);
});

test('native biometric prompt inactive is transient, background is always a hard revoke',()=>{
 assert.equal(shouldInvalidateLocalSession('inactive',true),false);
 assert.equal(shouldInvalidateLocalSession('inactive',false),true);
 assert.equal(shouldInvalidateLocalSession('background',true),true);
 assert.equal(shouldInvalidateLocalSession('background',false),true);
 assert.equal(shouldInvalidateLocalSession('active',true),false);
});
test('unlock and lock removal must re-check epoch after the native prompt and persistence',()=>{
 const hook=readFileSync(new URL('../apps/mobile/security/useLocalAppLock.ts',import.meta.url),'utf8');
 assert.match(hook,/shouldInvalidateLocalSession\(next,authenticating\.current\|\|protectedNativePrompt\.current\)/);
 assert.match(hook,/withProtectedNativePrompt/);
 assert.match(hook,/try\{return await task\(\);\}/);
 assert.match(hook,/finally\{protectedNativePrompt\.current=false;\}/);
 assert.match(hook,/const ticket=epoch\.current;/);
 assert.match(hook,/await persistBiometricOptOut\(AsyncStorage,valid\)/);
 assert.match(hook,/if\(outcome==='disabled'&&valid\(\)\)/);
 assert.doesNotMatch(hook,/AsyncStorage\.removeItem\(LOCAL_LOCK_PREF_KEY\)/);
});

test('stale preference reads fail closed rather than resetting lock to off',()=>{
 const hook=readFileSync(new URL('../apps/mobile/security/useLocalAppLock.ts',import.meta.url),'utf8');
 assert.match(hook,/if\(attemptEpoch!==epoch\.current\)return;/);
 assert.match(hook,/if\(appState\.current!=='active'\)\{[\s\S]*?setStatus\('error'\)/);
 assert.match(hook,/setStatus\(enabled\?'locked':'off'\)/);
 assert.doesNotMatch(hook,/setStatus\(enabled\?'locked':'off'\);\s*if\(attemptEpoch!==epoch\.current/);
});

test('overlapping preference retries are versioned and stale failures ignored',()=>{
 const hook=readFileSync(new URL('../apps/mobile/security/useLocalAppLock.ts',import.meta.url),'utf8');
 assert.match(hook,/const attemptEpoch=\+\+epoch\.current;/);
 assert.match(hook,/if\(active\.current&&attemptEpoch===epoch\.current\)\{/);
});

test('biometric authentication cannot overlap with SecureStore prompt or background',()=>{
 const hook=readFileSync(new URL('../apps/mobile/security/useLocalAppLock.ts',import.meta.url),'utf8');
 assert.match(hook,/if\(authenticating\.current\|\|protectedNativePrompt\.current\|\|preferenceMutation\.current\|\|!active\.current\|\|appState\.current!=='active'\)return false;/);
});

function preferenceStore(initial=LOCAL_LOCK_ENABLED){
 const values=new Map([[LOCAL_LOCK_PREF_KEY,initial]]);
 const writes=[];
 return {
  values,writes,
  async setItem(key,value){writes.push(['set',key,value]); values.set(key,value);},
  async removeItem(key){writes.push(['remove',key]); values.delete(key);}
 };
}
const reloadOptOut=(store)=>parseLocalLockWithJournal(
 store.values.get(LOCAL_LOCK_PREF_KEY)??null,
 store.values.get(LOCAL_LOCK_OPTOUT_JOURNAL_KEY)??null
);

test('opt-out journal takes precedence over disabled preference across process restart',()=>{
 assert.equal(parseLocalLockWithJournal(LOCAL_LOCK_DISABLED,LOCAL_LOCK_OPTOUT_PENDING),true);
 assert.equal(parseLocalLockWithJournal(LOCAL_LOCK_DISABLE_PENDING,null),true);
 assert.equal(parseLocalLockWithJournal(LOCAL_LOCK_DISABLED,null),false);
 assert.equal(parseLocalLockWithJournal(null,null),false);
 assert.throws(()=>parseLocalLockWithJournal(LOCAL_LOCK_DISABLED,'corrupted'),/journal/);
});

test('successful opt-out commits by removing journal last',async()=>{
 const store=preferenceStore();
 assert.equal(await persistBiometricOptOut(store,()=>true),'disabled');
 assert.deepEqual(store.writes,[
  ['set',LOCAL_LOCK_OPTOUT_JOURNAL_KEY,LOCAL_LOCK_OPTOUT_PENDING],
  ['set',LOCAL_LOCK_PREF_KEY,LOCAL_LOCK_DISABLE_PENDING],
  ['set',LOCAL_LOCK_PREF_KEY,LOCAL_LOCK_DISABLED],
  ['remove',LOCAL_LOCK_OPTOUT_JOURNAL_KEY]
 ]);
 assert.equal(reloadOptOut(store),false);
});

test('interruption after journal or pending preference fails closed after restart',async()=>{
 for(const interruptedAt of [1,2]){
  const store=preferenceStore();
  let valid=true;
  const original=store.setItem.bind(store);
  store.setItem=async(key,value)=>{
   await original(key,value);
   if(store.writes.length===interruptedAt)valid=false;
  };
  assert.equal(await persistBiometricOptOut(store,()=>valid),'interrupted');
  assert.equal(reloadOptOut(store),true);
 }
});

test('interrupt during final disabled write rearms the journal and preference',async()=>{
 const store=preferenceStore();
 let valid=true;
 const original=store.setItem.bind(store);
 store.setItem=async(key,value)=>{
  await original(key,value);
  if(value===LOCAL_LOCK_DISABLED)valid=false;
 };
 assert.equal(await persistBiometricOptOut(store,()=>valid),'interrupted');
 assert.equal(store.values.get(LOCAL_LOCK_PREF_KEY),LOCAL_LOCK_ENABLED);
 assert.equal(reloadOptOut(store),true);
});

test('simulated process death at the final disabled write leaves journal locked',()=>{
 const store=preferenceStore();
 store.values.set(LOCAL_LOCK_OPTOUT_JOURNAL_KEY,LOCAL_LOCK_OPTOUT_PENDING);
 store.values.set(LOCAL_LOCK_PREF_KEY,LOCAL_LOCK_DISABLED);
 assert.equal(reloadOptOut(store),true);
});

test('failed final write attempts to re-arm, even if backend persisted it',async()=>{
 const store=preferenceStore();
 const original=store.setItem.bind(store);
 store.setItem=async(key,value)=>{
  await original(key,value);
  if(key===LOCAL_LOCK_PREF_KEY&&value===LOCAL_LOCK_DISABLED)
   throw new Error('reported write failure after disk commit');
 };
 assert.equal(await persistBiometricOptOut(store,()=>true),'interrupted');
 assert.equal(reloadOptOut(store),true);
});

test('failed final journal removal attempts recovery and retains locked state',async()=>{
 const store=preferenceStore();
 const original=store.removeItem.bind(store);
 store.removeItem=async(key)=>{
  await original(key);
  throw new Error('reported deletion failure after disk commit');
 };
 assert.equal(await persistBiometricOptOut(store,()=>true),'interrupted');
 assert.equal(reloadOptOut(store),true);
});

test('unrecoverable journal writes fail rather than claiming opt-out success',async()=>{
 const store=preferenceStore();
 store.setItem=async()=>{throw new Error('storage unavailable');};
 assert.equal(await persistBiometricOptOut(store,()=>true),'failed');
 assert.equal(reloadOptOut(store),true);
});

test('opt-out uses a pending state instead of deleting legacy preference',()=>{
 const hook=readFileSync(new URL('../apps/mobile/security/useLocalAppLock.ts',import.meta.url),'utf8');
 assert.match(hook,/await persistBiometricOptOut\(AsyncStorage,valid\)/);
 assert.doesNotMatch(hook,/removeItem\(LOCAL_LOCK_PREF_KEY\)/);
});

test('preference writes serialize against further biometrics and SecureStore probes',()=>{
 const hook=readFileSync(new URL('../apps/mobile/security/useLocalAppLock.ts',import.meta.url),'utf8');
 assert.match(hook,/const preferenceMutation=useRef\(false\)/);
 assert.match(hook,/if\(preferenceMutation\.current\)return;\s*preferenceMutation\.current=true;/);
 assert.match(hook,/if\(!active\.current\|\|protectedNativePrompt\.current\|\|authenticating\.current\|\|preferenceMutation\.current\|\|appState\.current!=='active'\)/);
 assert.equal((hook.match(/preferenceMutation\.current=false;/g)||[]).length,2);
});

test('hook checks both persisted lock state and journal before showing the UI',()=>{
 const hook=readFileSync(new URL('../apps/mobile/security/useLocalAppLock.ts',import.meta.url),'utf8');
 assert.match(hook,/AsyncStorage\.getItem\(LOCAL_LOCK_OPTOUT_JOURNAL_KEY\)/);
 assert.match(hook,/parseLocalLockWithJournal\(saved,journal\)/);
 assert.match(hook,/const load=useCallback\(async\(\)=>\{\s*if\(preferenceMutation\.current\)return;/);
});

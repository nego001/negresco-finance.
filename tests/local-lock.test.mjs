import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 LOCAL_LOCK_PREF_KEY,parseLocalLockPreference,isStrongBiometryAvailable,
 canFinishAuthentication,shouldCoverAndLockOnState,shouldInvalidateLocalSession
} from '../apps/mobile/security/localLockPolicy.ts';

test('existing devices have opt-in UI lock disabled by default',()=>{
 assert.equal(LOCAL_LOCK_PREF_KEY,'negresco.local_lock.v1');
 assert.equal(parseLocalLockPreference(null),false);
 assert.equal(parseLocalLockPreference('enabled'),true);
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
 assert.match(hook,/await AsyncStorage\.removeItem\(LOCAL_LOCK_PREF_KEY\)/);
 assert.match(hook,/if\(active\.current&&canFinishAuthentication\(true,ticket,epoch\.current,appState\.current\)\)setStatus\('off'\)/);
});

test('stale preference reads fail closed rather than resetting lock to off',()=>{
 const hook=readFileSync(new URL('../apps/mobile/security/useLocalAppLock.ts',import.meta.url),'utf8');
 assert.match(hook,/if\(attemptEpoch!==epoch\.current\)\{[\s\S]*?setStatus\(prev=>prev==='loading'\?'error':prev\)/);
 assert.match(hook,/setStatus\(enabled\?'locked':'off'\)/);
 assert.doesNotMatch(hook,/setStatus\(enabled\?'locked':'off'\);\s*if\(attemptEpoch!==epoch\.current/);
});

test('overlapping preference retries are versioned and stale failures ignored',()=>{
 const hook=readFileSync(new URL('../apps/mobile/security/useLocalAppLock.ts',import.meta.url),'utf8');
 assert.match(hook,/const attemptEpoch=\+\+epoch\.current;/);
 assert.match(hook,/if\(active\.current&&attemptEpoch===epoch\.current\)\{/);
});

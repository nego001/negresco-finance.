import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('expiry time is persisted, bounded and verified inside consumption transaction',()=>{
 const src=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticEnrollmentInviteDataStoreLab.kt');
 assert.match(src,/MAX_INVITE_LIFETIME_MS: Long = 5L \* 60L \* 1000L/);
 assert.match(src,/val issuedAt = longPreferencesKey/);
 assert.match(src,/val expiresAt = longPreferencesKey/);
 assert.match(src,/labClockMillis: \(\) -> Long/);
 assert.match(src,/issuedAt > Long\.MAX_VALUE - MAX_INVITE_LIFETIME_MS/);
 assert.match(src,/expiresAt != issuedAt \+ MAX_INVITE_LIFETIME_MS/);
 assert.match(src,/if \(now < view\.issuedAtMillis\) throw InvalidSyntheticInviteClock\(\)/);
 assert.match(src,/if \(now >= view\.expiresAtMillis\)/);
 assert.match(src,/SyntheticInviteStatus\.EXPIRED\.name/);
 assert.match(src,/remove\(SyntheticInviteKeys\.pendingNonce\)/);
 assert.match(src,/if \(terminal\.status == SyntheticInviteStatus\.EXPIRED\) throw StaleSyntheticInvite\(\)/);
});

test('expired invitation tombstone is tested across JVM file and Android DataStore reopen',()=>{
 const tests=read('tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/SyntheticEnrollmentInviteDataStoreLabTest.kt');
 const android=read('tooling/native-lock-android-lab/src/androidTest/kotlin/com/negresco/finance/security/NativeLockDataStoreInstrumentedTest.kt');
 assert.match(tests,/PASS: 25 durable invite, expiry and tombstone scenarios/);
 assert.match(tests,/negresco-expired-reopen-/);
 assert.match(tests,/InvalidSyntheticInviteClock/);
 assert.match(tests,/invite\.expiresAtMillis - 1L/);
 assert.match(android,/expiredDualSignedInvitePersistsTerminalTombstoneAfterAndroidReopen/);
 assert.equal((android.match(/@Test fun /g)||[]).length,17);
});

test('fixture clock is not misrepresented as authenticated time or native enrollment',()=>{
 const src=read('tooling/native-lock-spike/src/main/kotlin/com/negresco/finance/security/SyntheticEnrollmentInviteDataStoreLab.kt');
 const app=read('apps/mobile/package.json');
 assert.match(src,/NOT anti-rollback storage/);
 assert.match(src,/UNAUTHENTICATED TEST FIXTURES/);
 assert.match(src,/Real expiry requires/);
 assert.match(src,/Neither state grants new-device trust/);
 assert.doesNotMatch(app,/SyntheticEnrollmentInviteDataStoreLab|native-lock-spike/);
});

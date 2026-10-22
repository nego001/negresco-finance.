import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const fixture = 'tooling/native-lock-spike/src/test/kotlin/com/negresco/finance/security/';
const code = read(fixture + 'SyntheticPersistentIndependentFloorFixtureLab.kt');
const cases = read(fixture + 'SyntheticJdbcPersistentFloorRollbackLabTest.kt');
const runner = read(fixture + 'SyntheticJdbcRekeyCasPersistenceLabTest.kt');

test('SEC-05K persistent independent JVM fixture uses bounded nofollow and synced atomic writes', () => {
  assert.match(code, /FileChannel\.open\(p, StandardOpenOption\.READ, nofollow\)/);
  assert.match(code, /require\(ch\.size\(\) == n\)/);
  assert.match(code, /ch\.force\(true\)/);
  assert.match(code, /StandardCopyOption\.ATOMIC_MOVE/);
  assert.match(code, /FileChannel\.open\(p\.parent, StandardOpenOption\.READ\)/);
  assert.match(code, /channel\.tryLock\(\)/);
  assert.match(code, /write\(identity, identityMagic\)/);
  assert.match(code, /write\(enrolled, enrolledMagic\)/);
  assert.match(code, /verifyState\(stateFile, pair\.public\)/);
  assert.match(code, /verify\.verify\(sig\)/);
  assert.match(code, /DENY_STORAGE/);
  assert.match(code, /Private signing key is stored in CLEAR/);
  assert.doesNotMatch(code, /DriverManager|NEGRESCO_LAB_PG_URL|SQLCipher/);
});

test('SEC-05K restart tests distinguish PostgreSQL-only rollback from signed witness replay', () => {
  assert.match(cases, /runSyntheticJdbcPersistentFloorRollbackScenarios\(\)/);
  assert.match(cases, /NEW floor survives process shutdown and restart/);
  assert.match(cases, /PostgreSQL currently shows OLD without receipt/);
  assert.match(cases, /NEW signature still valid after both authority restart and PG rollback/);
  assert.match(cases, /truncated signed floor fails closed/);
  assert.match(cases, /enrollment latch rejects missing floor\.state/);
  assert.match(cases, /KNOWN LIMIT: old signed authority state can itself be replayed/);
  assert.match(cases, /HOLD_EXTERNAL_AUTHORITY_REQUIRED/);
  assert.match(runner, /runSyntheticJdbcPersistentFloorRollbackScenarios\(\)/);
});

test('SEC-05K fixture stays out of the Expo APK and documents unresolved trust', () => {
  const doc = read('docs/security/SEC_05K_DURABLE_REKEY_JOURNAL_LAB.md');
  const pkg = read('apps/mobile/package.json');
  assert.match(doc, /persistência independente entre reinícios/i);
  assert.match(doc, /rollback da própria autoridade/i);
  assert.match(doc, /BLOQUEADO/);
  assert.doesNotMatch(pkg, /SyntheticPersistentIndependentFloorFixtureLab/);
  assert.doesNotMatch(pkg, /SyntheticJdbcPersistentFloorRollbackLabTest/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectNativeFinanceReadiness} from '../apps/mobile/security/nativeFinanceReadiness.ts';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function alwaysDenied(result) {
  assert.equal(result.financialStorageAllowed, false);
  assert.equal(result.keyReleaseAllowed, false);
  assert.equal(result.migrationAllowed, false);
  assert.equal(Object.isFrozen(result), true);
}

test('Fase 1 native integration diagnostics are read-only and reject missing Android module', async () => {
  const absent = [undefined, null, {}, {getIntegrationInfo: null}, {getIntegrationInfo: true}];
  for (const host of absent) {
    const result = await inspectNativeFinanceReadiness('android', host);
    assert.equal(result.status, 'native-module-absent');
    assert.match(result.message, /não integrada/i);
    alwaysDenied(result);
  }
});

test('no Android native finance probe runs on another platform', async () => {
  let invoked = 0;
  for (const platform of ['ios', 'web', 'windows', 'linux', '', 'ANDROID']) {
    const result = await inspectNativeFinanceReadiness(platform, {
      getIntegrationInfo() { invoked++; throw Error('should not call'); },
    });
    assert.equal(result.status, 'unsupported-platform');
    alwaysDenied(result);
  }
  assert.equal(invoked, 0);
});

test('even a forged native ready claim cannot grant any financial operation', async () => {
  const results = [
    {ready: true, financialStorageAllowed: true, unlock: true, sqlcipher: 'ready'},
    {status: 'VERIFIED_LIVE_CURRENT', keyReleaseAllowed: true, migrationAllowed: true},
    {protocolVersion: 999, production: true, hardwareBacked: true},
    true,
    null,
    undefined,
  ];
  for (const claim of results) {
    const result = await inspectNativeFinanceReadiness('android', {
      getIntegrationInfo: async () => claim,
    });
    assert.equal(result.status, 'native-lab-only');
    assert.match(result.message, /BLOQUEADA/);
    alwaysDenied(result);
    assert.doesNotMatch(JSON.stringify(result), /VERIFIED_LIVE_CURRENT|hardwareBacked|unlock/);
  }
});

test('synchronous or async native diagnostic errors always fail closed', async () => {
  for (const getIntegrationInfo of [
    () => { throw Error('private token'); },
    async () => { throw Error('unexpected sensitive details'); },
  ]) {
    const result = await inspectNativeFinanceReadiness('android', {getIntegrationInfo});
    assert.equal(result.status, 'native-diagnostic-error');
    assert.doesNotMatch(result.message, /private token|unexpected sensitive details/);
    alwaysDenied(result);
  }
});

test('read-only settings probe is manual, never wired into bank unlock or app startup', () => {
  const app = read('apps/mobile/App.tsx');
  const module = read('apps/mobile/security/nativeFinanceReadiness.ts');
  const expo = read('apps/mobile/app.json');
  assert.match(app, /onPress=\{checkNativeFinanceDiagnostic\}/);
  assert.match(app, /NativeModules\.NegrescoFinanceSecurityV1/);
  assert.match(app, /nativeFinanceDiagnosticEpoch\.current\+\+/);
  assert.match(app, /AppState\.currentState==='active'/);
  assert.match(app, /Segurança financeira nativa · integração pendente/);
  assert.match(app, /Este diagnóstico é somente leitura e nunca autoriza guardar dados financeiros/);
  assert.doesNotMatch(app, /useEffect\(\(\)=>\{\s*checkNativeFinanceDiagnostic/);
  assert.match(module, /financialStorageAllowed: false/);
  assert.match(module, /keyReleaseAllowed: false/);
  assert.match(module, /migrationAllowed: false/);
  assert.doesNotMatch(module, /openDatabase|createDatabase|grantAccess|CryptoObject|disableLock/);
  assert.doesNotMatch(expo, /native-lock-android-lab|sqlcipher-android-lab/);
});


test('host property access exceptions cannot escape diagnostic or expose secrets', async () => {
  const secret = 'synthetic-private-token-must-not-leak';
  const hostileHosts = [
    Object.defineProperty({}, 'getIntegrationInfo', {
      get() { throw Error(secret); }
    }),
    new Proxy({}, {
      get(_target, key) {
        if (key === 'getIntegrationInfo') throw Error(secret);
        return undefined;
      },
    }),
  ];
  for (const host of hostileHosts) {
    const result = await inspectNativeFinanceReadiness('android', host);
    assert.equal(result.status, 'native-diagnostic-error');
    assert.doesNotMatch(result.message, /synthetic-private-token/);
    alwaysDenied(result);
  }
});

test('native diagnostic that never responds times out and stays blocked', async () => {
  const never = new Promise(() => {});
  const started = Date.now();
  const result = await inspectNativeFinanceReadiness(
    'android', {getIntegrationInfo: () => never}, 10
  );
  assert.equal(result.status, 'native-diagnostic-error');
  assert.match(result.message, /tempo esgotado/i);
  assert.ok(Date.now() - started < 2000, 'manual diagnostic must not hang indefinitely');
  alwaysDenied(result);
});

test('delayed success after timeout cannot enable financial storage', async () => {
  let resolveRequest;
  const response = new Promise(resolve => { resolveRequest = resolve; });
  const result = await inspectNativeFinanceReadiness(
    'android', {getIntegrationInfo: () => response}, 10
  );
  assert.equal(result.status, 'native-diagnostic-error');
  alwaysDenied(result);
  resolveRequest({ready:true, financialStorageAllowed:true, keyReleaseAllowed:true});
  await Promise.resolve();
  assert.equal(result.financialStorageAllowed, false);
  assert.equal(result.keyReleaseAllowed, false);
  assert.equal(result.migrationAllowed, false);
});

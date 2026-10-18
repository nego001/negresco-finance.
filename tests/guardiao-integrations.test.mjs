import test from 'node:test';
import assert from 'node:assert/strict';
import {canMonitorBank,bankMonitoring,reclameAqui,availabilityMessage} from '../apps/mobile/guardiao/integrations.ts';
test('bank monitor is disabled by default',()=>{assert.equal(canMonitorBank(bankMonitoring,new Date().toISOString()),false);assert.equal(bankMonitoring.status,'not-connected');});
test('monitor requires provider, consent and unexpired authorization',()=>{
 const now='2026-10-18T12:00:00Z';
 assert.equal(canMonitorBank({status:'connected',provider:'Banco',consentId:'abc',expiresAt:'2026-10-19T12:00:00Z'},now),true);
 assert.equal(canMonitorBank({status:'connected',provider:'Banco',expiresAt:'2026-10-19T12:00:00Z'},now),false);
 assert.equal(canMonitorBank({status:'connected',provider:'Banco',consentId:'abc',expiresAt:'2026-10-17T12:00:00Z'},now),false);
});
test('reputation never claims data was retrieved',()=>{assert.equal(reclameAqui.status,'not-connected');assert.match(availabilityMessage(reclameAqui),/Nenhum dado externo foi consultado/);});

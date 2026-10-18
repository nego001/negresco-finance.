import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectBoleto} from '../apps/mobile/guardiao/validator.ts';

test('rejects empty, malformed and oversized boleto input',()=>{
 for(const input of ['', '123', 'abc', '1'.repeat(81), '1'.repeat(46), '1'.repeat(49), '123/456']){
  assert.equal(inspectBoleto(input).valid,false);
 }
});
test('rejects invalid banking and arrecadacao checksums',()=>{
 assert.equal(inspectBoleto('0'.repeat(47)).valid,false);
 assert.equal(inspectBoleto('8'+'0'.repeat(47)).valid,false);
 assert.equal(inspectBoleto('1'.repeat(48)).valid,false);
});
test('accepts spaces and punctuation without mistaking it for authenticity',()=>{
 const result=inspectBoleto('00000.00000 00000.000000 00000.000000 0 00000000000000');
 assert.equal(result.digits,47);
 assert.equal(result.valid,false);
 assert.match(result.explanation,/inconsistência|inconsistências|Confira/i);
});
test('never claims to authenticate beneficiary or payment',()=>{
 const result=inspectBoleto('0'.repeat(47));
 assert.doesNotMatch(result.explanation,/100% seguro|autêntico|pagamento autorizado/i);
});

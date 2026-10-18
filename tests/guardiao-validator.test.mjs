import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectBoleto} from '../apps/mobile/guardiao/validator.ts';

// Independent test fixtures assembled from synthetic numeric fields.
// No personal information or real payment instructions are used.
function dv10(s){let sum=0,weight=2;for(let i=s.length-1;i>=0;i--){const p=Number(s[i])*weight;sum+=Math.floor(p/10)+p%10;weight=weight===2?1:2;}return (10-sum%10)%10;}
function dv11(s){let sum=0,weight=2;for(let i=s.length-1;i>=0;i--){sum+=Number(s[i])*weight;weight=weight===9?2:weight+1;}const r=11-sum%11;return r===0||r===10||r===11?1:r;}
function bankFixture(){
 const bank='2379', amountAndDate='000000000000000', free='1234567890123456789012345';
 const barcodeWithoutDv=bank+amountAndDate+free;
 const general=dv11(barcodeWithoutDv);
 const barcode=bank+general+amountAndDate+free;
 const a=barcode.slice(0,4)+barcode.slice(19,24);
 const b=barcode.slice(24,34), c=barcode.slice(34,44);
 return a+dv10(a)+b+dv10(b)+c+dv10(c)+barcode[4]+barcode.slice(5,19);
}
function arrecadacaoFixture(reference){
 const prefix='8'+ '1' +reference;
 const check=reference==='6'||reference==='7'?dv10:dv11;
 return Array.from({length:4},(_,i)=>{const part=(i===0?prefix:'')+'123456789012345678901234567890123456789012345'.slice(i*11+(i===0?3:0),i*11+11);return part+check(part);}).join('');
}
test('accepts synthetic banking line with consistent field and general checksums',()=>{
 const line=bankFixture();assert.equal(line.length,47);
 const result=inspectBoleto(line);assert.equal(result.valid,true);
 assert.match(result.explanation,/NÃO confirma/);
 const tampered=line.slice(0,9)+(Number(line[9])+1)%10+line.slice(10);
 assert.equal(inspectBoleto(tampered).valid,false);
});
test('accepts synthetic arrecadacao lines with mod10 and mod11 block checks',()=>{
 for(const reference of ['6','7','8','9']){
  const line=arrecadacaoFixture(reference);
  assert.equal(line.length,48);
  assert.equal(inspectBoleto(line).valid,true,reference);
  const tampered=line.slice(0,11)+(Number(line[11])+1)%10+line.slice(12);
  assert.equal(inspectBoleto(tampered).valid,false,reference);
 }
});
test('rejects invalid, malformed, or oversized input',()=>{
 for(const input of ['', '123', 'abc', '1'.repeat(81), '1'.repeat(46), '1'.repeat(49), '123/456']){
  assert.equal(inspectBoleto(input).valid,false);
 }
});
test('rejects invalid format and checksum samples',()=>{
 assert.equal(inspectBoleto('0'.repeat(47)).valid,false);
 assert.equal(inspectBoleto('8'+'0'.repeat(47)).valid,false);
 assert.equal(inspectBoleto('1'.repeat(48)).valid,false);
});
test('permits normal formatting and never claims ownership',()=>{
 const line=bankFixture();const formatted=line.slice(0,10)+'.'+line.slice(10,21)+' '+line.slice(21);
 const result=inspectBoleto(formatted);
 assert.equal(result.valid,true);
 assert.doesNotMatch(result.explanation,/100% seguro|pagamento autorizado|beneficiário confirmado/i);
});

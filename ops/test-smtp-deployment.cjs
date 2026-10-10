const test = require('node:test');
const assert = require('node:assert/strict');
const {smtpTransferConfig} = require('./contabo/stage-smtp.cjs');
const fake = {SMTP_HOST:'smtp.gmail.com',SMTP_USER:'calebluna41@gmail.com',SMTP_PASS:'a'.repeat(16),SMTP_PORT:'587'};
test('only Gmail SMTP fields cross the deployment boundary; sender matches the authenticated account',()=>{
  const exported = smtpTransferConfig({...fake,DATABASE_URL:'private',JWT_SECRET:'private',EMAIL_DEV_LOG:'true',EMAIL_FROM:'Unverified <spoof@example.invalid>'});
  assert.deepEqual(Object.keys(exported),['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','EMAIL_FROM']);
  assert.equal(exported.EMAIL_FROM,'JUNTO <calebluna41@gmail.com>');
  assert.equal(smtpTransferConfig({...fake,SMTP_PASS:'aaaa aaaa aaaa aaaa'}).SMTP_PASS,'a'.repeat(16));
});
test('unknown destinations, plain SMTP ports, accounts and malformed application passwords are rejected',()=>{
  assert.throws(()=>smtpTransferConfig({...fake,SMTP_HOST:'other.example.invalid'}));
  assert.throws(()=>smtpTransferConfig({...fake,SMTP_PORT:'25'}));
  assert.throws(()=>smtpTransferConfig({...fake,SMTP_USER:'not-authorized@example.invalid'}));
  assert.throws(()=>smtpTransferConfig({...fake,SMTP_PASS:'invalid'}));
});

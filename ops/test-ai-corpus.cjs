const {test} = require('node:test');
const assert = require('node:assert/strict');
require('ts-node').register({transpileOnly:true, compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {allocateByWeights, allocateExact, allocatePercentages} = require('../apps/api/src/domain/money.ts');
const corpus = require('../ai/seed-cases.json');

test('JUNTO seed corpus is fictional, versioned and has a separate evaluation split', () => {
  assert.equal(corpus.synthetic, true); assert.equal(corpus.unit, 'integer_cents');
  assert.equal(corpus.currency, 'PEN'); assert.equal(corpus.version, 1);
  assert.equal(new Set(corpus.cases.map(c => c.id)).size, corpus.cases.length);
  assert.equal(new Set(corpus.cases.map(c => c.text)).size, corpus.cases.length);
  assert.ok(corpus.cases.some(c => c.split === 'train'));
  assert.ok(corpus.cases.some(c => c.split === 'evaluation'));
  for (const c of corpus.cases) {
    assert.ok(['train','evaluation'].includes(c.split));
    assert.ok(['propose','clarify','explain'].includes(c.expected.action));
    assert.equal(new Set(c.members).size, c.members.length);
    assert.ok(!c.text.includes('@'), 'No private email addresses in examples');
  }
});

for (const c of corpus.cases) test(`Golden financial label: ${c.id} (not an LLM test)`, () => {
  const e = c.expected;
  if (e.action === 'propose') {
    assert.equal(e.confirmationRequired, true); assert.ok(c.members.includes(e.payer));
    assert.equal(e.weights.length, c.members.length); assert.equal(e.shares.length, c.members.length);
    const inputs = c.members.map((usuarioId,i) => ({usuarioId,weight:e.weights[i]}));
    const result = e.allocation === 'exact'
      ? allocateExact(e.total, inputs.map(i => ({usuarioId:i.usuarioId,monto:i.weight})))
      : e.allocation === 'percentage'
        ? allocatePercentages(e.total, inputs.map(i => ({usuarioId:i.usuarioId,porcentaje:i.weight})))
        : allocateByWeights(e.total, inputs);
    assert.deepEqual(result.map(r => r.montoAsignado), e.shares);
    assert.equal(e.shares.reduce((sum,n)=>sum+n,0), e.total);
    for (const amount of e.shares) assert.ok(Number.isSafeInteger(amount) && amount >= 0);
  } else {
    assert.equal(e.maySave, false);
    if (e.action === 'explain') {
      // Pending declarations are not part of the confirmed settlement ledger.
      assert.equal(e.net, e.ownPaid - e.ownShare + e.confirmedSent - e.confirmedReceived);
    } else {
      assert.ok(e.question.length > 10);
      if (e.assigned) {
        assert.equal(e.receiptTotal-e.assigned.reduce((sum,n)=>sum+n,0), e.difference);
        assert.throws(()=>allocateExact(e.receiptTotal,e.assigned.map((monto,i)=>({usuarioId:c.members[i],monto}))));
      } else assert.ok(e.missing.length > 0);
    }
  }
});

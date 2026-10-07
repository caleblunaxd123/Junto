import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExpenseExplanation,
  extractExplicitAmountCents,
  extractLikelyAmountCents,
  findMentionedMemberIds,
  inferExpenseDescription,
  inferExpenseCategory,
  inferPayerId,
  isFirstPersonPayer,
  matchMemberId,
  normalizePersonName,
} from './aiExpense';

const members = [
  { id: '1', nombre: 'Caleb Luna' },
  { id: '2', nombre: 'Ana María' },
  { id: '3', nombre: 'Luis Pérez' },
];

test('normalizes accents and punctuation', () => {
  assert.equal(normalizePersonName('  Ana María! '), 'ana maria');
});

test('matches a unique first name', () => {
  assert.equal(matchMemberId('Ana', members, '1'), '2');
});

test('maps first-person words to the authenticated user', () => {
  assert.equal(matchMemberId('yo', members, '1'), '1');
});

test('does not guess when a first name is ambiguous', () => {
  assert.equal(
    matchMemberId('Ana', [...members, { id: '4', nombre: 'Ana Torres' }], '1'),
    null
  );
});

test('extracts exact PEN amounts instead of trusting model arithmetic', () => {
  assert.equal(extractExplicitAmountCents('Pagué S/80 por una cena'), 8000);
  assert.equal(extractExplicitAmountCents('Hotel: S/ 1,250.50'), 125050);
  assert.equal(extractExplicitAmountCents('Taxi 18,90 soles'), 1890);
  assert.equal(extractExplicitAmountCents('Cena para 3 personas'), null);
  assert.equal(extractLikelyAmountCents('Pagué 80 por una cena'), 8000);
  assert.equal(extractLikelyAmountCents('Cena para 3 personas'), null);
});

test('uses unambiguous expense words to correct the model category', () => {
  assert.equal(inferExpenseCategory('Pagué una cena', 'alojamiento'), 'comida');
  assert.equal(inferExpenseCategory('Noche de hotel', 'otro'), 'alojamiento');
  assert.equal(inferExpenseCategory('Algo sin pista', 'compras'), 'compras');
});

test('builds the visible explanation from normalized factual data', () => {
  assert.equal(
    buildExpenseExplanation({
      concepto: 'Cena',
      totalCents: 8000,
      payerName: 'Usuario IA',
      participantNames: ['Usuario IA'],
    }),
    'JUNTO preparó S/ 80.00 para “Cena”. Pagó Usuario IA y se divide entre Usuario IA.'
  );
});

test('recognizes the common instant-entry signals without an LLM', () => {
  assert.equal(isFirstPersonPayer('Pagué S/ 80 por la cena'), true);
  assert.equal(inferPayerId('Ana pagó S/ 80 por la cena', members, '1'), '2');
  assert.equal(inferExpenseDescription('Pagué la cena', 'comida'), 'Cena');
  assert.deepEqual(
    findMentionedMemberIds('Cena con Ana y Luis', members),
    ['2', '3']
  );
});

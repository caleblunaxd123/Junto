import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSpanishAmountCents} from './spanishMoney';
test('Exact written soles, not model arithmetic',()=>{
  for (const [text, expected] of [
    ['Ana pagó ciento veinte soles',12000], ['Pagué dieciséis soles',1600],
    ['Son treinta y cinco soles',3500], ['Hotel de dos mil ciento veinte soles',212000],
    ['Cien soles',10000], ['Veintitrés soles con cincuenta céntimos',2350],
    ['Cero soles con un centavo',1], ['Mil soles',100000],
  ] as const) assert.equal(extractSpanishAmountCents(text),expected,text);
});
test('Unsupported or ambiguous money asks for clarification instead of guessing',()=>{
  for (const text of ['Cena para tres', 'Cien veinte soles','Veinte treinta soles','Ciento soles',
    'Veinte soles y treinta soles','Veinte soles con cien centavos','Veinte soles con propina',
    'Cero soles','Dos mil mil soles']) assert.equal(extractSpanishAmountCents(text),null,text);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarToday, dueOccurrences, isCalendarDay, nextOccurrence, occurrenceOnOrAfter } from './recurrence';

test('monthly on the 31st: last day of short months, back to the 31st afterwards', () => {
  const days: string[] = ['2026-01-31'];
  for (let i = 0; i < 4; i++) days.push(nextOccurrence(days[days.length - 1], 'mensual', 31));
  assert.deepEqual(days, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  assert.equal(nextOccurrence('2028-01-30', 'mensual', 30), '2028-02-29', 'leap year');
  assert.equal(nextOccurrence('2026-12-05', 'mensual', 5), '2027-01-05', 'year change');
});

test('weekly and every 15 days', () => {
  assert.equal(nextOccurrence('2026-10-15', 'semanal'), '2026-10-22');
  assert.equal(nextOccurrence('2026-12-28', 'semanal'), '2027-01-04');
  assert.equal(nextOccurrence('2026-10-15', 'quincenal'), '2026-10-30');
  assert.equal(nextOccurrence('2026-12-28', 'quincenal'), '2027-01-12');
});

test('seeking distant occurrences preserves the schedule and short-month anchor', () => {
  for (const frequency of ['mensual', 'quincenal', 'semanal'] as const) {
    let expected = '2020-01-31';
    while (expected < '2028-02-28') expected = nextOccurrence(expected, frequency, 31);
    assert.equal(occurrenceOnOrAfter('2020-01-31', '2028-02-28', frequency, 31), expected);
  }
  assert.equal(occurrenceOnOrAfter('2026-10-31', '2026-10-01', 'mensual', 31), '2026-10-31');
});

test('catch-up after the server was off: every missed occurrence once, capped', () => {
  assert.deepEqual(dueOccurrences('2026-08-01', '2026-10-15', 'mensual', 1), { due: ['2026-08-01', '2026-09-01', '2026-10-01'], next: '2026-11-01' });
  assert.deepEqual(dueOccurrences('2026-10-16', '2026-10-15', 'mensual', 16), { due: [], next: '2026-10-16' }, 'nothing before its day');
  assert.equal(dueOccurrences('2026-01-01', '2026-12-31', 'semanal', null, 6).due.length, 6);
});

test('calendar days and Lima\'s today', () => {
  assert.ok(isCalendarDay('2026-02-28'));
  assert.ok(!isCalendarDay('2026-02-30'));
  assert.ok(!isCalendarDay('2026-2-3'));
  // 00:30 UTC on Oct 15 is still Oct 14 in Lima.
  assert.equal(calendarToday('America/Lima', new Date('2026-10-15T00:30:00Z')), '2026-10-14');
});

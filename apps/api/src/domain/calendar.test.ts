import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startOfCalendarDay, followingCalendarDay } from './calendar';
test('calendar search boundaries match local dates and 23/25-hour DST days', () => {
  assert.equal(startOfCalendarDay('2026-10-14', 'America/Lima').toISOString(), '2026-10-14T05:00:00.000Z');
  assert.equal(startOfCalendarDay('2026-10-14', 'UTC').toISOString(), '2026-10-14T00:00:00.000Z');
  const duration = (day: string) => (startOfCalendarDay(followingCalendarDay(day), 'Europe/Berlin').getTime() - startOfCalendarDay(day, 'Europe/Berlin').getTime()) / 3600000;
  assert.equal(duration('2026-03-29'), 23);
  assert.equal(duration('2026-10-25'), 25);
  assert.equal(followingCalendarDay('2026-12-31'), '2027-01-01');
});

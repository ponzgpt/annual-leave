import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDoc, tally, paint, monthWeeks, yearMonths } from '../public/leave.js';

test('tally splits taken/booked, counts half days, skips weekends and bank holidays', () => {
  const doc = defaultDoc();
  Object.assign(doc.days, {
    '2026-10-01': { t: 'al' }, '2026-10-02': { t: 'al', half: true },
    '2026-10-03': { t: 'al' }, // Saturday: ignored
    '2026-11-23': { t: 'al' }, '2026-11-24': { t: 'toil' },
    '2027-05-03': { t: 'al' }, // next leave year: ignored
  });
  doc.toil.push({ date: '2026-09-28', hours: 8 }, { date: '2026-10-04', hours: 4 });
  const t = tally(doc, '2026-10-05');
  assert.deepEqual(t.al, { allowance: 33, taken: 1.5, booked: 1, left: 30.5 });
  assert.deepEqual(t.toil, { hours: 12, allowance: 1.5, taken: 0, booked: 1, left: 0.5 });
  assert.equal(t.bh.taken + t.bh.booked, 10);
});

test('paint cycles full → half → clear, and erase clears', () => {
  assert.deepEqual(paint(null, 'al'), { t: 'al' });
  assert.deepEqual(paint({ t: 'al' }, 'al'), { t: 'al', half: true });
  assert.equal(paint({ t: 'al', half: true }, 'al'), null);
  assert.deepEqual(paint({ t: 'al' }, 'study'), { t: 'study' });
  assert.equal(paint({ t: 'al' }, 'erase'), null);
});

test('calendar grid starts on Monday and covers Apr–Mar', () => {
  assert.deepEqual(monthWeeks('2026-10')[0], [null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  const m = yearMonths('2026-04-01');
  assert.equal(m[0], '2026-04'); assert.equal(m[11], '2027-03');
});

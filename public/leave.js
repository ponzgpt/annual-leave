// Leave maths shared by the browser and the tests. Dates are ISO "YYYY-MM-DD" strings.

export const TYPES = {
  al: 'Annual leave',
  toil: 'Time off in lieu',
  study: 'Study leave',
  sick: 'Sick / other',
  bh: 'Bank holiday',
};

// NHS Grampian 2026/27 public holidays (communitypharmacy.scot.nhs.uk). Good Friday 2027 is assumed as the 10th.
export const GRAMPIAN_2026_27 = [
  '2026-04-06', '2026-05-04', '2026-06-15', '2026-07-13', '2026-09-28',
  '2026-12-25', '2026-12-28', '2027-01-01', '2027-01-04', '2027-03-26',
];

export function defaultDoc() {
  return {
    settings: { name: '', role: '', yearStart: '2026-04-01', allowance: 33, carryOver: 0, hoursPerDay: 8, studyAllowance: 10 },
    days: Object.fromEntries(GRAMPIAN_2026_27.map(d => [d, { t: 'bh' }])),
    toil: [],
    view: { mode: 'year', month: '2026-10', orient: 'landscape', layout: 'year' },
  };
}

const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const iso = dt => dt.toISOString().slice(0, 10);
export const isWeekend = s => { const w = parse(s).getUTCDay(); return w === 0 || w === 6; };
export const addMonths = (ym, n) => { const d = parse(ym + '-01'); d.setUTCMonth(d.getUTCMonth() + n); return iso(d).slice(0, 7); };

export function yearRange(yearStart) {
  const end = parse(yearStart); end.setUTCFullYear(end.getUTCFullYear() + 1); end.setUTCDate(end.getUTCDate() - 1);
  return [yearStart, iso(end)];
}

export const yearMonths = yearStart => Array.from({ length: 12 }, (_, i) => addMonths(yearStart.slice(0, 7), i));

// Weeks of a month, Monday first; null pads the edges.
export function monthWeeks(ym) {
  const first = parse(ym + '-01');
  const pad = (first.getUTCDay() + 6) % 7;
  const cells = Array(pad).fill(null);
  for (const d = new Date(first); iso(d).slice(0, 7) === ym; d.setUTCDate(d.getUTCDate() + 1)) cells.push(iso(d));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

// Tap cycle with the current brush: empty/other → full day → half day → cleared.
export function paint(cur, brush) {
  if (brush === 'erase') return null;
  if (!cur || cur.t !== brush) return { t: brush };
  if (!cur.half && brush !== 'bh') return { t: brush, half: true };
  return null;
}

export function tally(doc, today) {
  const s = doc.settings;
  const [from, to] = yearRange(s.yearStart);
  const sum = { al: [0, 0], toil: [0, 0], study: [0, 0], sick: [0, 0], bh: [0, 0] }; // [taken, booked]
  for (const [date, v] of Object.entries(doc.days)) {
    if (date < from || date > to || isWeekend(date) || !sum[v.t]) continue;
    sum[v.t][date <= today ? 0 : 1] += v.half ? 0.5 : 1;
  }
  const hours = doc.toil.filter(e => e.date >= from && e.date <= to).reduce((a, e) => a + Number(e.hours || 0), 0);
  const total = Number(s.allowance) + Number(s.carryOver);
  const earned = Math.round((hours / Number(s.hoursPerDay)) * 100) / 100;
  const pack = (k, allowance) => ({ allowance, taken: sum[k][0], booked: sum[k][1], left: allowance - sum[k][0] - sum[k][1] });
  return {
    range: [from, to],
    al: pack('al', total),
    toil: { hours, ...pack('toil', earned) },
    study: pack('study', Number(s.studyAllowance)),
    sick: pack('sick', 0),
    bh: pack('bh', 0),
  };
}

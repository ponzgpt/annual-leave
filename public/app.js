import { TYPES, defaultDoc, tally, paint, monthWeeks, yearMonths, addMonths, isWeekend } from './leave.js';

const $ = s => document.querySelector(s);
const API = `/api/${location.pathname.split('/')[2]}`;
const BRUSHES = { ...TYPES, erase: 'Erase' };
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const fmt = n => (Math.round(n * 100) / 100).toLocaleString('en-GB');
const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? '' : 's'}`;
const todayIso = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const monthName = ym => new Date(ym + '-01T12:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const shortDate = s => new Date(s + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

let doc;
let loaded = false; // never overwrite server data with defaults after a failed load

// ---------- saving ----------
let timer;
function status(text, err) { const el = $('#status'); el.textContent = text; el.classList.toggle('err', !!err); }
function save() {
  if (!loaded) return;
  status('Saving…');
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const r = await fetch(API, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(doc) });
      if (!r.ok) throw new Error(r.status);
      status('Saved ✓');
    } catch { status('Not saved, retrying…', true); timer = setTimeout(save, 5000); }
  }, 400);
}
const change = () => { render(); save(); };

// ---------- rendering ----------
function cell(date, today) {
  if (!date) return '<span></span>';
  const v = doc.days[date];
  const cls = ['d', isWeekend(date) && 'wknd', date === today && 'today', v && `typed ${v.t}`, v?.half && 'half'].filter(Boolean).join(' ');
  const label = v ? `${TYPES[v.t]}${v.half ? ' (½)' : ''}` : '';
  const inner = `<span>${Number(date.slice(8))}</span><em>${v ? esc(v.half ? '½ ' + TYPES[v.t] : TYPES[v.t]) : ''}</em>`;
  return isWeekend(date)
    ? `<span class="${cls}">${inner}</span>`
    : `<button class="${cls}" data-d="${date}" title="${label}" aria-label="${shortDate(date)} ${label}">${inner}</button>`;
}

function monthHtml(ym, today) {
  const cells = monthWeeks(ym).flat().map(d => cell(d, today)).join('');
  return `<div class="month"><h3>${monthName(ym)}</h3><div class="grid">${DOW.map(d => `<span class="dow">${d}</span>`).join('')}${cells}</div></div>`;
}

function cards(t) {
  const pct = (n, of) => `${Math.max(0, Math.min(100, (n / (of || 1)) * 100))}%`;
  const card = (cls, title, big, unit, line, meter = '') =>
    `<div class="card ${big < 0 ? 'neg' : ''}"><div class="k ${cls}"><i class="dot"></i>${title}</div>
     <div class="big">${fmt(big)}<small>${unit}</small></div><div class="line">${line}</div>${meter}</div>`;
  const meter = (cls, x) =>
    `<div class="meter ${cls}"><i style="width:${pct(x.taken, x.allowance)};background:var(--c)"></i><i style="width:${pct(x.booked, x.allowance)};background:var(--c);opacity:.45"></i></div>`;
  return [
    card('al', 'Annual leave', t.al.left, 'days left to book',
      `${fmt(t.al.allowance)} total · ${fmt(t.al.taken)} taken · ${fmt(t.al.booked)} booked`, meter('al', t.al)),
    card('toil', 'Time off in lieu', t.toil.left, 'days available',
      `${fmt(t.toil.hours)} h worked = ${plural(t.toil.allowance, 'day')} · ${fmt(t.toil.taken + t.toil.booked)} used`, meter('toil', t.toil)),
    card('study', 'Study leave', t.study.left, 'days left',
      `${fmt(t.study.allowance)} / year · ${fmt(t.study.taken)} taken · ${fmt(t.study.booked)} booked`, meter('study', t.study)),
    card('sick', 'Sick / other', t.sick.taken + t.sick.booked, 'days',
      `${fmt(t.bh.taken + t.bh.booked)} bank holidays this year`),
  ].join('');
}

function render() {
  const today = todayIso();
  const t = tally(doc, today);
  const v = doc.view;
  const [from, to] = t.range;
  const { name, role } = doc.settings;
  const long = d => new Date(d + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  $('#range').textContent = `Annual leave ${from.slice(0, 4)}/${to.slice(2, 4)}`;
  $('#dates').textContent = `${long(from)} – ${long(to)}`;
  $('#name').textContent = name || 'Annual leave';
  $('#role').textContent = role;
  document.title = name ? `${name} · Annual leave` : 'Annual leave';
  $('#tally').innerHTML = cards(t);
  $('#brushes').innerHTML = Object.entries(BRUSHES).map(([k, label]) =>
    `<button class="chip ${k}" role="radio" aria-checked="${v.brush === k}" data-b="${k}"><i class="dot"></i>${label}</button>`).join('');
  document.body.classList.toggle('mode-month', v.mode === 'month');
  document.querySelectorAll('#modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === v.mode));
  $('#mtitle').textContent = monthName(v.month);
  $('#cal').innerHTML = v.mode === 'month'
    ? `<div class="big">${monthHtml(v.month, today)}</div>`
    : yearMonths(doc.settings.yearStart).map(m => monthHtml(m, today)).join('');
  $('#hpd').textContent = doc.settings.hoursPerDay;
  $('#toilList').innerHTML = [...doc.toil].sort((a, b) => b.date.localeCompare(a.date)).map(e =>
    `<li><span>${shortDate(e.date)}</span><span>+${fmt(e.hours)} h</span><span>${esc(e.note || '')}</span><button data-del="${e.id}" aria-label="Delete">×</button></li>`).join('')
    || '<li><span>Nothing logged yet.</span></li>';
  $('#pLayout').value = v.layout; $('#pOrient').value = v.orient;
  document.querySelectorAll('#settings [data-k]').forEach(i => { if (document.activeElement !== i) i.value = doc.settings[i.dataset.k]; });
}

// ---------- printing ----------
function printNow() {
  const today = todayIso();
  const t = tally(doc, today);
  const { layout, orient } = doc.view;
  $('#page-size').textContent = `@page { size: A4 ${orient}; margin: 10mm; }`;
  const head = sub => `<div class="phead"><h2>${esc(doc.settings.name ? doc.settings.name + ' · ' : '')}Annual leave ${t.range[0].slice(0, 4)}/${t.range[1].slice(2, 4)}${sub ? ' · ' + sub : ''}</h2>
    <div class="legend">${Object.entries(TYPES).map(([k, l]) => `<span class="${k}"><i class="dot"></i>${l}</span>`).join('')}</div></div>
    <p class="psum">Annual leave ${fmt(t.al.allowance)}: ${fmt(t.al.taken)} taken, ${fmt(t.al.booked)} booked, <b>${fmt(t.al.left)} left</b> ·
    In lieu: ${fmt(t.toil.hours)} h = ${fmt(t.toil.allowance)} d, ${fmt(t.toil.left)} left · Study: ${fmt(t.study.left)} of ${fmt(t.study.allowance)} left ·
    Sick/other: ${fmt(t.sick.taken + t.sick.booked)} · Printed ${shortDate(today)}</p>`;
  const page = m => `<div class="ppage big">${head(monthName(m))}${monthHtml(m, '')}</div>`;
  $('#print').className = `print ${orient}`;
  $('#print').innerHTML =
    layout === 'year' ? `${head()}<div class="pyear ${orient}">${yearMonths(doc.settings.yearStart).map(m => monthHtml(m, '')).join('')}</div>`
    : layout === 'months' ? yearMonths(doc.settings.yearStart).map(page).join('')
    : page(doc.view.month);
  window.print();
}

// ---------- events ----------
$('#cal').addEventListener('click', e => {
  const d = e.target.closest('[data-d]')?.dataset.d;
  if (!d) return;
  const next = paint(doc.days[d], doc.view.brush);
  if (next) doc.days[d] = next; else delete doc.days[d];
  change();
});
$('#brushes').addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (b) { doc.view.brush = b.dataset.b; change(); } });
$('#modes').addEventListener('click', e => { const m = e.target.dataset.mode; if (m) { doc.view.mode = m; change(); } });
$('#prev').onclick = () => { doc.view.month = addMonths(doc.view.month, -1); change(); };
$('#next').onclick = () => { doc.view.month = addMonths(doc.view.month, 1); change(); };

$('#toilForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target);
  doc.toil.push({ id: crypto.randomUUID(), date: f.get('date'), hours: Number(f.get('hours')), note: f.get('note').trim() });
  e.target.hours.value = ''; e.target.note.value = '';
  change();
});
$('#bhWorked').onclick = () => {
  const f = $('#toilForm');
  doc.toil.push({ id: crypto.randomUUID(), date: f.date.value || todayIso(), hours: Number(doc.settings.hoursPerDay), note: 'Bank holiday worked' });
  change();
};
$('#toilList').addEventListener('click', e => {
  const id = e.target.dataset.del;
  if (id && confirm('Delete this entry?')) { doc.toil = doc.toil.filter(x => x.id !== id); change(); }
});

$('#settings').addEventListener('change', e => {
  const k = e.target.dataset.k;
  if (!k) return;
  const text = k === 'name' || k === 'role';
  if (!text && !e.target.value) return;
  doc.settings[k] = text ? e.target.value.trim() : k === 'yearStart' ? e.target.value : Number(e.target.value);
  change();
});
$('#pLayout').onchange = e => { doc.view.layout = e.target.value; save(); };
$('#pOrient').onchange = e => { doc.view.orient = e.target.value; save(); };
$('#printBtn').onclick = () => { $('#printDlg').close(); printNow(); };

// Banner tools open as native dialogs; tapping the backdrop closes them.
document.querySelectorAll('[data-open]').forEach(b => { b.onclick = () => $('#' + b.dataset.open).showModal(); });
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => {
  if (e.target === d || e.target.closest('[data-close]')) d.close();
}));

$('#exportBtn').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
  a.download = `annual-leave-${todayIso()}.json`;
  a.click();
};
$('#importFile').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const next = JSON.parse(await file.text());
    if (!next.settings || !next.days) throw new Error();
    if (confirm('Replace everything with this backup?')) { doc = merge(next); change(); }
  } catch { alert('That file is not a backup from this app.'); }
  e.target.value = '';
};

// ---------- boot ----------
function merge(remote) {
  const d = defaultDoc();
  if (!remote) return { ...d, view: { ...d.view, brush: 'al', month: todayIso().slice(0, 7) } };
  return { ...d, ...remote, settings: { ...d.settings, ...remote.settings }, view: { brush: 'al', ...d.view, ...remote.view } };
}

(async () => {
  status('Loading…');
  try {
    const r = await fetch(API);
    if (!r.ok) throw new Error(r.status);
    doc = merge(await r.json());
    loaded = true;
    status('Saved ✓');
  } catch {
    doc = merge(null);
    status('Offline: changes will not save', true);
  }
  $('#toilForm').date.value = todayIso();
  render();
})();

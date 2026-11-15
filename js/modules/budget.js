// Budget: a monthly budget in UGX. Dock: Overview · Add · Categories · History.
//
// Document shape (doc 'budget'):
//   cats:    [{ id, name, fixed, savings, day }]      fixed = ticked off once a month (rent, savings, family support)
//   months:  { '2026-11': { income, limits: {catId: amount}, paid: {catId: entryId} } }
//   entries: [{ id, date, amt, cat, note, kind: 'out' | 'in' }]
//   savingsStart: amount already saved before using the app
import { h, fill, icon, today, addDays, ymOf, shiftYM, daysInMonth, monthName, fmt, relDay, uid, UGX, kfmt, digits, sum, clamp } from '../core/util.js';
import { doc, save, hasDoc, setDoc } from '../core/store.js';
import { refresh, tabTo, emit } from '../core/nav.js';
import { head, section, empty, row, btn, dangerBtn, input, field, fieldGroup, chips, seg, toggle, ring, hbars, linkBtn, openSheet, closeSheet, toast } from '../core/ui.js';
import { legacyBudget, onOldBackup } from '../core/legacy.js';

const SEED = ['Rent', 'Savings', 'Family support', 'Work', 'Internet', 'Claude', 'Barber', 'Laundry', 'Food', 'Transport', 'Other'];
const FIXED = /^(rent|savings?|family support)$/i;

const B = () => doc('budget');
const curYM = () => ymOf(today());
const cat = id => B().cats.find(c => c.id === id);
const month = ym => B().months[ym];
const limit = (id, ym) => (month(ym) && +month(ym).limits[id]) || 0;
const entriesOf = ym => B().entries.filter(e => ymOf(e.date) === ym);
const outOf = ym => entriesOf(ym).filter(e => e.kind !== 'in');
const spentCat = (id, ym) => sum(outOf(ym).filter(e => e.cat === id), e => e.amt);
const isSavings = e => { const c = cat(e.cat); return !!(c && c.savings); };
const moneyIn = ym => ((month(ym) && +month(ym).income) || 0) + sum(entriesOf(ym).filter(e => e.kind === 'in'), e => e.amt);
const spentMonth = ym => sum(outOf(ym).filter(e => !isSavings(e)), e => e.amt);
const savedMonth = ym => sum(outOf(ym).filter(isSavings), e => e.amt);
const savedTotal = () => (+B().savingsStart || 0) + sum(B().entries.filter(e => e.kind !== 'in' && isSavings(e)), e => e.amt);
const daysLeft = () => daysInMonth(curYM()) - +today().slice(8) + 1;
const ringColor = p => p > 1 ? 'var(--bad)' : p >= .8 ? 'var(--warn)' : 'var(--good)';
const changed = () => { save('budget'); };
const ord = n => n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
const when = k => { const r = relDay(k); return r === 'Today' || r === 'Yesterday' ? r.toLowerCase() : 'on ' + r; };

// What is safe to spend per day for the rest of the month: what is left in the everyday
// (non-fixed) categories, capped by the cash that remains after fixed items, over the days left.
function safeToSpend() {
  const ym = curYM(), b = B(), flex = b.cats.filter(c => !c.fixed);
  const flexSpent = sum(flex, c => spentCat(c.id, ym));
  let left = sum(flex, c => limit(c.id, ym)) - flexSpent;
  const inc = moneyIn(ym);
  if (inc > 0) left = Math.min(left, inc - sum(b.cats.filter(c => c.fixed), c => Math.max(limit(c.id, ym), spentCat(c.id, ym))) - flexSpent);
  return { left, perDay: Math.max(0, left) / daysLeft(), days: daysLeft() };
}

/* ---------- months ---------- */
const lastMonthWithBudget = before => Object.keys(B().months).filter(m => m < before).sort().pop();
function startMonth(ym, copyFrom) {
  const src = copyFrom && month(copyFrom);
  B().months[ym] = { income: src ? src.income : 0, limits: src ? { ...src.limits } : {}, paid: {} };
  changed();
}
function ensureMonth(ym) { if (!month(ym)) startMonth(ym, lastMonthWithBudget(ym)); return month(ym); }

/* ---------- entries ---------- */
function addEntry({ amt, cat: catId, note = '', date = today(), kind = 'out' }) {
  ensureMonth(ymOf(date));
  const e = { id: uid('e'), date, amt, cat: catId || null, note: note.trim().slice(0, 60), kind };
  B().entries.unshift(e); changed();
  if (kind === 'out') emit('budget:logged', date);
  return e;
}
function removeEntry(id) {
  const b = B(); b.entries = b.entries.filter(e => e.id !== id);
  for (const m of Object.values(b.months)) for (const k in m.paid) if (m.paid[k] === id) delete m.paid[k];
  changed();
}
function togglePaid(c, ym) {
  const m = ensureMonth(ym);
  if (m.paid[c.id]) { const id = m.paid[c.id]; removeEntry(id); delete m.paid[c.id]; changed(); return false; }
  const amt = limit(c.id, ym);
  if (!amt) { toast('Set an amount for ' + c.name + ' in Categories first.'); return null; }
  const e = addEntry({ amt, cat: c.id, date: ym === curYM() ? today() : ym + '-01' });
  m.paid[c.id] = e.id; changed(); return true;
}

/* ---------- first launch: bring over the old Budget, or seed the standard lines ---------- */
function fromOld(old) {
  const b = { v: 3, cats: [], months: {}, entries: [], savingsStart: 0 };
  const bills = old.bills || [], billBy = n => bills.find(x => x.name.trim().toLowerCase() === n.trim().toLowerCase());
  for (const c of old.cats || []) { const bl = billBy(c.name); b.cats.push({ id: c.id, name: c.name, fixed: FIXED.test(c.name.trim()) || !!bl, savings: /saving/i.test(c.name), day: bl ? bl.day : null }); }
  const limits = Object.fromEntries((old.cats || []).map(c => [c.id, +c.amt || 0]));
  for (const bl of bills) if (!b.cats.some(c => c.name.trim().toLowerCase() === bl.name.trim().toLowerCase())) { b.cats.push({ id: bl.id, name: bl.name, fixed: true, savings: /saving/i.test(bl.name), day: bl.day }); limits[bl.id] = +bl.amt || 0; }
  if (!b.cats.some(c => c.savings)) b.cats.push({ id: uid('c'), name: 'Savings', fixed: true, savings: true });
  let other = null;
  for (const s of old.spends || []) {
    let cid = s.cat;
    if (!b.cats.some(c => c.id === cid)) { if (!other) { other = b.cats.find(c => /^other$/i.test(c.name)) || { id: uid('c'), name: 'Other', fixed: false, savings: false }; if (!b.cats.includes(other)) b.cats.push(other); } cid = other.id; }
    b.entries.push({ id: s.id, date: s.date, amt: +s.amt || 0, cat: cid, note: s.note || '', kind: 'out' });
  }
  const yms = new Set([curYM(), ...b.entries.map(e => ymOf(e.date))]);
  for (const bl of bills) for (const ym in bl.paid || {}) yms.add(ym);
  for (const ym of yms) b.months[ym] = { income: +old.income || 0, limits: { ...limits }, paid: {} };
  for (const bl of bills) {
    const c = b.cats.find(x => x.name.trim().toLowerCase() === bl.name.trim().toLowerCase());
    for (const ym in bl.paid || {}) {
      let id = bl.paid[ym];
      if (typeof id !== 'string' || !b.entries.some(e => e.id === id)) { id = uid('e'); b.entries.push({ id, date: ym + '-' + String(Math.min(bl.day || 1, daysInMonth(ym))).padStart(2, '0'), amt: +bl.amt || 0, cat: c.id, note: bl.name, kind: 'out' }); }
      b.months[ym].paid[c.id] = id;
    }
  }
  b.entries.sort((x, y) => y.date.localeCompare(x.date));
  b.importedFromOld = true;
  return b;
}
function fresh() {
  const b = { v: 3, cats: SEED.map(name => ({ id: uid('c'), name, fixed: FIXED.test(name), savings: name === 'Savings' })), months: {}, entries: [], savingsStart: 0 };
  b.months[curYM()] = { income: 0, limits: {}, paid: {} };
  return b;
}
function init() {
  if (!hasDoc('budget')) { const old = legacyBudget(); setDoc('budget', old ? fromOld(old) : fresh()); }
}
onOldBackup(bk => { if (bk.budget && bk.budget.v === 2) setDoc('budget', fromOld(bk.budget)); });

/* ---------- shared bits ---------- */
const moneyInput = (value, onchange, attrs = {}) => {
  const i = input({ inputmode: 'numeric', placeholder: '0', value: value ? UGX(value) : '', ...attrs });
  i.addEventListener('input', () => { const v = digits(i.value); i.value = v ? UGX(v) : ''; onchange(v); });
  return i;
};
function entryRow(e) {
  const c = cat(e.cat), inn = e.kind === 'in';
  return h('button', { class: 'row', type: 'button', onclick: () => editEntry(e) },
    h('span', { class: 'row-t' }, h('b', {}, e.note || (inn ? 'Money in' : c ? c.name : 'Spend')), h('small', {}, (e.note ? (inn ? 'Money in' : c ? c.name : 'No category') + ' · ' : '') + relDay(e.date))),
    h('span', { class: 'val' + (inn ? ' good' : '') }, (inn ? '+' : '−') + UGX(e.amt)));
}
function editEntry(e) {
  const st = { amt: e.amt, cat: e.cat, date: e.date, note: e.note || '' };
  const b = B();
  openSheet(
    h('h2', {}, e.kind === 'in' ? 'Edit money in' : 'Edit spend'),
    field('Amount (UGX)', moneyInput(st.amt, v => { st.amt = v; })),
    e.kind === 'in' ? null : fieldGroup('Category', chips(b.cats.map(c => [c.id, c.name]), st.cat, v => { st.cat = v; })),
    field('Date', input({ type: 'date', value: st.date, max: today(), onchange: ev => { if (ev.target.value) st.date = ev.target.value; } })),
    field('Note', input({ type: 'text', maxlength: 60, value: st.note, placeholder: 'Optional', oninput: ev => { st.note = ev.target.value; } })),
    h('div', { class: 'actions' },
      btn('Save changes', () => { if (!st.amt) return toast('Type an amount first.'); Object.assign(e, { amt: st.amt, cat: st.cat, date: st.date, note: st.note.trim().slice(0, 60) }); ensureMonth(ymOf(e.date)); changed(); closeSheet(); refresh(); toast('Saved'); }, 'pri'),
      dangerBtn('Delete', 'Tap again to delete', () => { removeEntry(e.id); closeSheet(); refresh(); toast('Deleted'); })));
}
const startBanner = () => {
  const ym = curYM(), prev = lastMonthWithBudget(ym);
  return h('div', { class: 'banner' },
    h('b', {}, monthName(ym) + ' has no budget yet'),
    h('p', {}, prev ? 'Copy ' + monthName(prev) + '’s limits and money in, then adjust anything that changed.' : 'Set your limits under Categories.'),
    h('div', { class: 'hstack' },
      prev ? btn('Copy ' + monthName(prev) + '’s budget', () => { startMonth(ym, prev); refresh(); toast(monthName(ym) + ' is ready'); }, 'pri sm') : null,
      btn(prev ? 'Start from zero' : 'Set limits', () => { startMonth(ym, null); tabTo('categories'); }, 'sm')));
};

/* ---------- Overview ---------- */
function overview() {
  const b = B(), ym = curYM(), m = month(ym);
  if (!m) return [head('Budget', monthName(ym, true)), startBanner()];
  const inc = moneyIn(ym), spent = spentMonth(ym), saved = savedMonth(ym), left = inc - spent - saved, safe = safeToSpend();
  const flex = b.cats.filter(c => !c.fixed && (limit(c.id, ym) > 0 || spentCat(c.id, ym) > 0));
  const fixed = b.cats.filter(c => c.fixed);
  const noLimits = !Object.values(m.limits).some(v => v > 0);
  const sav = b.cats.find(c => c.savings), target = sav ? limit(sav.id, ym) : 0;
  const recent = [...b.entries].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 5);

  return [
    head('Budget', monthName(ym, true)),
    noLimits ? h('div', { class: 'banner' }, h('b', {}, 'Set your monthly limits'), h('p', {}, 'Your categories are ready. Add this month’s money in and a limit for each one.'), h('div', { class: 'hstack' }, btn('Open Categories', () => tabTo('categories'), 'pri sm'))) : null,
    h('div', { class: 'card stack' },
      h('div', {},
        h('p', { class: 'muted small' }, 'Safe to spend per day'),
        h('div', { class: 'big-num' + (safe.left < 0 ? ' bad' : '') }, h('small', {}, 'UGX'), UGX(safe.perDay)),
        h('p', { class: 'muted small' }, safe.left < 0 ? 'Everyday categories are ' + UGX(-safe.left) + ' over for this month.' : UGX(safe.left) + ' left for everyday spending · ' + safe.days + (safe.days === 1 ? ' day' : ' days') + ' to go')),
      h('div', { class: 'track' }, h('i', { style: `width:${inc ? clamp((spent + saved) / inc * 100, 0, 100) : 0}%;background:${left < 0 ? 'var(--bad)' : 'var(--acc)'}` })),
      h('div', { class: 'grid3' },
        h('div', { class: 'stat' }, h('b', {}, kfmt(inc)), h('span', {}, 'Money in')),
        h('div', { class: 'stat' }, h('b', {}, kfmt(spent)), h('span', {}, 'Spent')),
        h('div', { class: 'stat' }, h('b', { class: left < 0 ? 'bad' : '' }, kfmt(left)), h('span', {}, saved ? 'Left after saving' : 'Left')))),

    flex.length ? section('Categories', linkBtn('Edit limits', () => tabTo('categories'))) : null,
    flex.length ? h('div', { class: 'card rings' }, flex.map(c => {
      const lim = limit(c.id, ym), sp = spentCat(c.id, ym), p = lim ? sp / lim : 0, l = lim - sp;
      return h('button', { type: 'button', class: 'ringcell', onclick: () => catSheet(c, ym) },
        ring(p, ringColor(p), 62, 7, lim ? Math.round(p * 100) + '%' : '–'),
        h('b', {}, c.name), h('span', { class: lim && l < 0 ? 'bad' : 'muted' }, !lim ? UGX(sp) + ' spent' : l < 0 ? kfmt(-l) + ' over' : kfmt(l) + ' left'));
    })) : null,

    fixed.length ? section('Fixed this month') : null,
    fixed.length ? h('div', { class: 'card flush' }, fixed.map(c => {
      const paid = !!m.paid[c.id], amt = limit(c.id, ym), e = paid && b.entries.find(x => x.id === m.paid[c.id]);
      return h('button', { class: 'row', type: 'button', 'aria-pressed': String(paid), onclick: () => { const r = togglePaid(c, ym); if (r == null) return; refresh(); toast(r ? c.name + (c.savings ? ' saved' : ' paid') : c.name + ' set back to unpaid'); } },
        h('span', { class: 'checkbox' + (paid ? ' on' : '') }, paid ? icon('tick', 16) : null),
        h('span', { class: 'row-t' }, h('b', {}, c.name), h('small', {}, paid ? (c.savings ? 'Saved ' : 'Paid ') + (e ? when(e.date) : '') : amt ? (c.day ? 'Due on the ' + c.day + ord(c.day) + ' · tap when ' : 'Tap when ') + (c.savings ? 'saved' : 'paid') : 'No amount set')),
        h('span', { class: 'val' + (paid ? ' muted' : '') }, amt ? UGX(amt) : '–'));
    })) : null,

    sav ? section('Savings') : null,
    sav ? h('button', { class: 'card hstack', type: 'button', style: 'gap:14px', onclick: () => savingsSheet(sav, ym) },
      ring(target ? saved / target : 0, 'var(--acc)', 62, 7, target ? Math.round(saved / target * 100) + '%' : '–'),
      h('span', { class: 'grow' }, h('b', { class: 'num', style: 'font-size:19px;display:block' }, UGX(saved) + (target ? ' of ' + UGX(target) : '')), h('span', { class: 'muted small' }, 'saved in ' + monthName(ym)),
        h('span', { class: 'small', style: 'display:block;margin-top:4px' }, 'Total saved so far: ', h('b', {}, 'UGX ' + UGX(savedTotal())))),
      icon('chevron', 18)) : null,

    section('Latest', recent.length ? linkBtn('All history', () => tabTo('history')) : null),
    recent.length ? h('div', { class: 'card flush' }, recent.map(entryRow)) : empty('Nothing logged yet.', btn('Log a spend', () => tabTo('add'), 'pri sm')),
  ];
}
function catSheet(c, ym) {
  const list = outOf(ym).filter(e => e.cat === c.id), lim = limit(c.id, ym), sp = spentCat(c.id, ym);
  openSheet(h('h2', {}, c.name), h('p', { class: 'muted' }, UGX(sp) + ' spent' + (lim ? ' of ' + UGX(lim) + ' · ' + (lim - sp < 0 ? UGX(sp - lim) + ' over' : UGX(lim - sp) + ' left') : '') + ' in ' + monthName(ym)),
    list.length ? h('div', { class: 'card flush', style: 'background:var(--raised)' }, list.map(e => entryRow(e))) : h('p', { class: 'muted' }, 'Nothing logged here this month.'),
    btn('Close', closeSheet));
}
function savingsSheet(sav, ym) {
  let amt = 0; const b = B();
  const months = Object.keys(b.months).sort().reverse().map(m => [m, savedMonth(m)]).filter(([, v]) => v > 0);
  openSheet(h('h2', {}, 'Savings'),
    h('div', { class: 'grid2' }, h('div', { class: 'stat' }, h('b', {}, UGX(savedMonth(ym))), h('span', {}, 'Saved in ' + monthName(ym))), h('div', { class: 'stat' }, h('b', {}, UGX(savedTotal())), h('span', {}, 'Total saved so far'))),
    field('Add to savings (UGX)', moneyInput(0, v => { amt = v; })),
    btn('Add to savings', () => { if (!amt) return toast('Type an amount first.'); addEntry({ amt, cat: sav.id }); closeSheet(); refresh(); toast('UGX ' + UGX(amt) + ' saved'); }, 'pri'),
    field('Already saved before this app (UGX)', moneyInput(b.savingsStart, v => { b.savingsStart = v; changed(); }), 'Counts towards the running total.'),
    months.length ? h('div', { class: 'card flush', style: 'background:var(--raised)' }, months.map(([m, v]) => row(monthName(m, true), null, h('span', { class: 'val' }, UGX(v))))) : null,
    btn('Done', () => { closeSheet(); refresh(); }));
}

/* ---------- Add (number pad -> tap a category -> saved) ---------- */
const draft = { amt: '0', note: '', date: null, kind: 'out' };
function add() {
  const b = B(); if (!draft.date || draft.date > today()) draft.date = today();
  const disp = h('div', { class: 'amount' }), cats = h('div', { class: 'catgrid' });
  const note = input({ type: 'text', maxlength: 60, placeholder: 'Note (optional)', value: draft.note, 'aria-label': 'Note', enterkeyhint: 'done', oninput: e => { draft.note = e.target.value; } });
  const dIn = h('input', { type: 'date', max: today(), class: 'ghost-date', 'aria-label': 'Date', onchange: e => { if (e.target.value) { draft.date = e.target.value; draw(); } } });
  const dates = h('div', { class: 'chips' });
  const commit = c => {
    const amt = +draft.amt; if (!amt) { disp.classList.remove('nudge'); void disp.offsetWidth; disp.classList.add('nudge'); return toast('Type an amount first.'); }
    const e = addEntry({ amt, cat: c ? c.id : null, note: draft.note, date: draft.date, kind: draft.kind });
    draft.amt = '0'; draft.note = ''; note.value = ''; draw();
    const ym = ymOf(e.date), lim = c ? limit(c.id, ym) : 0, l = c ? lim - spentCat(c.id, ym) : 0;
    toast(!c ? 'UGX ' + UGX(amt) + ' money in' : lim ? (l >= 0 ? c.name + ': ' + UGX(l) + ' left' : c.name + ' is ' + UGX(-l) + ' over') : UGX(amt) + ' logged under ' + c.name, () => { removeEntry(e.id); refresh(); });
  };
  function draw() {
    fill(disp, h('small', {}, 'UGX'), UGX(+draft.amt));
    const t = today(), y = addDays(t, -1), other = draft.date !== t && draft.date !== y;
    dates.replaceChildren(
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(draft.date === t), onclick: () => { draft.date = t; draw(); } }, 'Today'),
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(draft.date === y), onclick: () => { draft.date = y; draw(); } }, 'Yesterday'),
      h('label', { class: 'chip', 'aria-pressed': String(other) }, other ? fmt(draft.date, { day: 'numeric', month: 'short' }) : 'Other day', dIn));
    if (draft.kind === 'in') cats.replaceChildren(h('button', { type: 'button', class: 'catbtn wide', onclick: () => commit(null) }, 'Add as money in'));
    else {
      const ym = ymOf(draft.date);
      cats.replaceChildren(...b.cats.filter(c => !c.fixed).map(c => { const lim = limit(c.id, ym), p = lim ? spentCat(c.id, ym) / lim : 0;
        return h('button', { type: 'button', class: 'catbtn', onclick: () => commit(c) }, h('i', { class: 'dot', style: 'background:' + (lim ? ringColor(p) : 'var(--faint)') }), h('span', {}, c.name)); }));
    }
  }
  const press = k => { let a = draft.amt; if (k === '⌫') a = a.length > 1 ? a.slice(0, -1) : '0'; else a = (a === '0' ? '' : a) + k; draft.amt = a.replace(/^0+(?=\d)/, '').slice(0, 10) || '0'; draw(); };
  const pad = h('div', { class: 'pad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'].map(k => h('button', { type: 'button', 'aria-label': k === '⌫' ? 'Delete digit' : k, onclick: () => press(k) }, k)));
  draw();
  return [
    seg([['out', 'Spend'], ['in', 'Money in']], draft.kind, v => { draft.kind = v; draw(); }),
    disp,
    h('p', { class: 'muted small', style: 'text-align:center;margin-top:-8px' }, draft.kind === 'in' ? 'Type the amount, then add it.' : 'Type the amount, then tap a category to save it.'),
    cats, h('div', { class: 'hstack' }, h('div', { class: 'grow' }, note)), dates, pad,
  ];
}

/* ---------- Categories (limits for this month) ---------- */
function categories() {
  const b = B(), ym = curYM(), m = ensureMonth(ym);
  const tot = h('div', { class: 'card spread' });
  const drawTot = () => { const planned = sum(b.cats, c => limit(c.id, ym)), inc = +m.income || 0, l = inc - planned;
    tot.replaceChildren(h('div', { class: 'stat' }, h('b', {}, UGX(planned)), h('span', {}, 'planned of ' + UGX(inc) + ' money in')),
      h('span', { class: 'tag ' + (!inc ? '' : l < 0 ? 'bad' : l === 0 ? 'good' : 'warn') }, !inc ? 'Add money in' : l === 0 ? 'All planned' : l > 0 ? UGX(l) + ' unplanned' : UGX(-l) + ' over')); };
  drawTot();
  const rowFor = c => h('div', { class: 'row catrow' },
    h('button', { type: 'button', class: 'row-t', onclick: () => catEdit(c) }, h('b', {}, c.name), h('small', {}, c.savings ? 'Savings target · ticked off monthly' : c.fixed ? 'Fixed · ticked off monthly' : 'Everyday · tap to edit')),
    moneyInput(limit(c.id, ym), v => { m.limits[c.id] = v; changed(); drawTot(); }, { 'aria-label': 'Monthly limit for ' + c.name, class: 'in lim' }));
  return [
    head('Categories', 'Limits for ' + monthName(ym, true)),
    h('div', { class: 'card' }, field('Money in this month (UGX)', moneyInput(m.income, v => { m.income = v; changed(); drawTot(); }), 'Your salary and anything else you expect. Extra money can be logged from Add.')),
    tot,
    section('Everyday'),
    h('div', { class: 'card flush' }, b.cats.filter(c => !c.fixed).map(rowFor), h('button', { class: 'row addrow', type: 'button', onclick: () => catEdit(null, false) }, icon('plus', 18), 'Add a category')),
    section('Fixed (ticked off once a month)'),
    h('div', { class: 'card flush' }, b.cats.filter(c => c.fixed).map(rowFor), h('button', { class: 'row addrow', type: 'button', onclick: () => catEdit(null, true) }, icon('plus', 18), 'Add a fixed item')),
  ];
}
function catEdit(c, fixedDefault) {
  const b = B(), isNew = !c, st = c ? { name: c.name, fixed: !!c.fixed, savings: !!c.savings } : { name: '', fixed: !!fixedDefault, savings: false };
  const name = input({ type: 'text', maxlength: 30, value: st.name, placeholder: 'e.g. Airtime', oninput: e => { st.name = e.target.value; } });
  const used = c ? b.entries.filter(e => e.cat === c.id).length : 0;
  openSheet(h('h2', {}, isNew ? 'New category' : 'Edit category'),
    field('Name', name),
    h('div', { class: 'card flush', style: 'background:var(--raised)' },
      row('Fixed item', 'Ticked off as paid once a month and kept out of quick logging.', toggle(st.fixed, v => { st.fixed = v; }, 'Fixed item')),
      row('This is my savings', 'Counts towards the savings tracker instead of spending.', toggle(st.savings, v => { st.savings = v; }, 'Savings'))),
    h('div', { class: 'actions' },
      btn(isNew ? 'Add category' : 'Save changes', () => {
        const nm = st.name.trim().slice(0, 30); if (!nm) return toast('Give it a name.');
        if (b.cats.some(x => x !== c && x.name.toLowerCase() === nm.toLowerCase())) return toast('You already have “' + nm + '”.');
        if (st.savings) b.cats.forEach(x => { if (x !== c) x.savings = false; });
        if (isNew) b.cats.push({ id: uid('c'), name: nm, fixed: st.fixed, savings: st.savings }); else Object.assign(c, { name: nm, fixed: st.fixed, savings: st.savings });
        changed(); closeSheet(); refresh(); toast(isNew ? 'Category added' : 'Saved');
      }, 'pri'),
      isNew ? btn('Cancel', closeSheet) : dangerBtn('Delete', used ? 'Delete it and its ' + used + ' entries' : 'Tap again to delete', () => {
        b.entries = b.entries.filter(e => e.cat !== c.id); b.cats = b.cats.filter(x => x !== c);
        for (const m of Object.values(b.months)) { delete m.limits[c.id]; delete m.paid[c.id]; }
        changed(); closeSheet(); refresh(); toast(c.name + ' deleted');
      })));
  if (isNew) name.focus();
}

/* ---------- History ---------- */
let histYM = null;
function history() {
  const b = B(), cur = curYM(); if (!histYM) histYM = cur;
  const ym = histYM, all = [...new Set([cur, ...Object.keys(b.months), ...b.entries.map(e => ymOf(e.date))])].sort().reverse();
  const inc = moneyIn(ym), spent = spentMonth(ym), saved = savedMonth(ym);
  const byCat = b.cats.map(c => ({ label: c.name, value: spentCat(c.id, ym), lim: limit(c.id, ym), fixed: c.fixed })).filter(x => x.value > 0).sort((x, y) => y.value - x.value)
    .map(x => ({ ...x, color: !x.lim ? 'var(--muted)' : x.fixed && x.value <= x.lim ? 'var(--faint)' : ringColor(x.value / x.lim), note: UGX(x.value) + (x.lim ? ' / ' + kfmt(x.lim) : '') }));
  const days = {}; for (const e of entriesOf(ym).sort((x, y) => y.date.localeCompare(x.date))) (days[e.date] = days[e.date] || []).push(e);
  const nav = d => { histYM = shiftYM(ym, d); refresh(); };
  return [
    head('History', 'Month by month'),
    !month(cur) ? startBanner() : null,
    h('div', { class: 'card spread monthnav' },
      h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Previous month', onclick: () => nav(-1) }, icon('back', 20)),
      h('div', { style: 'text-align:center' }, h('b', { class: 'num', style: 'font-size:18px' }, monthName(ym, true)), h('div', { class: 'muted small' }, entriesOf(ym).length + ' entries')),
      h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Next month', disabled: ym >= cur, onclick: () => nav(1) }, icon('chevron', 20))),
    h('div', { class: 'card grid3' },
      h('div', { class: 'stat' }, h('b', {}, kfmt(inc)), h('span', {}, 'Money in')),
      h('div', { class: 'stat' }, h('b', {}, kfmt(spent)), h('span', {}, 'Spent')),
      h('div', { class: 'stat' }, h('b', {}, kfmt(saved)), h('span', {}, 'Saved'))),
    section('Spending by category'),
    byCat.length ? h('div', { class: 'card' }, hbars(byCat)) : empty('No spending in ' + monthName(ym) + '.'),
    ...Object.keys(days).flatMap(d => [section(relDay(d), h('span', { class: 'muted small' }, UGX(sum(days[d].filter(e => e.kind !== 'in'), e => e.amt)))), h('div', { class: 'card flush' }, days[d].map(entryRow))]),
    section('All months'),
    h('div', { class: 'card flush' }, all.map(m => row(monthName(m, true), month(m) ? UGX(spentMonth(m)) + ' spent of ' + UGX(moneyIn(m)) + ' in' : 'No budget set', m === ym ? h('span', { class: 'tag' }, 'Showing') : null, () => { histYM = m; refresh(); document.getElementById('view').scrollTop = 0; }))),
  ];
}

export default {
  id: 'budget', name: 'Budget', color: '#3DD68C', icon: 'wallet',
  tabs: [{ id: 'overview', label: 'Overview', icon: 'pie' }, { id: 'add', label: 'Add', icon: 'plus', add: true }, { id: 'categories', label: 'Categories', icon: 'tags' }, { id: 'history', label: 'History', icon: 'history' }],
  init,
  render: tab => ({ overview, add, categories, history })[tab](),
  tile() {
    const ym = curYM(); if (!month(ym)) return { badge: 'Start ' + monthName(ym), sub: 'Copy last month’s budget' };
    if (!Object.values(month(ym).limits).some(v => v > 0)) return { badge: 'Set limits', sub: 'Categories are ready' };
    const s = safeToSpend(); return { badge: kfmt(s.perDay) + ' a day', sub: s.left < 0 ? kfmt(-s.left) + ' over this month' : 'safe to spend · ' + s.days + 'd left' };
  },
};

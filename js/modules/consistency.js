// Consistency: the habit tracker from the original app, moved in as a module. Dock: Today · Stats · Settings.
//
// Document shape (doc 'consistency') - the same shape the old app kept in localStorage, so old data loads as-is:
//   habits:   { id: { name, color, order, created, sched: {t:'daily'} | {t:'days',days:[0..6]} | {t:'weekly',n}, target, unit, tod, remind, archived, archivedAt, auto } }
//   days:     { 'YYYY-MM-DD': { done: {habitId: true|count}, skip: {habitId: true}, note } }
//   reviews:  { '<monday>': { note, score, saved } }
//   settings: { warn: hour | 'off', review: bool, linkGym: bool, linkBudget: bool }
import { h, fill, icon, today, addDays, parse, dkey, pad, dow, weekStart, fmt, uid, WD, WDL } from '../core/util.js';
import { doc, save, hasDoc, setDoc } from '../core/store.js';
import { refresh, tabTo, go, on } from '../core/nav.js';
import { head, section, empty, row, btn, dangerBtn, input, textarea, field, fieldGroup, seg, toggle, ring, openSheet, closeSheet, toast } from '../core/ui.js';
import { legacyHabits, onOldBackup } from '../core/legacy.js';

const COLORS = ['#5B83EA', '#3B9BD8', '#D9903A', '#A377CC', '#E0666E', '#35A9B1', '#8FAE3A', '#C873A3'];
const SUGGEST = ['Study 1 hour', 'Exercise', 'Trading journal', 'Read 10 pages', 'Drink 8 glasses of water', 'Sleep by 11pm'];
const TOD = [['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening'], ['anytime', 'Anytime']];

const C = () => doc('consistency');
const changed = () => save('consistency');
let sel = today();          // the day shown on the Today tab

/* ---------- model (unchanged from the original app) ---------- */
const sched = hb => hb.sched || { t: 'daily' };
const tgt = hb => Math.max(1, +hb.target || 1);
const day = k => C().days[k] || {};
const val = (k, id) => { const v = day(k).done && day(k).done[id]; return v === true ? 1 : (+v || 0); };
const isDone = (k, hb) => val(k, hb.id) >= tgt(hb);
const skipped = (k, id) => !!(day(k).skip && day(k).skip[id]);
const list = () => Object.entries(C().habits).map(([id, hb]) => ({ id, ...hb }));
const sortH = a => a.sort((x, y) => (x.order || 0) - (y.order || 0));
const liveOn = (hb, k) => (hb.created || '0') <= k && (!hb.archived || (hb.archivedAt || '9') > k);
const scheduledOn = (hb, k) => { const s = sched(hb); if (s.t === 'days') return (s.days || []).includes(dow(k)); return s.t !== 'weekly'; };
const counts = (hb, k) => liveOn(hb, k) && scheduledOn(hb, k) && !skipped(k, hb.id);
function weekDone(hb, ws) { let n = 0; for (let i = 0; i < 7; i++) { const k = addDays(ws, i); if (k > today()) break; if (isDone(k, hb)) n++; } return n; }
const weekMet = (hb, ws) => weekDone(hb, ws) >= (sched(hb).n || 3);
function pct(k) { const a = list().filter(hb => counts(hb, k)); if (!a.length) return null; return a.filter(hb => isDone(k, hb)).length / a.length; }
function streak(hb) {
  const t = today(), c = hb.created || t; let n = 0, guard = 0;
  if (sched(hb).t === 'weekly') { let ws = weekStart(t); if (weekMet(hb, ws)) n++; ws = addDays(ws, -7); while (ws >= weekStart(c) && guard++ < 520) { if (weekMet(hb, ws)) { n++; ws = addDays(ws, -7); } else break; } return n; }
  let k = t; if (counts(hb, k) && !isDone(k, hb)) k = addDays(k, -1);
  while (k >= c && guard++ < 3000) { if (!counts(hb, k)) { k = addDays(k, -1); continue; } if (isDone(k, hb)) { n++; k = addDays(k, -1); } else break; }
  return n;
}
function best(hb) {
  const t = today(); let b = 0, r = 0;
  if (sched(hb).t === 'weekly') { for (let ws = weekStart(hb.created || t); ws <= t; ws = addDays(ws, 7)) { if (weekMet(hb, ws)) { r++; b = Math.max(b, r); } else if (ws < weekStart(t)) r = 0; } return b; }
  for (let k = hb.created || t; k <= t; k = addDays(k, 1)) { if (!counts(hb, k)) continue; if (isDone(k, hb)) { r++; b = Math.max(b, r); } else if (k < t) r = 0; } return b;
}
function rate(hb, days) {
  const t = today();
  if (sched(hb).t === 'weekly') { let m = 0, w = 0; const cw = weekStart(t); for (let i = 0; i < 5; i++) { const ws = addDays(cw, -7 * i); if (addDays(ws, 6) < (hb.created || t)) break; if (i === 0 && !weekMet(hb, ws)) continue; w++; if (weekMet(hb, ws)) m++; } return { n: m, d: w, unit: 'week' }; }
  let n = 0, d = 0; for (let i = 0; i < days; i++) { const k = addDays(t, -i); if (k < (hb.created || t)) break; if (!counts(hb, k)) continue; if (i === 0 && !isDone(k, hb)) continue; d++; if (isDone(k, hb)) n++; } return { n, d, unit: 'day' };
}
function totalDone(hb) { let n = 0; for (const k in C().days) if (isDone(k, hb)) n++; return n; }
const earliest = () => list().reduce((m, hb) => (hb.created || today()) < m ? (hb.created || today()) : m, today());
function perfectStreak() { const t = today(), e = earliest(); let k = t; if (pct(k) !== null && pct(k) < 1) k = addDays(k, -1); let n = 0; while (k >= e) { const p = pct(k); if (p === null) { k = addDays(k, -1); continue; } if (p === 1) { n++; k = addDays(k, -1); } else break; } return n; }
function bestPerfect() { let b = 0, r = 0; const t = today(); for (let k = earliest(); k <= t; k = addDays(k, 1)) { const p = pct(k); if (p === null) continue; if (p === 1) { r++; b = Math.max(b, r); } else if (k < t) r = 0; } return b; }
function avg(n) { let s = 0, c = 0; for (let i = 0; i < n; i++) { const p = pct(addDays(today(), -i)); if (p != null) { s += p; c++; } } return c ? s / c : null; }
const remainingToday = () => { const t = today(); return list().filter(hb => counts(hb, t) && !isDone(t, hb)).length; };
const schedText = hb => { const s = sched(hb); if (s.t === 'days') { const d = (s.days || []).slice().sort(); if (d.join() === '0,1,2,3,4') return 'Weekdays'; if (d.join() === '5,6') return 'Weekends'; return d.map(i => WD[i]).join(' '); } if (s.t === 'weekly') return (s.n || 3) + '× a week'; return 'Every day'; };

/* ---------- changes ---------- */
function setDay(k, fn) { const c = C(), d = c.days[k] || (c.days[k] = {}); d.done = d.done || {}; d.skip = d.skip || {}; fn(d); changed(); updateBadge(); }
const snapshotDay = k => JSON.stringify(C().days[k] || null);
function restoreDay(k, snap) { const v = JSON.parse(snap); if (v) C().days[k] = v; else delete C().days[k]; changed(); updateBadge(); refresh(); }
function tap(hb) {
  const k = sel, snap = snapshotDay(k), t = tgt(hb);
  setDay(k, d => { let v = d.done[hb.id] === true ? 1 : (+d.done[hb.id] || 0); if (d.skip[hb.id]) delete d.skip[hb.id]; v = v >= t ? 0 : v + 1; if (v) d.done[hb.id] = v; else delete d.done[hb.id]; });
  refresh();
  const v = val(k, hb.id), undo = () => restoreDay(k, snap);
  if (t > 1 && v > 0 && v < t) toast(hb.name + ': ' + v + ' of ' + t + (hb.unit ? ' ' + hb.unit : ''), undo);
  else if (v >= t) { const s = streak(hb); toast(s > 1 ? hb.name + ' done · ' + s + (sched(hb).t === 'weekly' ? '-week' : '-day') + ' streak' : hb.name + ' done', undo); }
  else toast(hb.name + ' unchecked', undo);
}
function toggleSkip(hb) { const k = sel, snap = snapshotDay(k); let onNow; setDay(k, d => { onNow = !d.skip[hb.id]; if (onNow) { d.skip[hb.id] = true; delete d.done[hb.id]; } else delete d.skip[hb.id]; }); closeSheet(); refresh(); toast(onNow ? 'Skipped. Your streak is safe.' : 'Skip removed', () => restoreDay(k, snap)); }
function addHabit(name, extra) {
  name = (name || '').trim().slice(0, 60); if (!name) return null;
  if (list().some(hb => !hb.archived && hb.name.toLowerCase() === name.toLowerCase())) { toast('You already track “' + name + '”.'); return null; }
  const id = uid('h'), t = today(), n = Object.keys(C().habits).length;
  C().habits[id] = { name, color: COLORS[n % COLORS.length], order: Date.now(), created: sel < t ? sel : t, sched: { t: 'daily' }, target: 1, unit: '', tod: 'anytime', remind: '', ...(extra || {}) };
  changed(); updateBadge(); return id;
}

/* ---------- app icon badge (habits left today) ---------- */
let lastBadge = null;
function updateBadge() {
  if (!doc('settings').badge || !('setAppBadge' in navigator)) return;
  const n = remainingToday(); if (n === lastBadge) return; lastBadge = n;
  (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}

/* ---------- link-ups: gym sessions and budget logging can count as habits automatically ---------- */
const AUTO = { gym: { name: 'Gym session', sched: { t: 'weekly', n: 3 }, key: 'linkGym' }, budget: { name: 'Log my spending', sched: { t: 'daily' }, key: 'linkBudget' } };
function autoHabit(kind, create) {
  const c = C(); let id = Object.keys(c.habits).find(k => c.habits[k].auto === kind && !c.habits[k].archived);
  if (!id && create) { const same = Object.keys(c.habits).find(k => !c.habits[k].archived && c.habits[k].name.toLowerCase() === AUTO[kind].name.toLowerCase());
    if (same) { c.habits[same].auto = kind; id = same; changed(); } else { id = addHabit(AUTO[kind].name, { sched: AUTO[kind].sched, auto: kind }); } }
  return id;
}
function markAuto(kind, date) {
  if (!hasDoc('consistency') || !C().settings[AUTO[kind].key]) return;
  const id = autoHabit(kind, true); if (!id) return;
  const hb = C().habits[id]; if (isDone(date, { id, ...hb })) return;
  setDay(date, d => { delete d.skip[id]; d.done[id] = tgt(hb) > 1 ? tgt(hb) : true; });
}
on('gym:session', date => markAuto('gym', date));
on('budget:logged', date => markAuto('budget', date));

/* ---------- first launch: import the old app's data ---------- */
function fromOld(old) {
  const s = old.settings || {}, habits = JSON.parse(JSON.stringify(old.habits || {}));
  const remap = { '#3E8E6A': COLORS[0], '#1E3A8A': COLORS[0], '#2F5BD3': COLORS[0], '#3B82C4': COLORS[1], '#C27A2C': COLORS[2], '#8A5BB0': COLORS[3], '#C0474F': COLORS[4], '#2B8C93': COLORS[5], '#5F7F1F': COLORS[6], '#A65A86': COLORS[7] };
  for (const id in habits) if (remap[habits[id].color]) habits[id].color = remap[habits[id].color];      // same hues, brightened for the dark theme
  return { habits, days: JSON.parse(JSON.stringify(old.days || {})), reviews: JSON.parse(JSON.stringify(old.reviews || {})), settings: { warn: s.warn == null ? 18 : s.warn, review: s.review !== false }, importedFromOld: Object.keys(habits).length > 0 };
}
function init() {
  if (!hasDoc('consistency')) { const old = legacyHabits(); setDoc('consistency', old ? fromOld(old) : { habits: {}, days: {}, reviews: {}, settings: { warn: 18, review: true } }); }
  if (sel > today()) sel = today();
  updateBadge();
}
onOldBackup(bk => { setDoc('consistency', fromOld(bk)); });

/* ---------- streak at risk, weekly review ---------- */
function atRisk() {
  const w = C().settings.warn == null ? 18 : C().settings.warn; if (w === 'off') return []; if (new Date().getHours() < +w) return [];
  const t = today();
  return sortH(list().filter(hb => {
    if (hb.archived || !liveOn(hb, t) || skipped(t, hb.id) || isDone(t, hb)) return false;
    if (sched(hb).t === 'weekly') { const n = sched(hb).n || 3, rem = n - weekDone(hb, weekStart(t)), left = 7 - dow(t); return rem > 0 && rem >= left && streak(hb) >= 2; }
    return scheduledOn(hb, t) && streak(hb) >= 3;
  }));
}
function isoWeek(k) { const d = parse(k); d.setDate(d.getDate() + 3 - dow(k)); const w1 = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7); }
function weekScore(ws) { let s = 0, c = 0; for (let i = 0; i < 7; i++) { const k = addDays(ws, i); if (k > today()) break; const p = pct(k); if (p != null) { s += p; c++; } } return c ? s / c : null; }
function habitWeek(hb, ws) {
  if (hb.archived) return null; const end = addDays(ws, 6); if ((hb.created || '0') > end) return null;
  if (sched(hb).t === 'weekly') { const n = sched(hb).n || 3; return { n: Math.min(weekDone(hb, ws), n), d: n }; }
  let n = 0, d = 0; for (let i = 0; i < 7; i++) { const k = addDays(ws, i); if (k > today()) break; if (!counts(hb, k)) continue; d++; if (isDone(k, hb)) n++; } return d ? { n, d } : null;
}
function reviewWeek() { if (C().settings.review === false) return null; const t = today(), d = dow(t); if (d === 6) return weekStart(t); if (d === 0) { const ws = addDays(weekStart(t), -7); if (!C().reviews[ws]) return ws; } return null; }
function openReview(ws) {
  const c = C(), sc = weekScore(ws), pv = weekScore(addDays(ws, -7));
  const hs = list().map(hb => ({ hb, r: habitWeek(hb, ws) })).filter(x => x.r).map(x => ({ ...x, p: x.r.n / x.r.d }));
  hs.sort((a, b) => b.p - a.p || b.r.n - a.r.n); const bestH = hs[0], worst = hs.length > 1 ? hs[hs.length - 1] : null;
  const bars = []; for (let i = 0; i < 7; i++) { const k = addDays(ws, i); bars.push(k > today() ? null : pct(k)); }
  const bw = 30, gap = (300 - 7 * bw) / 6; let svg = `<svg viewBox="0 0 300 92" role="img" aria-label="Completion by day this week">`;
  bars.forEach((p, i) => { const x = i * (bw + gap), hh = p == null ? 0 : Math.max(p ? 4 : 0, p * 64); svg += `<rect x="${x}" y="8" width="${bw}" height="64" rx="10" fill="var(--track)"/>`; if (p != null) svg += `<rect x="${x}" y="${72 - hh}" width="${bw}" height="${hh}" rx="10" fill="var(--acc)" fill-opacity="${p === 1 ? 1 : .6}"/>`; svg += `<text x="${x + bw / 2}" y="88" text-anchor="middle">${WD[i][0]}</text>`; });
  const d = sc != null && pv != null ? Math.round((sc - pv) * 100) : null;
  const fr = r => r.n + ' of ' + r.d + ' this week', prev = c.reviews[addDays(ws, -7)];
  const ta = textarea({ maxlength: 400, placeholder: 'e.g. Phone on charge in the living room by 10:30', value: (c.reviews[ws] && c.reviews[ws].note) || '' });
  openSheet(
    h('p', { class: 'muted small' }, 'Week ' + isoWeek(ws) + ' · ' + fmt(ws, { day: 'numeric', month: 'short' }) + ' – ' + fmt(addDays(ws, 6), { day: 'numeric', month: 'short' })), h('h2', { style: 'margin-top:-10px' }, 'Weekly review'),
    h('div', { class: 'hstack', style: 'align-items:baseline;flex-wrap:wrap' }, h('b', { class: 'num', style: 'font-size:44px;line-height:1' }, sc == null ? '–' : Math.round(sc * 100) + '%'), d != null ? h('span', { class: 'small ' + (d >= 0 ? 'good' : 'bad'), style: 'font-weight:700' }, (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d) + '% vs last week') : null),
    h('div', { class: 'line card', style: 'background:var(--raised);padding:12px', html: svg + '</svg>' }),
    h('div', { class: 'grid2' },
      h('div', { class: 'card', style: 'background:var(--raised);padding:12px' }, h('p', { class: 'muted small' }, 'Best habit'), h('b', {}, bestH ? bestH.hb.name : '–'), h('p', { class: 'muted small' }, bestH ? fr(bestH.r) : '')),
      h('div', { class: 'card', style: 'background:var(--raised);padding:12px' }, h('p', { class: 'muted small' }, 'Needs attention'), h('b', {}, worst && worst.p < 1 ? worst.hb.name : 'Nothing'), h('p', { class: 'muted small' }, worst && worst.p < 1 ? fr(worst.r) : 'Every habit hit'))),
    prev && prev.note ? h('div', { class: 'card', style: 'background:var(--field);padding:12px' }, h('p', { class: 'muted small' }, 'Last week you planned'), prev.note) : null,
    field('What will you change next week?', ta),
    h('div', { class: 'actions' }, btn('Save review', () => { c.reviews[ws] = { note: ta.value.trim().slice(0, 400), score: sc == null ? null : Math.round(sc * 100), saved: today() }; changed(); closeSheet(); refresh(); toast('Review saved · see you next Sunday'); }, 'pri'), btn('Close', closeSheet)));
}

/* ---------- Today ---------- */
const check = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';
function todayView() {
  const c = C(), t = today(); if (sel > t) sel = t; const isT = sel === t;
  const dayLabel = isT ? 'Today' : sel === addDays(t, -1) ? 'Yesterday' : fmt(sel, { weekday: 'short', day: 'numeric', month: 'short' });
  const a = list().filter(hb => counts(hb, sel)), dn = a.filter(hb => isDone(sel, hb)).length, ps = perfectStreak();
  const risk = isT ? atRisk() : [], riskIds = new Set(risk.map(hb => hb.id)), ws = isT ? reviewWeek() : null;
  const nav = d => { sel = d; refresh(); };

  // habit list, grouped by time of day
  const all = list().filter(hb => !hb.archived), shown = list().filter(hb => liveOn(hb, sel) && (scheduledOn(hb, sel) || sched(hb).t === 'weekly'));
  const groups = !all.length ? [empty('No habits yet. Add one below or tap a suggestion.')] : !shown.length ? [empty('Nothing scheduled for this day.')]
    : TOD.map(([tk, tl]) => { const hs = sortH(shown.filter(hb => (hb.tod || 'anytime') === tk)); if (!hs.length) return null;
      return [section(tl), h('div', { class: 'card flush' }, hs.map(hb => {
        const v = val(sel, hb.id), tg = tgt(hb), done = v >= tg, sk = skipped(sel, hb.id), wk = sched(hb).t === 'weekly', s = streak(hb), rk = riskIds.has(hb.id);
        const box = h('span', { class: 'hbox' }, tg > 1 ? [h('span', { class: 'hfill', style: 'height:' + Math.min(100, v / tg * 100) + '%' }), h('span', { class: 'hcnt' }, v ? String(v) : '')] : null, h('span', { class: 'hcheck', html: check }));
        let sub = sk ? 'Skipped' : tg > 1 ? v + ' / ' + tg + (hb.unit ? ' ' + hb.unit : '') : null;
        if (wk) { const wd = weekDone(hb, weekStart(sel)), n = sched(hb).n || 3; sub = (sub ? sub + ' · ' : '') + Math.min(wd, n) + ' of ' + n + ' this week'; }
        if (hb.auto) sub = (sub ? sub + ' · ' : '') + (hb.auto === 'gym' ? 'ticks itself from Gym' : 'ticks itself from Budget');
        return h('div', { class: 'habit', 'data-h': hb.id, style: '--hc:' + hb.color },
          h('button', { class: 'htick' + (done ? ' done' : '') + (sk ? ' skipped' : ''), type: 'button', 'aria-pressed': String(done), onclick: () => tap(hb) }, box,
            h('span', { class: 'row-t' }, h('b', {}, hb.name), sub ? h('small', {}, sub) : null),
            h('span', { class: 'hstreak' + (rk ? ' warn' : s >= 3 ? ' hot' : '') }, (rk ? '⚠ ' : '') + (s ? s + (wk ? 'w' : 'd') : ''))),
          h('button', { class: 'hmore', type: 'button', 'aria-label': 'Options for ' + hb.name, onclick: () => openMenu(hb.id) }, '⋯'));
      }))]; });

  const have = new Set(list().map(hb => hb.name.toLowerCase()));
  const suggestions = all.length >= 3 ? [] : SUGGEST.filter(s => !have.has(s.toLowerCase()));
  const newHabit = input({ type: 'text', maxlength: 60, placeholder: 'Add a habit, e.g. Study 1 hour', 'aria-label': 'New habit name', enterkeyhint: 'done' });
  const note = textarea({ maxlength: 500, placeholder: 'How did today go? What got in the way?', value: day(sel).note || '', 'aria-label': 'Note' });
  let nt; note.addEventListener('input', () => { const k = sel, v = note.value; clearTimeout(nt); nt = setTimeout(() => setDay(k, d => { if (v.trim()) d.note = v; else delete d.note; }), 400); });
  const sc = ws ? weekScore(ws) : null, reviewed = ws && !!c.reviews[ws];

  return [
    head(isT ? 'Today' : dayLabel, fmt(sel)),
    h('div', { class: 'card spread daynav' },
      h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Previous day', onclick: () => nav(addDays(sel, -1)) }, icon('back', 20)),
      h('div', { style: 'text-align:center' }, h('b', {}, dayLabel), isT ? null : h('div', {}, h('button', { class: 'link', type: 'button', onclick: () => nav(t) }, 'Back to today'))),
      h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Next day', disabled: isT, onclick: () => nav(addDays(sel, 1)) }, icon('chevron', 20))),
    h('div', { class: 'card hstack', style: 'gap:16px', 'aria-live': 'polite' }, ring(a.length ? dn / a.length : 0, 'var(--acc)', 68, 8),
      h('div', {}, h('b', { class: 'num', style: 'font-size:28px;display:block;line-height:1.1' }, a.length ? dn + ' of ' + a.length : '–'), h('span', { class: 'muted small' }, (isT ? 'done today' : 'done ' + dayLabel.toLowerCase()) + (ps > 1 ? ' · ' + ps + '-day perfect streak' : '')))),
    risk.length ? h('div', { class: 'banner warnb' }, h('b', {}, risk.length === 1 ? '1 streak at risk tonight' : risk.length + ' streaks at risk tonight'), h('p', {}, 'Finish ' + (risk.length === 1 ? 'it' : 'these') + ' before midnight to keep ' + (risk.length === 1 ? 'it' : 'them') + ' going.'),
      h('div', { class: 'chips' }, risk.map(hb => h('button', { type: 'button', class: 'chip', onclick: () => { const li = document.querySelector('[data-h="' + hb.id + '"]'); if (!li) return; li.scrollIntoView({ behavior: 'smooth', block: 'center' }); li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash'); } }, hb.name + ' · ' + streak(hb) + (sched(hb).t === 'weekly' ? 'w' : 'd'))))) : null,
    ws ? h('button', { class: 'card hstack', type: 'button', onclick: () => openReview(ws) }, h('span', { class: 'emo', style: 'width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-weight:800;font-size:13px;flex:none;background:' + (reviewed ? 'var(--raised)' : 'var(--acc)') + ';color:' + (reviewed ? 'var(--fg)' : 'var(--on-acc)') }, reviewed ? '✓' : 'W' + isoWeek(ws)),
      h('span', { class: 'row-t' }, h('b', {}, reviewed ? 'Week ' + isoWeek(ws) + ' reviewed' : 'Your week is ready'), h('small', {}, reviewed ? 'Tap to see or edit your plan' : sc == null ? 'Not enough check-ins yet' : Math.round(sc * 100) + '% this week')), icon('chevron', 18)) : null,
    groups,
    h('form', { class: 'addform', autocomplete: 'off', onsubmit: e => { e.preventDefault(); if (addHabit(newHabit.value)) { refresh(); toast('Added. Tap ⋯ to set a schedule, goal or reminder.'); } } }, newHabit, h('button', { class: 'btn pri', type: 'submit' }, 'Add')),
    suggestions.length ? h('div', { class: 'chips' }, suggestions.map(s => h('button', { class: 'chip', type: 'button', onclick: () => { const extra = s.startsWith('Drink 8') ? { target: 8, unit: 'glasses' } : s === 'Exercise' ? { sched: { t: 'weekly', n: 4 } } : s.startsWith('Sleep') ? { tod: 'evening' } : {}; if (addHabit(s, extra)) refresh(); } }, '+ ' + s))) : null,
    h('div', { class: 'card' }, field(isT ? 'Note for today' : 'Note for ' + dayLabel, note)),
  ];
}

/* ---------- habit sheets: menu, editor, details ---------- */
function openMenu(id) {
  const hb = { id, ...C().habits[id] }, sk = skipped(sel, id), lbl = sel === today() ? 'today' : fmt(sel, { weekday: 'short', day: 'numeric', month: 'short' });
  openSheet(h('h2', {}, hb.name), h('p', { class: 'muted', style: 'margin-top:-8px' }, schedText(hb) + (tgt(hb) > 1 ? ' · goal ' + tgt(hb) + (hb.unit ? ' ' + hb.unit : '') : '')),
    btn(sk ? 'Remove skip for ' + lbl : 'Skip ' + lbl + ' (keeps your streak)', () => toggleSkip(hb)), btn('Details and calendar', () => openDetails(id)), btn('Edit habit', () => openEditor(id)), btn('Close', closeSheet));
}
function openEditor(id) {
  const c = C(), isNew = !id, hb = isNew ? { name: '', color: COLORS[Object.keys(c.habits).length % COLORS.length], sched: { t: 'daily' }, target: 1, unit: '', tod: 'anytime', remind: '' } : { ...c.habits[id] };
  const st = { color: hb.color, t: sched(hb).t, days: [...(sched(hb).days || [0, 1, 2, 3, 4])], n: sched(hb).n || 3 };
  const name = input({ type: 'text', maxlength: 60, value: hb.name, placeholder: 'e.g. Study 1 hour' });
  const sw = h('div', { class: 'swatches' }); const drawSw = () => fill(sw, COLORS.map(col => h('button', { type: 'button', style: '--c:' + col, 'aria-label': 'Colour', 'aria-pressed': String(col === st.color), onclick: () => { st.color = col; drawSw(); } }))); drawSw();
  const extra = h('div');
  const drawExtra = () => fill(extra,
    st.t === 'days' ? h('div', { class: 'chips' }, WD.map((d, i) => h('button', { type: 'button', class: 'chip', 'aria-label': WDL[i], 'aria-pressed': String(st.days.includes(i)), onclick: () => { st.days = st.days.includes(i) ? st.days.filter(x => x !== i) : [...st.days, i]; drawExtra(); } }, d))) : null,
    st.t === 'weekly' ? h('div', { class: 'hstack' }, input({ type: 'number', min: 1, max: 7, value: String(st.n), style: 'width:84px', 'aria-label': 'Times a week', oninput: e => { st.n = Math.min(7, Math.max(1, +e.target.value || 1)); } }), h('span', { class: 'muted small' }, 'times a week, any days')) : null);
  drawExtra();
  const target = input({ type: 'number', min: 1, max: 999, value: String(tgt(hb)), style: 'width:92px', 'aria-label': 'Daily goal' });
  const unit = input({ type: 'text', maxlength: 20, value: hb.unit || '', placeholder: 'unit, e.g. pages', 'aria-label': 'Unit' });
  const tod = h('select', { class: 'in' }, TOD.map(([v, l]) => { const o = h('option', { value: v }, l); if ((hb.tod || 'anytime') === v) o.selected = true; return o; }));
  const remind = input({ type: 'time', value: hb.remind || '', 'aria-label': 'Reminder time' });
  const collect = () => st.t === 'days' ? { t: 'days', days: st.days.slice().sort() } : st.t === 'weekly' ? { t: 'weekly', n: st.n } : { t: 'daily' };
  const doSave = () => {
    const nm = name.value.trim().slice(0, 60); if (!nm) { toast('Give the habit a name.'); return name.focus(); }
    if (st.t === 'days' && !st.days.length) return toast('Pick at least one day.');
    const data = { name: nm, color: st.color, sched: collect(), target: Math.max(1, Math.min(999, +target.value || 1)), unit: unit.value.trim().slice(0, 20), tod: tod.value, remind: remind.value };
    if (isNew) { if (!addHabit(nm, data)) return; } else { Object.assign(c.habits[id], data); changed(); }
    closeSheet(); refresh(); toast(isNew ? 'Habit added' : 'Saved');
  };
  openSheet(h('h2', {}, isNew ? 'New habit' : 'Edit habit'),
    field('Name', name), fieldGroup('Colour', sw),
    fieldGroup('How often', h('div', { class: 'stack', style: 'gap:10px' }, seg([['daily', 'Every day'], ['days', 'Some days'], ['weekly', 'X per week']], st.t, v => { st.t = v; drawExtra(); }), extra)),
    fieldGroup('Daily goal', h('div', { class: 'hstack' }, target, h('div', { class: 'grow' }, unit)), 'Leave at 1 for a simple yes/no habit.'),
    field('Time of day', tod),
    fieldGroup('Reminder', h('div', { class: 'hstack' }, h('div', { class: 'grow' }, remind), btn('Add to Calendar', () => { if (!remind.value) return toast('Pick a reminder time first.'); reminderFile({ ...hb, id, name: name.value.trim() || hb.name, remind: remind.value, sched: collect() }); }, 'sm')), 'Adds a repeating alert to your iPhone Calendar.'),
    isNew ? null : fieldGroup('Order', h('div', { class: 'actions' }, btn('Move up', () => move(id, -1), 'sm'), btn('Move down', () => move(id, 1), 'sm'))),
    h('div', { class: 'actions' }, btn(isNew ? 'Add habit' : 'Save', doSave, 'pri'), btn('Cancel', closeSheet)),
    isNew ? null : h('div', { class: 'actions' },
      btn('Archive', () => { Object.assign(c.habits[id], { archived: true, archivedAt: addDays(today(), 1) }); changed(); closeSheet(); refresh(); toast(hb.name + ' archived. Restore it from Settings.'); }),
      dangerBtn('Delete', 'Tap again to delete for good', () => { delete c.habits[id]; changed(); updateBadge(); closeSheet(); refresh(); toast(hb.name + ' deleted'); })));
  if (isNew) name.focus();
}
function move(id, dir) {
  const c = C(), hs = sortH(list().filter(hb => !hb.archived && (hb.tod || 'anytime') === (c.habits[id].tod || 'anytime'))), i = hs.findIndex(hb => hb.id === id), j = i + dir;
  if (j < 0 || j >= hs.length) return toast(dir < 0 ? 'Already at the top' : 'Already at the bottom');
  const a = hs[i].order || 0, b = hs[j].order || 0; c.habits[hs[i].id].order = b; c.habits[hs[j].id].order = a === b ? a + dir : a; changed(); refresh(); toast('Moved ' + (dir < 0 ? 'up' : 'down'));
}
let calMonth = null;
function openDetails(id) {
  const hb = { id, ...C().habits[id] }; if (!hb.name) return; calMonth = calMonth && calMonth.id === id ? calMonth : { id, m: today().slice(0, 7) };
  const r = rate(hb, 30), wk = sched(hb).t === 'weekly', u = wk ? 'w' : 'd', t = today();
  const [y, m] = calMonth.m.split('-').map(Number), first = dkey(new Date(y, m - 1, 1)), dim = new Date(y, m, 0).getDate();
  const grid = h('div', { class: 'calgrid', style: '--hc:' + hb.color }, WD.map(d => h('span', { class: 'wdh' }, d.slice(0, 2))), Array.from({ length: dow(first) }, () => h('span')));
  for (let d = 1; d <= dim; d++) { const k = dkey(new Date(y, m - 1, d)); let cl = 'd';
    if (k > t || !liveOn(hb, k)) cl += ' off'; else if (skipped(k, id)) cl += ' sk'; else if (isDone(k, hb)) cl += ' ok'; else if (scheduledOn(hb, k) && k < t) cl += ' miss'; else cl += ' off';
    if (k === t) cl += ' today'; grid.append(h('span', { class: cl }, String(d))); }
  const nav = d => { const dt = new Date(y, m - 1 + d, 1); calMonth = { id, m: dt.getFullYear() + '-' + pad(dt.getMonth() + 1) }; openDetails(id); };
  const stat = (v, l) => h('div', { class: 'card stat', style: 'background:var(--raised);padding:12px' }, h('b', {}, v), h('span', {}, l));
  openSheet(h('h2', {}, hb.name), h('p', { class: 'muted', style: 'margin-top:-8px' }, schedText(hb) + (tgt(hb) > 1 ? ' · goal ' + tgt(hb) + (hb.unit ? ' ' + hb.unit : '') : '') + ' · since ' + fmt(hb.created || t, { day: 'numeric', month: 'short', year: 'numeric' })),
    h('div', { class: 'grid2' }, stat(streak(hb) + u, 'Current streak'), stat(best(hb) + u, 'Best streak'), stat(r.d ? Math.round(r.n / r.d * 100) + '%' : '–', wk ? 'Weeks hit, last 5' : 'Hit rate, 30 days'), stat(String(totalDone(hb)), 'Times completed')),
    h('div', { class: 'spread' }, h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Previous month', onclick: () => nav(-1) }, icon('back', 20)), h('b', {}, new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })), h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Next month', onclick: () => nav(1) }, icon('chevron', 20))),
    grid,
    h('div', { class: 'actions' }, btn('Edit habit', () => openEditor(id)), btn('Done', closeSheet, 'pri')));
}
function reminderFile(hb) {
  const [hh, mm] = hb.remind.split(':'), s = sched(hb);
  const rr = s.t === 'days' ? 'FREQ=WEEKLY;BYDAY=' + s.days.map(i => ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][i]).join(',') : 'FREQ=DAILY';
  const esc = v => String(v).replace(/[\\,;]/g, x => '\\' + x).replace(/\n/g, ' ');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Life OS//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:' + (hb.id || uid('h')) + '-' + Date.now() + '@life-os', 'DTSTAMP:' + stamp, 'DTSTART:' + today().replace(/-/g, '') + 'T' + hh + mm + '00', 'DURATION:PT10M', 'RRULE:' + rr, 'SUMMARY:' + esc(hb.name), 'DESCRIPTION:' + esc('Open Life OS and check it off.'), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(hb.name), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const file = new File([ics], 'reminder-' + hb.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.ics', { type: 'text/calendar' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: hb.name + ' reminder' }).catch(() => {}); toast('Choose Calendar in the share sheet.'); }
  else { const a = h('a', { href: URL.createObjectURL(file), download: file.name }); document.body.append(a); a.click(); a.remove(); toast('Open the downloaded file to add it to Calendar.'); }
}

/* ---------- Stats ---------- */
function lineSvg() {
  const W = 340, H = 170, pl = 34, pr = 10, pt = 10, pb = 24, t = today();
  const days = []; for (let i = 29; i >= 0; i--) days.push(addDays(t, -i)); const vals = days.map(pct);
  if (vals.every(v => v == null)) return h('p', { class: 'muted small' }, 'Your trend line fills in as you check things off.');
  const x = i => pl + i * (W - pl - pr) / 29, y = v => pt + (1 - v) * (H - pt - pb);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily completion over the last 30 days">`;
  for (const g of [0, .5, 1]) s += `<line x1="${pl}" x2="${W - pr}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line)"/><text x="${pl - 6}" y="${y(g) + 3}" text-anchor="end">${g * 100}%</text>`;
  const segs = []; let cur = []; vals.forEach((v, i) => { if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(v)]); }); if (cur.length) segs.push(cur);
  for (const sg of segs) { const d = sg.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    s += `<path d="${d} L${sg[sg.length - 1][0].toFixed(1)} ${y(0)} L${sg[0][0].toFixed(1)} ${y(0)} Z" fill="var(--acc)" fill-opacity=".14"/><path d="${d}" fill="none" stroke="var(--acc)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`; }
  vals.forEach((v, i) => { if (v != null) s += `<circle cx="${x(i)}" cy="${y(v)}" r="${i === 29 ? 4.5 : 2.2}" fill="${i === 29 ? 'var(--acc)' : 'var(--surface)'}" stroke="var(--acc)" stroke-width="1.5"/>`; });
  [[0, 'start'], [15, 'middle'], [29, 'end']].forEach(([i, a]) => { s += `<text x="${x(i)}" y="${H - 6}" text-anchor="${a}">${i === 29 ? 'Today' : fmt(days[i], { day: 'numeric', month: 'short' })}</text>`; });
  return h('div', { class: 'line', html: s + '</svg>' });
}
function weekdayChart() {
  const t = today(), sum = [0, 0, 0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 56; i++) { const k = addDays(t, -i), p = pct(k); if (p == null) continue; if (i === 0 && p < 1) continue; sum[dow(k)] += p; cnt[dow(k)]++; }
  const av = sum.map((s, i) => cnt[i] ? s / cnt[i] : null);
  if (av.filter(v => v != null).length < 3) return [h('p', { class: 'muted small' }, 'After a week of check-ins you’ll see which days you’re strongest on.')];
  let bi = -1, wi = -1; av.forEach((v, i) => { if (v == null) return; if (bi < 0 || v > av[bi]) bi = i; if (wi < 0 || v < av[wi]) wi = i; });
  const W = 340, H = 150, pb = 20, pt = 18, gap = 8, bw = (W - gap * 6) / 7;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Average completion by weekday">`;
  av.forEach((v, i) => { const x = i * (bw + gap), hh = v == null ? 0 : Math.max(2, v * (H - pt - pb));
    s += `<rect x="${x}" y="${pt}" width="${bw}" height="${H - pt - pb}" rx="9" fill="var(--track)"/>`;
    if (v != null) s += `<rect x="${x}" y="${H - pb - hh}" width="${bw}" height="${hh}" rx="9" fill="var(--acc)" fill-opacity="${i === bi ? 1 : .5}"/><text x="${x + bw / 2}" y="${H - pb - hh - 5}" text-anchor="middle">${Math.round(v * 100)}%</text>`;
    s += `<text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle">${WD[i]}</text>`; });
  return [h('div', { class: 'line', html: s + '</svg>' }), h('p', { style: 'font-size:14px' }, 'You’re most consistent on ', h('b', { style: 'color:var(--acc)' }, WDL[bi] + 's'), '.', wi !== bi && av[bi] - av[wi] >= .15 ? ' ' + WDL[wi] + 's are your weak spot, so plan a little extra for them.' : '')];
}
function stats() {
  const t = today(), a7 = avg(7), a30 = avg(30), f = v => v == null ? '–' : Math.round(v * 100) + '%', ps = perfectStreak();
  const start = addDays(t, -(dow(t) + 15 * 7)), cells = [];
  for (let i = 0; i < 16 * 7; i++) { const k = addDays(start, i);
    if (k > t) { cells.push(h('span', { class: 'cell', 'data-l': 'x' })); continue; }
    const p = pct(k), l = p == null ? null : p === 0 ? 0 : p < .34 ? 1 : p < .67 ? 2 : p < 1 ? 3 : 4;
    cells.push(h('button', { class: 'cell' + (k === sel ? ' sel' : ''), type: 'button', 'data-l': l == null ? null : String(l), 'aria-label': fmt(k) + (p == null ? ', nothing scheduled' : ', ' + Math.round(p * 100) + ' percent'), onclick: () => { sel = k; tabTo('today'); } })); }
  const hs = sortH(list().filter(hb => !hb.archived));
  const tile = (v, l) => h('div', { class: 'card stat' }, h('b', {}, v), h('span', {}, l));
  return [
    head('Stats', 'Your record'),
    h('div', { class: 'grid2' }, tile(ps + (ps === 1 ? ' day' : ' days'), 'Perfect-day streak'), tile(String(bestPerfect()), 'Best perfect streak'), tile(f(a7), 'Average, last 7 days'), tile(f(a30), 'Average, last 30 days')),
    section('Daily completion', h('span', { class: 'muted small' }, 'last 30 days')), h('div', { class: 'card' }, lineSvg()),
    section('Every day, at a glance', h('span', { class: 'muted small' }, '16 weeks · tap a day')),
    h('div', { class: 'card stack' }, h('div', { class: 'heatwrap' }, h('div', { class: 'daylbl' }, ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map(d => h('span', {}, d))), h('div', { class: 'heat' }, cells)),
      h('div', { class: 'legend' }, 'Missed', [0, 1, 2, 3, 4].map(l => h('i', { 'data-l': String(l) })), 'All done')),
    section('Your best days', h('span', { class: 'muted small' }, 'by weekday, 8 weeks')), h('div', { class: 'card stack' }, weekdayChart()),
    section('By habit', h('span', { class: 'muted small' }, '30 days · tap for details')),
    hs.length ? h('div', { class: 'card flush' }, hs.map(hb => { const r = rate(hb, 30), pc = r.d ? r.n / r.d : 0, wk = sched(hb).t === 'weekly';
      return h('button', { class: 'row hrow', type: 'button', style: '--hc:' + hb.color, onclick: () => openDetails(hb.id) },
        h('span', { class: 'row-t' }, h('span', { class: 'spread' }, h('b', {}, h('i', { class: 'dot', style: 'background:' + hb.color + ';display:inline-block;margin-right:8px;width:10px;height:10px' }), hb.name), h('b', { class: 'num' }, r.d ? Math.round(pc * 100) + '%' : '–')),
          h('span', { class: 'track', style: 'margin:7px 0 5px' }, h('i', { style: 'width:' + (pc * 100) + '%;background:' + hb.color })),
          h('small', {}, `${r.n} of ${r.d} ${r.unit}${r.d === 1 ? '' : 's'} · ${schedText(hb)} · best ${best(hb)}${wk ? 'w' : 'd'}`))); }))
      : empty('Each habit gets its own hit rate and streak here.'),
  ];
}

/* ---------- Settings (habit settings; backup and lock live in the app's Settings) ---------- */
function settings() {
  const c = C(), s = c.settings, app = doc('settings'), ar = list().filter(hb => hb.archived);
  const warn = h('select', { class: 'in', style: 'width:auto', 'aria-label': 'Streak warnings', onchange: e => { const v = e.target.value; s.warn = v === 'off' ? 'off' : +v; changed(); refresh(); toast(v === 'off' ? 'Streak warnings off' : 'Streak warnings from ' + (+v - 12) + ' pm'); } },
    [['off', 'Off'], [17, 'From 5 pm'], [18, 'From 6 pm'], [19, 'From 7 pm'], [20, 'From 8 pm'], [21, 'From 9 pm']].map(([v, l]) => { const o = h('option', { value: v }, l); if (String(s.warn == null ? 18 : s.warn) === String(v)) o.selected = true; return o; }));
  const link = (kind, title, note) => row(title, note, toggle(s[AUTO[kind].key], v => { s[AUTO[kind].key] = v; if (v) autoHabit(kind, true); changed(); refresh(); toast(v ? '“' + AUTO[kind].name + '” will tick itself' : 'Link-up off'); }, title));
  const badge = async v => {
    if (v) {
      if (!('setAppBadge' in navigator)) { toast('Badges work once the app is on your Home Screen.'); return refresh(); }
      try { if ('Notification' in window && Notification.permission !== 'granted') { const p = await Notification.requestPermission(); if (p !== 'granted') { toast('Allow notifications for Life OS to show the badge.'); return refresh(); } } } catch (e) {}
      app.badge = true; lastBadge = null; save('settings'); updateBadge(); toast('Badge on');
    } else { app.badge = false; save('settings'); if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {}); toast('Badge off'); }
  };
  return [
    head('Settings', 'Consistency'),
    h('div', { class: 'card flush' },
      row('Streak warnings', 'Highlights open habits on a 3+ day streak.', warn),
      row('Weekly review', 'A recap card every Sunday.', toggle(s.review !== false, v => { s.review = v; changed(); toast(v ? 'Weekly review on' : 'Weekly review off'); }, 'Weekly review')),
      row('Badge on app icon', 'Habits left today. Asks for notification permission once.', toggle(app.badge, badge, 'Badge on app icon'))),
    section('Link-ups'),
    h('div', { class: 'card flush' },
      link('gym', 'Gym sessions count as a habit', 'Finishing a workout ticks “Gym session” (3× a week).'),
      link('budget', 'Budget logging counts as a habit', 'Logging a spend ticks “Log my spending” for that day.')),
    ar.length ? section('Archived habits') : null,
    ar.length ? h('div', { class: 'card flush' }, ar.map(hb => row(hb.name, 'Paused. Its history is kept.', btn('Restore', () => { delete c.habits[hb.id].archived; delete c.habits[hb.id].archivedAt; changed(); refresh(); toast(hb.name + ' is back on your list'); }, 'sm')))) : null,
    section('More'),
    h('div', { class: 'card flush' }, row('Backup, Face ID lock and updates', 'In the app’s Settings.', null, () => go('settings')),
      c.importedFromOld ? row('Imported from the old app', Object.keys(c.habits).length + ' habits and ' + Object.keys(c.days).length + ' days of history.') : null),
  ];
}

export default {
  id: 'consistency', name: 'Consistency', color: '#7AA2FF', icon: 'check',
  tabs: [{ id: 'today', label: 'Today', icon: 'check' }, { id: 'stats', label: 'Stats', icon: 'stats' }, { id: 'settings', label: 'Settings', icon: 'tags' }],
  init,
  render: tab => ({ today: todayView, stats, settings })[tab](),
  tile() {
    const t = today(), a = list().filter(hb => counts(hb, t)), dn = a.filter(hb => isDone(t, hb)).length, ps = perfectStreak();
    updateBadge();
    return { badge: a.length ? dn + ' of ' + a.length + ' done' : list().length ? 'Nothing today' : 'Add a habit', sub: ps > 1 ? ps + '-day perfect streak' : a.length ? 'habits today' : '', pip: a.length - dn || null };
  },
  today() {
    const t = today(), a = list().filter(hb => counts(hb, t)), left = a.filter(hb => !isDone(t, hb)).length, r = atRisk(), ps = perfectStreak();
    if (!list().length) return { label: 'Habits', value: 'Add a habit', sub: 'Nothing tracked yet', tab: 'today' };
    return { label: 'Habits left', value: !a.length ? 'None today' : left ? left + ' left' : 'All done', sub: r.length ? r.length + (r.length === 1 ? ' streak' : ' streaks') + ' at risk' : ps > 1 ? ps + '-day perfect streak' : a.length ? (a.length - left) + ' of ' + a.length + ' done' : '', tab: 'today' };
  },
};

// Shared interface pieces: page header, bottom sheet, toast, form controls and small charts.
import { h, fill, icon, clamp } from './util.js';

const $ = id => document.getElementById(id);

/* ---------- page header ---------- */
export const head = (title, sub, right) => h('header', { class: 'head' },
  h('div', {}, sub ? h('p', { class: 'head-sub' }, sub) : null, h('h1', {}, title)), right || null);
export const section = (label, right) => h('div', { class: 'sec' }, h('h2', {}, label), right || null);
export const empty = (text, action) => h('div', { class: 'empty card' }, h('p', {}, text), action || null);
export const linkBtn = (label, onclick) => h('button', { class: 'link', type: 'button', onclick }, label);

/* ---------- bottom sheet ---------- */
let sheetOnClose = null;
export function openSheet(...kids) {
  const sh = $('sheet');
  sh.replaceChildren(h('div', { class: 'grab' }), ...kids.flat().filter(k => k != null && k !== false));
  sh.hidden = false; $('scrim').hidden = false; sh.scrollTop = 0;
  sh.animate([{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
  return sh;
}
export function closeSheet() {
  if ($('sheet').hidden) return;
  $('sheet').hidden = true; $('scrim').hidden = true; $('sheet').replaceChildren();
  const f = sheetOnClose; sheetOnClose = null; if (f) f();
}
export const onSheetClose = fn => { sheetOnClose = fn; };
export const sheetOpen = () => !$('sheet').hidden;
export function initSheet() {
  $('scrim').onclick = closeSheet;
  const sh = $('sheet'); let y0 = 0, dy = 0, drag = false;
  sh.addEventListener('touchstart', e => { if (sh.scrollTop > 0 || e.target.closest('input,textarea,select,.pad,.hscroll,.cropbox')) return; drag = true; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
  sh.addEventListener('touchmove', e => { if (!drag) return; dy = e.touches[0].clientY - y0; if (dy <= 0) { sh.style.transform = ''; return; } if (e.cancelable) e.preventDefault(); sh.style.transform = 'translateY(' + dy + 'px)'; }, { passive: false });
  const end = () => { if (!drag) return; drag = false; sh.style.transform = ''; if (dy > 110) closeSheet(); };
  sh.addEventListener('touchend', end); sh.addEventListener('touchcancel', end);
}

/* ---------- toast (with optional Undo) ---------- */
let toastTimer;
export function toast(msg, undo) {
  const t = $('toast');
  fill(t, h('span', {}, msg), undo ? h('button', { type: 'button', onclick: () => { t.hidden = true; undo(); } }, 'Undo') : null);
  t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, undo ? 5000 : 2800);
}

/* ---------- buttons and form controls ---------- */
export const btn = (label, onclick, cls = '') => h('button', { class: 'btn ' + cls, type: 'button', onclick }, label);
// A button that asks for a second tap before doing something destructive.
export function dangerBtn(label, confirmLabel, onconfirm, cls = '') {
  return h('button', { class: 'btn danger ' + cls, type: 'button', onclick: e => {
    const b = e.currentTarget;
    if (b.dataset.armed) return onconfirm();
    b.dataset.armed = '1'; b.textContent = confirmLabel; b.classList.add('solid');
    setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = label; b.classList.remove('solid'); } }, 4000);
  } }, label);
}
export const field = (label, control, hint) => h('label', { class: 'field' }, h('span', { class: 'field-l' }, label), control, hint ? h('span', { class: 'hint' }, hint) : null);
export const fieldGroup = (label, control, hint) => h('div', { class: 'field' }, h('span', { class: 'field-l' }, label), control, hint ? h('span', { class: 'hint' }, hint) : null);
export const input = (attrs) => h('input', { class: 'in', autocomplete: 'off', ...attrs });
export const textarea = (attrs) => h('textarea', { class: 'in', rows: 3, ...attrs });

// Segmented control. options: [[value,label],...]. onchange(value) is called on tap.
export function seg(options, value, onchange) {
  const box = h('div', { class: 'seg', role: 'group' });
  const draw = () => box.replaceChildren(...options.map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(v === value), onclick: () => { value = v; draw(); onchange(v); } }, l)));
  draw();
  return box;
}
// Chips. multi=false -> single choice (value), multi=true -> array of values.
export function chips(options, value, onchange, { multi = false, scroll = false, allowNone = false } = {}) {
  const box = h('div', { class: 'chips' + (scroll ? ' hscroll' : '') });
  const on = v => multi ? value.includes(v) : value === v;
  const draw = () => box.replaceChildren(...options.map(o => {
    const [v, l, dot] = Array.isArray(o) ? o : [o, o];
    return h('button', { type: 'button', class: 'chip', 'aria-pressed': String(on(v)), onclick: () => {
      if (multi) value = on(v) ? value.filter(x => x !== v) : [...value, v];
      else value = (allowNone && value === v) ? null : v;
      draw(); onchange(value);
    } }, dot ? h('i', { class: 'dot', style: 'background:' + dot }) : null, l);
  }));
  draw();
  return box;
}
export function toggle(checked, onchange, label) {
  const i = h('input', { type: 'checkbox', 'aria-label': label, onchange: e => onchange(e.target.checked) });
  i.checked = !!checked;
  return h('label', { class: 'switch' }, i, h('span'));
}
// A settings-style row: title + note on the left, a control on the right.
export const row = (title, note, control, onclick) => h(onclick ? 'button' : 'div', { class: 'row', type: onclick ? 'button' : null, onclick },
  h('span', { class: 'row-t' }, h('b', {}, title), note ? h('small', {}, note) : null), control || (onclick ? icon('chevron', 18) : null));

// A round tick box with a full-size (44px) tap target.
export const checkBtn = (on, label, onclick) => h('button', { type: 'button', class: 'checkbtn', 'aria-label': label, 'aria-pressed': String(!!on), onclick }, h('span', { class: 'checkbox' + (on ? ' on' : '') }, on ? icon('tick', 16) : null));

/* ---------- charts ---------- */
// Progress ring. pct 0..1+, colour is a CSS colour. Children go in the middle.
export function ring(pct, color, size = 64, stroke = 7, center) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r, p = clamp(pct || 0, 0, 1);
  const box = h('span', { class: 'ring', style: `width:${size}px;height:${size}px` });
  box.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>${p > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(p * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>` : ''}</svg>`;
  if (center != null) box.append(h('span', { class: 'ring-c' }, center));
  return box;
}
// Horizontal bars: items [{label, value, color?, note?}]
export function hbars(items, fmtV = String) {
  const max = Math.max(1, ...items.map(i => i.value));
  return h('div', { class: 'hbars' }, items.map(i => h('div', { class: 'hbar' },
    h('div', { class: 'hbar-t' }, h('span', {}, i.label), h('b', {}, i.note || fmtV(i.value))),
    h('div', { class: 'track' }, h('i', { style: `width:${(i.value / max * 100).toFixed(1)}%;background:${i.color || 'var(--acc)'}` })))));
}
// Vertical columns: values (null = no data), labels under each, optional highlight index.
export function columns(values, labels, { height = 120, fmtV = String, hi = -1 } = {}) {
  const max = Math.max(1, ...values.map(v => v || 0));
  return h('div', { class: 'cols', style: `height:${height}px` }, values.map((v, i) => h('div', { class: 'col' },
    h('span', { class: 'col-v' }, v ? fmtV(v) : ''),
    h('div', { class: 'col-bar' + (i === hi ? ' hi' : ''), style: `height:${v ? Math.max(4, v / max * 100) : 0}%` }),
    h('span', { class: 'col-l' }, labels[i]))));
}
// Line chart from points [{x:label, y:number}]. Draws in the module accent colour.
export function lineChart(points, { height = 150, fmtV = String, min = null } = {}) {
  const box = h('div', { class: 'line' });
  if (points.length < 2) { box.append(h('p', { class: 'muted small' }, points.length ? 'One entry so far: ' + fmtV(points[0].y) + '. The line appears after the next one.' : 'Nothing logged yet.')); return box; }
  const W = 340, H = height, pl = 38, pr = 10, pt = 12, pb = 22;
  const ys = points.map(p => p.y); let lo = min != null ? min : Math.min(...ys), hi = Math.max(...ys);
  if (hi === lo) { hi += 1; lo -= 1; }
  const span = hi - lo; lo -= span * .1; hi += span * .1;
  const x = i => pl + i * (W - pl - pr) / (points.length - 1), y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const d = points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.y).toFixed(1)).join(' ');
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
  for (const g of [lo + (hi - lo) * .1, (lo + hi) / 2, hi - (hi - lo) * .1]) s += `<line x1="${pl}" x2="${W - pr}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line)"/><text x="${pl - 6}" y="${y(g) + 3}" text-anchor="end">${fmtV(Math.round(g * 10) / 10)}</text>`;
  s += `<path d="${d} L${x(points.length - 1)} ${H - pb} L${x(0)} ${H - pb} Z" fill="var(--acc)" fill-opacity=".12"/><path d="${d}" fill="none" stroke="var(--acc)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
  points.forEach((p, i) => { s += `<circle cx="${x(i)}" cy="${y(p.y)}" r="${i === points.length - 1 ? 4.5 : 2.5}" fill="${i === points.length - 1 ? 'var(--acc)' : 'var(--surface)'}" stroke="var(--acc)" stroke-width="1.6"/>`; });
  s += `<text x="${x(0)}" y="${H - 5}" text-anchor="start">${points[0].x}</text><text x="${x(points.length - 1)}" y="${H - 5}" text-anchor="end">${points[points.length - 1].x}</text></svg>`;
  box.innerHTML = s;
  return box;
}

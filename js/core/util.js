// Small helpers shared by every module: dates (as 'YYYY-MM-DD' keys), ids, money, DOM building.

export const pad = n => String(n).padStart(2, '0');
export const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d || 1); };
export const today = () => dkey(new Date());
export const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return dkey(d); };
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
export const dow = k => (parse(k).getDay() + 6) % 7;            // Monday = 0
export const weekStart = k => addDays(k, -dow(k));              // the Monday of that week
export const ymOf = k => k.slice(0, 7);
export const shiftYM = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
export const daysInMonth = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export const fmt = (k, o) => parse(k).toLocaleDateString('en-GB', o || { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtShort = k => fmt(k, { day: 'numeric', month: 'short' });
export const monthName = (ym, year) => parse(ym + '-01').toLocaleDateString('en-GB', year ? { month: 'long', year: 'numeric' } : { month: 'long' });
export const relDay = k => { const t = today(); return k === t ? 'Today' : k === addDays(t, -1) ? 'Yesterday' : k === addDays(t, 1) ? 'Tomorrow' : fmt(k, { weekday: 'short', day: 'numeric', month: 'short' }); };
export const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WDL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
export const sum = (a, f = x => x) => a.reduce((t, x) => t + (+f(x) || 0), 0);

// Money (UGX has no decimals)
export const UGX = n => Math.round(n).toLocaleString('en-US');
export const kfmt = n => { const a = Math.abs(n), s = n < 0 ? '−' : ''; return s + (a >= 1e6 ? (a / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M' : a >= 10000 ? Math.round(a / 1000) + 'k' : a >= 1000 ? (a / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(Math.round(a))); };
export const digits = v => +String(v).replace(/[^\d]/g, '') || 0;

// h('div', {class:'x', onclick:fn}, child, 'text', [more]) -> element. null/false children are skipped.
export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'value') e.value = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  append(e, kids);
  return e;
}
function append(e, kids) { for (const c of kids) { if (c == null || c === false) continue; if (Array.isArray(c)) append(e, c); else e.append(c); } }

// Icons: 24x24 stroke paths, drawn in the current text colour.
const P = {
  home: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 15h2"/>',
  pie: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  tags: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.6-5.9L4 8.5"/><path d="M4 4v4.5h4.5M12 8v4.5l3 2"/>',
  board: '<rect x="3.5" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="11" rx="1.5"/><rect x="15.5" y="4" width="5" height="7" rx="1.5"/>',
  archive: '<rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5"/><path d="M5 9v9.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>',
  stats: '<path d="M5 20V11M12 20V5M19 20v-6"/>',
  dumbbell: '<path d="M7 12h10M4.5 9v6M7 7v10M17 7v10M19.5 9v6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  book: '<path d="M5 4.5h10.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10.5"/>',
  trend: '<path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/>',
  hanger: '<path d="M12 8.5c0-1.6 1.8-1.7 1.8-3.3A1.8 1.8 0 0 0 12 3.4a1.8 1.8 0 0 0-1.8 1.8"/><path d="M12 8.5l8.3 6.2c.9.7.4 2.3-.8 2.3h-15c-1.2 0-1.7-1.6-.8-2.3z"/>',
  shirt: '<path d="M8.5 4l-5 3 2 3.5 2-1V20h9V9.5l2 1 2-3.5-5-3a3.5 3.5 0 0 1-7 0z"/>',
  layers: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  tick: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 3h5"/>',
  camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.2-2h6.2l1.2 2h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.5"/><path d="M4 17l5-4.5 4 3 3-2.5 4 3.5"/>',
  shuffle: '<path d="M4 7h3.5c5 0 5 10 10 10H20M4 17h3.5c1.6 0 2.7-1 3.6-2.3M20 7h-2.5c-1.6 0-2.7 1-3.6 2.3"/><path d="M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.5l.8-12"/>',
  flame: '<path d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-4-3-5.5-3.5-9.5-3 1.5-4.5 4-4.5 6.5-1-.5-1.800-1.5-2-3-1.5 1.5-3 3.5-3 6A6.5 6.5 0 0 0 12 21z"/>',
};
export function icon(name, size = 22) {
  return h('span', { class: 'ic', 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>` });
}

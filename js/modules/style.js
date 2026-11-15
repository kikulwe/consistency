// Style: photograph your clothes once, build outfits from them and rotate through them. Dock: Today · Wardrobe · Outfits · Add.
//
// Document shape (doc 'style'):
//   items:   [{ id, photo, cat: 'top'|'bottom'|'shoes'|'layer'|'accessory', color, occ: ['work', ...], laundry, created }]
//   outfits: [{ id, items: [itemIds], occ, created, flagged }]      flagged = an item it used was removed
//   wears:   [{ date, outfit, items: [itemIds] }]                   the wear log
//   picks:   { 'YYYY-MM-DD': { occ, outfit } }                      today's outfit of the day (stays put through the day)
//   gap:     days before an outfit may come round again (7 to 10)
// Photos are compressed to JPEG and kept in the shared photo store (IndexedDB), so they are in the backup file.
import { h, fill, icon, today, addDays, dow, daysBetween, relDay, uid, plural } from '../core/util.js';
import { doc, save, photos } from '../core/store.js';
import { refresh, tabTo } from '../core/nav.js';
import { head, section, empty, row, btn, dangerBtn, fieldGroup, chips, seg, toggle, linkBtn, openSheet, closeSheet, onSheetClose, toast } from '../core/ui.js';

const CATS = [['top', 'Top'], ['bottom', 'Bottom'], ['shoes', 'Shoes'], ['layer', 'Jacket / layer'], ['accessory', 'Accessory']];
const CAT_PLURAL = { top: 'Tops', bottom: 'Bottoms', shoes: 'Shoes', layer: 'Layers', accessory: 'Accessories' };
const OCCS = [['work', 'Work'], ['casual', 'Casual'], ['church', 'Church'], ['out', 'Going out']];
const COLORS = [['black', 'Black', '#16181D'], ['white', 'White', '#F4F4EF'], ['grey', 'Grey', '#8A8F98'], ['navy', 'Navy', '#1F2A4D'], ['denim', 'Denim', '#4E6E9A'], ['beige', 'Beige', '#D8C7A6'], ['brown', 'Brown', '#7A5236'],
  ['blue', 'Blue', '#3F74D1'], ['green', 'Green', '#3F8F5B'], ['olive', 'Olive', '#6B6B3A'], ['red', 'Red', '#C8403A'], ['maroon', 'Maroon', '#6E1F2B'], ['yellow', 'Yellow', '#E5C13A'], ['orange', 'Orange', '#E2812E'], ['pink', 'Pink', '#E79AB5'], ['purple', 'Purple', '#7B55B5']];
// Simple colour rules: neutrals go with anything; these pairs are avoided.
const NEUTRAL = new Set(['black', 'white', 'grey', 'navy', 'denim', 'beige', 'brown']);
const CLASH = new Set(['red+pink', 'red+orange', 'red+green', 'red+purple', 'maroon+red', 'maroon+orange', 'orange+pink', 'orange+purple', 'green+orange', 'green+pink', 'green+purple', 'olive+green', 'pink+yellow', 'purple+yellow', 'blue+green', 'olive+purple'].flatMap(p => { const [a, b] = p.split('+'); return [a + '+' + b, b + '+' + a]; }));
const colorOf = id => COLORS.find(c => c[0] === id) || COLORS[2];
const label = (list, id) => (list.find(x => x[0] === id) || [0, id])[1];

const S = () => doc('style', () => ({ items: [], outfits: [], wears: [], picks: {}, gap: 7 }));
const changed = () => save('style');
const itemBy = id => S().items.find(i => i.id === id);
const wearsOfItem = id => S().wears.filter(w => w.items.includes(id));
const lastWornItem = id => wearsOfItem(id).map(w => w.date).sort().pop() || null;
const lastWornOutfit = o => S().wears.filter(w => w.outfit === o.id).map(w => w.date).sort().pop() || null;
const defaultOcc = () => dow(today()) < 5 ? 'work' : 'casual';

function photoImg(itemOrId, cls = '') {
  const it = typeof itemOrId === 'string' ? itemBy(itemOrId) : itemOrId;
  const img = h('img', { class: 'ph ' + cls, alt: it ? label(COLORS, it.color) + ' ' + label(CATS, it.cat).toLowerCase() : 'Removed item', loading: 'lazy' });
  if (it) photos.url(it.photo).then(u => { if (u) img.src = u; });
  return img;
}
const collage = (ids, cls = '') => h('div', { class: 'collage n' + Math.min(ids.length, 4) + ' ' + cls }, ids.slice(0, 4).map(id => itemBy(id) ? photoImg(id) : h('div', { class: 'ph gone' }, 'Removed')));

/* ---------- colour rules and the outfit generator ---------- */
function clashes(colors) {
  const accents = [...new Set(colors.filter(c => !NEUTRAL.has(c)))];
  for (let i = 0; i < accents.length; i++) for (let j = i + 1; j < accents.length; j++) if (CLASH.has(accents[i] + '+' + accents[j])) return true;
  return accents.length > 2;                      // more than two strong colours is too busy
}
function generate(occ, withLayer, count = 6) {
  const s = S(), ok = c => s.items.filter(i => i.cat === c && !i.laundry && i.occ.includes(occ));
  const tops = ok('top'), bottoms = ok('bottom'), shoes = ok('shoes'), layers = withLayer ? ok('layer') : [];
  const saved = new Set(s.outfits.map(o => [...o.items].sort().join('|')));
  const stale = id => { const d = lastWornItem(id); return d ? Math.min(30, daysBetween(d, today())) : 30; };   // rotation: favour what has not been worn lately
  const out = [];
  for (const t of tops) for (const b of bottoms) for (const sh of shoes) for (const l of (layers.length ? layers : [null])) {
    const items = [t, b, sh, ...(l ? [l] : [])], colors = items.map(i => i.color);
    if (clashes(colors)) continue;
    if (!NEUTRAL.has(t.color) && t.color === b.color) continue;                 // same strong colour top and bottom
    const ids = items.map(i => i.id);
    if (saved.has([...ids].sort().join('|'))) continue;
    const accents = new Set(colors.filter(c => !NEUTRAL.has(c))).size;
    const score = (accents <= 1 ? 2 : 0) + (NEUTRAL.has(sh.color) ? 1 : 0) + (t.color !== b.color ? 1 : 0) + ids.reduce((a, id) => a + stale(id), 0) / (ids.length * 10) + Math.random() * 1.5;
    out.push({ items: ids, score });
  }
  out.sort((a, b) => b.score - a.score);
  // keep suggestions varied: no top or bottom more than twice
  const used = {}, picked = [];
  for (const o of out) { const [t, b] = o.items; if ((used[t] || 0) >= 2 || (used[b] || 0) >= 2) continue; used[t] = (used[t] || 0) + 1; used[b] = (used[b] || 0) + 1; picked.push(o); if (picked.length >= count) break; }
  return { list: picked, missing: [!tops.length && 'a top', !bottoms.length && 'a bottom', !shoes.length && 'shoes'].filter(Boolean) };
}

/* ---------- rotation: outfit of the day ---------- */
function eligible(occ) {
  const s = S(), cutoff = addDays(today(), -s.gap);
  return s.outfits.filter(o => { const lw = lastWornOutfit(o); return o.occ === occ && !o.flagged && o.items.every(id => { const it = itemBy(id); return it && !it.laundry; }) && !(lw && lw > cutoff); });
}
function pickFor(occ, skip) {
  const s = S(), t = today(), cur = s.picks[t];
  const pool = eligible(occ);
  if (!skip && cur && cur.occ === occ && pool.some(o => o.id === cur.outfit)) return pool.find(o => o.id === cur.outfit);
  // least recently worn first (never worn wins), skipping the one just shown
  const ranked = pool.filter(o => !skip || o.id !== skip).sort((a, b) => (lastWornOutfit(a) || '').localeCompare(lastWornOutfit(b) || '') || a.created.localeCompare(b.created));
  const pick = ranked[0] || (skip ? pool[0] : null);
  for (const k of Object.keys(s.picks)) if (k < addDays(t, -3)) delete s.picks[k];
  const id = pick ? pick.id : null;
  if (!cur || cur.occ !== occ || cur.outfit !== id) { s.picks[t] = { occ, outfit: id }; changed(); }
  return pick || null;
}
const wornToday = () => S().wears.find(w => w.date === today());
function wear(o) {
  const s = S(), w = { date: today(), outfit: o.id, items: o.items.filter(itemBy) };
  s.wears = s.wears.filter(x => x.date !== today()); s.wears.push(w); changed(); refresh();
  toast('Logged. It rests for ' + s.gap + ' days.', () => { s.wears = s.wears.filter(x => x !== w); changed(); refresh(); });
}

/* ---------- Today ---------- */
function todayView() {
  const s = S(), t = today(), occ = (s.picks[t] && s.picks[t].occ) || defaultOcc();
  if (!s.items.length) return [head('Style', 'Outfit of the day'), empty('Photograph your clothes once. The app builds outfits from them and rotates through them.', btn('Add your first item', () => tabTo('add'), 'pri sm'))];
  const worn = wornToday(), wornOutfit = worn && s.outfits.find(o => o.id === worn.outfit);
  const pick = worn ? null : pickFor(occ);
  const pool = eligible(occ), anyForOcc = s.outfits.some(o => o.occ === occ);
  const laundry = s.items.filter(i => i.laundry);
  const counts = s.items.map(i => [i, wearsOfItem(i.id).length]).sort((a, b) => b[1] - a[1]);
  const most = counts.filter(c => c[1] > 0).slice(0, 4), never = counts.filter(c => c[1] === 0).map(c => c[0]);
  return [
    head('Today', 'Outfit of the day'),
    worn ? null : chips(OCCS, occ, v => { s.picks[t] = { occ: v, outfit: null }; changed(); refresh(); }, { scroll: true }),
    worn
      ? h('div', { class: 'card stack' }, collage(worn.items, 'big'), h('div', { class: 'hstack' }, h('span', { class: 'checkbox on' }, icon('tick', 16)), h('div', { class: 'grow' }, h('h3', {}, 'Wearing this today'), h('p', { class: 'muted small' }, (wornOutfit ? label(OCCS, wornOutfit.occ) + ' · ' : '') + 'back in rotation in ' + s.gap + ' days'))),
        btn('Change', () => { s.wears = s.wears.filter(x => x !== worn); changed(); refresh(); }, 'sm'))
      : pick
        ? h('div', { class: 'card stack' }, collage(pick.items, 'big'),
          h('p', { class: 'muted small' }, pick.items.map(id => itemBy(id)).filter(Boolean).map(i => label(COLORS, i.color) + ' ' + label(CATS, i.cat).toLowerCase()).join(' · ')),
          h('div', { class: 'actions' }, btn('Wore this', () => wear(pick), 'pri'), btn('Pick another', () => { const n = pickFor(occ, pick.id); refresh(); if (!n || n.id === pick.id) toast('That’s the only one ready for ' + label(OCCS, occ).toLowerCase() + '.'); })),
          h('p', { class: 'hint' }, plural(pool.length, 'outfit') + ' ready for ' + label(OCCS, occ).toLowerCase() + ' · ' + (lastWornOutfit(pick) ? 'last worn ' + relDay(lastWornOutfit(pick)).toLowerCase() : 'not worn yet')))
        : empty(anyForOcc ? 'Every ' + label(OCCS, occ).toLowerCase() + ' outfit was worn in the last ' + s.gap + ' days or has something in the laundry.' : 'No saved ' + label(OCCS, occ).toLowerCase() + ' outfits yet.', btn(anyForOcc ? 'Make a new outfit' : 'Generate outfits', () => { genOcc = occ; tabTo('outfits'); }, 'pri sm')),
    laundry.length ? section('In the laundry', linkBtn('All clean', () => { laundry.forEach(i => { i.laundry = false; }); changed(); refresh(); toast('Everything is back in rotation'); })) : null,
    laundry.length ? h('div', { class: 'thumbrow hscroll' }, laundry.map(i => h('button', { type: 'button', class: 'thumb', 'aria-label': 'Open item', onclick: () => itemSheet(i) }, photoImg(i)))) : null,
    section('Rotation'),
    h('div', { class: 'card' }, fieldGroup('Don’t repeat an outfit for', seg([[7, '7 days'], [8, '8'], [9, '9'], [10, '10 days']], s.gap, v => { s.gap = v; changed(); refresh(); }))),
    most.length ? section('Most worn') : null,
    most.length ? h('div', { class: 'thumbrow hscroll' }, most.map(([i, n]) => h('button', { type: 'button', class: 'thumb', onclick: () => itemSheet(i) }, photoImg(i), h('span', { class: 'cnt' }, n + '×')))) : null,
    never.length ? section('Never worn', h('span', { class: 'muted small' }, plural(never.length, 'item'))) : null,
    never.length ? h('div', { class: 'thumbrow hscroll' }, never.slice(0, 12).map(i => h('button', { type: 'button', class: 'thumb', onclick: () => itemSheet(i) }, photoImg(i)))) : null,
  ];
}

/* ---------- Wardrobe ---------- */
const filt = { cat: 'all', color: 'all', occ: 'all' };
function wardrobe() {
  const s = S();
  const sel = (key, options, lbl) => h('select', { class: 'in', 'aria-label': lbl, onchange: e => { filt[key] = e.target.value; refresh(); } }, [['all', lbl], ...options].map(([v, l]) => { const o = h('option', { value: v }, l); if (filt[key] === v) o.selected = true; return o; }));
  const list = s.items.filter(i => (filt.cat === 'all' || i.cat === filt.cat) && (filt.color === 'all' || i.color === filt.color) && (filt.occ === 'all' || i.occ.includes(filt.occ)));
  const usedColors = COLORS.filter(c => s.items.some(i => i.color === c[0]));
  return [
    head('Wardrobe', plural(s.items.length, 'item')),
    s.items.length ? chips([['all', 'All'], ...CATS.map(([v]) => [v, CAT_PLURAL[v]])], filt.cat, v => { filt.cat = v; refresh(); }, { scroll: true }) : null,
    s.items.length ? h('div', { class: 'grid2' }, sel('color', usedColors.map(c => [c[0], c[1]]), 'Any colour'), sel('occ', OCCS, 'Any occasion')) : null,
    !s.items.length ? empty('Your wardrobe is empty. Add clothes with the camera or from your photos.', btn('Add an item', () => tabTo('add'), 'pri sm'))
      : list.length ? h('div', { class: 'wgrid' }, list.map(i => h('button', { type: 'button', class: 'witem', onclick: () => itemSheet(i) }, photoImg(i),
        h('span', { class: 'wtag' }, h('i', { class: 'dot', style: 'background:' + colorOf(i.color)[2] }), label(CATS, i.cat).split(' ')[0]), i.laundry ? h('span', { class: 'wlaundry' }, 'Laundry') : null)))
        : empty('Nothing matches those filters.', btn('Clear filters', () => { filt.cat = filt.color = filt.occ = 'all'; refresh(); }, 'sm')),
  ];
}
function tagForm(st) {
  return [
    fieldGroup('Category', chips(CATS, st.cat, v => { st.cat = v; })),
    fieldGroup('Colour', chips(COLORS.map(c => [c[0], c[1], c[2]]), st.color, v => { st.color = v; })),
    fieldGroup('Occasion', chips(OCCS, st.occ, v => { st.occ = v; }, { multi: true }), 'Pick every occasion it works for.'),
  ];
}
function itemSheet(i) {
  const s = S(), st = { cat: i.cat, color: i.color, occ: [...i.occ] }, n = wearsOfItem(i.id).length, last = lastWornItem(i.id);
  const inOutfits = s.outfits.filter(o => o.items.includes(i.id));
  const remove = withOutfits => {
    if (withOutfits) s.outfits = s.outfits.filter(o => !o.items.includes(i.id)); else inOutfits.forEach(o => { o.flagged = true; });
    s.items = s.items.filter(x => x !== i); photos.del(i.photo); changed(); closeSheet(); refresh();
    toast(inOutfits.length ? (withOutfits ? 'Item and ' + plural(inOutfits.length, 'outfit') + ' removed' : 'Item removed · ' + plural(inOutfits.length, 'outfit') + ' flagged') : 'Item removed');
  };
  openSheet(
    photoImg(i, 'hero'),
    h('p', { class: 'muted small' }, n ? 'Worn ' + plural(n, 'time') + ' · last ' + relDay(last).toLowerCase() : 'Never worn yet'),
    h('div', { class: 'card flush', style: 'background:var(--raised)' }, row('In the laundry', 'Outfits using it are skipped until it’s clean.', toggle(i.laundry, v => { i.laundry = v; changed(); }, 'In the laundry'))),
    tagForm(st),
    btn('Save changes', () => { if (!st.occ.length) return toast('Pick at least one occasion.'); Object.assign(i, st); changed(); closeSheet(); refresh(); toast('Saved'); }, 'pri'),
    inOutfits.length
      ? h('div', { class: 'stack', style: 'gap:8px' }, h('p', { class: 'muted small' }, 'Used in ' + plural(inOutfits.length, 'saved outfit') + '. Removing it can remove those outfits too, or keep them flagged as missing an item.'),
        dangerBtn('Remove item and ' + plural(inOutfits.length, 'outfit'), 'Tap again to remove both', () => remove(true)), dangerBtn('Remove item, keep outfits flagged', 'Tap again to remove the item', () => remove(false)))
      : dangerBtn('Remove item', 'Tap again to remove', () => remove(false)));
  onSheetClose(refresh);     // redraw after the sheet closes so a laundry change shows up
}

/* ---------- Outfits (generator, saved, build your own) ---------- */
let genOcc = null, genLayer = false, genList = null;
function saveOutfit(ids, occ, msg = 'Outfit saved') {
  const s = S(), key = [...ids].sort().join('|');
  if (s.outfits.some(o => [...o.items].sort().join('|') === key && o.occ === occ)) return toast('You already saved that outfit.');
  s.outfits.push({ id: uid('o'), items: ids, occ, created: new Date().toISOString() }); changed(); toast(msg);
}
function outfits() {
  const s = S(); if (!genOcc) genOcc = defaultOcc();
  if (!genList) genList = generate(genOcc, genLayer);
  const regen = () => { genList = generate(genOcc, genLayer); refresh(); };
  const saved = s.outfits.filter(o => o.occ === genOcc), others = s.outfits.length - saved.length;
  return [
    head('Outfits', plural(s.outfits.length, 'saved outfit')),
    chips(OCCS, genOcc, v => { genOcc = v; genList = null; refresh(); }, { scroll: true }),
    section('Ideas for ' + label(OCCS, genOcc).toLowerCase(), genList.list.length ? linkBtn('Shuffle', regen) : null),
    genList.missing.length
      ? empty('To build ' + label(OCCS, genOcc).toLowerCase() + ' outfits you still need ' + genList.missing.join(', ') + ' tagged for it (and not in the laundry).', btn('Add an item', () => tabTo('add'), 'pri sm'))
      : genList.list.length
        ? h('div', { class: 'ogrid' }, genList.list.map(o => h('div', { class: 'ocard' }, collage(o.items), btn('Save', () => { saveOutfit(o.items, genOcc); genList.list = genList.list.filter(x => x !== o); refresh(); }, 'sm pri wide'))))
        : empty('No new combinations pass the colour rules. Add more clothes or build one by hand.'),
    h('div', { class: 'card flush' },
      row('Include a jacket or layer', 'Adds one on top when you have layers for this occasion.', toggle(genLayer, v => { genLayer = v; regen(); }, 'Include a layer')),
      row('Build your own', 'Pick each piece by hand.', null, () => buildSheet())),
    section('Saved for ' + label(OCCS, genOcc).toLowerCase(), others ? h('span', { class: 'muted small' }, others + ' more under other occasions') : null),
    saved.length ? h('div', { class: 'ogrid' }, saved.map(o => { const lw = lastWornOutfit(o);
      return h('button', { type: 'button', class: 'ocard', onclick: () => outfitSheet(o) }, collage(o.items), h('span', { class: 'ometa' + (o.flagged ? ' warn' : '') }, o.flagged ? 'Missing an item' : lw ? 'Worn ' + relDay(lw).toLowerCase() : 'Not worn yet')); }))
      : empty('Save an idea above, or build your own, and it joins the daily rotation.'),
  ];
}
function outfitSheet(o) {
  const s = S(), n = s.wears.filter(w => w.outfit === o.id).length, lw = lastWornOutfit(o);
  openSheet(h('h2', {}, label(OCCS, o.occ) + ' outfit'), collage(o.items, 'big'),
    h('p', { class: 'muted small' }, (o.flagged ? 'One of its items was removed, so it’s out of the rotation. ' : '') + (n ? 'Worn ' + plural(n, 'time') + ' · last ' + relDay(lw).toLowerCase() : 'Not worn yet')),
    fieldGroup('Occasion', chips(OCCS, o.occ, v => { o.occ = v; changed(); })),
    h('div', { class: 'actions' }, o.flagged ? null : btn('Wore this today', () => { closeSheet(); wear(o); }, 'pri'),
      dangerBtn('Remove outfit', 'Tap again to remove', () => { s.outfits = s.outfits.filter(x => x !== o); changed(); closeSheet(); refresh(); toast('Outfit removed'); })));
  onSheetClose(refresh);
}
function buildSheet() {
  const s = S(), st = { top: null, bottom: null, shoes: null, layer: null, accessory: null, occ: genOcc };
  const slot = ([cat, name]) => { const items = s.items.filter(i => i.cat === cat); const box = h('div', { class: 'thumbrow hscroll' });
    const draw = () => fill(box, items.length ? items.map(i => h('button', { type: 'button', class: 'thumb' + (st[cat] === i.id ? ' on' : ''), 'aria-pressed': String(st[cat] === i.id), onclick: () => { st[cat] = st[cat] === i.id ? null : i.id; draw(); } }, photoImg(i))) : h('p', { class: 'muted small' }, 'None in your wardrobe yet.'));
    draw(); return fieldGroup(name + (cat === 'layer' || cat === 'accessory' ? ' (optional)' : ''), box); };
  openSheet(h('h2', {}, 'Build an outfit'), CATS.map(slot), fieldGroup('Occasion', chips(OCCS, st.occ, v => { st.occ = v; })),
    btn('Save outfit', () => {
      if (!st.top || !st.bottom || !st.shoes) return toast('Pick a top, a bottom and shoes.');
      const ids = [st.top, st.bottom, st.shoes, st.layer, st.accessory].filter(Boolean);
      saveOutfit(ids, st.occ, clashes(ids.map(id => itemBy(id).color)) ? 'Saved. Heads up: those colours usually clash.' : 'Outfit saved'); genOcc = st.occ; genList = null; closeSheet(); refresh();
    }, 'pri'));
}

/* ---------- Add (camera or photo library -> crop -> tag) ---------- */
let crop = null;         // { img, url, w, h, z, x, y, side } while a photo is being cropped
let tagging = null;      // { blob, url, cat, color, occ } once it is cropped
const OUT = 800;         // saved photos are 800 x 800 JPEG

function loadFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { crop = { img, url, w: img.naturalWidth, h: img.naturalHeight, z: 1, x: 0, y: 0 }; tagging = null; refresh(); };
  img.onerror = () => { URL.revokeObjectURL(url); toast('That photo couldn’t be opened. Try another.'); };
  img.src = url;
}
function cropView() {
  const c = crop, box = h('div', { class: 'cropbox' }), im = h('img', { src: c.url, alt: 'Photo to crop', draggable: 'false' });
  box.append(im, h('div', { class: 'cropgrid' }));
  const zoom = h('input', { type: 'range', min: '1', max: '4', step: '0.01', value: String(c.z), 'aria-label': 'Zoom', class: 'range' });
  const layout = () => {
    c.side = box.clientWidth || 300; const base = c.side / Math.min(c.w, c.h), sc = base * c.z, dw = c.w * sc, dh = c.h * sc;
    c.x = Math.min(0, Math.max(c.side - dw, c.x)); c.y = Math.min(0, Math.max(c.side - dh, c.y));
    im.style.width = dw + 'px'; im.style.height = dh + 'px'; im.style.transform = `translate(${c.x}px, ${c.y}px)`;
  };
  const setZoom = (z, cx, cy) => { z = Math.min(4, Math.max(1, z)); const k = z / c.z; c.x = cx - (cx - c.x) * k; c.y = cy - (cy - c.y) * k; c.z = z; zoom.value = String(z); layout(); };
  requestAnimationFrame(() => { const base = (box.clientWidth || 300) / Math.min(c.w, c.h); if (!c.placed) { c.placed = true; c.x = ((box.clientWidth || 300) - c.w * base) / 2; c.y = ((box.clientWidth || 300) - c.h * base) / 2; } layout(); });
  zoom.oninput = () => setZoom(+zoom.value, c.side / 2, c.side / 2);
  // one finger drags, two fingers pinch
  let last = null, pinch = null;
  const pt = t => { const r = box.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; };
  box.addEventListener('touchstart', e => { if (e.touches.length === 2) { const [a, b] = [pt(e.touches[0]), pt(e.touches[1])]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: c.z }; last = null; } else last = pt(e.touches[0]); }, { passive: true });
  box.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 2 && pinch) { const [a, b] = [pt(e.touches[0]), pt(e.touches[1])]; setZoom(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    else if (last) { const p = pt(e.touches[0]); c.x += p[0] - last[0]; c.y += p[1] - last[1]; last = p; layout(); }
  }, { passive: false });
  box.addEventListener('touchend', e => { pinch = null; last = e.touches.length === 1 ? pt(e.touches[0]) : null; });
  box.addEventListener('mousedown', e => { last = pt(e); const mv = ev => { const p = pt(ev); c.x += p[0] - last[0]; c.y += p[1] - last[1]; last = p; layout(); }; const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); }; window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up); });
  const use = () => {
    const sc = c.side / Math.min(c.w, c.h) * c.z, src = c.side / sc, size = Math.round(Math.min(OUT, src));
    const cv = h('canvas', { width: size, height: size }), g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.drawImage(c.img, -c.x / sc, -c.y / sc, src, src, 0, 0, size, size);
    // guess the colour from the middle of the photo to pre-select a tag
    const d = g.getImageData(Math.round(size * .35), Math.round(size * .35), Math.max(1, Math.round(size * .3)), Math.max(1, Math.round(size * .3))).data; let r = 0, gg = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } const n = d.length / 4;
    const guess = nearestColor(r / n, gg / n, b / n);
    cv.toBlob(blob => { if (!blob) return toast('Couldn’t save that photo. Try again.'); URL.revokeObjectURL(c.url); crop = null; tagging = { blob, url: URL.createObjectURL(blob), cat: lastTags.cat, color: guess, occ: [...lastTags.occ] }; refresh(); }, 'image/jpeg', .82);
  };
  return [
    head('Crop', 'Drag to move, pinch to zoom'),
    box, h('div', { class: 'hstack' }, h('span', { class: 'muted small' }, 'Zoom'), h('div', { class: 'grow' }, zoom)),
    h('div', { class: 'actions' }, btn('Use photo', use, 'pri'), btn('Cancel', () => { URL.revokeObjectURL(c.url); crop = null; refresh(); })),
  ];
}
const lastTags = { cat: 'top', occ: ['casual'] };     // remembered between items so adding a batch is quick
function nearestColor(r, g, b) {
  const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  let best = 'grey', bd = 1e9; for (const [id, , c] of COLORS) { const [R, G, B] = hex(c); const d = (R - r) ** 2 * .3 + (G - g) ** 2 * .59 + (B - b) ** 2 * .11; if (d < bd) { bd = d; best = id; } }
  return best;
}
function tagView() {
  const tg = tagging;
  return [
    head('Tag it', 'Last step'),
    h('div', { class: 'hstack', style: 'align-items:flex-start;gap:14px' }, h('img', { class: 'ph tagph', src: tg.url, alt: 'Cropped photo' }), h('p', { class: 'muted small grow' }, 'The colour is a guess from the photo. Change it if it’s off.')),
    h('div', { class: 'card stack' }, tagForm(tg)),
    h('div', { class: 'actions' }, btn('Save item', async () => {
      if (!tg.occ.length) return toast('Pick at least one occasion.');
      const id = uid('i'), pid = 'ph-' + id;
      try { await photos.put(pid, tg.blob); } catch (e) { return toast('Couldn’t save the photo. Your phone storage may be full.'); }
      S().items.push({ id, photo: pid, cat: tg.cat, color: tg.color, occ: [...tg.occ], laundry: false, created: today() }); changed();
      lastTags.cat = tg.cat; lastTags.occ = [...tg.occ]; URL.revokeObjectURL(tg.url); tagging = null; genList = null; refresh(); toast('Added to your wardrobe');
    }, 'pri'), btn('Discard', () => { URL.revokeObjectURL(tg.url); tagging = null; refresh(); })),
  ];
}
function add() {
  if (crop) return cropView();
  if (tagging) return tagView();
  const pickFile = capture => { const i = h('input', { type: 'file', accept: 'image/*', capture: capture ? 'environment' : null, hidden: true, onchange: e => loadFile(e.target.files[0]) }); document.body.append(i); i.click(); setTimeout(() => i.remove(), 60000); };
  const n = S().items.length;
  return [
    head('Add', 'A new piece of clothing'),
    h('div', { class: 'grid2' },
      h('button', { type: 'button', class: 'bigbtn', onclick: () => pickFile(true) }, icon('camera', 30), h('b', {}, 'Take a photo'), h('span', {}, 'Lay it flat in good light')),
      h('button', { type: 'button', class: 'bigbtn', onclick: () => pickFile(false) }, icon('image', 30), h('b', {}, 'Choose from Photos'), h('span', {}, 'Pick one you already have'))),
    h('div', { class: 'card stack' }, h('h3', {}, 'How it works'), h('ol', { class: 'steps' }, ['Take or choose a photo, then crop it square.', 'Tag its category, colour and the occasions it suits.', 'Open Outfits to generate combinations and save the ones you like.'].map(x => h('li', {}, x)))),
    n ? h('p', { class: 'muted small', style: 'text-align:center' }, plural(n, 'item') + ' in your wardrobe so far. Photos are shrunk and stored on this phone.') : null,
  ];
}

export default {
  id: 'style', name: 'Style', color: '#C4A1FF', icon: 'hanger',
  tabs: [{ id: 'today', label: 'Today', icon: 'sun' }, { id: 'wardrobe', label: 'Wardrobe', icon: 'shirt' }, { id: 'outfits', label: 'Outfits', icon: 'layers' }, { id: 'add', label: 'Add', icon: 'plus', add: true }],
  init() { S(); },
  render: tab => ({ today: todayView, wardrobe, outfits, add })[tab](),
  tile() {
    const s = S(); if (!s.items.length) return { badge: 'Add clothes', sub: 'Photograph them once' };
    const l = s.items.filter(i => i.laundry).length;
    return { badge: plural(s.outfits.length, 'outfit'), sub: plural(s.items.length, 'item') + (l ? ' · ' + l + ' in laundry' : '') };
  },
  today() {
    const s = S(), w = wornToday();
    if (!s.items.length) return { label: 'Outfit', value: 'Add clothes', sub: 'Style is empty', tab: 'add' };
    if (w) return { label: 'Outfit · wearing', thumbs: w.items.map(id => itemBy(id)).filter(Boolean).map(i => i.photo), value: 'Logged', tab: 'today' };
    const occ = (s.picks[today()] && s.picks[today()].occ) || defaultOcc(), p = pickFor(occ);
    return p ? { label: 'Outfit · ' + label(OCCS, occ).toLowerCase(), thumbs: p.items.map(id => itemBy(id)).filter(Boolean).map(i => i.photo), value: 'Ready', tab: 'today' }
      : { label: 'Outfit', value: 'None ready', sub: s.outfits.length ? 'All worn recently' : 'Save some outfits', tab: 'outfits' };
  },
};

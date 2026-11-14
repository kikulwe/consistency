// Home screen: a "Today" strip and one tile per module, each with a live badge.
import { h, icon, today, fmt, daysBetween } from './core/util.js';
import { doc, photos } from './core/store.js';
import { go } from './core/nav.js';
import { head, section } from './core/ui.js';

const safe = fn => { try { return fn(); } catch (e) { console.error(e); return null; } };

export function renderHome(MODULES) {
  const s = doc('settings'), hr = new Date().getHours();
  const hello = (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + (s.name ? ', ' + s.name : '');

  // Today strip: today's workout, outfit of the day, open tasks, habits left
  const strip = MODULES.map(m => [m, m.today && safe(() => m.today())]).filter(([, t]) => t).map(([m, t]) => {
    const thumbs = t.thumbs && t.thumbs.length ? h('span', { class: 'thumbs' }, t.thumbs.slice(0, 4).map(id => { const img = h('img', { alt: '' }); photos.url(id).then(u => { if (u) img.src = u; }); return img; })) : null;
    return h('button', { type: 'button', style: '--c:' + m.color, onclick: () => go(m.id, t.tab || '') },
      h('span', { class: 't-l' }, h('i'), t.label),
      thumbs || h('span', { class: 't-v' }, t.value),
      t.sub ? h('span', { class: 't-s' }, t.sub) : null);
  });

  const tiles = MODULES.map(m => {
    const t = safe(() => m.tile()) || {};
    return h('button', { class: 'tile', type: 'button', style: '--c:' + m.color, onclick: () => go(m.id) },
      h('span', { class: 'tile-ic' }, icon(m.icon, 25)),
      t.pip ? h('span', { class: 'pip' }, String(t.pip)) : null,
      h('span', {}, h('span', { class: 'tile-n' }, m.name), h('div', { class: 'tile-b' }, t.badge || 'Open'), h('div', { class: 'tile-s' }, t.sub || ' ')));
  });
  const since = s.lastBackup ? daysBetween(s.lastBackup, today()) : null;
  tiles.push(h('button', { class: 'tile', type: 'button', style: '--c:#C9CFDD', onclick: () => go('settings') },
    h('span', { class: 'tile-ic' }, icon('gear', 25)),
    h('span', {}, h('span', { class: 'tile-n' }, 'Settings'), h('div', { class: 'tile-b' }, 'Backup'),
      h('div', { class: 'tile-s' + (since == null || since > 14 ? ' warn' : '') }, since == null ? 'Not backed up yet' : since === 0 ? 'Saved today' : 'Saved ' + since + (since === 1 ? ' day ago' : ' days ago')))));

  return [
    head(hello, fmt(today())),
    section('Today'),
    h('div', { class: 'today' }, strip),
    section('Apps'),
    h('div', { class: 'tiles' }, tiles),
  ];
}

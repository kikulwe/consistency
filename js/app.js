// Life OS shell: start-up, routing, the per-module dock and page transitions.
// Each module in js/modules/ exports { id, name, color, icon, tabs, init(), render(tab, arg), tile(), today() }.
import { h, icon, today } from './core/util.js';
import { initStore, doc, persistent } from './core/store.js';
import { setRenderer, route, go, tabTo, goHome } from './core/nav.js';
import { initSheet, closeSheet, sheetOpen, toast } from './core/ui.js';
import { initLock } from './core/lock.js';
import { migrateLegacy } from './core/legacy.js';
import { renderHome } from './home.js';
import { renderSettings } from './settings.js';
import budget from './modules/budget.js';
import tasks from './modules/tasks.js';
import gym from './modules/gym.js';
import style from './modules/style.js';
import consistency from './modules/consistency.js';

export const VERSION = '6.0';
export const MODULES = [budget, tasks, gym, style, consistency];
const byId = Object.fromEntries(MODULES.map(m => [m.id, m]));
const $ = id => document.getElementById(id);

let prev = null;
function render(keepScroll) {
  const r = route(), view = $('view'), app = $('app'), dock = $('dock');
  const mod = byId[r.mod];
  const tab = mod ? (mod.tabs.some(t => t.id === r.tab) || (mod.pages || []).includes(r.tab) ? r.tab : mod.tabs[0].id) : '';
  const scroll = view.scrollTop;
  let nodes;
  try {
    nodes = mod ? mod.render(tab, r.arg) : r.mod === 'settings' ? renderSettings(VERSION) : renderHome(MODULES);
  } catch (e) {
    console.error(e);
    nodes = [h('div', { class: 'card empty' }, h('p', {}, 'This screen hit a problem: ' + (e && e.message || e)), h('button', { class: 'btn', type: 'button', onclick: goHome }, 'Back to home'))];
  }
  app.dataset.mod = mod ? mod.id : r.mod;
  document.documentElement.style.setProperty('--acc', mod ? mod.color : '#F3F5FA');   // on the root so sheets and toasts pick it up too
  view.className = mod ? 'v-' + mod.id + ' t-' + tab : 'v-' + (r.mod === 'settings' ? 'settings' : 'home');
  view.replaceChildren(...[nodes].flat(Infinity).filter(Boolean));

  // dock
  app.classList.toggle('has-dock', !!mod || r.mod === 'settings');
  dock.hidden = !mod && r.mod !== 'settings';
  if (mod) {
    const dockTab = mod.tabs.some(t => t.id === tab) ? tab : (mod.pageParent && mod.pageParent[tab]) || '';
    dock.replaceChildren(
      h('button', { type: 'button', class: 'dock-home', 'aria-label': 'Home', onclick: goHome }, icon('home', 22)),
      ...mod.tabs.map(t => h('button', { type: 'button', class: t.add ? 'add' : '', 'aria-current': t.id === dockTab ? 'page' : null, onclick: () => tabTo(t.id) }, icon(t.icon, t.add ? 20 : 23), t.label)));
  } else if (r.mod === 'settings') {
    dock.replaceChildren(h('button', { type: 'button', class: 'dock-home', style: 'flex:1;border:0', onclick: goHome }, icon('home', 22), 'Home'));
  }

  // transitions: opening a module rises in, tabs slide sideways, going home settles back
  const same = prev && prev.mod === r.mod;
  if (!keepScroll || !same || prev.tab !== tab || prev.arg !== r.arg) {
    view.scrollTop = 0;
    let from = null;
    if (!prev) from = null;
    else if (!same) from = r.mod === 'home' ? { transform: 'scale(1.03)', opacity: 0 } : { transform: 'translateY(18px) scale(.985)', opacity: 0 };
    else if (mod && prev.tab !== tab) { const a = mod.tabs.findIndex(t => t.id === prev.tab), b = mod.tabs.findIndex(t => t.id === tab); from = { transform: `translateX(${b >= a ? 22 : -22}px)`, opacity: 0 }; }
    if (from && view.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) view.animate([from, { transform: 'none', opacity: 1 }], { duration: 230, easing: 'cubic-bezier(.2,.8,.2,1)' });
  } else view.scrollTop = scroll;
  prev = { mod: r.mod, tab, arg: r.arg };
}

async function boot() {
  await initStore();
  doc('settings', () => ({ name: 'Andrew' }));
  migrateLegacy();                       // first launch only: bring over the old Consistency + Budget data
  for (const m of MODULES) { try { m.init && m.init(); } catch (e) { console.error(m.id, e); } }
  initSheet();
  setRenderer(render);
  window.addEventListener('hashchange', () => { closeSheet(); render(false); });
  window.addEventListener('store-error', () => toast('Couldn’t save. Your phone storage may be full.'));
  initLock(() => render(true));
  render(false);
  if (!persistent) toast('Private browsing: nothing will be saved.');

  // Redraw when the day changes or the app comes back to the front (week rollover, streak warnings, etc.)
  let stamp = today() + '@' + new Date().getHours();
  const tick = () => {
    const s = today() + '@' + new Date().getHours();
    if (s === stamp || document.hidden) return;
    const dayChanged = s.slice(0, 10) !== stamp.slice(0, 10); stamp = s;
    if (dayChanged) for (const m of MODULES) { try { m.init && m.init(); } catch (e) { console.error(e); } }
    if (!sheetOpen() && !document.querySelector('#view input:focus, #view textarea:focus')) render(true);
  };
  setInterval(tick, 60000);
  document.addEventListener('visibilitychange', tick);

  if ('serviceWorker' in navigator) {
    const had = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();
export { go };

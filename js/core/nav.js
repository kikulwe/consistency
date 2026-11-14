// Routing. The address is #/<module>/<tab>/<arg>, e.g. #/budget/add or #/tasks/past/2026-11-02.
// Opening a module adds a history entry (so swiping back returns home); switching tabs replaces it.

let renderer = () => {};
export const setRenderer = fn => { renderer = fn; };

export const route = () => {
  const p = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  return { mod: p[0] || 'home', tab: p[1] || '', arg: p[2] || '' };
};
const url = (mod, tab, arg) => '#/' + [mod === 'home' ? '' : mod, tab, arg].filter(Boolean).map(encodeURIComponent).join('/');

export function go(mod, tab = '', arg = '', { replace = false } = {}) {
  const u = url(mod, tab, arg);
  if (u === (location.hash || '#/')) return renderer(true);
  if (replace) location.replace(u); else location.hash = u;
}
// Switch tab inside the current module without growing the history.
export const tabTo = (tab, arg = '') => go(route().mod, tab, arg, { replace: true });
// Open a sub-page inside the current module (back returns to where you were).
export const openPage = (tab, arg = '') => go(route().mod, tab, arg);
export const goHome = () => go('home', '', '', { replace: true });
export const back = () => history.back();
// Redraw the current screen, keeping the scroll position.
export const refresh = () => renderer(true);

/* tiny event bus so modules can talk without importing each other (e.g. gym -> habits) */
const subs = {};
export const on = (evt, fn) => { (subs[evt] = subs[evt] || []).push(fn); };
export const emit = (evt, data) => { (subs[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); };

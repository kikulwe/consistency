// Reads what the old single-file app (Consistency 5.0) kept in localStorage, so each module can
// import its part on first launch. The old data is never deleted, so it stays as a safety net.
import { doc, save } from './store.js';

const OLD_HABITS = 'consistency-log-v1', OLD_BUDGET = 'super-budget-v2';
const SKIP = 'life-os-skip-legacy';   // set after "Erase everything" so the old data is not imported again
const read = k => { try { return localStorage.getItem(SKIP) ? null : JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
export const skipLegacy = () => { try { localStorage.setItem(SKIP, '1'); } catch (e) {} };

export const legacyHabits = () => { const d = read(OLD_HABITS); return d && typeof d.habits === 'object' ? d : null; };
export const legacyBudget = () => { const b = read(OLD_BUDGET); return b && b.v === 2 ? b : null; };

// App-wide settings (name, Face ID lock, last backup date, icon badge) move into the shared settings document.
export function migrateLegacy() {
  const s = doc('settings');
  if (s.legacyChecked) return;
  s.legacyChecked = true;
  const old = legacyHabits();
  if (old && old.settings) {
    const o = old.settings;
    if (o.name) s.name = o.name;
    if (o.lock && o.lock.on) s.lock = o.lock;
    if (o.badge) s.badge = true;
    if (o.lastBackup) s.lastBackup = o.lastBackup;
    s.importedFromOld = new Date().toISOString().slice(0, 10);
  }
  save('settings');
}

// Turns an old "consistency-log" backup file into the parts the new modules understand.
export const isOldBackup = b => b && b.app === 'consistency-log' && typeof b.habits === 'object';

// Modules register a function that takes an old backup ({habits, days, reviews, settings, budget}) and
// loads their part of it. Settings > Import calls these when it is given an old Consistency backup file.
const importers = [];
export const onOldBackup = fn => { importers.push(fn); };
export const importOldBackup = b => { importers.forEach(fn => fn(b)); };

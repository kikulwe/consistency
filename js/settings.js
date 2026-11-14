// Settings: backup (export / import one JSON file, photos included), Face ID lock, updates.
import { h, today, fmt, daysBetween } from './core/util.js';
import { doc, save, exportBackup, importBackup, wipeAll, usage, photos } from './core/store.js';
import { refresh } from './core/nav.js';
import { head, section, row, toggle, input, btn, dangerBtn, toast } from './core/ui.js';
import { toggleLock, lockOn, lockNote, setLockAfter } from './core/lock.js';
import { isOldBackup, importOldBackup, skipLegacy } from './core/legacy.js';

async function doExport() {
  try {
    const name = 'life-os-backup-' + today() + '.json';
    const file = new File([await exportBackup()], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Life OS backup' });
    else { const a = h('a', { href: URL.createObjectURL(file), download: name }); document.body.append(a); a.click(); a.remove(); }
    doc('settings').lastBackup = today(); save('settings'); refresh();
    toast('Backup ready. Save it to Files or iCloud Drive.');
  } catch (e) { if (!e || e.name !== 'AbortError') toast('Couldn’t create the backup. Try again.'); }
}

async function doImport(file) {
  if (!file) return;
  let b;
  try { b = JSON.parse(await file.text()); } catch (e) { return toast('That file isn’t a backup.'); }
  try {
    if (isOldBackup(b)) { importOldBackup(b); toast('Old Consistency backup imported.'); }
    else { const r = await importBackup(b); toast('Restored' + (r.photos ? ' with ' + r.photos + ' photos' : '') + '. Reloading…'); }
    setTimeout(() => location.reload(), 900);
  } catch (e) { toast(e && e.message === 'not-a-backup' ? 'That file isn’t a Life OS backup.' : 'Couldn’t restore that file.'); }
}

async function checkUpdates(b) {
  b.disabled = true; b.textContent = 'Checking…';
  const fail = () => { toast('Couldn’t check. Connect to the internet and try again.'); b.disabled = false; b.textContent = 'Check for updates'; };
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !navigator.serviceWorker.controller) return fail();
    await reg.update();
    const ok = await new Promise(res => {
      const ch = new MessageChannel(); ch.port1.onmessage = e => res(e.data && e.data.ok);
      navigator.serviceWorker.controller.postMessage('refresh', [ch.port2]); setTimeout(() => res(false), 20000);
    });
    if (!ok) return fail();
    toast('Up to date. Reloading…'); setTimeout(() => location.reload(), 700);
  } catch (e) { fail(); }
}

export function renderSettings(VERSION) {
  const s = doc('settings');
  const since = s.lastBackup ? daysBetween(s.lastBackup, today()) : null;
  const name = input({ type: 'text', maxlength: 24, value: s.name || '', placeholder: 'Your name', style: 'max-width:150px;text-align:right', onchange: e => { s.name = e.target.value.trim(); save('settings'); } });
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: e => { const f = e.target.files[0]; e.target.value = ''; doImport(f); } });
  const size = h('small', {}, 'Everything is stored on this phone only.');
  Promise.all([usage(), photos.all()]).then(([u, p]) => { size.textContent = 'On this phone only' + (u ? ' · about ' + (u / 1048576).toFixed(1) + ' MB' : '') + (p.length ? ' · ' + p.length + ' photos' : ''); });
  const after = h('select', { class: 'in', style: 'width:auto', 'aria-label': 'Lock again after', onchange: e => setLockAfter(+e.target.value) },
    [[0, 'Right away'], [60, '1 minute'], [300, '5 minutes'], [900, '15 minutes']].map(([v, l]) => { const o = h('option', { value: v }, l); if (((s.lock || {}).after || 0) === v) o.selected = true; return o; }));

  return [
    head('Settings', 'Life OS'),
    section('Backup'),
    h('div', { class: 'card stack' },
      h('div', {}, h('h3', {}, since == null ? 'Not backed up yet' : 'Last backup ' + (since === 0 ? 'today' : fmt(s.lastBackup, { day: 'numeric', month: 'short', year: 'numeric' }))),
        h('p', { class: 'muted small', style: 'margin-top:4px' }, 'One file holds everything, photos included. Save it to Files or iCloud Drive so nothing is lost if Safari clears its data.')),
      h('div', { class: 'actions' }, btn('Export backup', doExport, 'pri'), btn('Import backup', () => file.click()), file),
      size),
    section('You'),
    h('div', { class: 'card flush' },
      row('Name', 'Shown on the home screen.', name),
      row('Face ID lock', lockNote(), toggle(lockOn(), v => toggleLock(v, refresh), 'Face ID lock')),
      lockOn() ? row('Lock again after', 'Time away before it asks again.', after) : null),
    section('App'),
    h('div', { class: 'card flush' },
      row('Version ' + VERSION, 'Works offline. Updates arrive when you’re online.', h('button', { class: 'btn sm', type: 'button', onclick: e => checkUpdates(e.currentTarget) }, 'Check for updates')),
      s.importedFromOld ? row('Old app data', 'Imported from Consistency on ' + fmt(s.importedFromOld, { day: 'numeric', month: 'short', year: 'numeric' }) + '.') : null),
    section('Start over'),
    h('div', { class: 'card stack' },
      h('p', { class: 'muted small' }, 'Erases every module’s data and all photos from this phone. Export a backup first.'),
      dangerBtn('Erase everything', 'Tap again to erase everything', async () => { await wipeAll(); skipLegacy(); toast('Erased. Reloading…'); setTimeout(() => location.reload(), 700); }, 'wide')),
  ];
}

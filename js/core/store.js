// The one storage layer every module uses. Everything lives in IndexedDB on the phone:
//   "docs"   - one JSON document per module (budget, tasks, gym, style, consistency, settings)
//   "photos" - compressed clothing photos, stored as raw bytes
// Documents are loaded into memory once at start-up, so modules read them synchronously
// with doc() and call save() after changing them.

const DB_NAME = 'life-os', DB_VERSION = 1;
let idb = null;               // null = IndexedDB unavailable, data is kept in memory only
const docs = {};              // in-memory copies of every document
const urls = new Map();       // photo id -> object URL
const memPhotos = new Map();  // fallback when IndexedDB is unavailable
export let persistent = true;

const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = (store, mode = 'readonly') => idb.transaction(store, mode).objectStore(store);

export async function initStore() {
  try {
    idb = await new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('docs')) d.createObjectStore('docs');
        if (!d.objectStoreNames.contains('photos')) d.createObjectStore('photos');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('blocked'));
    });
    const s = tx('docs');
    const [keys, vals] = await Promise.all([req(s.getAllKeys()), req(s.getAll())]);
    keys.forEach((k, i) => { docs[k] = vals[i]; });
  } catch (e) { idb = null; persistent = false; }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

// Get a module's document, creating it from init() the first time.
export function doc(key, init) {
  if (docs[key] === undefined && init) { docs[key] = init(); save(key); }
  return docs[key];
}
export const hasDoc = key => docs[key] !== undefined;
export function setDoc(key, value) { docs[key] = value; return save(key); }

const pending = new Map();
export function save(key) {
  if (!idb) return Promise.resolve();
  if (pending.has(key)) return pending.get(key);
  const p = Promise.resolve().then(() => { pending.delete(key); return req(tx('docs', 'readwrite').put(docs[key], key)); })
    .catch(e => { window.dispatchEvent(new CustomEvent('store-error', { detail: e })); });
  pending.set(key, p);
  return p;
}

/* ---------- photos ---------- */
export const photos = {
  async put(id, blob) {
    const rec = { type: blob.type || 'image/jpeg', data: await blob.arrayBuffer() };
    if (idb) await req(tx('photos', 'readwrite').put(rec, id)); else memPhotos.set(id, rec);
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
  },
  async url(id) {
    if (urls.has(id)) return urls.get(id);
    const rec = idb ? await req(tx('photos').get(id)) : memPhotos.get(id);
    if (!rec) return null;
    const u = URL.createObjectURL(new Blob([rec.data], { type: rec.type }));
    urls.set(id, u);
    return u;
  },
  async del(id) {
    if (idb) await req(tx('photos', 'readwrite').delete(id)); else memPhotos.delete(id);
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
  },
  async all() {
    if (!idb) return [...memPhotos].map(([id, r]) => ({ id, ...r }));
    const s = tx('photos');
    const [keys, vals] = await Promise.all([req(s.getAllKeys()), req(s.getAll())]);
    return keys.map((id, i) => ({ id, ...vals[i] }));
  },
};

/* ---------- backup: one JSON file with every document and every photo ---------- */
const toB64 = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = s => { const bin = atob(s), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b.buffer; };

export async function exportBackup() {
  await Promise.all([...pending.values()]);
  const ph = await photos.all();
  return JSON.stringify({
    app: 'life-os', version: 1, exported: new Date().toISOString(),
    docs,
    photos: ph.map(p => ({ id: p.id, type: p.type, data: toB64(p.data) })),
  });
}

// Replaces everything on the phone with the backup. Returns a short summary.
export async function importBackup(b) {
  if (!b || b.app !== 'life-os' || typeof b.docs !== 'object') throw new Error('not-a-backup');
  for (const k of Object.keys(docs)) delete docs[k];
  Object.assign(docs, b.docs);
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear(); memPhotos.clear();
  const list = Array.isArray(b.photos) ? b.photos : [];
  if (idb) {
    await new Promise((res, rej) => {
      const t = idb.transaction(['docs', 'photos'], 'readwrite');
      const d = t.objectStore('docs'), p = t.objectStore('photos');
      d.clear(); p.clear();
      for (const k of Object.keys(docs)) d.put(docs[k], k);
      for (const ph of list) p.put({ type: ph.type, data: fromB64(ph.data) }, ph.id);
      t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  } else for (const ph of list) memPhotos.set(ph.id, { type: ph.type, data: fromB64(ph.data) });
  return { docs: Object.keys(docs).length, photos: list.length };
}

export async function wipeAll() {
  for (const k of Object.keys(docs)) delete docs[k];
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear(); memPhotos.clear();
  if (idb) await new Promise((res, rej) => {
    const t = idb.transaction(['docs', 'photos'], 'readwrite');
    t.objectStore('docs').clear(); t.objectStore('photos').clear();
    t.oncomplete = res; t.onerror = () => rej(t.error);
  });
}

export async function usage() {
  try { const e = await navigator.storage.estimate(); return e.usage || 0; } catch (e) { return null; }
}

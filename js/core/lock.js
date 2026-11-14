// Optional Face ID lock for the whole app (with a 4-digit passcode as backup).
// Uses the phone's built-in passkey prompt; nothing leaves the device.
import { h, icon } from './util.js';
import { doc, save } from './store.js';
import { openSheet, closeSheet, toast, btn } from './ui.js';

const $ = id => document.getElementById(id);
const settings = () => doc('settings');
const cfg = () => settings().lock || {};
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const rnd = n => crypto.getRandomValues(new Uint8Array(n));
async function pinHash(pin, salt) { return b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin))); }

let busy = false, pinBuf = '', fails = 0, waitUntil = 0, hiddenAt = 0, onUnlock = () => {};
const msg = t => { const m = $('lockMsg'); if (m) m.textContent = t; };

function draw(mode = 'face') {
  const L = cfg(), box = $('lock');
  const dots = h('div', { class: 'pinrow', id: 'pinDots' });
  const drawDots = () => dots.replaceChildren(...Array.from({ length: L.pinLen || 4 }, (_, i) => h('i', { class: i < pinBuf.length ? 'on' : '' })));
  const press = async x => {
    if (Date.now() < waitUntil) return msg('Too many tries. Wait a moment.');
    if (x === '⌫') { pinBuf = pinBuf.slice(0, -1); return drawDots(); }
    const n = L.pinLen || 4; if (pinBuf.length >= n) return;
    pinBuf += x; drawDots();
    if (pinBuf.length < n) return;
    if ((await pinHash(pinBuf, L.salt)) === L.pin) { fails = 0; return unlock(); }
    fails++; pinBuf = ''; dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); drawDots();
    if (fails >= 5) { waitUntil = Date.now() + 30000; fails = 0; msg('Too many tries. Wait 30 seconds.'); } else msg('Wrong passcode. Try again.');
  };
  pinBuf = ''; drawDots();
  box.replaceChildren(
    h('div', { class: 'tile-ic', style: '--c:var(--fg);width:72px;height:72px;border-radius:22px' }, icon('lock', 34)),
    h('h2', {}, 'Locked'),
    h('p', { id: 'lockMsg' }, mode === 'pin' ? 'Enter your passcode.' : 'Unlock with Face ID to open your apps.'),
    mode === 'pin'
      ? [dots, h('div', { class: 'pinpad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(x => h('button', { type: 'button', class: x ? '' : 'blank', 'aria-label': x === '⌫' ? 'Delete' : x || null, onclick: () => press(x) }, x))),
        L.cred ? h('button', { class: 'link', type: 'button', onclick: () => { draw('face'); faceUnlock(); } }, 'Use Face ID') : null]
      : [btn('Unlock with Face ID', faceUnlock, 'pri'), h('button', { class: 'link', type: 'button', onclick: () => draw('pin') }, 'Use passcode')]);
}
function setLocked(v) { $('lock').hidden = !v; $('app').style.visibility = v ? 'hidden' : ''; if (v) draw(cfg().cred ? 'face' : 'pin'); }
function unlock() { setLocked(false); hiddenAt = 0; onUnlock(); }

async function faceUnlock() {
  const L = cfg(); if (!L.on || busy) return;
  if (!L.cred) return draw('pin');
  busy = true;
  try {
    const c = await navigator.credentials.get({ publicKey: { challenge: rnd(32), allowCredentials: [{ type: 'public-key', id: unb64(L.cred), transports: ['internal', 'hybrid'] }], userVerification: 'required', timeout: 60000 } });
    if (c && b64(c.rawId) === L.cred) return unlock();
    msg('That didn’t match. Try again or use your passcode.');
  } catch (e) { msg(e && e.name === 'NotAllowedError' ? 'Tap below to unlock with Face ID.' : 'Face ID isn’t available right now. Use your passcode.'); }
  finally { busy = false; }
}

export function initLock(afterUnlock) {
  onUnlock = afterUnlock || onUnlock;
  document.addEventListener('visibilitychange', () => {
    const L = cfg(); if (!L.on) return;
    if (document.hidden) { hiddenAt = Date.now(); if (!(L.after > 0)) setLocked(true); }
    else if (hiddenAt && (Date.now() - hiddenAt) / 1000 >= (L.after || 0)) { setLocked(true); faceUnlock(); }
  });
  if (cfg().on) { setLocked(true); setTimeout(faceUnlock, 250); }
}
export const lockOn = () => !!cfg().on;
export const lockNote = () => { const L = cfg(); return L.on ? (L.cred ? 'On. Face ID, with your passcode as backup.' : 'On, with passcode only.') : 'Ask for Face ID when the app opens.'; };

function pinSetup(done, cancel) {
  let first = '', buf = '';
  const dots = h('div', { class: 'pinrow' }), note = h('p', { class: 'muted', style: 'text-align:center' }, 'Choose a 4-digit backup passcode.');
  const drawDots = () => dots.replaceChildren(...[0, 1, 2, 3].map(i => h('i', { class: i < buf.length ? 'on' : '' }))); drawDots();
  const press = async x => {
    if (x === '⌫') { buf = buf.slice(0, -1); return drawDots(); }
    if (buf.length >= 4) return; buf += x; drawDots(); if (buf.length < 4) return;
    if (!first) { first = buf; buf = ''; note.textContent = 'Enter it again to confirm.'; return setTimeout(drawDots, 150); }
    if (buf !== first) { first = ''; buf = ''; note.textContent = 'Those didn’t match. Choose a passcode again.'; return setTimeout(drawDots, 150); }
    const salt = b64(rnd(16)); done({ pin: await pinHash(buf, salt), salt, pinLen: 4 });
  };
  openSheet(h('h2', {}, 'Backup passcode'), note, dots,
    h('div', { class: 'pinpad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(x => h('button', { type: 'button', class: x ? '' : 'blank', onclick: () => press(x) }, x))),
    btn('Cancel', () => { closeSheet(); cancel(); }));
}

// Turn the lock on or off from Settings. Calls redraw() when the setting has changed.
export async function toggleLock(wantOn, redraw) {
  const s = settings();
  if (wantOn) {
    let cred = null;
    try {
      if (window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) {
        const c = await navigator.credentials.create({ publicKey: { challenge: rnd(32), rp: { name: 'Life OS' }, user: { id: rnd(16), name: (s.name || 'me').toLowerCase() + '@life-os', displayName: s.name || 'Me' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' }, timeout: 60000 } });
        cred = b64(c.rawId);
      }
    } catch (e) { if (e && e.name === 'NotAllowedError') { toast('Face ID was cancelled.'); return redraw(); } }
    if (!cred) toast('Face ID isn’t available here, so the lock will use a passcode.');
    pinSetup(p => { s.lock = { on: true, cred, after: 0, ...p }; save('settings'); closeSheet(); redraw(); toast(cred ? 'Face ID lock on' : 'Passcode lock on'); }, redraw);
  } else {
    // Ask for the passcode or Face ID once more before switching the lock off.
    const prev = onUnlock;
    onUnlock = () => { onUnlock = prev; s.lock = { on: false }; save('settings'); redraw(); toast('Lock off'); };
    toast('Unlock to turn the lock off.'); setLocked(true); faceUnlock();
  }
}
export function setLockAfter(sec) { settings().lock = { ...cfg(), after: sec }; save('settings'); }

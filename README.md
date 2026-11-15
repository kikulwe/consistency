# Life OS

A phone-only web app for iPhone that runs five small apps under one roof: **Budget**, **Tasks**, **Gym**, **Style** and **Consistency** (the old habit tracker). Dark mode only. No account, no server — everything stays on your phone.

Live at **https://kikulwe.github.io/consistency/**

## Install on your iPhone

1. Open **Safari** on the iPhone (it has to be Safari, not Chrome) and go to the link above.
2. Tap the **Share** button (the square with an arrow, at the bottom of the screen).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Open **Life OS** from the Home Screen like any other app. It runs full-screen with no browser bar.

The first time it opens it caches itself, so after that it works with no signal at all — on the bus, in the gym, anywhere.

If you already had the old Consistency tracker installed, open the new one once from the same address. Your habits and budget are picked up from the old app automatically. You can then delete the old icon.

## Using it

- **Home** shows a Today strip (today's workout, outfit, tasks and habits) and one tile per app. Tap a tile to open it; tap the Life OS title or swipe the dock to come back.
- **Budget** — Overview shows safe-to-spend for the month. The Add tab logs a spend in two taps (amount, then category). Fixed items like rent are ticked off once a month; Savings tracks your running total.
- **Tasks** — A three-column board for this week (To do / Doing / Done). Hold a card to drag it. Unfinished tasks carry over every Monday; past weeks are kept.
- **Gym** — A 12-week beginner programme (two workouts, A and B). Tap a set bubble to log it; a 90-second rest timer runs between sets. Weights go up automatically once you hit the target twice. Every exercise has a how-to, common mistakes and a little animated demo.
- **Style** — Photograph your clothes (crop and tag them), then let it suggest an outfit each day without repeating anything for a week or so. Build and save your own outfits too.
- **Consistency** — Your habits, streaks, weekly review and heat-map, exactly as before. Logging a gym session or a spend can tick a habit for you (Settings → Link-ups).

## Backups

Everything (photos included) lives in your phone's storage for this app. iOS can clear that if the app is unused for a long time, so back up now and then:

- **Settings → Export backup** saves one `life-os-backup-YYYY-MM-DD.json` file (share it to iCloud Drive, Files or WhatsApp to yourself).
- **Settings → Import backup** restores it on this or a new phone. Backups from the old Consistency app also import.
- The Settings tile on Home shows how long ago you last backed up.

## Lock with Face ID

**Settings → Lock with Face ID** turns on a lock screen that opens with Face ID (or Touch ID). A 4-digit PIN is the fallback. "Lock again after" sets how long the app can sit in the background before it asks again.

## Updates

New versions download in the background the next time you open the app with signal, and apply the time after that. **Settings → Check for updates** forces it.

## For developers

Plain HTML, CSS and ES modules — no build step, no dependencies.

```
index.html             shell
manifest.webmanifest   PWA manifest
sw.js                  service worker (cache-first, offline)
css/app.css            one shared dark theme; modules only set an accent colour
js/app.js              boot, routing, dock
js/home.js             home screen
js/settings.js         backup, lock, updates, erase
js/core/               store (IndexedDB), ui helpers, nav + event bus, lock, legacy migration
js/modules/            budget.js  tasks.js  gym.js (+ gym-data.js, gym-demo.js)  style.js  consistency.js
```

Each module exports `{ id, name, color, icon, tabs, init, render, tile, today }` and is registered in `js/app.js`.

Data is one IndexedDB database (`life-os`) with a `docs` store (one JSON document per module) and a `photos` store (JPEG blobs). A backup is a single JSON file with photos base64-encoded inside it.

### Deploying

Pushing to `main` runs `.github/workflows/deploy-pages.yml`, which copies the files to GitHub Pages. To release a new version, bump `VERSION` in `js/app.js` and `CACHE` in `sw.js`; if you add a file, add it to the `FILES` list in `sw.js` so it is available offline.

### Running locally

Any static server works, e.g. `python3 -m http.server 8000`, then open `http://localhost:8000` in a browser at a 390px-wide viewport.

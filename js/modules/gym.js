// Gym: a 12-week, 3-days-a-week full-body program for a complete beginner. Dock: Today · Program · Exercises · Progress.
//
// Document shape (doc 'gym'):
//   setup:    { started, bodyweight, equipment: [ids], days: [0..6, Monday = 0] }     null until first launch is answered
//   lifts:    { exerciseId: { w, streak } }     w = current weight (or seconds / reps); streak = sessions in a row with every rep hit
//   sessions: [{ id, date, n, workout, week, items: [{ ex, kind, target: { sets, reps, w }, sets: [..], done }] }]
//   active:   the session in progress (same shape), so closing the app mid-workout loses nothing
//   weights:  [{ date, kg }]    body weight log
import { h, fill, icon, today, addDays, dow, weekStart, daysBetween, fmt, fmtShort, relDay, uid, plural, clamp, WD, WDL } from '../core/util.js';
import { doc, save } from '../core/store.js';
import { refresh, tabTo, emit } from '../core/nav.js';
import { head, section, empty, row, btn, dangerBtn, checkBtn, input, field, fieldGroup, chips, lineChart, linkBtn, openSheet, closeSheet, toast } from '../core/ui.js';
import { EX, WORKOUTS, PHASES, phaseOf, WEEKS, PER_WEEK, TOTAL, REST_SECONDS, EQUIPMENT, GUIDANCE, BASICS } from './gym-data.js';
import { demo } from './gym-demo.js';

const G = () => doc('gym', () => ({ setup: null, lifts: {}, sessions: [], active: null, weights: [] }));
const changed = () => save('gym');
const mmss = s => Math.floor(s / 60) + ':' + String(Math.max(0, Math.round(s)) % 60).padStart(2, '0');
const kg = w => w ? (Number.isInteger(w) ? w : w.toFixed(1)) + ' kg' : 'Bodyweight';

/* ---------- program maths ---------- */
const has = id => { const s = G().setup; return !s || s.equipment.includes(id); };
const available = ex => EX[ex].needs.every(has);
// The exercise to actually do: the planned one, or its first alternative if the gym lacks the equipment.
const resolve = ex => available(ex) ? ex : (EX[ex].alts.find(available) || ex);
function startValue(ex) {
  const e = EX[ex], bw = (G().setup && G().setup.bodyweight) || 70;
  return ex === 'leg_press' ? clamp(Math.round(bw * .5 / 10) * 10, 30, 60) : e.start;
}
const lift = ex => { const g = G(); return g.lifts[ex] || (g.lifts[ex] = { w: startValue(ex), streak: 0 }); };
const doneCount = () => G().sessions.length;
function plan(n) {
  const workout = n % 2 ? 'B' : 'A', week = Math.floor(n / PER_WEEK) + 1, phase = phaseOf(week);
  return { n, workout, week, phase, items: WORKOUTS[workout].map(resolve).map(ex => item(ex, phase)) };
}
function item(ex, phase) {
  const e = EX[ex], w = lift(ex).w;
  if (e.kind === 'cardio') return { ex, kind: 'cardio', target: { mins: e.start }, done: false };
  const target = e.kind === 'weight' ? { sets: phase.sets, reps: phase.reps, w } : { sets: phase.sets, reps: w };   // hold: reps = seconds
  return { ex, kind: e.kind, target, sets: Array(phase.sets).fill(null) };
}
const targetText = it => {
  const e = EX[it.ex], t = it.target;
  if (it.kind === 'cardio') return t.mins + ' min';
  if (it.kind === 'hold') return t.sets + ' × ' + t.reps + ' s';
  return t.sets + ' × ' + t.reps + (e.perSide ? ' each side' : '') + (it.kind === 'weight' ? ' · ' + kg(t.w) + (t.w && e.load ? ' ' + e.load : '') : '');
};
const hitAll = it => it.kind === 'cardio' ? it.done : it.sets.every(s => s != null && s >= it.target.reps);
const lastSession = () => G().sessions[G().sessions.length - 1];
const trainedOn = d => G().sessions.some(s => s.date === d);
const isTrainingDay = d => G().setup.days.includes(dow(d));
function nextTrainingDate() { let d = today(); for (let i = 0; i < 14; i++, d = addDays(d, 1)) if (isTrainingDay(d) && !trainedOn(d)) return d; return today(); }
function weekStreak() {
  const per = {}; for (const s of G().sessions) { const w = weekStart(s.date); per[w] = (per[w] || 0) + 1; }
  let w = weekStart(today()), n = 0;
  if ((per[w] || 0) < PER_WEEK) w = addDays(w, -7);
  while ((per[w] || 0) >= PER_WEEK) { n++; w = addDays(w, -7); }
  return n;
}

/* ---------- timers (rest, plank holds, warm-up, cardio) ---------- */
let timer = null, tickId = null, audio = null;
function unlockAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) {} }
function beep() {
  if (!audio) return;
  try { [0, .22].forEach(d => { const t = audio.currentTime + d, o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.25, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .18); o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + .2); }); } catch (e) {}
}
function startTimer(label, seconds, onDone) {
  unlockAudio();
  timer = { label, total: seconds, endsAt: Date.now() + seconds * 1000, onDone };
  if (!tickId) tickId = setInterval(tick, 250);
  drawTimer();
}
function stopTimer() { timer = null; clearInterval(tickId); tickId = null; drawTimer(); }
function tick() {
  if (!timer) return stopTimer();
  if (Date.now() >= timer.endsAt) { const f = timer.onDone; stopTimer(); beep(); if (f) f(); return; }
  drawTimer();
}
function drawTimer() {
  const el = document.getElementById('gymTimer'); if (!el) return;
  el.hidden = !timer; if (!timer) return;
  const left = (timer.endsAt - Date.now()) / 1000;
  fill(el,
    h('div', { class: 'rt-bar' }, h('i', { style: `width:${clamp(left / timer.total * 100, 0, 100)}%` })),
    h('div', { class: 'rt-row' },
      h('span', { class: 'rt-l' }, timer.label), h('b', { class: 'num' }, mmss(Math.ceil(left))),
      h('button', { class: 'btn sm', type: 'button', onclick: () => { timer.endsAt += 15000; timer.total += 15; drawTimer(); } }, '+15 s'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => { const f = timer.onDone, wasRest = timer.label === 'Rest'; stopTimer(); if (!wasRest && f) f(); } }, timer.label === 'Rest' ? 'Skip' : 'Done')));
}
const rest = () => startTimer('Rest', REST_SECONDS, () => toast('Rest over. Next set.'));

/* ---------- first launch ---------- */
function onboarding() {
  const st = { bw: '', equipment: EQUIPMENT.map(e => e[0]), days: [0, 2, 4] };
  return [
    head('Gym', 'Before your first session'),
    h('div', { class: 'banner' }, h('b', {}, '12 weeks, 3 sessions a week'), h('p', {}, 'Two full-body workouts that alternate. The app tells you what to do each session and when to add weight. Two quick questions first.')),
    h('div', { class: 'card stack' },
      field('Your body weight today (kg)', input({ type: 'text', inputmode: 'decimal', placeholder: 'e.g. 68', oninput: e => { st.bw = e.target.value; } }), 'Used for your progress chart and a sensible leg-press starting weight.'),
      fieldGroup('What does your gym have?', chips(EQUIPMENT, st.equipment, v => { st.equipment = v; }, { multi: true }), 'Untick anything missing and the app swaps in an alternative exercise.'),
      fieldGroup('Which 3 days will you train?', chips(WD.map((d, i) => [i, d]), st.days, v => { st.days = v; }, { multi: true }), 'Leave a rest day between sessions if you can, like Mon / Wed / Fri.')),
    btn('Start my program', () => {
      const bw = parseFloat(String(st.bw).replace(',', '.'));
      if (!(bw >= 30 && bw <= 250)) return toast('Enter your body weight in kg.');
      if (st.days.length !== 3) return toast('Pick exactly 3 training days.');
      const g = G(); g.setup = { started: today(), bodyweight: bw, equipment: st.equipment, days: [...st.days].sort() };
      g.weights.push({ date: today(), kg: bw }); changed(); refresh(); toast('Program ready');
    }, 'pri wide'),
  ];
}

/* ---------- Today ---------- */
function todayView() {
  const g = G();
  if (!g.setup) return onboarding();
  if (g.active) return activeView();
  const p = plan(doneCount()), t = today(), trained = trainedOn(t), isDay = isTrainingDay(t), next = nextTrainingDate();
  const last = lastSession();
  const preview = h('div', { class: 'card flush' }, p.items.map(it => row(EX[it.ex].name, targetText(it), null, () => exSheet(it.ex))));
  return [
    head('Today', fmt(t)),
    doneCount() >= TOTAL ? h('div', { class: 'banner' }, h('b', {}, 'You finished all 12 weeks'), h('p', {}, 'Sessions keep alternating at 3 × 8 so you can keep adding weight, or restart the program from the Program tab.')) : null,
    trained
      ? h('div', { class: 'card stack' }, h('div', { class: 'hstack' }, h('span', { class: 'checkbox on' }, icon('tick', 16)), h('div', {}, h('h3', {}, 'Workout ' + last.workout + ' done'), h('p', { class: 'muted small' }, 'Rest, eat well and sleep. Next: Workout ' + p.workout + ' on ' + relDay(next) + '.'))), btn('See this session', () => sessionSheet(last), 'sm'))
      : h('div', { class: 'card stack' },
        h('div', {}, h('p', { class: 'muted small' }, isDay ? 'Week ' + p.week + ' · ' + p.phase.name + ' phase' : 'Rest day'),
          h('div', { class: 'big-num', style: 'font-size:34px' }, isDay ? 'Workout ' + p.workout : 'Next: Workout ' + p.workout),
          h('p', { class: 'muted small' }, isDay ? 'About 45 minutes · ' + p.phase.sets + ' × ' + p.phase.reps + ' · ' + p.phase.focus.toLowerCase() : 'Planned for ' + relDay(next) + '. Rest days are when you get stronger.')),
        btn(isDay ? 'Start workout' : 'Train today anyway', () => { unlockAudio(); startSession(p); }, isDay ? 'pri wide' : 'wide')),
    p.week === 1 ? guidanceCard('First week at the gym') : null,
    section(trained ? 'Next session · Workout ' + p.workout : 'What you’ll do'),
    preview,
    basicsCard(),
  ];
}
const guidanceCard = title => [section(title), h('div', { class: 'card flush' }, GUIDANCE.map(([t, lines]) => row(t, lines[0], null, () => openSheet(h('h2', {}, t), h('ul', { class: 'steps' }, lines.map(l => h('li', {}, l))), btn('Got it', closeSheet, 'pri')))))];
const basicsCard = () => [section('The basics'), h('div', { class: 'card flush' }, BASICS.map(([t, s]) => h('div', { class: 'row' }, h('span', { class: 'row-t' }, h('b', {}, t), h('small', { style: 'white-space:normal' }, s)))))];

function startSession(p) {
  G().active = { id: uid('s'), date: today(), n: p.n, workout: p.workout, week: p.week, phase: p.phase.n, warmup: false, items: p.items };
  changed(); refresh();
}

function activeView() {
  const g = G(), s = g.active, ph = PHASES[s.phase - 1];
  const cards = s.items.map((it, i) => exerciseCard(s, it, i));
  const missing = s.items.some(it => it.kind === 'cardio' ? !it.done : it.sets.some(x => x == null));
  const finish = () => finishSession();
  return [
    head('Workout ' + s.workout, 'Week ' + s.week + ' · ' + ph.name + ' · ' + ph.sets + ' × ' + ph.reps),
    h('div', { class: 'card stack' + (s.warmup ? ' ex-done' : '') },
      h('div', { class: 'spread' }, h('div', {}, h('h3', {}, 'Warm-up · 5 min'), h('p', { class: 'muted small' }, 'Easy walk or bike, then 10 arm circles each way and 10 slow bodyweight squats.')),
        checkBtn(s.warmup, 'Warm-up done', () => { s.warmup = !s.warmup; changed(); refresh(); })),
      s.warmup ? null : btn('Start 5:00 timer', () => startTimer('Warm-up', 300, () => { s.warmup = true; changed(); refresh(); toast('Warmed up. First exercise.'); }), 'sm')),
    cards,
    missing ? dangerBtn('Finish workout', 'Some sets are empty. Tap again to finish', finish, 'wide') : btn('Finish workout', finish, 'pri wide'),
    h('div', { style: 'text-align:center' }, linkBtn('Cancel this workout', () => openSheet(h('h2', {}, 'Cancel this workout?'), h('p', { class: 'muted' }, 'Nothing from this session will be saved.'), h('div', { class: 'actions' }, btn('Keep going', closeSheet, 'pri'), dangerBtn('Cancel workout', 'Tap again to cancel', () => { g.active = null; stopTimer(); changed(); closeSheet(); refresh(); }))))),
    h('div', { id: 'gymTimer', class: 'resttimer', hidden: true }),
    (() => { requestAnimationFrame(drawTimer); return null; })(),
  ];
}

function exerciseCard(s, it, i) {
  const e = EX[it.ex], L = lift(it.ex), untouched = it.kind !== 'cardio' && it.sets.every(x => x == null);
  const tools = h('div', { class: 'hstack', style: 'gap:6px' },
    h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'How to do ' + e.name, onclick: () => exSheet(it.ex) }, icon('book', 19)),
    (e.alts.length || WORKOUTS[s.workout][i] !== it.ex) ? h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Swap ' + e.name, onclick: () => swapSheet(s, i) }, icon('swap', 19)) : null);
  const top = h('div', { class: 'spread' }, h('div', { class: 'grow' }, h('h3', {}, e.name),
    it.kind === 'weight' ? h('button', { type: 'button', class: 'target', onclick: () => weightSheet(it) }, targetText(it), h('span', { class: 'edit' }, 'Change')) : h('p', { class: 'target' }, targetText(it))), tools);

  if (it.kind === 'cardio') return h('div', { class: 'card stack' + (it.done ? ' ex-done' : '') }, top,
    h('div', { class: 'spread' }, it.done ? h('span', { class: 'good small' }, 'Done') : btn('Start ' + it.target.mins + ':00 timer', () => startTimer(e.name, it.target.mins * 60, () => { it.done = true; changed(); refresh(); toast(e.name + ' done'); }), 'sm'),
      checkBtn(it.done, e.name + ' done', () => { it.done = !it.done; changed(); refresh(); })));

  // Auto-progression: every rep hit in the last 2 sessions -> suggest the next weight up.
  const step = e.step, unit = it.kind === 'weight' ? ' kg' : it.kind === 'hold' ? ' s' : ' reps';
  const suggest = L.streak >= 2 && untouched ? h('div', { class: 'banner', style: 'padding:12px' },
    h('p', { style: 'color:var(--fg)' }, 'You hit every ' + (it.kind === 'hold' ? 'second' : 'rep') + ' two sessions running. Time to go up to ' + (L.w + step) + unit + '.'),
    h('div', { class: 'hstack' },
      btn('Use ' + (L.w + step) + unit, () => { L.w += step; L.streak = 0; if (it.kind === 'weight') it.target.w = L.w; else it.target.reps = L.w; changed(); refresh(); toast(e.name + ' moved up'); }, 'pri sm'),
      btn('Not yet', () => { L.streak = 1; changed(); refresh(); }, 'sm'))) : null;

  const bubbles = h('div', { class: 'sets' }, it.sets.map((v, k) => {
    const hit = v != null && v >= it.target.reps, miss = v != null && !hit;
    return h('button', { type: 'button', class: 'set' + (hit ? ' hit' : miss ? ' miss' : ''), 'aria-label': 'Set ' + (k + 1) + (v == null ? ', not done' : ', ' + v), onclick: () => {
      unlockAudio();
      if (v != null) return repsSheet(it, k);
      const done = () => { it.sets[k] = it.target.reps; changed(); refresh(); if (!(i === s.items.length - 1 && it.sets.every(x => x != null))) rest(); };
      if (it.kind === 'hold') startTimer('Hold · ' + e.name, it.target.reps, done); else done();
    } }, h('b', {}, v != null ? v : it.target.reps), h('small', {}, it.kind === 'hold' ? 'sec' : 'Set ' + (k + 1)));
  }));
  return h('div', { class: 'card stack' + (it.sets.every(x => x != null) ? ' ex-done' : '') }, top, suggest, bubbles,
    untouched && it.kind === 'weight' && s.n < 2 ? h('p', { class: 'hint' }, 'Tap a set when you finish it. It should feel like you could do 3 more reps; if not, tap Change and go lighter.') : null,
    untouched && it.kind === 'hold' ? h('p', { class: 'hint' }, 'Tap a set to start the hold timer.') : null);
}
function repsSheet(it, k) {
  const t = it.target.reps, opts = it.kind === 'hold' ? [t, t - 5, t - 10, t - 15].filter(x => x > 0) : Array.from({ length: t + 1 }, (_, i) => t - i);
  openSheet(h('h2', {}, it.kind === 'hold' ? 'How long did you hold?' : 'How many reps did you get?'), h('p', { class: 'muted' }, EX[it.ex].name + ' · set ' + (k + 1) + ' · target ' + t + (it.kind === 'hold' ? ' s' : '')),
    h('div', { class: 'repgrid' }, opts.map(n => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(it.sets[k] === n), onclick: () => { it.sets[k] = n; changed(); closeSheet(); refresh(); } }, String(n)))),
    btn('Clear this set', () => { it.sets[k] = null; changed(); closeSheet(); refresh(); }));
}
function weightSheet(it) {
  const e = EX[it.ex], L = lift(it.ex); let w = it.target.w;
  const disp = h('div', { class: 'amount' });
  const draw = () => fill(disp, w ? String(w) : 'Bodyweight', w ? h('small', { style: 'margin-left:6px' }, 'kg') : null);
  draw();
  openSheet(h('h2', {}, e.name), h('p', { class: 'muted' }, 'Pick a weight you can lift for every rep with good form' + (e.load ? ' (' + e.load + ').' : '.')),
    h('div', { class: 'spread' }, h('button', { class: 'iconbtn', type: 'button', style: 'width:56px;height:56px', 'aria-label': 'Lighter', onclick: () => { w = Math.max(0, +(w - e.step / 2).toFixed(1)); draw(); } }, '−'), disp,
      h('button', { class: 'iconbtn', type: 'button', style: 'width:56px;height:56px', 'aria-label': 'Heavier', onclick: () => { w = +(w + e.step / 2).toFixed(1); draw(); } }, '+')),
    btn('Use this weight', () => { if (w !== L.w) { L.w = w; L.streak = 0; } it.target.w = w; changed(); closeSheet(); refresh(); }, 'pri'));
}
function swapSheet(s, i) {
  const planned = WORKOUTS[s.workout][i], cur = s.items[i];
  const options = [planned, ...EX[planned].alts].filter((x, k, a) => a.indexOf(x) === k && x !== cur.ex);
  openSheet(h('h2', {}, 'Swap ' + EX[cur.ex].name), h('p', { class: 'muted' }, 'Machine busy or not there? These work the same muscles. The swap is for this session only.'),
    h('div', { class: 'card flush', style: 'background:var(--raised)' }, options.map(x => row(EX[x].name, EX[x].muscles + (available(x) ? '' : ' · not at your gym'), null, () => {
      s.items[i] = item(x, PHASES[s.phase - 1]); changed(); closeSheet(); refresh(); toast('Swapped to ' + EX[x].name);
    }))), btn('Keep ' + EX[cur.ex].name, closeSheet));
}
function finishSession() {
  const g = G(), s = g.active; if (!s) return;
  for (const it of s.items) { if (it.kind === 'cardio') continue; const L = lift(it.ex); if (hitAll(it)) L.streak = (L.streak || 0) + 1; else L.streak = 0; }
  delete s.warmup; g.sessions.push(s); g.active = null; stopTimer(); changed();
  emit('gym:session', s.date);
  const ups = s.items.filter(it => it.kind !== 'cardio' && lift(it.ex).streak >= 2).map(it => EX[it.ex].name);
  refresh();
  openSheet(h('h2', {}, 'Workout ' + s.workout + ' done'), h('p', { class: 'muted' }, 'Session ' + g.sessions.length + ' of ' + TOTAL + '. ' + (ups.length ? 'Next time you’ll be offered more weight on: ' + ups.join(', ') + '.' : 'Hit every rep twice in a row and the app will suggest the next weight up.')),
    h('p', { class: 'muted' }, 'Drink some water and have a meal with protein in the next couple of hours.'), btn('Done', closeSheet, 'pri'));
}

/* ---------- Program ---------- */
function program() {
  const g = G(); if (!g.setup) return onboarding();
  const done = doneCount(), cur = plan(done);
  const dayBox = h('div');
  const drawDays = () => fill(dayBox, chips(WD.map((d, i) => [i, d]), g.setup.days, v => { if (v.length === 3) { g.setup.days = [...v].sort(); changed(); toast('Training days updated'); } else toast('Pick exactly 3 days.'); }, { multi: true }));
  drawDays();
  return [
    head('Program', WEEKS + ' weeks · ' + PER_WEEK + ' days a week'),
    h('div', { class: 'card stack' },
      h('div', { class: 'spread' }, h('div', { class: 'stat' }, h('b', {}, done >= TOTAL ? 'Complete' : 'Week ' + cur.week + ' of ' + WEEKS), h('span', {}, done >= TOTAL ? 'All 36 sessions done' : cur.phase.name + ' phase · next is Workout ' + cur.workout)), h('span', { class: 'tag' }, Math.min(done, TOTAL) + ' / ' + TOTAL)),
      h('div', { class: 'track' }, h('i', { style: `width:${Math.min(100, done / TOTAL * 100)}%` }))),
    PHASES.map(p => [section('Phase ' + p.n + ' · ' + p.name, h('span', { class: 'muted small' }, p.sets + ' × ' + p.reps)),
      h('div', { class: 'card stack' }, h('p', { class: 'muted small' }, p.focus + '.'),
        h('div', { class: 'weeks' }, Array.from({ length: p.to - p.from + 1 }, (_, k) => { const w = p.from + k;
          return h('div', { class: 'wk' + (w === cur.week && done < TOTAL ? ' now' : '') }, h('span', {}, 'W' + w), h('span', { class: 'dots' }, [0, 1, 2].map(d => h('i', { class: (w - 1) * 3 + d < done ? 'on' : '' })))); })))]),
    ['A', 'B'].map(k => [section('Workout ' + k), h('div', { class: 'card flush' }, WORKOUTS[k].map(resolve).map(ex => row(EX[ex].name, EX[ex].muscles, null, () => exSheet(ex))))]),
    section('Training days'), h('div', { class: 'card' }, dayBox),
    guidanceCard('New to the gym'),
    basicsCard(),
    section('Setup'),
    h('div', { class: 'card flush' },
      row('Equipment at my gym', g.setup.equipment.length + ' of ' + EQUIPMENT.length + ' ticked', null, () => { let eq = [...g.setup.equipment];
        openSheet(h('h2', {}, 'Equipment at my gym'), h('p', { class: 'muted' }, 'Untick anything missing and the program uses the alternative exercise.'), chips(EQUIPMENT, eq, v => { eq = v; }, { multi: true }), btn('Save', () => { g.setup.equipment = eq; changed(); closeSheet(); refresh(); }, 'pri')); }),
      row('Restart the program', 'Back to week 1. Your weights and history stay.', null, () => openSheet(h('h2', {}, 'Restart the program?'), h('p', { class: 'muted' }, 'Your session history moves out of the 12-week count, so you start again at week 1 with the weights you have reached.'),
        h('div', { class: 'actions' }, btn('Keep going', closeSheet, 'pri'), dangerBtn('Restart', 'Tap again to restart', () => { g.past = [...(g.past || []), ...g.sessions]; g.sessions = []; g.active = null; changed(); closeSheet(); refresh(); toast('Back to week 1'); }))))),
  ];
}

/* ---------- Exercises ---------- */
function exercises() {
  const main = new Set([...WORKOUTS.A, ...WORKOUTS.B]);
  const list = ids => h('div', { class: 'card flush' }, ids.map(ex => row(EX[ex].name, EX[ex].muscles + (G().lifts[ex] && EX[ex].kind === 'weight' ? ' · ' + kg(G().lifts[ex].w) : ''), null, () => exSheet(ex))));
  return [
    head('Exercises', 'How to do each one'),
    section('Workout A'), list(WORKOUTS.A),
    section('Workout B'), list(WORKOUTS.B),
    section('Alternatives'), list(Object.keys(EX).filter(k => !main.has(k))),
  ];
}
function exSheet(ex) {
  const e = EX[ex];
  openSheet(
    h('h2', {}, e.name), h('p', { class: 'muted', style: 'margin-top:-8px' }, e.muscles),
    h('div', { class: 'demobox' }, demo(e.demo)),
    h('h3', {}, 'How to do it'), h('ol', { class: 'steps' }, e.how.map(s => h('li', {}, s))),
    h('h3', {}, 'Common mistakes'), h('ul', { class: 'steps' }, e.mistakes.map(s => h('li', {}, s))),
    e.alts.length ? [h('h3', {}, 'If it’s busy, do this instead'), h('div', { class: 'chips' }, e.alts.map(a => h('button', { type: 'button', class: 'chip', onclick: () => exSheet(a) }, EX[a].name)))] : null,
    h('a', { class: 'btn', href: 'https://www.youtube.com/results?search_query=' + encodeURIComponent('how to ' + e.name + ' proper form beginner'), target: '_blank', rel: 'noopener' }, 'Watch videos (needs internet)'),
    btn('Close', closeSheet, 'pri'));
}

/* ---------- Progress ---------- */
let chartEx = null;
function sessionSheet(s) {
  openSheet(h('h2', {}, 'Workout ' + s.workout), h('p', { class: 'muted' }, fmt(s.date) + ' · week ' + s.week),
    h('div', { class: 'card flush', style: 'background:var(--raised)' }, s.items.map(it => row(EX[it.ex].name, targetText(it), h('span', { class: 'val ' + (hitAll(it) ? 'good' : 'warn') }, it.kind === 'cardio' ? (it.done ? 'Done' : 'Skipped') : it.sets.map(x => x == null ? '–' : x).join(' · '))))),
    btn('Close', closeSheet));
}
function progress() {
  const g = G(); if (!g.setup) return onboarding();
  const all = [...(g.past || []), ...g.sessions];
  const bwIn = input({ type: 'text', inputmode: 'decimal', placeholder: 'kg', 'aria-label': 'Body weight in kg', style: 'max-width:110px' });
  const ws = [...g.weights].sort((a, b) => a.date.localeCompare(b.date)), w0 = ws[0], w1 = ws[ws.length - 1], diff = w1 && w0 ? +(w1.kg - w0.kg).toFixed(1) : 0;
  const lifted = {}; for (const s of all) for (const it of s.items) if (it.kind === 'weight') (lifted[it.ex] = lifted[it.ex] || []).push({ x: fmtShort(s.date), y: it.target.w });
  const exs = Object.keys(lifted); if (!exs.includes(chartEx)) chartEx = exs[0] || null;
  const thisWeek = g.sessions.filter(s => weekStart(s.date) === weekStart(today())).length;
  return [
    head('Progress', 'Since ' + fmt(g.setup.started, { day: 'numeric', month: 'long' })),
    h('div', { class: 'grid3' },
      h('div', { class: 'card stat' }, h('b', {}, all.length), h('span', {}, 'Sessions done')),
      h('div', { class: 'card stat' }, h('b', {}, weekStreak()), h('span', {}, 'Week streak')),
      h('div', { class: 'card stat' }, h('b', {}, thisWeek + '/' + PER_WEEK), h('span', {}, 'This week'))),
    section('Body weight'),
    h('div', { class: 'card stack' },
      h('div', { class: 'spread' }, h('div', { class: 'stat' }, h('b', {}, w1 ? w1.kg + ' kg' : '–'), h('span', {}, w1 ? (diff === 0 ? 'Logged ' + relDay(w1.date).toLowerCase() : (diff > 0 ? '+' : '−') + Math.abs(diff) + ' kg since you started') : 'Not logged yet')),
        h('div', { class: 'hstack' }, bwIn, btn('Log', () => { const v = parseFloat(bwIn.value.replace(',', '.')); if (!(v >= 30 && v <= 250)) return toast('Enter your weight in kg.'); g.weights = g.weights.filter(x => x.date !== today()); g.weights.push({ date: today(), kg: v }); changed(); refresh(); toast('Body weight logged'); }, 'pri sm'))),
      lineChart(ws.map(x => ({ x: fmtShort(x.date), y: x.kg })), { height: 130 })),
    section('Weight lifted'),
    exs.length ? h('div', { class: 'card stack' }, chips(exs.map(x => [x, EX[x].name]), chartEx, v => { chartEx = v; refresh(); }, { scroll: true }), lineChart(lifted[chartEx], { height: 140, fmtV: v => v + '' }), h('p', { class: 'muted small' }, 'Kilograms per session' + (EX[chartEx].load ? ' (' + EX[chartEx].load + ')' : '') + '.')) : empty('Finish a session and your weights are charted here.'),
    section('Sessions'),
    all.length ? h('div', { class: 'card flush' }, [...all].reverse().slice(0, 12).map(s => row('Workout ' + s.workout, relDay(s.date) + ' · week ' + s.week, h('span', { class: 'tag ' + (s.items.every(hitAll) ? 'good' : '') }, s.items.filter(hitAll).length + '/' + s.items.length), () => sessionSheet(s))))
      : empty('No sessions yet. Your first one is on the Today tab.'),
  ];
}

export default {
  id: 'gym', name: 'Gym', color: '#FF7A6B', icon: 'dumbbell',
  tabs: [{ id: 'today', label: 'Today', icon: 'dumbbell' }, { id: 'program', label: 'Program', icon: 'calendar' }, { id: 'exercises', label: 'Exercises', icon: 'book' }, { id: 'progress', label: 'Progress', icon: 'trend' }],
  init() { G(); },
  render: tab => ({ today: todayView, program, exercises, progress })[tab](),
  tile() {
    const g = G(); if (!g.setup) return { badge: 'Set up', sub: '12-week beginner program' };
    const last = lastSession() || (g.past || [])[(g.past || []).length - 1], p = plan(doneCount()), d = last ? daysBetween(last.date, today()) : null;
    return { badge: g.active ? 'In progress' : 'Workout ' + p.workout + ' next', sub: d == null ? 'No sessions yet' : d === 0 ? 'Trained today' : plural(d, 'day') + ' since last session' };
  },
  today() {
    const g = G(); if (!g.setup) return { label: 'Workout', value: 'Set up Gym', sub: '2 quick questions', tab: 'today' };
    const p = plan(doneCount()), t = today();
    if (g.active) return { label: 'Workout', value: 'Workout ' + g.active.workout, sub: 'In progress', tab: 'today' };
    if (trainedOn(t)) return { label: 'Workout', value: 'Done', sub: 'Workout ' + lastSession().workout + ' finished', tab: 'today' };
    return isTrainingDay(t) ? { label: 'Workout', value: 'Workout ' + p.workout, sub: 'Week ' + p.week + ' · ' + p.phase.sets + ' × ' + p.phase.reps, tab: 'today' }
      : { label: 'Workout', value: 'Rest day', sub: 'Next: ' + p.workout + ' on ' + relDay(nextTrainingDate()), tab: 'today' };
  },
};

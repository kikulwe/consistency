// Work Tasks: a kanban board per week. Dock: This Week · Add · Past Weeks · Stats.
//
// Document shape (doc 'tasks'):
//   week:    Monday (YYYY-MM-DD) of the week the live board belongs to
//   tasks:   [{ id, title, tag, pri: 'high'|'med'|'low', due, notes, status: 'todo'|'doing'|'done', created, doneAt, carried }]
//   archive: { '<monday>': { tasks: [...snapshot of that week's board] } }     read-only past weeks
//   tags:    project tags offered when adding a task
import { h, fill, icon, today, addDays, weekStart, daysBetween, fmt, fmtShort, relDay, uid, plural, sum } from '../core/util.js';
import { doc, save } from '../core/store.js';
import { refresh, tabTo, openPage, back } from '../core/nav.js';
import { head, section, empty, row, btn, dangerBtn, input, textarea, field, fieldGroup, chips, seg, columns, hbars, linkBtn, openSheet, closeSheet, toast } from '../core/ui.js';

const COLS = [['todo', 'To Do'], ['doing', 'In Progress'], ['done', 'Done']];
const PRI = { high: ['High', 'var(--bad)'], med: ['Med', 'var(--warn)'], low: ['Low', 'var(--muted)'] };
const TAG_COLORS = ['#7AA2FF', '#3DD68C', '#F5B544', '#C4A1FF', '#FF7A6B', '#5AD1E0', '#F28BD0', '#B8C24A'];

const D = () => doc('tasks', () => ({ week: weekStart(today()), tasks: [], archive: {}, tags: ['CAB', 'WENDI', 'MRC', 'CIB', '4Waajiri'] }));
const changed = () => save('tasks');
const tagColor = t => { const i = D().tags.indexOf(t); return TAG_COLORS[(i < 0 ? t.length : i) % TAG_COLORS.length]; };
const weekLabel = w => fmtShort(w) + ' – ' + fmtShort(addDays(w, 6));
const open = () => D().tasks.filter(t => t.status !== 'done');
const dueThisWeek = () => { const end = addDays(D().week, 6); return open().filter(t => t.due && t.due <= end); };

// Every Monday: file last week's board in the archive, keep unfinished tasks and mark them carried over.
function rollover() {
  const d = D(), now = weekStart(today());
  let moved = false;
  while (d.week < now) {
    d.archive[d.week] = { tasks: d.tasks.map(t => ({ ...t })) };
    d.tasks = d.tasks.filter(t => t.status !== 'done').map(t => ({ ...t, carried: (t.carried || 0) + 1 }));
    d.week = addDays(d.week, 7); moved = true;
  }
  if (moved) changed();
}

/* ---------- task card ---------- */
function card(t, readonly) {
  const overdue = t.due && t.due < today() && t.status !== 'done';
  const c = h('article', { class: 'tcard' + (t.status === 'done' ? ' is-done' : ''), 'data-id': t.id, tabindex: '0', role: 'button' },
    h('div', { class: 'tcard-top' },
      t.tag ? h('span', { class: 'tag', style: `color:${tagColor(t.tag)};background:color-mix(in srgb, ${tagColor(t.tag)} 16%, transparent)` }, t.tag) : null,
      h('span', { class: 'pri', style: 'color:' + PRI[t.pri || 'med'][1] }, h('i'), PRI[t.pri || 'med'][0])),
    h('h3', {}, t.title),
    t.notes ? h('p', { class: 'tnotes' }, t.notes) : null,
    (t.due || t.carried) ? h('div', { class: 'tcard-meta' },
      t.due ? h('span', { class: overdue ? 'bad' : '' }, icon('calendar', 14), (overdue ? 'Overdue · ' : 'Due ') + relDay(t.due)) : null,
      t.carried ? h('span', { class: 'warn' }, 'Carried over · ' + plural(t.carried, 'week')) : null) : null);
  if (!readonly) { c.addEventListener('click', () => { if (!justDragged) taskSheet(t); }); attachDrag(c, t); }
  return c;
}

/* ---------- board (swipe between columns, hold a card to drag it) ---------- */
let boardCol = 0;
function board(tasks, readonly) {
  const pills = h('div', { class: 'colpills' }), el = h('div', { class: 'board' });
  const count = s => tasks.filter(t => t.status === s).length;
  const drawPills = () => fill(pills, COLS.map(([s, l], i) => h('button', { type: 'button', 'aria-pressed': String(i === boardCol), onclick: () => scrollToCol(el, i, true) }, l, h('b', {}, count(s)))));
  COLS.forEach(([s, l]) => {
    const list = tasks.filter(t => t.status === s);
    el.append(h('section', { class: 'bcol', 'data-status': s },
      h('header', {}, h('h2', {}, l), h('span', {}, count(s))),
      list.length ? list.map(t => card(t, readonly)) : h('p', { class: 'bcol-empty' }, s === 'todo' ? (readonly ? 'Nothing was left to do.' : 'Nothing to do. Add a task to start the week.') : s === 'doing' ? (readonly ? 'Nothing in progress.' : 'Hold a card and drag it here when you start.') : 'Nothing finished yet.')));
  });
  el.addEventListener('scroll', () => { const i = Math.round(el.scrollLeft / (el.scrollWidth / 3)); if (i !== boardCol) { boardCol = i; drawPills(); } }, { passive: true });
  drawPills();
  requestAnimationFrame(() => scrollToCol(el, boardCol, false));
  return [pills, el];
}
function scrollToCol(el, i, smooth) { const col = el.children[i]; if (!col) return; el.scrollTo({ left: col.offsetLeft - (el.clientWidth - col.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' }); }

let justDragged = false;
function attachDrag(cardEl, task) {
  let timer = null, drag = null, x0 = 0, y0 = 0;
  const pt = e => (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
  const startDrag = () => {
    const r = cardEl.getBoundingClientRect(), ghost = cardEl.cloneNode(true);
    ghost.className = 'tcard ghost'; ghost.style.cssText = `width:${r.width}px;left:${r.left}px;top:${r.top}px`;
    document.body.append(ghost); cardEl.classList.add('lifted');
    drag = { ghost, dx: x0 - r.left, dy: y0 - r.top, target: null, edgeAt: 0 };
    document.body.classList.add('dragging');
  };
  const move = e => {
    const p = pt(e);
    if (!drag) { if (Math.abs(p.clientX - x0) > 8 || Math.abs(p.clientY - y0) > 8) cancel(); return; }
    if (e.cancelable) e.preventDefault();
    drag.ghost.style.left = (p.clientX - drag.dx) + 'px'; drag.ghost.style.top = (p.clientY - drag.dy) + 'px';
    const boardEl = cardEl.closest('.board'), now = Date.now();
    // near a screen edge: slide to the next column
    if (now - drag.edgeAt > 650) {
      if (p.clientX > innerWidth - 40 && boardCol < 2) { scrollToCol(boardEl, boardCol + 1, true); drag.edgeAt = now; }
      else if (p.clientX < 40 && boardCol > 0) { scrollToCol(boardEl, boardCol - 1, true); drag.edgeAt = now; }
    }
    let target = null;
    for (const col of boardEl.children) { const r = col.getBoundingClientRect(); if (p.clientX >= r.left && p.clientX <= r.right) target = col; }
    if (target !== drag.target) { if (drag.target) drag.target.classList.remove('drop'); if (target) target.classList.add('drop'); drag.target = target; }
    drag.y = p.clientY;
  };
  const end = () => {
    clearTimeout(timer); timer = null; unbind();
    if (!drag) return;
    const { ghost, target, y } = drag; drag = null;
    ghost.remove(); cardEl.classList.remove('lifted'); document.body.classList.remove('dragging');
    justDragged = true; setTimeout(() => { justDragged = false; }, 350);
    if (!target) return;
    target.classList.remove('drop');
    // drop before the card under the finger, otherwise at the end of the column
    const before = [...target.querySelectorAll('.tcard')].find(c => c !== cardEl && y < c.getBoundingClientRect().top + c.offsetHeight / 2);
    moveTask(task, target.dataset.status, before ? before.dataset.id : null);
  };
  const cancel = () => { clearTimeout(timer); timer = null; if (!drag) unbind(); };
  const unbind = () => { window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end); window.removeEventListener('touchcancel', end); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end); };
  const down = e => {
    if (e.type === 'mousedown' && e.button !== 0) return;
    const p = pt(e); x0 = p.clientX; y0 = p.clientY;
    clearTimeout(timer); timer = setTimeout(startDrag, 380);
    if (e.type === 'touchstart') { window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', end); window.addEventListener('touchcancel', end); }
    else { window.addEventListener('mousemove', move); window.addEventListener('mouseup', end); }
  };
  cardEl.addEventListener('touchstart', down, { passive: true });
  cardEl.addEventListener('mousedown', down);
  cardEl.addEventListener('contextmenu', e => e.preventDefault());
}
function moveTask(t, status, beforeId) {
  const d = D(), was = t.status;
  d.tasks = d.tasks.filter(x => x !== t);
  t.status = status; t.doneAt = status === 'done' ? (t.doneAt || today()) : null;
  const i = beforeId ? d.tasks.findIndex(x => x.id === beforeId) : -1;
  if (i >= 0) d.tasks.splice(i, 0, t); else d.tasks.push(t);
  changed(); refresh();
  if (was !== status) toast(status === 'done' ? 'Done: ' + t.title : 'Moved to ' + COLS.find(c => c[0] === status)[1]);
}

/* ---------- task details / edit ---------- */
function form(st) {
  const d = D();
  const title = input({ type: 'text', maxlength: 80, placeholder: 'What needs doing?', value: st.title, enterkeyhint: 'done', oninput: e => { st.title = e.target.value; } });
  const tagBox = h('div', { class: 'stack', style: 'gap:8px' });
  let adding = false;
  const addTag = name => {
    name = name.trim().slice(0, 16); adding = false;
    if (name) { if (!d.tags.some(t => t.toLowerCase() === name.toLowerCase())) { d.tags.push(name); changed(); } st.tag = d.tags.find(t => t.toLowerCase() === name.toLowerCase()); }
    drawTags();
  };
  const drawTags = () => {
    const nameIn = adding ? input({ type: 'text', maxlength: 16, placeholder: 'New project tag', 'aria-label': 'New project tag', enterkeyhint: 'done', onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); addTag(nameIn.value); } } }) : null;
    fill(tagBox,
      chips([...d.tags.map(t => [t, t, tagColor(t)]), ['+', '+ New tag']], adding ? '+' : st.tag, v => { if (v === '+') { adding = true; drawTags(); } else { adding = false; st.tag = v; drawTags(); } }, { allowNone: true }),
      adding ? h('div', { class: 'hstack' }, h('div', { class: 'grow' }, nameIn), btn('Add tag', () => addTag(nameIn.value), 'sm')) : null);
    if (nameIn) nameIn.focus();
  };
  drawTags();
  const t = today(), fri = addDays(weekStart(t), 4);
  const dueIn = input({ type: 'date', value: st.due || '', 'aria-label': 'Due date', onchange: e => { st.due = e.target.value || null; drawDue(); } });
  const dueBox = h('div', { class: 'chips' });
  const quick = [[t, 'Today'], [addDays(t, 1), 'Tomorrow'], ...(fri > addDays(t, 1) ? [[fri, 'Friday']] : []), [null, 'No date']];
  const drawDue = () => fill(dueBox, quick.map(([v, l]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String((st.due || null) === v), onclick: () => { st.due = v; dueIn.value = v || ''; drawDue(); } }, l)));
  drawDue();
  return [
    field('Task', title),
    fieldGroup('Project', tagBox),
    fieldGroup('Priority', seg([['high', 'High'], ['med', 'Med'], ['low', 'Low']], st.pri, v => { st.pri = v; })),
    fieldGroup('Due', h('div', { class: 'stack', style: 'gap:8px' }, dueBox, dueIn)),
    field('Notes', textarea({ maxlength: 300, rows: 2, placeholder: 'Short notes (optional)', value: st.notes, oninput: e => { st.notes = e.target.value; } })),
  ];
}
function taskSheet(t) {
  const st = { title: t.title, tag: t.tag || null, pri: t.pri || 'med', due: t.due || null, notes: t.notes || '' };
  openSheet(
    h('h2', {}, 'Task'),
    t.carried ? h('p', { class: 'warn small' }, 'Carried over · it has slipped ' + plural(t.carried, 'week') + '.') : null,
    fieldGroup('Move to', seg(COLS, t.status, v => { closeSheet(); moveTask(t, v); })),
    form(st),
    h('div', { class: 'actions' },
      btn('Save changes', () => { if (!st.title.trim()) return toast('Give the task a title.'); Object.assign(t, { ...st, title: st.title.trim(), notes: st.notes.trim() }); changed(); closeSheet(); refresh(); toast('Saved'); }, 'pri'),
      dangerBtn('Delete', 'Tap again to delete', () => { const d = D(); d.tasks = d.tasks.filter(x => x !== t); changed(); closeSheet(); refresh(); toast('Task deleted'); })));
}

/* ---------- views ---------- */
function thisWeek() {
  const d = D(), due = dueThisWeek().length;
  return [
    head('This Week', weekLabel(d.week) + (due ? ' · ' + due + ' due' : '')),
    d.tasks.length ? board(d.tasks, false) : empty('A clean board for the week. Unfinished tasks will carry over next Monday.', btn('Add a task', () => tabTo('add'), 'pri sm')),
    d.tasks.length ? h('p', { class: 'muted small', style: 'text-align:center' }, 'Swipe between columns. Hold a card to drag it, or tap it to edit.') : null,
  ];
}
let draft = null;
const blank = () => ({ title: '', tag: null, pri: 'med', due: null, notes: '', status: 'todo' });
function add() {
  if (!draft) draft = blank();
  const st = draft;
  return [
    head('Add', 'New task for this week'),
    h('div', { class: 'card stack' }, form(st),
      fieldGroup('Starts in', seg(COLS.slice(0, 2), st.status, v => { st.status = v; }))),
    btn('Add task', () => {
      if (!st.title.trim()) return toast('Give the task a title.');
      D().tasks.push({ id: uid('t'), title: st.title.trim(), tag: st.tag, pri: st.pri, due: st.due, notes: st.notes.trim(), status: st.status, created: today(), doneAt: null, carried: 0 });
      changed(); boardCol = st.status === 'doing' ? 1 : 0; draft = null; tabTo('week'); toast('Task added');
    }, 'pri wide'),
  ];
}
function past(week) {
  const d = D();
  if (week && d.archive[week]) {
    const ts = d.archive[week].tasks;
    return [
      head(weekLabel(week), 'Past week · read-only', h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Back', onclick: back }, icon('back', 20))),
      ts.length ? board(ts, true) : empty('Nothing was on the board that week.'),
    ];
  }
  const weeks = Object.keys(d.archive).sort().reverse();
  return [
    head('Past Weeks', 'Read-only archive'),
    weeks.length ? h('div', { class: 'card flush' }, weeks.map(w => { const ts = d.archive[w].tasks, done = ts.filter(t => t.status === 'done').length;
      return row('Week of ' + fmt(w, { day: 'numeric', month: 'long' }), plural(done, 'task') + ' done · ' + (ts.length - done) + ' carried over', null, () => { boardCol = 0; openPage('past', w); }); }))
      : empty('Each finished week is filed here on Monday morning, exactly as you left it.'),
  ];
}
function stats() {
  const d = D(), weeks = Object.keys(d.archive).sort();
  const last = [...weeks.slice(-7), d.week];
  const doneIn = w => (w === d.week ? d.tasks : d.archive[w].tasks).filter(t => t.status === 'done').length;
  const carried = weeks.map(w => d.archive[w].tasks.filter(t => t.status !== 'done').length);
  const all = [...weeks.flatMap(w => d.archive[w].tasks), ...d.tasks].filter(t => t.status === 'done');
  const byTag = {}; for (const t of all) byTag[t.tag || 'No project'] = (byTag[t.tag || 'No project'] || 0) + 1;
  const tags = Object.entries(byTag).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: label === 'No project' ? 'var(--muted)' : tagColor(label) }));
  const slipped = open().filter(t => t.carried).sort((a, b) => b.carried - a.carried).slice(0, 4);
  return [
    head('Stats', 'How your weeks go'),
    h('div', { class: 'grid3' },
      h('div', { class: 'card stat' }, h('b', {}, doneIn(d.week)), h('span', {}, 'Done this week')),
      h('div', { class: 'card stat' }, h('b', {}, open().length), h('span', {}, 'Still open')),
      h('div', { class: 'card stat' }, h('b', {}, weeks.length ? (sum(carried) / weeks.length).toFixed(1) : '–'), h('span', {}, 'Avg carried over'))),
    section('Tasks done per week'),
    h('div', { class: 'card' }, columns(last.map(doneIn), last.map(w => w === d.week ? 'Now' : fmt(w, { day: 'numeric', month: 'numeric' })), { hi: last.length - 1 })),
    section('Done by project'),
    tags.length ? h('div', { class: 'card' }, hbars(tags)) : empty('Finish a task and it shows up here by project.'),
    slipped.length ? section('Slipping the longest') : null,
    slipped.length ? h('div', { class: 'card flush' }, slipped.map(t => row(t.title, (t.tag ? t.tag + ' · ' : '') + 'carried over ' + plural(t.carried, 'week'), null, () => taskSheet(t)))) : null,
  ];
}

export default {
  id: 'tasks', name: 'Tasks', color: '#F5B544', icon: 'board',
  tabs: [{ id: 'week', label: 'This Week', icon: 'board' }, { id: 'add', label: 'Add', icon: 'plus', add: true }, { id: 'past', label: 'Past Weeks', icon: 'archive' }, { id: 'stats', label: 'Stats', icon: 'stats' }],
  init() { D(); rollover(); },
  render: (tab, arg) => ({ week: thisWeek, add, past, stats })[tab](arg),
  tile() { const due = dueThisWeek().length, o = open().length; return { badge: due ? due + ' due this week' : o ? 'Nothing due' : 'All clear', sub: plural(o, 'open task'), pip: due || null }; },
  today() {
    const o = open(), t = today(), late = o.filter(x => x.due && x.due < t).length, now = o.filter(x => x.due === t).length;
    return { label: 'Open tasks', value: o.length ? plural(o.length, 'task') : 'All clear', sub: late ? late + ' overdue' : now ? now + ' due today' : o.length ? o.filter(x => x.status === 'doing').length + ' in progress' : 'Nothing on the board', tab: 'week' };
  },
};

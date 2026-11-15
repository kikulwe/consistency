// Animated stick-figure demos for the exercise library. Each demo is two poses (a = start, b = end)
// on a 120 x 100 canvas; the figure moves smoothly between them. Works offline: no images or video.
//
// Joints: head, sh (shoulder), hip, el (elbow), hand, knee, foot. A "2" suffix is the far-side limb.
// Extras: db = dumbbell in the hand, grip = machine handle, bar = pulldown bar, cable = fixed point the cable runs to,
//         plate = leg-press plate at the foot, props = fixed equipment drawn behind the figure.

const STAND = { head: [60, 16], sh: [60, 29], hip: [60, 56], knee: [61, 74], foot: [60, 92] };
const L = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const FLOOR = L(8, 95, 112, 95);

const DEMOS = {
  squat: { db: 1, a: { ...STAND, foot: [62, 92], el: [66, 40], hand: [65, 31] }, b: { head: [60, 36], sh: [58, 48], hip: [46, 70], knee: [72, 72], foot: [62, 92], el: [65, 60], hand: [65, 50] } },
  bwsquat: { a: { ...STAND, foot: [62, 92], el: [70, 31], hand: [81, 31] }, b: { head: [60, 36], sh: [58, 48], hip: [46, 70], knee: [72, 72], foot: [62, 92], el: [70, 49], hand: [82, 48] } },
  chestpress: { grip: 1, props: L(38, 32, 38, 68) + L(38, 68, 56, 68) + L(47, 68, 47, 95),
    a: { head: [45, 24], sh: [44, 38], hip: [46, 66], knee: [66, 66], foot: [68, 92], el: [45, 53], hand: [58, 42] }, b: { head: [45, 24], sh: [44, 38], hip: [46, 66], knee: [66, 66], foot: [68, 92], el: [60, 42], hand: [78, 41] } },
  row: { grip: 1, cable: [96, 52], props: L(30, 72, 62, 72) + L(36, 72, 36, 95) + L(56, 72, 56, 95) + L(88, 58, 88, 82) + L(96, 44, 96, 95),
    a: { head: [53, 32], sh: [51, 44], hip: [46, 70], knee: [66, 62], foot: [86, 72], el: [63, 50], hand: [77, 52] }, b: { head: [46, 30], sh: [45, 43], hip: [46, 70], knee: [66, 62], foot: [86, 72], el: [38, 57], hand: [55, 54] } },
  rdl: { db: 1, a: { ...STAND, el: [61, 42], hand: [62, 56] }, b: { head: [87, 40], sh: [76, 45], hip: [52, 56], knee: [58, 74], foot: [60, 92], el: [76, 60], hand: [74, 74] } },
  plank: { slow: 1, a: { head: [99, 66], sh: [86, 72], hip: [58, 76], knee: [38, 83], foot: [20, 91], el: [86, 91], hand: [99, 91] }, b: { head: [99, 65], sh: [86, 71], hip: [58, 74.5], knee: [38, 82], foot: [20, 91], el: [86, 91], hand: [99, 91] } },
  kneeplank: { slow: 1, a: { head: [99, 66], sh: [86, 72], hip: [58, 79], knee: [40, 91], foot: [22, 82], el: [86, 91], hand: [99, 91] }, b: { head: [99, 65], sh: [86, 71], hip: [58, 77.5], knee: [40, 91], foot: [22, 82], el: [86, 91], hand: [99, 91] } },
  pushup: { props: `<rect x="80" y="75" width="26" height="20" rx="2"/>`,
    a: { head: [98, 44], sh: [88, 53], hip: [60, 68], knee: [40, 80], foot: [22, 92], el: [89, 64], hand: [90, 75] }, b: { head: [101, 58], sh: [91, 66], hip: [61, 75], knee: [40, 84], foot: [22, 92], el: [79, 71], hand: [90, 75] } },
  walk: { props: L(26, 95, 98, 87), a: { head: [62, 14], sh: [61, 27], hip: [60, 54], knee: [68, 70], foot: [73, 88], knee2: [55, 72], foot2: [46, 92], el: [55, 39], hand: [52, 50], el2: [67, 38], hand2: [73, 46] },
    b: { head: [62, 14], sh: [61, 27], hip: [60, 54], knee: [55, 72], foot: [46, 92], knee2: [68, 70], foot2: [73, 88], el: [67, 38], hand: [73, 46], el2: [55, 39], hand2: [52, 50] } },
  legpress: { plate: 1, props: L(18, 42, 40, 76) + L(40, 76, 54, 76) + L(30, 95, 104, 95),
    a: { head: [23, 34], sh: [28, 47], hip: [44, 72], knee: [58, 48], foot: [72, 58], el: [40, 62], hand: [50, 74] }, b: { head: [23, 34], sh: [28, 47], hip: [44, 72], knee: [66, 58], foot: [88, 46], el: [40, 62], hand: [50, 74] } },
  pulldown: { bar: 1, cable: [63, 2], props: L(48, 68, 66, 68) + L(57, 68, 57, 95) + L(62, 60, 76, 60),
    a: { head: [56, 28], sh: [56, 40], hip: [56, 66], knee: [74, 66], foot: [74, 92], el: [60, 25], hand: [63, 11] }, b: { head: [53, 27], sh: [54, 40], hip: [56, 66], knee: [74, 66], foot: [74, 92], el: [67, 51], hand: [64, 37] } },
  press: { db: 1, a: { ...STAND, head: [60, 18], el: [70, 43], hand: [69, 30] }, b: { ...STAND, head: [60, 18], el: [67, 21], hand: [66, 7] } },
  lunge: { db: 1, a: { ...STAND, knee: [62, 74], foot: [63, 92], knee2: [59, 74], foot2: [57, 92], el: [60, 42], hand: [60, 55] },
    b: { head: [60, 30], sh: [60, 43], hip: [60, 68], knee: [76, 70], foot: [78, 92], knee2: [52, 89], foot2: [36, 90], el: [60, 56], hand: [60, 69] } },
  deadbug: { props: L(8, 93, 108, 93), a: { head: [18, 84], sh: [30, 87], hip: [60, 87], knee: [62, 66], foot: [80, 66], knee2: [62, 66], foot2: [80, 66], el: [30, 74], hand: [30, 60], el2: [30, 74], hand2: [30, 60] },
    b: { head: [18, 84], sh: [30, 87], hip: [60, 87], knee: [78, 81], foot: [98, 83], knee2: [62, 66], foot2: [80, 66], el: [30, 74], hand: [30, 60], el2: [20, 78], hand2: [8, 76] } },
  bike: { props: L(28, 95, 98, 95) + L(50, 95, 50, 63) + L(43, 63, 57, 63) + L(86, 95, 81, 46) + L(76, 46, 86, 46) + `<circle cx="64" cy="79" r="7"/>`,
    a: { head: [67, 22], sh: [61, 34], hip: [50, 61], el: [70, 43], hand: [80, 46], knee: [69, 62], foot: [66, 86], knee2: [63, 68], foot2: [61, 73] },
    b: { head: [67, 22], sh: [61, 34], hip: [50, 61], el: [70, 43], hand: [80, 46], knee: [63, 68], foot: [61, 73], knee2: [69, 62], foot2: [66, 86] } },
  bench: { db: 1, props: L(24, 73, 86, 73) + L(32, 73, 32, 95) + L(76, 73, 76, 95),
    a: { head: [29, 66], sh: [40, 69], hip: [68, 69], knee: [84, 72], foot: [86, 92], el: [47, 60], hand: [43, 52] }, b: { head: [29, 66], sh: [40, 69], hip: [68, 69], knee: [84, 72], foot: [86, 92], el: [41, 55], hand: [41, 40] } },
  dbrow: { db: 1, props: L(64, 72, 104, 72) + L(70, 72, 70, 95) + L(98, 72, 98, 95),
    a: { head: [91, 46], sh: [78, 51], hip: [52, 56], knee: [56, 74], foot: [52, 92], el2: [80, 62], hand2: [82, 72], el: [76, 64], hand: [76, 78] }, b: { head: [91, 46], sh: [78, 51], hip: [52, 56], knee: [56, 74], foot: [52, 92], el2: [80, 62], hand2: [82, 72], el: [67, 49], hand: [72, 60] } },
  bridge: { props: L(8, 94, 108, 94), a: { head: [18, 86], sh: [30, 89], hip: [58, 89], knee: [76, 70], foot: [86, 92], el: [44, 91], hand: [56, 91] }, b: { head: [18, 86], sh: [30, 89], hip: [58, 71], knee: [78, 66], foot: [86, 92], el: [44, 91], hand: [56, 91] } },
  birddog: { props: L(8, 94, 108, 94), a: { head: [93, 54], sh: [80, 60], hip: [44, 60], knee2: [44, 91], foot2: [24, 91], el2: [80, 76], hand2: [80, 91], knee: [44, 91], foot: [24, 91], el: [80, 76], hand: [80, 91] },
    b: { head: [93, 54], sh: [80, 60], hip: [44, 60], knee2: [44, 91], foot2: [24, 91], el2: [80, 76], hand2: [80, 91], knee: [26, 60], foot: [8, 60], el: [93, 59], hand: [106, 57] } },
};

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const pts = (...p) => p.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');

function frame(d, t) {
  const j = {}; for (const k in d.a) j[k] = lerp(d.a[k], d.b[k] || d.a[k], t);
  let far = '', near = '', gear = '';
  if (j.knee2) far += `<polyline points="${pts(j.hip, j.knee2, j.foot2)}"/>`;
  if (j.el2) far += `<polyline points="${pts(j.sh, j.el2, j.hand2)}"/>`;
  near += `<polyline points="${pts(j.head, j.sh, j.hip, j.knee, j.foot)}"/><polyline points="${pts(j.sh, j.el, j.hand)}"/>`;
  near += `<circle cx="${j.head[0].toFixed(1)}" cy="${j.head[1].toFixed(1)}" r="7" fill="var(--surface)"/>`;
  const h = j.hand;
  if (d.cable) gear += L(h[0].toFixed(1), h[1].toFixed(1), d.cable[0], d.cable[1]);
  if (d.db) gear += `<circle cx="${h[0].toFixed(1)}" cy="${h[1].toFixed(1)}" r="4.5" fill="var(--acc)"/>`;
  if (d.grip) gear += L(h[0].toFixed(1), (h[1] - 6).toFixed(1), h[0].toFixed(1), (h[1] + 6).toFixed(1));
  if (d.bar) gear += L((h[0] - 12).toFixed(1), h[1].toFixed(1), (h[0] + 12).toFixed(1), h[1].toFixed(1));
  if (d.plate) gear += L((j.foot[0] - 3).toFixed(1), (j.foot[1] - 14).toFixed(1), (j.foot[0] + 9).toFixed(1), (j.foot[1] + 8).toFixed(1));
  return `<g class="d-props">${d.props || FLOOR}</g><g class="d-far">${far}</g><g class="d-gear">${gear}</g><g class="d-near">${near}</g>`;
}

// Returns an animated <svg>. The loop stops by itself once the element leaves the page.
export function demo(key) {
  const d = DEMOS[key] || DEMOS.squat;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 120 100'); svg.setAttribute('class', 'demo'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Animated demonstration');
  svg.innerHTML = frame(d, 0);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { svg.innerHTML = frame(d, .5); return svg; }
  const period = d.slow ? 4200 : 2600; let t0 = null, seen = false, waits = 0;
  const step = now => {
    if (!svg.isConnected) { if (seen || ++waits > 300) return; } else seen = true;
    if (t0 == null) t0 = now;
    const ph = ((now - t0) % period) / period;                       // 0..1
    const tri = ph < .5 ? ph * 2 : 2 - ph * 2;                       // 0..1..0
    const eased = tri < .15 ? 0 : tri > .85 ? 1 : (1 - Math.cos((tri - .15) / .7 * Math.PI)) / 2;   // pause briefly at each end
    svg.innerHTML = frame(d, eased);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return svg;
}
export const demoKeys = Object.keys(DEMOS);
// A single still frame (t = 0 start pose, 1 = end pose), used for checking the drawings.
export function demoStill(key, t) { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 120 100'); svg.setAttribute('class', 'demo'); svg.innerHTML = frame(DEMOS[key], t); return svg; }

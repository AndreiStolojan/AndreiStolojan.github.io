// Path, pinned horizontal journey. Vertical scrolling pans the track from 2013 to now; nothing moves unless the
// reader scrolls, except the thesis grade, which plays once when it is reached. The section is a tall wrapper (.jr)
// with a sticky stage inside, so the page scrolls normally the whole time and leaves the section as soon as the pan
// is complete: nothing is captured, nothing to escape.
//
// Desktop (same media query as the CSS): sets --tx, --ph, --phx on .jr-hz and --p on .jr, lights each mark
// ([data-x]) once the playhead reaches it, keeps long labels in view, fades out any label the viewport edge would
// cut, and pans to any entry that receives keyboard focus. The track's start and end line up with the page margin.
// Phone form: fills each existing rail down to a reading line, lights events and plays the grade when reached.
// Reduced motion: shows every final state, including when the preference changes while the page is open.
(() => {
  const root = document.querySelector('.jr');
  if (!root) return;
  const stage = root.querySelector('.jr-stage');
  const heading = stage.querySelector('h2');
  const hz = root.querySelector('.jr-hz');
  const now = hz.querySelector('.jr-now');
  const [nowYear, nowMonth] = now.children;
  const rails = [...root.querySelectorAll('.jv-rail')];
  const phoneEvents = [...root.querySelectorAll('.jv-it, .jv-arm')].map(el => ({
    el, marker: el.querySelector('.jv-mk') || el
  }));
  const grades = [...root.querySelectorAll('.grade')];
  const phoneGrades = [...root.querySelectorAll('.jv .grade')];
  const desk = matchMedia('(min-width: 1024px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // Track units per decimal year; the same knots as path-gen.js. Inverted here to print the playhead's date.
  const KNOTS = [[2013, 0], [2018, 1.25], [2020, 2.75], [2024, 6.75], [2025, 8.25], [2026, 10.75], [2027, 19.25]];
  const yearAt = x => {
    for (let i = 1; i < KNOTS.length; i++) {
      const [t0, x0] = KNOTS[i - 1], [t1, x1] = KNOTS[i];
      if (x <= x1) return t0 + (t1 - t0) * (x - x0) / (x1 - x0);
    }
    return 2027;
  };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const PLAY = .55;     // where the playhead rests, as a share of the visible track
  const PAN = .7;       // pixels of vertical scroll per pixel of horizontal travel
  const ARROW = 24;     // room after "now" for the "still going" arrows

  /** Plays the grade once: the ring fills (CSS transition) while the number counts up to its value. */
  function play(g) {
    if (g.classList.contains('played')) return;
    g.classList.add('played');
    const v = g.querySelector('.gv');
    const target = parseFloat(v.dataset.v ??= v.textContent);
    const t0 = performance.now();
    const step = t => {
      if (reduce.matches) { v.textContent = target.toFixed(1); return; }
      const k = Math.min(1, (t - t0) / 1400);
      v.textContent = (target * (1 - (1 - k) ** 3)).toFixed(1);
      if (k < 1) requestAnimationFrame(step);
    };
    v.textContent = '0.0';
    requestAnimationFrame(step);
  }

  /** Layout numbers for the pinned form, or null when the phone form is showing. */
  let m = null;

  function measure() {
    root.classList.toggle('anim', !reduce.matches);
    root.classList.remove('flat');
    root.classList.toggle('pin', desk.matches);
    // Pin only if the whole stage fits under the top bar; otherwise fall back to the year groups.
    if (desk.matches && stage.scrollHeight > stage.clientHeight + 1) root.classList.replace('pin', 'flat');
    if (!root.classList.contains('pin')) { m = null; root.style.height = ''; update(); return; }
    const clip = hz.querySelector('.jr-lane .jr-clip');
    const W = clip.firstElementChild.offsetWidth, view = clip.clientWidth;
    const edge = Math.round(heading.getBoundingClientRect().left - hz.getBoundingClientRect().left);
    const u = W / Number(hz.style.getPropertyValue('--units'));
    const dist = Math.round(W * PAN);
    root.style.height = stage.offsetHeight + dist + 'px';

    // Labels inside a block slide along it, so the name stays on screen at the page margin, until they reach the
    // next label (or the armband) or the block's end. A block too short for its first label, and .side blocks, get
    // .out: the label moves just past the end cap and does not slide.
    const sliders = [];
    for (const el of hz.querySelectorAll('.jr-seg')) {
      const labs = [...el.querySelectorAll(':scope > .jr-lab')];
      const arm = el.querySelector(':scope > .jr-arm');
      labs.forEach(l => { l.style.removeProperty('--sx'); });
      el.classList.remove('out');
      const first = labs[0];
      if (el.classList.contains('side') || first.offsetLeft + first.offsetWidth + 6 > (arm ? arm.offsetLeft : el.clientWidth)) el.classList.add('out');
      if (el.classList.contains('out')) continue;
      labs.forEach((lab, i) => {
        const next = labs[i + 1];
        const limit = (next ? Math.min(next.offsetLeft, arm ? arm.offsetLeft : Infinity) : el.clientWidth) - 8;
        sliders.push({ el, lab, i, left: el.offsetLeft, start: lab.offsetLeft, end: lab.offsetLeft + lab.offsetWidth, room: limit - lab.offsetLeft - lab.offsetWidth, sx: -1, cut: null, dirty: true });
      });
    }
    // Every label on the track, with its place on the track at rest, to fade the ones the viewport edge would cut.
    const sx0 = hz.querySelector('.jr-lane .jr-slice').getBoundingClientRect().left;
    const all = [...hz.querySelectorAll('.jr-lab')].map(lab => {
      const r = lab.getBoundingClientRect();
      return { lab, x: r.left - sx0, w: r.width, slide: sliders.find(s => s.lab === lab) };
    });
    const marks = [...hz.querySelectorAll('[data-x]')].map(el => ({ el, x: parseFloat(el.dataset.x) * u }));
    m = { W, view, edge, dist, sliders, all, marks, top: parseFloat(getComputedStyle(stage).top), tx: 0, label: '' };
    update();
  }

  function update() {
    if (!m) { updatePhone(); return; }
    let p = clamp((m.top - root.getBoundingClientRect().top) / m.dist, 0, 1);
    if (p > .999) p = 1;   // sub-pixel scroll positions would otherwise stop just short of "now"
    const xp = p * m.W;
    const tx = clamp(PLAY * m.view - xp, m.view - m.W - m.edge - ARROW, m.edge);
    const phx = xp + tx;
    m.tx = tx;
    hz.style.setProperty('--tx', tx.toFixed(1) + 'px');
    hz.style.setProperty('--ph', xp.toFixed(1) + 'px');
    hz.style.setProperty('--phx', phx.toFixed(1) + 'px');
    root.style.setProperty('--p', p.toFixed(3));

    const t = yearAt(xp / m.W * KNOTS.at(-1)[1]);
    const year = p >= 1 ? 'Now' : String(Math.min(2026, Math.floor(t)));
    const month = p < 1 && t >= 2026 ? MONTHS[Math.min(11, Math.floor((t - 2026) * 12))] : '';
    if (year + month !== m.label) { nowYear.textContent = year; nowMonth.textContent = month; m.label = year + month; m.nowW = now.offsetWidth; }
    hz.style.setProperty('--nx', clamp(phx - m.nowW / 2, m.edge, m.view - m.edge - m.nowW).toFixed(1) + 'px');

    for (const k of m.marks) {
      const on = k.x <= xp + 1;
      k.el.classList.toggle('on', on);
      if (on && k.el.classList.contains('grade')) play(k.el);
    }
    for (const s of m.sliders) {
      const sx = Math.round(clamp(m.edge - (tx + s.left + s.start), 0, Math.max(0, s.room)));
      if (sx !== s.sx) { s.sx = sx; s.dirty = true; s.lab.style.setProperty('--sx', sx + 'px'); }
    }
    for (const a of m.all) {
      const x = tx + a.x + (a.slide ? a.slide.sx : 0);
      const cut = x < -.5 || x + a.w > m.view + .5;
      a.lab.classList.toggle('cut', cut);
      if (a.slide && a.slide.cut !== cut) { a.slide.cut = cut; a.slide.dirty = true; }
    }
    // The patterns stay clear of the labels: --h1b is the first label's right edge, --h2a/--h2b the second's span.
    // A faded label leaves no gap, so its block never shows up empty.
    for (const s of m.sliders) {
      if (!s.dirty) continue;
      s.dirty = false;
      if (s.i === 0) s.el.style.setProperty('--h1b', s.cut ? '0px' : s.end + s.sx + 'px');
      else { s.el.style.setProperty('--h2a', s.cut ? '99999px' : s.start + s.sx - 6 + 'px'); s.el.style.setProperty('--h2b', s.cut ? '99999px' : s.end + s.sx + 'px'); }
    }
  }

  // Each rail keeps its own row-span geometry. One reading line advances all overlapping periods,
  // so SCM and high school begin before university and reverse scrolling restores their earlier state.
  function updatePhone() {
    const line = innerHeight * .66;
    const railStates = rails.map(el => ({ el, box: el.getBoundingClientRect() }));
    const eventStates = phoneEvents.map(({ el, marker }) => ({ el, box: marker.getBoundingClientRect() }));
    const gradeStates = phoneGrades.map(el => ({ el, box: el.getBoundingClientRect() }));
    for (const { el, box } of railStates) {
      if (reduce.matches || box.height) {
        const lit = reduce.matches ? 1 : clamp((line - box.top) / box.height, 0, 1);
        el.style.setProperty('--lit', lit.toFixed(3));
      }
    }
    for (const { el, box } of eventStates) {
      el.classList.toggle('on', reduce.matches || (box.height > 0 && box.top <= line));
    }
    if (reduce.matches) {
      // Inline progress from a previous scroll must not override the reduced-motion final state.
      // Restore both grade copies immediately if the preference changes during their count-up.
      for (const g of grades) {
        const v = g.querySelector('.gv');
        v.textContent = v.dataset.v ?? v.textContent;
        g.classList.add('played');
      }
      return;
    }
    for (const { el, box } of gradeStates) { if (box.height && box.top <= line) play(el); }
  }

  // Keyboard: an entry that gets focus while off screen is panned in, its start just behind the playhead.
  hz.addEventListener('focusin', e => {
    const a = e.target.closest('a');
    if (!m || !a) return;
    const left = a.offsetLeft, right = left + a.offsetWidth;
    if (left + m.tx >= m.edge && right + m.tx <= m.view - m.edge) return;
    const p = clamp((left + 24) / m.W, 0, 1);
    const y = scrollY + root.getBoundingClientRect().top - m.top + p * m.dist;
    scrollTo({ top: Math.round(y), behavior: reduce.matches ? 'instant' : 'smooth' });
  });

  let ticking = false;
  const ask = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); } };
  let resizing = 0;
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', () => { cancelAnimationFrame(resizing); resizing = requestAnimationFrame(measure); });
  desk.addEventListener('change', measure);
  reduce.addEventListener('change', measure);
  document.fonts.ready.then(measure);
  measure();
})();

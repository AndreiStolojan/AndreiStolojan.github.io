// Passions: Find the gap, a handball moment the visitor plays as the pivot, and a mate in one to find. Everything moves
// only in answer to the visitor: a drag, a click or tap, a key. The motion loops run only while something is
// moving and stop by themselves. Reduced motion: every move lands at once.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const inOut = t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
  const out = t => 1 - (1 - t) ** 3;
  const inQ = t => t * t;
  const bump = t => Math.sin(Math.PI * clamp(t));
  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
  // Runs fn(t) from 0 to 1 over ms with an easing, on animation frames; under reduced motion only fn(1).
  const tween = (ms, fn, ease = inOut) => new Promise(done => {
    if (reduce) { fn(1); done(); return; }
    const t0 = performance.now();
    const tick = now => { const t = clamp((now - t0) / ms); fn(ease(t)); if (t < 1) requestAnimationFrame(tick); else done(); };
    requestAnimationFrame(tick);
  });

  /* ---------- Find the gap ---------- */
  const game = document.querySelector('.passions-game');
  if (game) {
    const G = JSON.parse(game.dataset.g);
    const $ = s => game.querySelector(s);
    const svg = $('.passions-svg'), pitch = $('.passions-pitch'), handle = $('.passions-me'), tag = $('.passions-tag');
    const mine = $('.passions-mine'), face = $('.passions-face'), ring = $('.passions-ring'), lane = $('.passions-lane'), ball = $('.passions-ball'), shot = $('.passions-shot'), gk = $('.passions-gk'), net = $('.passions-netg');
    const dfs = [...game.querySelectorAll('.passions-df')], aims = [...game.querySelectorAll('.passions-aim')], pips = [...game.querySelectorAll('.passions-pips svg')];
    const say = $('.passions-say'), goalsB = $('.passions-score b');
    // The view: the whole half court, or on phones a closer one on the 6 to 9 m area (the wings fall outside),
    // so the gaps are wide enough for a thumb. The pitch's aspect follows in CSS.
    const phone = matchMedia('(max-width: 640px)');
    let VB;

    // The geometry, as in the inline game data.
    const [P1, P2] = G.posts, straight = P2[0] - P1[0];
    const along = (R, s) => {
      const a = R * (G.a0 - G.a1), d = s * (2 * a + straight);
      if (d < a) { const t = G.a0 - d / R; return [P1[0] + R * Math.cos(t), P1[1] + R * Math.sin(t)]; }
      if (d < a + straight) return [P1[0] + (d - a), P1[1] + R];
      const t = G.a1 - (d - a - straight) / R; return [P2[0] + R * Math.cos(t), P2[1] + R * Math.sin(t)];
    };
    const defender = (s, o, b) => { const p = along(G.rd, s), dx = b[0] - p[0], dy = b[1] - p[1], l = Math.hypot(dx, dy); return [p[0] + dx / l * o, p[1] + dy / l * o]; };
    const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const q = (a, c, b, t) => [0, 1].map(i => (1 - t) ** 2 * a[i] + 2 * (1 - t) * t * c[i] + t * t * b[i]);
    const deg = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI;

    const texts = [
      'The left back has the ball, and a defender steps out to meet him. Slide into the gap he leaves.',
      'The ball goes to the right back. Find the gap on that side.',
      'Now the centre back, and the middle defender steps out. Find a gap.',
    ];
    const OPEN = 'Lane open. Let go, or press Enter, for the pass.';

    // State. s is where the pivot is drawn, target where he is heading; both run from G.lo to G.hi.
    let round = 0, goals = 0, phase = 'move', s = .5, target = .5, raf = 0, last = 0, dragging = false, calling = false, keyed = false;
    let spots = [], holder = G.backs[G.rounds[0].ball], keeperX = G.keeper[0];

    const set = (el, attrs) => { for (const k in attrs) el.setAttribute(k, typeof attrs[k] === 'number' ? attrs[k].toFixed(1) : attrs[k]); };
    const place = (el, [x, y]) => { el.style.left = `${((x - VB.x) / VB.w * 100).toFixed(2)}%`; el.style.top = `${((y - VB.y) / VB.h * 100).toFixed(2)}%`; };
    const setPhase = p => { phase = p; game.dataset.phase = p; };
    const roundSpots = r => G.rounds[r].d.map(([ds, o]) => defender(ds, o, G.backs[G.rounds[r].ball]));
    const blockers = (p, b = holder) => spots.map(d => segDist(d, b, p) <= G.lane || Math.hypot(d[0] - p[0], d[1] - p[1]) <= G.mark);
    const isOpen = at => !blockers(along(G.rp, at)).some(Boolean);
    const drawDefence = () => spots.forEach((d, i) => set(dfs[i], { cx: d[0], cy: d[1] }));

    // Draws the pivot at s with his lane, ring and label, and says whether the lane is open.
    let wasOpen = null;
    const drawPivot = () => {
      const p = along(G.rp, s), bl = blockers(p), open = !bl.some(Boolean);
      set(mine, { transform: `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})` });
      set(ring, { cx: p[0], cy: p[1] });
      if (phase === 'move') set(face, { transform: `rotate(${deg(p, holder).toFixed(1)})` });
      place(handle, p); place(tag, p);
      set(lane, { d: `M${holder[0]} ${holder[1]}L${p[0].toFixed(1)} ${p[1].toFixed(1)}` });
      dfs.forEach((el, i) => el.classList.toggle('passions-block', phase === 'move' && bl[i]));
      game.classList.toggle('passions-open', open);
      game.dataset.s = s.toFixed(3);
      handle.setAttribute('aria-valuenow', String(Math.round((s - G.lo) / (G.hi - G.lo) * 100)));
      handle.setAttribute('aria-valuetext', open ? 'Open' : 'Marked');
      if (phase === 'move' && open !== wasOpen) say.textContent = open ? OPEN : texts[round];
      wasOpen = phase === 'move' ? open : null;
    };

    // The pivot follows his target with a quick, damped glide (no overshoot), then stops; a call for the ball
    // waits until he has arrived.
    const loop = now => {
      const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
      s += (target - s) * (1 - Math.exp(-dt * 16));
      if (Math.abs(target - s) < .0008) s = target;
      drawPivot();
      if (s !== target) raf = requestAnimationFrame(loop);
      else { raf = 0; last = 0; if (calling && !dragging) { calling = false; call(); } }
    };
    const go = t => {
      target = clamp(t, G.lo, G.hi);
      if (reduce) { s = target; drawPivot(); if (calling && !dragging) { calling = false; call(); } return; }
      if (!raf) raf = requestAnimationFrame(loop);
    };

    // A call for the ball. Within a short reach of an open window he steps into it; marked, he is told so.
    const call = () => {
      if (phase !== 'move') return;
      if (!isOpen(s)) {
        let best = null;
        for (let d = .002; d <= .045; d += .002) for (const c of [s - d, s + d]) if (best === null && c >= G.lo && c <= G.hi && isOpen(c) && isOpen(c + Math.sign(c - s) * .012)) best = c + Math.sign(c - s) * .012;
        if (best !== null) { calling = true; go(best); return; }
        say.textContent = 'Marked. The lane is closed: find the gap first.';
        wasOpen = false;
        if (!reduce) dfs.filter(el => el.classList.contains('passions-block')).forEach(el => el.animate([{ transform: 'none' }, { transform: 'translateX(3px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }], { duration: 260, transformBox: 'fill-box' }));
        return;
      }
      pass();
    };

    const pass = async () => {
      setPhase('pass');
      const p = along(G.rp, s), c = lerp(holder, p, .5);
      await tween(420, t => { const b = q(holder, [c[0] + 8, c[1] - 8], p, t); set(ball, { cx: b[0], cy: b[1] }); });
      // The catch, the turn, and the keeper shifting to the near post.
      const nearX = p[0] < 400 ? 372 : 428, a0 = deg(p, holder), a1 = deg(p, [400, 12]), k0 = keeperX;
      let a = a1 - a0; if (a > 180) a -= 360; if (a < -180) a += 360;
      await tween(300, t => {
        set(mine, { transform: `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)}) scale(${(1 + .12 * bump(t)).toFixed(3)})` });
        set(face, { transform: `rotate(${(a0 + a * t).toFixed(1)})` });
        keeperX = k0 + (nearX - k0) * t; set(gk, { cx: keeperX });
      }, out);
      setPhase('shoot');
      say.textContent = 'He turns. The keeper covers the near post. Pick a corner.';
      aims.forEach(b => { b.hidden = false; });
      // Keyboard: focus lands on the left corner; the arrow keys pick, Enter shoots.
      if (keyed) aims[0].focus({ preventScroll: true });
    };

    const shootAt = async c => {
      if (phase !== 'shoot') return;
      setPhase('shot');
      aims.forEach(b => { b.hidden = true; });
      const p = along(G.rp, s), near = p[0] < 400 ? 0 : 1, to = G.corners[c], ctl = [(p[0] + to[0]) / 2 - 10, (p[1] + to[1]) / 2 - 30];
      if (c !== near) {
        await tween(260, t => { const b = q(p, ctl, to, t); set(ball, { cx: b[0], cy: b[1], r: 6.5 + 3 * bump(t) }); set(shot, { d: `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}` }); }, inQ);
        shot.setAttribute('marker-end', 'url(#passions-head)');
        game.classList.add('passions-scored');
        if (!reduce) net.animate([{ transform: 'none' }, { transform: 'translateY(-5px) scaleX(1.04)' }, { transform: 'translateY(2px)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.3, .7, .4, 1)' });
        goals++; game.dataset.goals = String(goals); goalsB.textContent = String(goals);
        pips[goals - 1].classList.add('passions-got');
        if (!reduce) pips[goals - 1].animate([{ transform: 'scale(.6)' }, { transform: 'scale(1.15)' }, { transform: 'none' }], { duration: 380, easing: 'ease-out' });
        say.textContent = goals < 3 ? `Goal, the far corner. ${goals} of 3.` : 'Goal. Three from three, all from the line.';
        await wait(1100);
        if (goals < 3) nextRound(round + 1); else { setPhase('done'); game.querySelector('.passions-restart').focus({ preventScroll: true }); }
      } else {
        // Saved: the keeper is there; the ball comes off him towards the wing.
        const k = [keeperX, G.keeper[1] + 4], off = [p[0] < 400 ? 150 : 650, 40];
        await tween(240, t => { const b = lerp(p, k, t); set(ball, { cx: b[0], cy: b[1] }); }, inQ);
        if (!reduce) gk.animate([{ transform: 'none' }, { transform: 'scale(1.25)' }, { transform: 'none' }], { duration: 300, transformBox: 'fill-box', transformOrigin: 'center' });
        await tween(340, t => { const b = lerp(k, off, t); set(ball, { cx: b[0], cy: b[1] }); }, out);
        say.textContent = 'Saved: the keeper had the near post. Shoot again.';
        await wait(900);
        set(ball, { cx: p[0], cy: p[1] });
        setPhase('shoot');
        aims.forEach(b => { b.hidden = false; });
        if (keyed) aims[0].focus({ preventScroll: true });
      }
    };

    // A new round: the ball goes to the next back and the defence slides across to meet it.
    const nextRound = async r => {
      round = r; game.dataset.round = String(r);
      const from = spots.map(d => [...d]), to = roundSpots(r), b0 = [+ball.getAttribute('cx'), +ball.getAttribute('cy')], b1 = G.backs[G.rounds[r].ball], k0 = keeperX;
      game.classList.remove('passions-scored'); shot.setAttribute('d', 'M0 0'); shot.removeAttribute('marker-end');
      holder = b1;
      await tween(650, t => {
        spots = from.map((d, i) => lerp(d, to[i], t)); drawDefence();
        const b = lerp(b0, b1, t); set(ball, { cx: b[0], cy: b[1], r: 6.5 });
        keeperX = k0 + (G.keeper[0] - k0) * t; set(gk, { cx: keeperX });
        drawPivot();
      });
      spots = to; setPhase('move'); wasOpen = null; drawPivot();
      say.textContent = texts[r];
    };

    // Pointer: drag the pivot, or click or tap a spot near his line to send him there.
    const toView = e => { const r = svg.getBoundingClientRect(); return [VB.x + (e.clientX - r.left) / r.width * VB.w, VB.y + (e.clientY - r.top) / r.height * VB.h]; };
    const nearest = pt => { let best = G.lo, bd = Infinity; for (let i = 0; i <= 300; i++) { const c = G.lo + (G.hi - G.lo) * i / 300, p = along(G.rp, c), d = Math.hypot(p[0] - pt[0], p[1] - pt[1]); if (d < bd) { bd = d; best = c; } } return { s: best, d: bd }; };
    handle.addEventListener('pointerdown', e => {
      if (phase !== 'move') return;
      e.preventDefault(); keyed = false; dragging = true; calling = false;
      handle.setPointerCapture(e.pointerId); handle.focus({ preventScroll: true });
    });
    handle.addEventListener('pointermove', e => { if (dragging) go(nearest(toView(e)).s); });
    const release = () => { if (!dragging) return; dragging = false; calling = true; go(target); };
    handle.addEventListener('pointerup', release);
    handle.addEventListener('pointercancel', () => { dragging = false; });
    pitch.addEventListener('click', e => {
      if (phase !== 'move' || e.target === handle || e.target.closest('.passions-aim')) return;
      const n = nearest(toView(e));
      if (n.d > 90) return;
      keyed = false; calling = true; go(n.s);
    });
    // Keys: the pivot is a slider. Arrows move him, Shift moves further, Enter or Space call for the ball.
    handle.addEventListener('keydown', e => {
      if (phase !== 'move') return;
      const step = e.shiftKey ? .06 : .015;
      const to = { ArrowRight: target + step, ArrowUp: target + step, ArrowLeft: target - step, ArrowDown: target - step, Home: G.lo, End: G.hi }[e.key];
      if (to !== undefined) { e.preventDefault(); keyed = true; go(to); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); keyed = true; if (raf) calling = true; else call(); }
    });
    aims.forEach(b => {
      b.addEventListener('click', () => shootAt(+b.dataset.c));
      b.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); aims[e.key === 'ArrowLeft' ? 0 : 1].focus(); } });
    });
    $('.passions-restart').addEventListener('click', async () => {
      if (phase === 'pass' || phase === 'shot') return;
      goals = 0; game.dataset.goals = '0'; goalsB.textContent = '0';
      pips.forEach(p => p.classList.remove('passions-got'));
      aims.forEach(b => { b.hidden = true; });
      setPhase('reset');
      target = .5; go(.5);
      await nextRound(0);
      handle.focus({ preventScroll: true });
    });

    const view = () => {
      VB = phone.matches ? { x: 100, y: -20, w: 600, h: 432 } : { x: -60, y: -40, w: 920, h: 575 };
      svg.setAttribute('viewBox', `${VB.x} ${VB.y} ${VB.w} ${VB.h}`);
      aims.forEach((b, i) => place(b, [G.corners[i][0], G.corners[i][1] + 4]));
      drawPivot();
    };
    phone.addEventListener('change', view);

    spots = roundSpots(0); drawDefence(); view();
  }

  /* ---------- Find the mate ---------- */
  const chess = document.querySelector('.passions-chess');
  if (chess) {
    const $ = s => chess.querySelector(s);
    const rk = $('.passions-rk'), rook = $('.passions-rook'), csay = $('.passions-csay'), again = $('.passions-again');
    const dests = [...chess.querySelectorAll('.passions-dest')];
    const first = csay.innerHTML;
    let busy = false;
    const pick = on => { rk.setAttribute('aria-expanded', String(on)); dests.forEach(d => { d.hidden = !on; }); };
    const moveTo = sqr => {
      const x = sqr.charCodeAt(0) - 97, y = 8 - Number(sqr[1]);
      rook.style.transform = `translate(${x - 3}px, ${y - 7}px)`;
      rk.style.left = `${x * 12.5}%`; rk.style.top = `${y * 12.5}%`;
    };
    rk.addEventListener('click', () => {
      if (busy || chess.classList.contains('passions-solved')) return;
      const on = rk.getAttribute('aria-expanded') !== 'true';
      pick(on);
      csay.textContent = on ? 'Where does the rook go?' : 'Illustrative position. White to move and mate in one.';
    });
    dests.forEach(d => {
      d.addEventListener('click', async () => {
        const to = d.dataset.sq;
        pick(false); busy = true; moveTo(to);
        if (to === 'd8') {
          chess.classList.add('passions-solved'); chess.dataset.solved = '1';
          csay.textContent = 'Rd8#. Mate on the back rank: his own pawns hold the king in.';
          again.hidden = false; rk.setAttribute('aria-label', 'The white rook on d8, mate');
          busy = false;
          return;
        }
        csay.textContent = `R${to} is not even check. Try another square.`;
        await wait(950);
        moveTo('d1'); busy = false; rk.focus({ preventScroll: true });
      });
      d.addEventListener('keydown', e => { if (e.key === 'Escape') { pick(false); rk.focus(); } });
    });
    again.addEventListener('click', () => {
      chess.classList.remove('passions-solved'); chess.dataset.solved = '0';
      moveTo('d1'); rook.style.transform = '';
      again.hidden = true; csay.innerHTML = first; rk.setAttribute('aria-label', 'The white rook on d1. Pick it up');
      rk.focus({ preventScroll: true });
    });
  }
})();

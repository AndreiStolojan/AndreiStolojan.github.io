// Badge, Badge: the headline reveals once on load. The badge copies three fields and hangs like a real one: it swings
// once into place, responds to a brush or tap, and can follow phone tilt after a touch grants sensor access.
// The damped pendulum runs frames only while moving. Sensors detach while hidden or off screen.
(() => {
  const hero = document.querySelector('.badge-hero');
  if (!hero) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const title = hero.querySelector('.badge-t');
  requestAnimationFrame(() => requestAnimationFrame(() => title.classList.add('badge-in')));

  // Copy. If the browser refuses the clipboard, the value is selected instead, so a copy shortcut still works.
  // The row's data-state switches its label to "Copied" or "Selected" (CSS); the live region says it in words.
  const badge = hero.querySelector('.badge-badge');
  const live = badge.querySelector(':scope > .badge-vh');
  const rows = [...badge.querySelectorAll('.badge-fields li')];
  let reset = 0;
  badge.querySelectorAll('.badge-copy').forEach(b => b.addEventListener('click', async () => {
    const row = b.closest('li');
    let copied = true;
    try { await navigator.clipboard.writeText(b.dataset.copy); } catch { copied = false; }
    if (!copied) {
      const range = document.createRange();
      range.selectNodeContents(row.querySelector('.badge-v [translate="no"]'));
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }
    rows.forEach(r => { if (r === row) r.dataset.state = copied ? 'copied' : 'selected'; else delete r.dataset.state; });
    live.textContent = copied ? b.dataset.done : b.dataset.fail;
    clearTimeout(reset);
    reset = setTimeout(() => { rows.forEach(r => delete r.dataset.state); live.textContent = ''; }, 2400);
  }));

  // Swing: angle a (degrees) and speed v (degrees per second), pulled back to rest and slowed by the air.
  const K = 34, DAMP = 2.4, MAX = 14;
  let a = 0, v = 0, target = 0, last = 0, frame = 0, limit = 4;
  let visible = false, introduced = false, introTimer = 0;
  let tiltGranted = false, tiltPending = false, tiltDenied = false, listening = false, neutral = null;
  const orientation = window.DeviceOrientationEvent;
  const supported = isSecureContext && typeof orientation === 'function';
  badge.dataset.tilt = supported ? 'off' : 'unsupported';
  const active = () => visible && !document.hidden && !reduce.matches;

  /** Writes a resting angle once, removing the property when the badge is upright. */
  function paint() {
    if (a === 0) badge.style.removeProperty('--swing');
    else badge.style.setProperty('--swing', `${a.toFixed(3)}deg`);
  }

  /** Fits the swing into the available screen margin, including the strap's pivot above the card. */
  function measureMotion() {
    badge.style.removeProperty('--swing');
    const rect = badge.getBoundingClientRect();
    const pivot = Math.max(0, -parseFloat(getComputedStyle(badge).transformOrigin.split(' ')[1]));
    const margin = Math.max(0, Math.min(rect.left, innerWidth - rect.right) - 4);
    limit = Math.min(4, Math.atan2(margin, rect.height + pivot) * 180 / Math.PI);
    a = Math.max(-limit, Math.min(limit, a));
    target = Math.max(-limit * .7, Math.min(limit * .7, target));
    paint();
  }

  const step = t => {
    const dt = Math.min(.032, (t - (last || t)) / 1000);
    last = t;
    v += (-K * (a - target) - DAMP * v) * dt;
    a += v * dt;
    if (Math.abs(a) > limit) { a = Math.sign(a) * limit; v = 0; }
    if (Math.abs(a - target) < .01 && Math.abs(v) < .05) { a = target; v = last = frame = 0; paint(); return; }
    paint();
    frame = requestAnimationFrame(step);
  };
  const push = dv => {
    if (!active()) return;
    v = Math.max(-MAX, Math.min(MAX, v + dv));
    if (!frame) frame = requestAnimationFrame(step);
  };

  /** Calibrates to the phone's current position and keeps left/right tilt correct in landscape. */
  function followTilt(event) {
    if (!active() || !Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return;
    const angle = (screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
    const lean = event.gamma * Math.cos(angle) + event.beta * Math.sin(angle);
    if (neutral === null) {
      neutral = lean;
      badge.dataset.tilt = 'on';
      live.textContent = 'Badge tilt enabled.';
      return;
    }
    // A small dead band ignores sensor noise, so a steady phone does not repaint the badge.
    const maxTilt = Math.min(3, limit * .7);
    const next = Math.round(Math.max(-maxTilt, Math.min(maxTilt, (neutral - lean) * .12)) * 10) / 10;
    if (Math.abs(next - target) < .099) return;
    target = next;
    push(0);
  }

  /** Suspends sensor delivery and animation when the badge is not being viewed. */
  function syncMotion() {
    const shouldListen = active() && tiltGranted;
    if (shouldListen !== listening) {
      if (shouldListen) addEventListener('deviceorientation', followTilt, { passive: true });
      else removeEventListener('deviceorientation', followTilt);
      listening = shouldListen;
      neutral = null;
    }
    if (!active()) {
      clearTimeout(introTimer);
      cancelAnimationFrame(frame);
      a = v = target = last = frame = 0;
      paint();
    }
  }

  /** Requests access only inside the visitor's touch gesture, never on page load or link clicks. */
  async function enableTilt() {
    if (!supported || !active() || tiltGranted || tiltPending || tiltDenied) return;
    tiltPending = true;
    try {
      const permission = typeof orientation.requestPermission === 'function' ? await orientation.requestPermission() : 'granted';
      if (permission === 'granted') {
        tiltGranted = true;
        badge.dataset.tilt = 'ready';
        syncMotion();
      } else {
        tiltDenied = true;
        badge.dataset.tilt = 'denied';
        live.textContent = 'Badge tilt unavailable.';
      }
    } catch {
      tiltDenied = true;
      badge.dataset.tilt = 'unavailable';
      live.textContent = 'Badge tilt unavailable.';
    } finally { tiltPending = false; }
  }

  // Introduce the badge once. Continue observing it to pause motion when the visitor scrolls away.
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    syncMotion();
    if (!introduced && active() && e.intersectionRatio >= .4) {
      introduced = true;
      introTimer = setTimeout(() => { a = 2.6; push(0); }, 350);
    }
  }, { threshold: [0, .4] });
  io.observe(badge);
  document.addEventListener('visibilitychange', syncMotion);
  reduce.addEventListener('change', syncMotion);
  const recalibrate = () => { neutral = null; target = 0; if (listening) push(0); };
  screen.orientation?.addEventListener('change', recalibrate);
  addEventListener('orientationchange', recalibrate);
  addEventListener('resize', measureMotion, { passive: true });
  new ResizeObserver(measureMotion).observe(badge);
  measureMotion();

  // A brush: the pointer's horizontal speed as it enters the badge. A tap: a small push away from the finger.
  let px = 0, pt = 0, speed = 0;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const now = performance.now();
    if (pt) speed = (e.clientX - px) / Math.max(8, now - pt);   // px per ms
    px = e.clientX; pt = now;
  }, { passive: true });
  badge.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') push(-speed * 9); });   // moving right pushes the bottom right, a negative turn
  badge.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || e.target.closest('a, button')) return;
    const r = badge.getBoundingClientRect();
    push(e.clientX < r.left + r.width / 2 ? -6 : 6);
  });
  badge.addEventListener('pointerup', e => {
    // Touch activation becomes available on pointerup, rather than on pointerdown.
    if (e.pointerType !== 'mouse' && !e.target.closest('a, button')) enableTilt();
  });
})();

// Badge, Badge: the headline reveals once on load. The badge copies three fields and hangs like a real one: it swings
// once into place when it first comes into view, and a brush of the pointer (or a tap) sets it swinging again.
// The swing is a damped pendulum stepped per frame only while it moves; once it settles, nothing runs.
(() => {
  const hero = document.querySelector('.badge-hero');
  if (!hero) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  if (reduce) return;

  // Swing: angle a (degrees) and speed v (degrees per second), pulled back to rest and slowed by the air.
  const K = 34, DAMP = 2.4, MAX = 14;
  let a = 0, v = 0, last = 0, frame = 0;
  const step = t => {
    const dt = Math.min(.032, (t - (last || t)) / 1000);
    last = t;
    v += (-K * a - DAMP * v) * dt;
    a += v * dt;
    if (Math.abs(a) < .01 && Math.abs(v) < .05) { a = v = 0; last = frame = 0; badge.style.removeProperty('--swing'); return; }
    badge.style.setProperty('--swing', `${a.toFixed(3)}deg`);
    frame = requestAnimationFrame(step);
  };
  const push = dv => { v = Math.max(-MAX, Math.min(MAX, v + dv)); if (!frame) frame = requestAnimationFrame(step); };

  // Once, when the badge first comes into view: it has just been hung, so it starts a little off and settles.
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    setTimeout(() => { a = 2.6; push(0); }, 350);
  }, { threshold: .4 });
  io.observe(badge);

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
})();

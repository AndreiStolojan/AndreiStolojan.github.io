// Projects projects: the working objects.
//   Stages on screen get .prj-live, so the continuous motion (Sotto's bars, Eclipse's wave) and the player clock only
//   run while they can be seen.
//   Barb: a click on a message shows its score, verdict and rules; another click, another message.
//   Eclipse: hover or focus opens the notch after 100 ms and leaving closes it after 300 ms, as in the app; a tap
//   opens it on touch screens. Only next and previous change the track, with the artwork flip; play and pause
//   work; shuffle and repeat toggle; the page buttons only press. Where the browser can vibrate (Android), the
//   notch opening and each button give a short tick, like the app's trackpad haptic. The playing track's clock
//   ticks once a second while the stage is on screen.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Stages on screen.
  const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('prj-live', e.isIntersecting && !reduce)));
  document.querySelectorAll('.prj-stage').forEach(s => io.observe(s));

  // Runs f(t) for t from 0 to 1 over ms, eased out.
  const tween = (ms, f) => {
    if (reduce) return f(1);
    const t0 = performance.now();
    const step = now => { const t = Math.min(1, (now - t0) / ms); f(1 - (1 - t) ** 3); if (t < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };

  // ---------- Barb ----------
  // A click on a message scans it, and every click plays the scan again from the start: the badge appears, the
  // score counts up from 0 while the meter fills, then the rules come in one by one.
  const bx = document.querySelector('.bx');
  if (bx) {
    const n = bx.querySelector('.sc .n'), em = bx.querySelector('.sc em'), meter = bx.querySelector('.meter i');
    const lists = [...bx.querySelectorAll('.bx-score ul')];
    let run = 0;
    bx.querySelectorAll('.bx-msg').forEach(m => m.addEventListener('click', () => {
      const score = Number(m.dataset.score), id = ++run;
      bx.querySelectorAll('.bx-msg').forEach(o => o.setAttribute('aria-pressed', String(o === m)));
      bx.dataset.v = m.dataset.v;
      em.textContent = m.querySelector('em').textContent;
      // Back to empty without a transition, then fill.
      meter.style.transition = 'none';
      meter.style.setProperty('--s', '0');
      m.classList.remove('seen');
      lists.forEach(l => { l.hidden = true; });
      void meter.offsetWidth;
      meter.style.transition = '';
      meter.style.setProperty('--s', (score / 100).toFixed(2));
      m.classList.add('seen');
      lists.forEach(l => { l.hidden = l.dataset.for !== m.dataset.i; });
      tween(900, t => { if (id === run) n.textContent = String(Math.round(score * t)); });
    }));
  }

  // ---------- Eclipse ----------
  const nt = document.querySelector('.nt');
  if (!nt) return;
  const stage = nt.closest('.prj-stage');
  const tracks = [
    { title: 'Weightless', artist: 'Marconi Union', len: 239, at: 90, cover: 'c0' },
    { title: 'Experience', artist: 'Ludovico Einaudi', len: 315, at: 42, cover: 'c1' },
  ];
  const $ = s => nt.querySelector(s);
  const art = $('.art'), mini = $('.mini'), tt = $('.tt'), ar = $('.ar'), el = $('.el'), rm = $('.rm'), fill = $('.tr i'), pp = $('.pp'), say = stage.querySelector('[aria-live]');
  const ti = $('.ti');
  let cur = 0, playing = true;
  const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const progress = (smooth) => {
    const t = tracks[cur];
    fill.classList.toggle('run', smooth);
    fill.style.setProperty('--p', (t.at / t.len).toFixed(4));
    el.textContent = clock(t.at);
    rm.textContent = '-' + clock(t.len - t.at);
  };
  const paint = () => {
    const t = tracks[cur];
    art.className = `cv art ${t.cover}`;
    mini.className = `cv mini ${t.cover}`;
    tt.textContent = t.title;
    ar.textContent = t.artist;
    progress(false);
  };

  // The artwork turns about its vertical axis (Eclipse's Flip), the new cover arriving on the far side; the
  // title settles in from slightly out of focus. Next turns one way, previous the other.
  let turning = false;
  const go = dir => {
    if (turning) return;
    cur = (cur + tracks.length + dir) % tracks.length;
    say.textContent = `Now playing ${tracks[cur].title} by ${tracks[cur].artist}`;
    if (reduce) { paint(); return; }
    turning = true;
    const p = 'perspective(600px) ';
    art.animate([{ transform: p + 'rotateY(0)' }, { transform: p + `rotateY(${90 * dir}deg)` }], { duration: 260, easing: 'cubic-bezier(.5, 0, .9, .5)' }).finished.then(() => {
      paint();
      art.animate([{ transform: p + `rotateY(${-90 * dir}deg)` }, { transform: p + 'rotateY(0)' }], { duration: 420, easing: 'cubic-bezier(.2, .9, .3, 1.15)' }).finished.then(() => { turning = false; });
    });
    ti.animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(3px)', transform: `translateX(${-6 * dir}px)` }], { duration: 220, fill: 'forwards' }).finished.then(() => {
      ti.animate([{ opacity: 0, filter: 'blur(3px)', transform: 'scale(1.03)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'forwards' });
    });
  };
  const setPlaying = v => {
    playing = v;
    nt.classList.toggle('playing', playing);
    nt.classList.toggle('paused', !playing);
    pp.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  };

  // Open and close, with the app's hover and close delays.
  let timer = 0;
  // Only inside a user gesture: browsers refuse vibration otherwise.
  const tick = () => { if (navigator.userActivation?.isActive) navigator.vibrate?.(8); };
  const open = v => { clearTimeout(timer); if (v && !nt.classList.contains('open')) tick(); nt.classList.toggle('open', v); };
  const later = (v, ms) => { clearTimeout(timer); timer = setTimeout(() => open(v), ms); };
  nt.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') later(true, 100); });
  nt.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') later(false, 300); });
  nt.addEventListener('focusin', () => open(true));
  nt.addEventListener('focusout', e => { if (!nt.contains(e.relatedTarget)) later(false, 300); });
  // A tap outside closes it on touch screens.
  document.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && !nt.contains(e.target)) open(false); });

  nt.addEventListener('click', e => {
    if (!nt.classList.contains('open')) { open(true); return; }
    const b = e.target.closest('button');
    if (!b) return;
    tick();
    if (b.classList.contains('next')) go(1);
    else if (b.classList.contains('prev')) go(-1);
    else if (b.classList.contains('pp')) setPlaying(!playing);
    else if (b.classList.contains('tg')) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
  });
  nt.addEventListener('keydown', e => { if (e.key === 'Escape') open(false); });

  // The clock: one second a second, while playing and on screen; at the end the other track starts.
  setInterval(() => {
    if (!playing || !stage.classList.contains('prj-live') || document.hidden) return;
    const t = tracks[cur];
    t.at += 1;
    if (t.at >= t.len) { t.at = 0; go(1); return; }
    progress(true);
  }, 1000);

  paint();
  setPlaying(true);
  // Without hover (phones, tablets) the player starts open; a tap on it plays the other track.
  if (matchMedia('(hover: none)').matches) open(true);
})();

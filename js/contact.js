// Contact patch panel: the patch cable and the steps of the shared contact form (contact-form.js).
// The cable is two paths in the rack's own pixels: the wire, from the left edge of the screen along under the
// panel and up behind it, and the plug, drawn in front of the panel. A move unplugs (the plug drops just below
// the panel), travels under it to the new port, and seats; the new port's link light comes on.
//   on view  the cable hangs loose under Message and plugs in, once
//   ports    using any port (click, tap, Enter) moves the plug there; Message also puts the cursor in the form
//   sending  the plug goes back to Message if it was elsewhere; the link light blinks a few times
//   sent     the light stays on
//   error    the link goes down and the cable fails over to Email, where the mailto fallback is
//   idle     back to Message
// Under reduced motion the plug is seated from the start and moves without travelling.
(() => {
  const root = document.querySelector('.contact-sec');
  if (!root || !window.coForm) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
  const rack = root.querySelector('.contact-rack'), panel = root.querySelector('.contact-panel');
  const wire = root.querySelector('.contact-wire'), boot = root.querySelector('.contact-boot');
  const port = k => root.querySelector(`.contact-p[data-port="${k}"]`);
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  const easeOut = t => 1 - (1 - t) ** 3;

  // Where things are, in rack pixels: the port's jack, the panel's bottom edge, the cable's run, the screen edge.
  const geo = k => {
    const r = rack.getBoundingClientRect(), j = port(k).querySelector('.contact-jack').getBoundingClientRect();
    return { cx: j.left + j.width / 2 - r.left, top: j.top - r.top, w: j.width, h: j.height, floor: panel.getBoundingClientRect().bottom - r.top, run: r.height - 16, left: -r.left };
  };

  // The plug seen from the front: the body in the jack, then the boot tapering into the cable.
  const plug = (cx, top, w, h) => {
    const x0 = cx - w / 2, x1 = cx + w / 2, b = top + h, tail = h * .55, n = 3, r = 2;
    return { d: `M${x0 + r} ${top}H${x1 - r}Q${x1} ${top} ${x1} ${top + r}V${b}L${cx + n} ${b + tail}H${cx - n}L${x0} ${b}V${top + r}Q${x0} ${top} ${x0 + r} ${top}Z`, end: b + tail };
  };
  // Down from the plug, a bend to the left, then straight to the edge of the screen.
  const run = (cx, y, g) => {
    const k = Math.min(Math.max(24, (g.run - y) * .9), cx - g.left - 8);
    return `M${cx} ${y}C${cx} ${y + (g.run - y) * .7} ${cx - k * .25} ${g.run} ${cx - k} ${g.run}L${g.left} ${g.run}`;
  };

  // Current state: the port the cable belongs to, an x while travelling (null when over its port), and how far
  // the plug is out of the jack (0 seated, 1 hanging just under the panel).
  const cur = { port: 'message', x: null, lift: reduce ? 0 : 1 };
  let seq = 0;

  function draw() {
    const g = geo(cur.port), w = g.w * .7, h = g.h * .8;
    const seated = g.top + g.h * .1, loose = g.floor + 6;
    const x = cur.x ?? g.cx, p = plug(x, seated + (loose - seated) * cur.lift, w, h);
    boot.setAttribute('d', p.d);
    wire.setAttribute('d', run(x, p.end, g));
  }
  const light = (k, on) => port(k).classList.toggle('contact-on', on);

  // Runs fn(t) for t from 0 to 1 over ms, drawing each frame. Resolves false if a newer move took over.
  const tween = (ms, fn) => new Promise(res => {
    const mine = seq, t0 = performance.now();
    const frame = now => {
      if (mine !== seq) return res(false);
      const t = Math.min(1, (now - t0) / ms);
      fn(t); draw();
      t < 1 ? requestAnimationFrame(frame) : res(true);
    };
    requestAnimationFrame(frame);
  });

  async function move(to) {
    if (cur.port === to && cur.x === null && cur.lift === 0) return;
    seq++;
    light(cur.port, false);
    root.dataset.port = to;
    if (reduce) { Object.assign(cur, { port: to, x: null, lift: 0 }); draw(); light(to, true); return; }
    const l0 = cur.lift;
    if (l0 < 1 && !await tween(240 * (1 - l0), t => { cur.lift = l0 + (1 - l0) * easeInOut(t); })) return;
    const x0 = cur.x ?? geo(cur.port).cx, x1 = geo(to).cx;
    cur.port = to; cur.x = x0;
    if (!await tween(Math.min(720, 260 + Math.abs(x1 - x0) * .45), t => { cur.x = x0 + (x1 - x0) * easeInOut(t); })) return;
    cur.x = null;
    if (!await tween(300, t => { cur.lift = 1 - easeOut(t); })) return;
    light(to, true);
  }

  // Link up once, when the panel comes into view.
  root.dataset.port = 'message';
  draw();
  if (reduce) light('message', true);
  else new IntersectionObserver((entries, io) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    if (cur.port !== 'message' || cur.lift !== 1) return;
    setTimeout(async () => { seq++; if (await tween(420, t => { cur.lift = 1 - easeOut(t); })) light('message', true); }, 250);
  }, { threshold: .6 }).observe(rack);
  addEventListener('resize', draw);
  document.fonts.ready.then(draw);

  root.querySelectorAll('.contact-p').forEach(p => p.addEventListener('click', () => {
    move(p.dataset.port);
    if (p.dataset.port === 'message') root.querySelector('#contact-name').focus();
  }));

  const msg = port('message');
  const play = async step => {
    if (step === 'sending') { await move('message'); msg.classList.remove('contact-act'); void msg.offsetWidth; msg.classList.add('contact-act'); }
    if (step === 'sent') { msg.classList.remove('contact-act'); light('message', true); await wait(250); }
    if (step === 'error') { msg.classList.remove('contact-act'); await wait(250); await move('email'); await wait(150); }
    if (step === 'idle') await move('message');
  };

  coForm(root, play);
})();

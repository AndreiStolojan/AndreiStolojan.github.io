// Shared behaviour: scroll reveals, the path's spine, popups with URL hashes, the contact form mock.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reveals: each .r fades in once when it enters the viewport. The hero headline uses the same hook.
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
  }), { threshold: .1, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.r, .hero h1').forEach(el => io.observe(el));

  // Path: the spine fills down to a reading line two thirds down the viewport, and each entry lights up once
  // the line has passed it. Both follow the scroll position, so nothing moves unless the reader does. Under
  // reduced motion the spine is drawn in full by CSS and every entry is on from the start.
  const tl = document.querySelector('.timeline');
  if (tl) {
    const items = [...tl.querySelectorAll('.ev')];
    if (reduce) items.forEach(li => li.classList.add('on'));
    else {
      let ticking = false;
      const update = () => {
        ticking = false;
        const r = tl.getBoundingClientRect(), line = innerHeight * .66;
        tl.style.setProperty('--p', Math.min(1, Math.max(0, (line - r.top) / r.height)).toFixed(3));
        items.forEach(li => li.classList.toggle('on', li.getBoundingClientRect().top + 16 <= line));
      };
      const ask = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
      addEventListener('scroll', ask, { passive: true });
      addEventListener('resize', ask);
      update();
    }
  }

  // Popups. Each <dialog class="dlg" id="x"> is opened by any <a href="#x">.
  // Opening pushes #x into history, so the back button and a shared URL both work.
  let open = null, opener = null, scrollY = 0;

  function lockScroll(on) {
    const b = document.body;
    if (on) { scrollY = window.scrollY; b.style.position = 'fixed'; b.style.top = -scrollY + 'px'; b.style.width = '100%'; }
    else { b.style.position = ''; b.style.top = ''; b.style.width = ''; window.scrollTo({ top: scrollY, behavior: 'instant' }); }
  }

  function show(dlg, push, from) {
    if (open === dlg) return;
    // Opened from inside another popup: replace its history entry, so one close returns to the page.
    const chained = !!open && !!history.state && history.state.dlg === open.id;
    if (open) finish(open);
    opener = from || document.activeElement;
    open = dlg;
    lockScroll(true);
    dlg.showModal();
    dlg.querySelector('.panel').focus({ preventScroll: true });
    if (push) history[chained ? 'replaceState' : 'pushState']({ dlg: dlg.id }, '', '#' + dlg.id);
  }

  // Closes without animation and restores scroll and focus.
  function finish(dlg) {
    dlg.classList.remove('closing');
    dlg.close();
    if (open === dlg) { open = null; lockScroll(false); }
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  }

  // Plays the exit animation, then closes. If we pushed a hash for this popup, step back in history instead
  // so the URL and the back button stay in sync (popstate then calls hide again with the dialog closed).
  function hide(dlg, viaHistory) {
    if (!dlg || !dlg.open) return;
    if (!viaHistory && history.state && history.state.dlg === dlg.id) { history.back(); return; }
    if (reduce) { finish(dlg); return; }
    dlg.classList.add('closing');
    dlg.querySelector('.panel').addEventListener('animationend', () => finish(dlg), { once: true });
  }

  document.querySelectorAll('dialog.dlg').forEach(dlg => {
    dlg.addEventListener('cancel', ev => { ev.preventDefault(); hide(dlg); });        // Esc
    // Tab wraps inside the panel instead of leaving for the browser chrome.
    dlg.addEventListener('keydown', ev => {
      if (ev.key !== 'Tab') return;
      const f = [...dlg.querySelectorAll('a[href], button, [tabindex="-1"]')].filter(el => !el.hidden);
      const first = f[1] || f[0], last = f[f.length - 1];   // f[0] is the panel itself
      if (ev.shiftKey && (document.activeElement === first || document.activeElement === f[0])) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
    dlg.addEventListener('click', ev => { if (ev.target === dlg) hide(dlg); });         // backdrop
    dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => hide(dlg)));
  });

  document.addEventListener('click', ev => {
    const a = ev.target.closest('a[href^="#"]');
    if (!a) return;
    const dlg = document.getElementById(a.getAttribute('href').slice(1));
    if (!dlg || dlg.tagName !== 'DIALOG') return;
    ev.preventDefault();
    // A link inside a popup opens the next one; focus still returns to the original trigger at the end.
    show(dlg, true, open ? opener : a);
  });

  // Opens the popup named by `id`, or closes the open one when there is none.
  function route(id, push) {
    const dlg = document.getElementById(id);
    if (dlg && dlg.tagName === 'DIALOG') {
      // The first *visible* trigger: a popup can be linked from both the desktop and the phone form of the path.
      const trigger = [...document.querySelectorAll(`a[href="#${dlg.id}"]`)].find(a => a.offsetParent !== null) || null;
      if (trigger && !open) trigger.scrollIntoView({ block: 'center', behavior: 'instant' });
      show(dlg, push, trigger);
    } else if (open) hide(open, true);
  }
  window.addEventListener('popstate', () => route(location.hash.slice(1), false));
  // Deep link on load: put a clean entry underneath, so the back button closes the popup instead of leaving the site.
  if (location.hash && document.getElementById(location.hash.slice(1))?.matches('dialog')) {
    const id = location.hash.slice(1);
    history.replaceState(null, '', location.pathname + location.search);
    route(id, true);
  }

})();

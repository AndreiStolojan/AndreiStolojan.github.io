/* Enhances the phone disclosure and keeps sticky path offsets equal to the actual desktop header. */
(() => {
  const header = document.querySelector('.nav-repair');
  if (!header) return;
  const phone = matchMedia('(max-width: 640px)');
  const toggle = header.querySelector('.nav-toggle');
  const panel = header.querySelector('.nav-panel');
  const label = header.querySelector('[data-menu-label]');

  /** Closes the panel before anchor scrolling and returns focus only when requested. */
  function setOpen(open, restoreFocus = false) {
    if (!toggle || !panel) return;
    toggle.setAttribute('aria-expanded', String(open));
    panel.toggleAttribute('data-open', open);
    if (restoreFocus) toggle.focus();
  }

  /** Mobile headers scroll away; only a sticky header contributes to the path offset. */
  function syncOffset() {
    document.body.style.setProperty('--polish-header-offset', `${phone.matches ? 0 : Math.ceil(header.getBoundingClientRect().height)}px`);
  }

  /** The existing language group still uses the site's delegated i18n handler. */
  function syncLabel() {
    if (!label) return;
    const labels = { en: 'Menu', ro: 'Meniu', de: 'Menü', fr: 'Menu' };
    label.textContent = labels[document.documentElement.lang] || labels.en;
  }

  if (toggle && panel) {
    header.setAttribute('data-nav-ready', '');
    setOpen(false);
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    header.addEventListener('keydown', event => {
      if (event.key === 'Escape' && phone.matches && panel.hasAttribute('data-open')) {
        event.preventDefault();
        setOpen(false, true);
      }
    });
    document.addEventListener('pointerdown', event => {
      if (phone.matches && panel.hasAttribute('data-open') && !header.contains(event.target)) {
        setOpen(false, panel.contains(document.activeElement));
      }
    });
    header.addEventListener('focusout', event => {
      if (event.relatedTarget && phone.matches && !header.contains(event.relatedTarget)) setOpen(false);
    });
    header.querySelector('.btn.primary')?.addEventListener('click', () => setOpen(false));
    panel.addEventListener('click', event => {
      const anchor = event.target.closest('a[href]');
      if (!anchor || !phone.matches) return;
      const destination = new URL(anchor.href);
      setOpen(false);
      // Collapse first, then resolve same-page anchors in their final layout.
      if (destination.pathname === location.pathname && destination.hash) {
        event.preventDefault();
        const target = document.getElementById(decodeURIComponent(destination.hash.slice(1)));
        if (target) {
          if (location.hash !== destination.hash) history.pushState(null, '', destination.hash);
          target.scrollIntoView({ behavior: 'instant', block: 'start' });
          const previousTabindex = target.getAttribute('tabindex');
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
          target.addEventListener('blur', () => {
            if (previousTabindex === null) target.removeAttribute('tabindex');
            else target.setAttribute('tabindex', previousTabindex);
          }, { once: true });
        } else location.hash = destination.hash;
      }
    });
  }
  phone.addEventListener('change', () => { setOpen(false); syncOffset(); });
  new ResizeObserver(syncOffset).observe(header);
  document.addEventListener('i18n:change', syncLabel);
  syncLabel();
  syncOffset();
})();

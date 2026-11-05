// Contact form validation and delivery through Web3Forms, with an email fallback on failure.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
  const EMAIL = 'andreistolojan@gmail.com';
  const looksLikeEmail = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

  // One message per field, empty when the value is fine.
  const rules = {
    name: v => !v ? 'Please tell me your name.' : v.length < 2 ? 'That looks too short for a name.' : '',
    email: v => !v ? 'I need an email to reply to.' : looksLikeEmail.test(v) ? '' : 'That email does not look right.',
    message: v => !v ? 'Please write a message.' : v.length < 10 ? 'A few more words, please.' : '',
  };

  window.coForm = (root, play = async () => {}) => {
    const q = s => root.querySelector(`[data-co="${s}"]`);
    const form = q('form'), sendBtn = q('send'), label = q('label'), status = q('status');
    const done = q('done'), fail = q('fail'), mailto = q('mailto');
    const fields = ['name', 'email', 'message'].map(n => form.elements[n]);
    const idleLabel = label.textContent;
    let busy = false;

    form.noValidate = true;
    root.dataset.state = 'idle';

    // An empty key leaves the address available and disables sending before a visitor types.
    const key = form.elements.access_key.value;
    if (!key) {
      root.dataset.offline = 'true';
      fields.forEach(field => { field.disabled = true; });
      sendBtn.disabled = true;
      status.textContent = 'The form is offline right now.';
    }

    // Accept success only when Web3Forms accepts the message. The mailto fallback retains failed messages.
    const request = async () => {
      if (!key) return false;
      const data = Object.fromEntries(new FormData(form));
      delete data.website;
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(15000),
        });
        const result = await response.json();
        return response.ok && result.success === true;
      } catch { return false; }
    };

    const check = el => {
      const msg = rules[el.name](el.value.trim());
      document.getElementById(el.getAttribute('aria-describedby')).textContent = msg;
      el.setAttribute('aria-invalid', String(!!msg));
      return !msg;
    };
    // Errors appear on submit; after that each field re-checks as it is corrected, and on blur once filled.
    fields.forEach(el => {
      el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') check(el); });
      el.addEventListener('blur', () => { if (el.value.trim() && el.hasAttribute('aria-invalid')) check(el); });
    });

    const setState = s => { root.dataset.state = s; };
    const info = () => ({ name: form.elements.name.value.trim(), email: form.elements.email.value.trim(), message: form.elements.message.value.trim() });

    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      if (busy || !key) return;
      const bad = fields.filter(el => !check(el));
      if (bad.length) { bad[0].focus(); return; }
      busy = true;
      fail.hidden = true;
      const data = info();
      // A filled honeypot is a bot: show the same success, send nothing.
      const trap = form.elements.website.value !== '';
      setState('sending');
      sendBtn.setAttribute('aria-disabled', 'true');
      label.textContent = 'Sending';
      status.textContent = 'Sending your message.';
      const [ok] = await Promise.all([trap ? wait(1100).then(() => true) : request(), play('sending', data)]);
      status.textContent = '';
      sendBtn.removeAttribute('aria-disabled');
      label.textContent = idleLabel;
      if (ok) {
        setState('sent');
        await play('sent', data);
        done.hidden = false;
        done.focus();
      } else {
        // The fallback carries the message, so nothing typed is lost.
        const body = `${data.message}\n\n${data.name}`;
        mailto.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Message from andreistolojan.me')}&body=${encodeURIComponent(body)}`;
        setState('error');
        await play('error', data);
        fail.hidden = false;
        fail.focus();
      }
      busy = false;
    });

    // After a send: start a new message.
    q('again')?.addEventListener('click', async () => {
      form.reset();
      fields.forEach(el => { el.removeAttribute('aria-invalid'); document.getElementById(el.getAttribute('aria-describedby')).textContent = ''; });
      done.hidden = true;
      setState('idle');
      await play('idle');
      form.elements.name.focus();
    });
    // After a failure, where the variant hides the form: go back to it with the text intact.
    q('edit')?.addEventListener('click', async () => {
      fail.hidden = true;
      setState('idle');
      await play('idle');
      form.elements.message.focus();
    });

    // Copy the address, and say so for a moment.
    root.querySelectorAll('[data-co="copy"]').forEach(b => {
      const said = b.querySelector('[data-co="copied"]');
      let t = 0;
      b.hidden = false;
      b.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(EMAIL); }
        catch {
          const ta = Object.assign(document.createElement('textarea'), { value: EMAIL });
          ta.style.cssText = 'position:fixed;opacity:0';
          document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
        }
        b.dataset.done = 'true'; said.textContent = 'Copied';
        clearTimeout(t);
        t = setTimeout(() => { delete b.dataset.done; said.textContent = 'Copy'; }, 2400);
      });
    });
  };
})();

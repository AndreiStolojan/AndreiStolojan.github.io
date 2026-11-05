// Validates and submits the contact draft. Only an accepted response can produce a sent state.
(() => {
  const EMAIL = 'andreistolojan@gmail.com';
  const looksLikeEmail = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
  const rules = {
    name: value => !value ? 'Please tell me your name.' : value.length < 2 ? 'That looks too short for a name.' : '',
    email: value => !value ? 'I need an email to reply to.' : looksLikeEmail.test(value) ? '' : 'That email does not look right.',
    message: value => !value ? 'Please write a message.' : value.length < 10 ? 'A few more words, please.' : '',
  };

  window.coForm = (root, play = async () => {}) => {
    const q = name => root.querySelector(`[data-co="${name}"]`);
    const form = q('form'), send = q('send'), label = q('label'), status = q('status');
    const fail = q('fail'), done = q('done'), availability = q('availability');
    const fields = ['name', 'email', 'message'].map(name => form.elements.namedItem(name));
    let busy = false;
    form.noValidate = true;
    root.dataset.state = 'idle';
    const hasKey = () => !!form.elements.namedItem('access_key').value.trim();
    // Decoration must never prevent delivery, retain a draft, or hold the form in a busy state.
    const animate = step => Promise.resolve().then(() => play(step)).catch(() => {});
    const info = () => Object.fromEntries(fields.map(field => [field.name, field.value]));
    const setState = state => { root.dataset.state = state; };

    // Update every email route on each edit, including the Email jack and the initial fallback.
    const updateFallback = () => {
      const data = info();
      const body = `${data.message}\n\n${data.name}\n${data.email}`;
      const href = `mailto:${EMAIL}?subject=${encodeURIComponent('Message from andreistolojan.me')}&body=${encodeURIComponent(body)}`;
      root.querySelectorAll('[data-co="mailto"], .contact-p[data-port="email"]').forEach(link => { link.href = href; });
    };
    const check = field => {
      const error = rules[field.name](field.value.trim()) || (field.validity.typeMismatch ? 'That email does not look right.' : '') ||
        (field.maxLength > 0 && field.value.length > field.maxLength ? 'Please shorten this field.' : '');
      root.querySelector(`#${field.getAttribute('aria-describedby')}`).textContent = error;
      field.setAttribute('aria-invalid', String(!!error));
      return !error;
    };
    fields.forEach(field => {
      field.addEventListener('input', () => {
        updateFallback();
        if (field.getAttribute('aria-invalid') === 'true') check(field);
      });
      field.addEventListener('blur', () => { if (field.hasAttribute('aria-invalid')) check(field); });
    });

    // Snapshot the form once. A timeout, non-2xx response, invalid JSON, or rejected result is a failure.
    const request = async () => {
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
    const showError = () => {
      setState('error');
      status.textContent = 'Message not sent.';
      fail.hidden = false;
      updateFallback();
      fail.focus();
      void animate('error');
    };

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      const invalid = fields.filter(field => !check(field));
      if (invalid.length) { invalid[0].focus(); return; }
      busy = true;
      fail.hidden = true;
      try {
        // A filled honeypot blocks the request but never fabricates a delivery confirmation.
        if (!hasKey() || form.elements.namedItem('website').value !== '') { showError(); return; }
        setState('sending');
        send.setAttribute('aria-disabled', 'true');
        fields.forEach(field => { field.readOnly = true; });
        label.textContent = 'Sending';
        status.textContent = 'Sending your message.';
        void animate('sending');
        if (await request()) {
          setState('sent');
          status.textContent = '';
          done.hidden = false;
          done.focus();
          void animate('sent');
        } else showError();
      } finally {
        busy = false;
        send.removeAttribute('aria-disabled');
        fields.forEach(field => { field.readOnly = false; });
        label.textContent = 'Send';
      }
    });

    q('again')?.addEventListener('click', async () => {
      form.reset();
      fields.forEach(field => {
        field.removeAttribute('aria-invalid');
        root.querySelector(`#${field.getAttribute('aria-describedby')}`).textContent = '';
      });
      done.hidden = true;
      fail.hidden = true;
      status.textContent = '';
      setState('idle');
      updateFallback();
      await animate('idle');
      fields[0].focus();
    });
    q('edit')?.addEventListener('click', () => fields[2].focus());

    if (!hasKey()) {
      root.dataset.offline = 'true';
      if (availability) availability.hidden = false;
      void animate('unavailable');
    }
    updateFallback();
    root.querySelectorAll('[data-co="copy"]').forEach(button => {
      const said = button.querySelector('[data-co="copied"]');
      let timer;
      button.hidden = false;
      button.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(EMAIL); }
        catch { return; }
        button.dataset.done = 'true';
        said.textContent = 'Copied';
        clearTimeout(timer);
        timer = setTimeout(() => { delete button.dataset.done; said.textContent = 'Copy'; }, 2400);
      });
    });
  };
})();

// The language switch for the whole site. English is the source: the HTML and every script write English, and this
// file translates the page in place. i18n/ro.js, i18n/de.js and i18n/fr.js each map English text to its translation.
// Text a script writes later is caught by a MutationObserver and translated before it is painted, so no variant
// script needs to know about languages, and any page assemble.ts builds works as long as it loads these files.
//
// What one entry translates:
//   - a text node, keyed by its text with the spaces collapsed;
//   - a sentence with inline markup in it, keyed by its text with the child elements numbered:
//     "Graduate from <1>Politehnica Timișoara</1>, since 2026". The translation may move the numbered parts, so
//     word order can change; the elements themselves stay, with their attributes and listeners. <2/> stands for a
//     child with no text of its own (an icon) or with markup inside it, which is translated on its own;
//   - the attributes aria-label, alt, title and placeholder, and the page's description meta tags.
// A key may hold {0}, {1}... for what a script fills in (a count, a name). The value fills the same slots; it can
// also be an object of plural forms ({ one, few, other }), picked with Intl.PluralRules by the first number.
//
// Text inside translate="no" is left alone. Any [data-set-lang] button switches the language; the choice is kept in
// localStorage, English by default. Nothing reloads, so one-time animations do not play again.
(() => {
  const LANGS = ['en', 'ro', 'de', 'fr'];
  const STORE = 'lang';
  const ATTRS = ['aria-label', 'alt', 'title', 'placeholder'];
  const META = 'meta[name="description"], meta[property="og:title"], meta[property="og:description"]';
  const SKIP = 'script, style, noscript, template, [translate="no"]';
  const letter = /\p{L}/u, decimal = /^\d+\.\d+$/;
  // Only ASCII white space is collapsed: French no-break spaces (before : and in 1 054) are part of the text.
  const norm = s => s.replace(/[ \t\n\r\f]+/g, ' ').replace(/^ | $/g, '');
  const tables = window.I18N_STRINGS || {};

  // Per language: exact entries, the {n} patterns as regular expressions, and translation -> English.
  const books = {};
  const book = l => books[l] ??= compile(tables[l] || {}, l);
  function compile(table, l) {
    const exact = new Map(), patterns = [], reverse = new Map();
    for (const [k, v] of Object.entries(table)) {
      if (!/\{\d\}/.test(k)) { exact.set(k, v); if (typeof v === 'string') reverse.set(v, k); continue; }
      // A slot used twice ("{0} miss, {0} star") must match the same text twice.
      const group = [];
      let src = '', g = 0;
      for (const part of k.split(/(\{\d\})/)) {
        const m = /^\{(\d)\}$/.exec(part);
        if (!m) src += part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        else if (group[m[1]]) src += `\\${group[m[1]]}`;
        else { group[m[1]] = ++g; src += '(.+?)'; }
      }
      patterns.push({ re: new RegExp(`^${src}$`), group, v, fixed: k.replace(/\{\d\}/g, '').length });
    }
    // The most specific pattern first: "{0} hour {1} minutes" before "{0} minutes".
    patterns.sort((a, b) => b.fixed - a.fixed);
    return { exact, patterns, reverse, plural: new Intl.PluralRules(l) };
  }

  let lang = 'en';
  /** English text with no translation in the current language, for the checks. */
  const missing = new Set();

  // A value with its slots filled. Slot text is translated when it is a known phrase (a name stays as it is).
  function fill(v, args, b) {
    if (typeof v === 'object') {
      const n = args.find(a => /^\d+$/.test(a));
      v = v[b.plural.select(Number(n ?? 1))] ?? v.other;
    }
    return v.replace(/\{(\d)\}/g, (_, i) => { const a = args[i] ?? ''; return lookup(a) ?? (decimal.test(a) ? a.replace('.', ',') : a); });
  }

  /** `src` (English) in the current language, or undefined when the table has no entry for it. */
  function lookup(src) {
    const b = book(lang);
    const hit = b.exact.get(src);
    if (hit !== undefined) return typeof hit === 'string' ? hit : fill(hit, [], b);
    for (const p of b.patterns) {
      const m = p.re.exec(src);
      if (m) return fill(p.v, p.group.map(g => m[g]), b);
    }
  }

  /** `src` (English) in the current language. Text with no letters stays, except decimals, which take a comma. */
  function tr(src) {
    if (lang === 'en') return src;
    if (decimal.test(src)) return src.replace('.', ',');
    if (!letter.test(src)) return src;
    const out = lookup(src);
    if (out !== undefined) return out;
    missing.add(src);
    return src;
  }

  /** The English behind text now on the page: what it was translated from if it is still what was written,
      otherwise the text itself if it is English, otherwise the English of whichever translation it is. */
  function source(rec, cur) {
    if (rec && rec.out === cur) return rec.src;
    if (LANGS.some(l => book(l).exact.has(cur))) return cur;
    for (const l of LANGS) { const en = book(l).reverse.get(cur); if (en !== undefined) return en; }
    if (rec && decimal.test(rec.src) && cur === rec.src.replace('.', ',')) return rec.src;
    return cur;
  }

  const done = new WeakMap();        // text node or sentence element -> { src, out, lang }
  const attrs = new WeakMap();       // element -> { [attribute]: { src, out, lang } }
  const units = new WeakSet();       // elements translated as one sentence

  function leaf(node) {
    const raw = node.data, cur = norm(raw);
    if (!cur) return;
    const rec = done.get(node);
    if (rec && rec.out === cur && rec.lang === lang) return;
    const src = source(rec, cur), out = tr(src);
    done.set(node, { src, out, lang });
    if (out !== cur) node.data = raw.match(/^[ \t\n\r\f]*/)[0] + out + raw.match(/[ \t\n\r\f]*$/)[0];
  }

  function attr(el, name) {
    const cur = norm(el.getAttribute(name) ?? '');
    if (!cur) return;
    const recs = attrs.get(el) ?? {}, rec = recs[name];
    if (rec && rec.out === cur && rec.lang === lang) return;
    const src = source(rec, cur), out = tr(src);
    recs[name] = { src, out, lang };
    attrs.set(el, recs);
    if (out !== cur) el.setAttribute(name, out);
  }

  // Sentences. A child is "simple" when it holds only text: it is written into the key with that text.
  const simple = el => !el.childElementCount && !!el.textContent.trim() && !el.matches(SKIP);
  function isUnit(el) {
    let text = false, kid = false;
    for (const n of el.childNodes) {
      if (n.nodeType === 3) text ||= !!n.data.trim();
      else if (n.nodeType === 1) kid ||= simple(n);
    }
    return text && kid;
  }
  function key(el) {
    const kids = [...el.children];
    let s = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) s += n.data;
      else if (n.nodeType === 1) { const i = kids.indexOf(n) + 1; s += simple(n) ? `<${i}>${n.textContent.replace(/[ \t\n\r\f]+/g, ' ')}</${i}>` : `<${i}/>`; }
    }
    return { cur: norm(s), kids };
  }
  function unit(el) {
    units.add(el);
    const { cur, kids } = key(el), rec = done.get(el);
    if (rec && rec.out === cur && rec.lang === lang) return;
    const src = source(rec, cur), out = tr(src);
    done.set(el, { src, out, lang });
    if (out === cur) return;
    // Rebuild: the translation's text between the original child elements, in the translation's order.
    const first = el.firstChild, last = el.lastChild;
    const lead = first?.nodeType === 3 ? first.data.match(/^[ \t\n\r\f]*/)[0] : '', tail = last?.nodeType === 3 ? last.data.match(/[ \t\n\r\f]*$/)[0] : '';
    const parts = [];
    let at = 0;
    for (const m of out.matchAll(/<(\d+)>([\s\S]*?)<\/\1>|<(\d+)\/>/g)) {
      if (m.index > at) parts.push(out.slice(at, m.index));
      const k = kids[Number(m[1] ?? m[3]) - 1];
      if (k) { if (m[1] && k.textContent !== m[2]) k.textContent = m[2]; parts.push(k); }
      at = m.index + m[0].length;
    }
    if (at < out.length) parts.push(out.slice(at));
    if (lead) parts.unshift(lead);
    if (tail) parts.push(tail);
    [...el.childNodes].forEach(n => { if (n.nodeType === 3) n.remove(); });
    const order = parts.filter(p => typeof p !== 'string');
    // Same order: only the text moves, so no element is detached (focus, animations and media keep running).
    if (order.length === kids.length && order.every((k, i) => k === kids[i])) {
      let i = 0;
      for (const p of parts) typeof p === 'string' ? el.insertBefore(document.createTextNode(p), order[i] ?? null) : i++;
    } else el.append(...parts);
    done.set(el, { src, out: key(el).cur, lang });
  }

  function visit(el) {
    if (el.matches(SKIP)) return;
    for (const a of ATTRS) if (el.hasAttribute(a)) attr(el, a);
    if (el.matches(META)) attr(el, 'content');
    if (el.matches('textarea, input, select')) return;
    if (isUnit(el)) {
      unit(el);
      for (const k of el.children) if (!simple(k)) visit(k);
      return;
    }
    units.delete(el);
    for (const n of el.childNodes) n.nodeType === 3 ? leaf(n) : n.nodeType === 1 && visit(n);
  }

  // Text that scripts write. Our own writes are dropped with takeRecords().
  const mo = new MutationObserver(records => {
    for (const r of records) {
      const el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      if (!el || !el.isConnected || el.closest(SKIP)) continue;
      if (r.type === 'attributes') { if (ATTRS.includes(r.attributeName)) attr(el, r.attributeName); continue; }
      const p = el.parentElement;
      visit(p && units.has(p) ? p : el);
    }
    mo.takeRecords();
  });

  function set(next, save = true) {
    lang = LANGS.includes(next) ? next : 'en';
    missing.clear();
    document.documentElement.lang = lang;
    if (save) try { localStorage.setItem(STORE, lang); } catch {}
    visit(document.documentElement);
    document.querySelectorAll('[data-set-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)));
    mo.takeRecords();
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang } }));
  }

  let stored = 'en';
  try { stored = localStorage.getItem(STORE) || 'en'; } catch {}
  set(stored, false);
  mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-set-lang]');
    if (b && b.dataset.setLang !== lang) set(b.dataset.setLang);
  });

  window.I18N = { set, get lang() { return lang; }, missing, tr };
})();

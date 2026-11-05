// Checks the site as GitHub Pages will serve it, through dev/serve.ts. Run from dev/: bun install, then bun run check
//   Files     the published root holds nothing private (archives, PDFs, design files, sources, generators) and no
//             mockup names; prints the published size. dev/ is tooling and is skipped.
//   Pages     at 360 to 2560 px: no console errors or CSP violations, no failed requests, 0px horizontal overflow
//             at every step while scrolling the whole page, every image (popups included) and the font loaded.
//   Links     every internal link and #hash resolves, every external link opens a new tab with rel="noopener".
//   Objects   driven with a real mouse: popups open and close, the path pins and pans, Barb's inbox scan, Eclipse's
//             notch player, Sotto's pill, the About moon (also a tap on a phone), and the page under reduced motion.
//   Contact   with the key empty, fields stay editable and an email fallback preserves the draft; with Web3Forms mocked,
//             bad input is stopped in the browser, a good message is posted, and a failed request shows the
//             email address.
import puppeteer, { type HTTPRequest, type Page } from 'puppeteer-core';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { serve } from './serve';

const root = join(import.meta.dir, '..');
const chrome = process.env.CHROME ?? '/Users/polo/.t3/tools/chrome-headless-shell/mac-arm64/156.0.8078.70/chrome-headless-shell';
const widths = [360, 390, 768, 1024, 1280, 1440, 1920, 2560];
const pages = ['/', '/barb/', '/eclipse/', '/sotto/', '/homelab/', '/no-such-page'];

let fails = 0;
const ok = (cond: boolean, msg: string) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) fails++; };
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---------- Files ----------
const files = (function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter(e => !['.git', 'dev', 'node_modules'].includes(e.name))
    .flatMap(e => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
})(root);
const bytes = files.reduce((n, f) => n + statSync(f).size, 0);
const banned = files.map(f => relative(root, f)).filter(f => /\.(zip|pdf|ai|eps|ts|psd|sketch|fig|env)$|SOURCE|\.DS_Store|(^|\/)(p\d|x\d|a\d|h\d)-|assets-|check|gen\b|\.dev\.vars/i.test(f));
ok(!banned.length, `published root: ${files.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB, nothing private${banned.length ? ': ' + banned.join(' ') : ''}`);
// Mockup names: the variant prefixes in lower case (path data is skipped, it is full of things like a1.5), or any
// mention of the mockup folders.
const named = files.filter(f => /\.(html|css|js|txt|xml)$/.test(f)).filter(f => {
  const t = readFileSync(f, 'utf8').replace(/ (d|points|viewBox|transform)="[^"]*"/g, '');
  return /(?:[."']|class=")(?:p9|x3|a1)-/.test(t) || /mockup|assets-[pxa]|check-[ax]/i.test(t);
});
ok(!named.length, `no mockup names in HTML, CSS or JS${named.length ? ': ' + named.map(f => relative(root, f)).join(' ') : ''}`);

// ---------- Browser ----------
const server = serve(0);
const base = `http://localhost:${server.port}`;
const browser = await puppeteer.launch({ executablePath: chrome, args: ['--hide-scrollbars'] });

/** Opens a page and collects console errors, CSP violations, failed requests and error responses. */
async function open(path: string, width: number, opts: { reduce?: boolean; touch?: boolean; intercept?: (r: HTTPRequest) => void } = {}) {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error' && !(path === '/no-such-page' && m.text().includes('404'))) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('requestfailed', r => errors.push(`request failed ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', r => { if (r.status() >= 400 && r.url() !== base + path) errors.push(`${r.status()} ${r.url()}`); });
  if (opts.intercept) { await page.setRequestInterception(true); page.on('request', opts.intercept); }
  await page.evaluateOnNewDocument(() => document.addEventListener('securitypolicyviolation', e => console.error(`CSP ${e.violatedDirective} ${e.blockedURI}`)));
  if (opts.reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport({ width, height: width < 700 ? 800 : 900, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  await page.goto(base + path, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}
// Scrolls the whole page, so lazy images load, reveals fire and the pinned path pans end to end. Returns the widest
// horizontal overflow seen at any step, in px. The page-level clip (body { overflow-x: clip }) is lifted for each
// measurement, so overflow it would only hide (the path's 40px burst margin, for one) still counts.
const scrollAll = (page: Page) => page.evaluate(async () => {
  const d = document.documentElement, b = document.body;
  let extra = 0;
  for (let y = 0; y < d.scrollHeight; y += 150) {
    scrollTo({ top: y, behavior: 'instant' });
    await new Promise(r => setTimeout(r, 30));
    d.style.overflowX = b.style.overflowX = 'visible';
    extra = Math.max(extra, d.scrollWidth - innerWidth);
    d.style.overflowX = b.style.overflowX = '';
  }
  return extra;
});
const center = async (page: Page, sel: string) => { const b = (await (await page.$(sel))!.boundingBox())!; return [b.x + b.width / 2, b.y + b.height / 2] as const; };

// ---------- Pages at every width ----------
for (const path of pages) {
  const bad: string[] = [];
  for (const w of widths) {
    const { page, errors } = await open(path, w);
    const extra = await scrollAll(page);
    await wait(700);
    // Images in closed popups stay lazy until opened; switch them to eager so they load and can be checked too.
    await page.evaluate(() => document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; }));
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 15000 }).catch(() => null);
    const r = await page.evaluate(() => ({
      broken: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.getAttribute('src')),
      font: [...document.fonts].some(f => f.family.includes('Plex') && f.status === 'loaded'),
    }));
    if (extra !== 0) bad.push(`${w}: ${extra}px horizontal overflow`);
    if (r.broken.length) bad.push(`${w}: images ${r.broken.join(' ')}`);
    if (!r.font) bad.push(`${w}: Plex Sans not loaded`);
    if (errors.length) bad.push(`${w}: ${[...new Set(errors)].join(' | ')}`);
    await page.close();
  }
  ok(!bad.length, `${path} at ${widths.join(', ')}: no errors, 0px overflow, images and font loaded${bad.length ? '\n     ' + bad.join('\n     ') : ''}`);
}

// ---------- Links ----------
{
  const idsOn = new Map<string, Set<string>>();
  const ids = async (path: string) => {
    if (!idsOn.has(path)) idsOn.set(path, new Set([...(await (await fetch(base + path)).text()).matchAll(/\sid="([^"]+)"/g)].map(m => m[1])));
    return idsOn.get(path)!;
  };
  const broken: string[] = [], extBad: string[] = [];
  let count = 0;
  for (const path of pages) {
    const { page } = await open(path, 1440);
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => ({ href: a.getAttribute('href')!, target: a.getAttribute('target'), rel: a.getAttribute('rel') ?? '' })));
    await page.close();
    for (const l of links) {
      count++;
      if (l.href.startsWith('mailto:')) continue;
      if (/^https?:/.test(l.href)) { if (l.target !== '_blank' || !l.rel.includes('noopener')) extBad.push(`${path} ${l.href}`); continue; }
      const url = new URL(l.href, base + path);
      const res = await fetch(url.origin + url.pathname);
      if (!res.ok) { broken.push(`${path} -> ${l.href} (${res.status})`); continue; }
      if (url.hash && !(await ids(new URL(res.url).pathname)).has(url.hash.slice(1))) broken.push(`${path} -> ${l.href} (no #${url.hash.slice(1)})`);
      if (l.href.endsWith('.html')) broken.push(`${path} -> ${l.href} (.html link)`);
    }
  }
  ok(!broken.length, `${count} links on ${pages.length} pages: every internal link and #hash resolves${broken.length ? ': ' + broken.join(', ') : ''}`);
  ok(!extBad.length, `external links open a new tab with noopener${extBad.length ? ': ' + extBad.join(', ') : ''}`);
}

// ---------- Objects, with a real mouse ----------
{
  const { page, errors } = await open('/', 1440);

  await page.mouse.click(...await center(page, '.badge-copy'));
  await wait(150);
  const badge = await page.evaluate(() => ({
    width: document.querySelector('.badge-badge')!.getBoundingClientRect().width,
    copied: document.querySelector('.badge-fields li')!.getAttribute('data-state'),
    domain: document.querySelector('.badge-code span')!.textContent,
  }));
  ok(badge.width > 360 && ['copied', 'selected'].includes(badge.copied ?? '') && badge.domain === 'andreistolojan.me', `badge: approved size, copy response and .me domain (${JSON.stringify(badge)})`);
  await page.click('.bar [data-set-lang="ro"]');
  const ro = await page.evaluate(() => document.documentElement.lang);
  await page.click('.bar [data-set-lang="en"]');
  ok(ro === 'ro' && await page.evaluate(() => document.documentElement.lang) === 'en', 'language switch: Romanian and back to English');

  // Popups: a link opens its popup and puts its id in the URL; the close button and Esc close it.
  await page.evaluate(() => document.querySelector('#certs')!.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await wait(1200);
  await page.mouse.click(...await center(page, '.certs-tape[data-i="1"]'));
  await wait(500);
  await page.mouse.click(...await center(page, '#certs-v1 a[href="#cert-linux"]'));
  await wait(600);
  const opened = await page.evaluate(() => (document.getElementById('cert-linux') as HTMLDialogElement).open && location.hash === '#cert-linux');
  await page.mouse.click(...await center(page, '#cert-linux [data-close]'));
  await wait(800);
  const closed = await page.evaluate(() => !(document.getElementById('cert-linux') as HTMLDialogElement).open && location.hash === '');
  await page.mouse.click(...await center(page, '.certs-tape[data-i="0"]'));
  await wait(500);
  await page.mouse.click(...await center(page, '#certs-v0 a[href="#cert-savnet"]'));
  await wait(600);
  await page.keyboard.press('Escape');
  await wait(800);
  const escaped = await page.evaluate(() => !(document.getElementById('cert-savnet') as HTMLDialogElement).open);
  ok(opened && closed && escaped, `popups: open with the hash (${opened}), close button (${closed}), Esc (${escaped})`);

  // Path: pins under the bar and pans the track as the page scrolls.
  await page.evaluate(() => scrollTo({ top: document.querySelector('#path')!.getBoundingClientRect().top + scrollY, behavior: 'instant' }));
  await wait(400);
  const tx0 = await page.evaluate(() => getComputedStyle(document.querySelector('.jr-hz')!).getPropertyValue('--tx'));
  await page.mouse.move(700, 500);
  await page.mouse.wheel({ deltaY: 900 });
  await wait(700);
  const path = await page.evaluate(() => ({ pin: document.querySelector('.jr')!.classList.contains('pin'), tx: getComputedStyle(document.querySelector('.jr-hz')!).getPropertyValue('--tx') }));
  ok(path.pin && path.tx !== tx0, `path pins (${path.pin}) and pans (--tx ${tx0} -> ${path.tx})`);

  // Barb: a click on a message scans it.
  await page.evaluate(() => document.querySelector('.bx')!.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await wait(400);
  const scores: string[] = [];
  for (const i of [0, 2]) {
    await page.mouse.click(...await center(page, `.bx-msg[data-i="${i}"]`));
    await wait(1400);
    scores.push(await page.evaluate(() => `${document.querySelector('.sc .n')!.textContent} ${(document.querySelector('.bx') as HTMLElement).dataset.v}`));
  }
  ok(scores.join() === '83 phish,6 safe', `Barb inbox: clicks give ${scores.join(', ')}`);

  // Eclipse: hover opens the notch, next and previous change the track, leaving closes it.
  await page.evaluate(() => document.querySelector('.nt')!.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await wait(400);
  await page.mouse.move(...await center(page, '.nt'));
  await wait(900);
  const title = () => page.evaluate(() => document.querySelector('.nt .tt')!.textContent);
  const notchOpen = await page.evaluate(() => document.querySelector('.nt')!.classList.contains('open'));
  const t0 = await title();
  await page.mouse.click(...await center(page, '.nt .next')); await wait(900);
  const t1 = await title();
  await page.mouse.click(...await center(page, '.nt .prev')); await wait(900);
  const t2 = await title();
  await page.mouse.move(5, 5); await wait(800);
  const notchClosed = await page.evaluate(() => !document.querySelector('.nt')!.classList.contains('open'));
  ok(notchOpen && t1 !== t0 && t2 === t0 && notchClosed, `Eclipse notch: opens on hover (${notchOpen}), next "${t1}", previous "${t2}", closes on leave (${notchClosed})`);

  // Sotto: the pill's bars move while the stage is on screen.
  await page.evaluate(() => document.querySelector('.prj-sotto')!.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await wait(500);
  const pill = await page.evaluate(() => getComputedStyle(document.querySelector('.prj-sotto .pill i')!).animationPlayState);
  ok(pill === 'running', `Sotto pill animates on screen (${pill})`);

  // About: the first shot fires when the sky is seen, a click on the moon fires the next.
  await page.evaluate(() => document.querySelector('.abt-sky')!.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await wait(2400);
  await page.mouse.click(...await center(page, '.abt-aim'));
  await wait(1600);
  const moon = await page.evaluate(() => document.querySelector('.abt-n')!.textContent);
  ok(moon === '2 misses, 2 stars', `About moon: a click sends a shot (${moon})`);
  ok(!errors.length, `no errors while driving the page${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await page.close();

  const t = await open('/', 390, { touch: true });
  await t.page.evaluate(() => document.querySelector('.abt-sky')!.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await wait(2400);
  await t.page.touchscreen.tap(...await center(t.page, '.abt-aim'));
  await wait(1600);
  const tapped = await t.page.evaluate(() => document.querySelector('.abt-n')!.textContent);
  ok(tapped === '2 misses, 2 stars', `About moon: a tap on a phone sends a shot (${tapped})`);
  await t.page.close();
}

// ---------- Reduced motion ----------
{
  const { page, errors } = await open('/', 1440, { reduce: true });
  await wait(300);
  const s = await page.evaluate(() => ({ moon: document.querySelector('.abt-n')!.textContent, pinned: document.querySelector('.jr')!.classList.contains('pin'), reveal: getComputedStyle(document.querySelector('#certs .r')!).opacity }));
  await page.evaluate(() => (document.querySelector('.abt-aim') as HTMLElement).click());
  await page.evaluate(() => (document.querySelector('.bx-msg') as HTMLElement).click());
  await wait(150);
  const after = await page.evaluate(() => ({ moon: document.querySelector('.abt-n')!.textContent, score: document.querySelector('.sc .n')!.textContent, running: document.getAnimations().filter(a => a.playState === 'running').length }));
  ok(s.moon === '1 miss, 1 star' && !s.pinned && s.reveal === '1' && after.moon === '2 misses, 2 stars' && after.score === '83' && after.running === 0 && !errors.length,
    `reduced motion: final from the start (${s.moon}, pinned ${s.pinned}, reveal opacity ${s.reveal}), clicks still work (${after.moon}, score ${after.score}), ${after.running} running animations${errors.length ? ' errors: ' + errors.join(' | ') : ''}`);
  await page.close();
}

// ---------- Contact ----------
{
  // Without a key, visitors can write a draft and move it to their email application.
  const { page, errors } = await open('/', 1440);
  const s = await page.evaluate(() => {
    const status = document.querySelector<HTMLElement>('.contact-availability')!;
    const box = status.getBoundingClientRect();
    return {
      text: status.textContent!.trim(), address: document.querySelector('.contact-mail')!.textContent!,
      disabled: document.querySelector<HTMLButtonElement>('.contact-send')!.disabled,
      editable: [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('.contact-form [name="name"], .contact-form [name="email"], .contact-form [name="message"]')].every(field => !field.disabled),
      visible: !status.hidden && getComputedStyle(status).clipPath === 'none' && box.width > 10 && box.height > 10,
      ports: document.querySelectorAll('.contact-port').length,
      error: document.querySelector('[data-port="message"]')!.classList.contains('contact-error'),
    };
  });
  ok(!s.disabled && s.editable && s.visible && s.ports === 5 && s.error && s.address.includes('andreistolojan@gmail.com') && s.text.includes('unavailable') && !errors.length,
    `contact, no key: editable draft, five ports and visible unavailability (${JSON.stringify(s)})`);
  await page.type('#contact-name', 'Preview Check');
  await page.type('#contact-email', 'preview@example.com');
  await page.type('#contact-message', 'A local draft that must remain available.');
  await page.click('.contact-send');
  const draft = await page.evaluate(() => ({
    failureVisible: !(document.querySelector('.contact-fail') as HTMLElement).hidden,
    value: (document.querySelector('#contact-message') as HTMLTextAreaElement).value,
    fallback: (document.querySelector('[data-co="mailto"]') as HTMLAnchorElement).href,
  }));
  ok(draft.failureVisible && draft.value === 'A local draft that must remain available.' && decodeURIComponent(draft.fallback).includes(draft.value),
    'contact, no key: submission reports failure, preserves the draft and updates the email fallback');
  await page.close();

  // With a test key, and Web3Forms answered by this script.
  const posted: Record<string, string>[] = [];
  let answer = 200;
  const intercept = (r: HTTPRequest) => {
    if (r.url() === `${base}/`) {
      const html = readFileSync(join(root, 'index.html'), 'utf8').replace('name="access_key" value=""', 'name="access_key" value="test-key"');
      return r.respond({ status: 200, contentType: 'text/html', body: html });
    }
    if (r.url() === 'https://api.web3forms.com/submit') {
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, accept', 'Access-Control-Allow-Methods': 'POST' };
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: cors });
      posted.push(JSON.parse(r.postData() ?? '{}'));
      return r.respond({ status: answer, contentType: 'application/json', headers: cors, body: JSON.stringify({ success: answer === 200, message: 'mock' }) });
    }
    return r.continue();
  };
  const c = await open('/', 1440, { intercept });
  const p = c.page;
  await p.evaluate(() => document.querySelector('#contact')!.scrollIntoView({ behavior: 'instant' }));
  await wait(800);
  await p.type('input[name="email"]', 'nope');
  await p.click('.contact-form button[type="submit"]');
  const flagged = await p.evaluate(() => document.querySelectorAll('.contact-form [aria-invalid="true"]').length);
  ok(flagged === 3 && posted.length === 0, `contact: empty name, bad email and short message are stopped in the browser (${flagged} flagged, ${posted.length} sent)`);

  await p.evaluate(() => { (document.querySelector('input[name="email"]') as HTMLInputElement).value = ''; });
  await p.type('input[name="name"]', 'Check Script');
  await p.type('input[name="email"]', 'check@example.com');
  await p.type('textarea[name="message"]', 'A message from the site check script.');
  answer = 500;
  await p.click('.contact-form button[type="submit"]');
  await p.waitForFunction(() => !(document.querySelector('.contact-fail') as HTMLElement).hidden);
  const failed = await p.evaluate(() => ({ hidden: (document.querySelector('.contact-fail') as HTMLElement).hidden, text: document.querySelector('.contact-fail')!.textContent!.trim() }));
  ok(!failed.hidden && failed.text.includes('The form is not working right now.') && failed.text.includes('andreistolojan@gmail.com'), `contact: a failed request shows "${failed.text}"`);

  answer = 200;
  await p.click('.contact-form button[type="submit"]');
  await p.waitForFunction(() => !(document.querySelector('.contact-done') as HTMLElement).hidden);
  const done = await p.evaluate(() => !(document.querySelector('.contact-done') as HTMLElement).hidden);
  const last = posted.at(-1) ?? {};
  ok(done && posted.length === 2 && last.access_key === 'test-key' && last.email === 'check@example.com' && last.name === 'Check Script' && !('botcheck' in last),
    `contact: a good message is posted to Web3Forms with the key and fields, honeypot unticked (done ${done}, ${JSON.stringify(last)})`);
  // The 500 is the failure answered on purpose above.
  const unexpected = c.errors.filter(e => !e.includes('500'));
  ok(!unexpected.length, `contact: no errors besides the deliberate 500${unexpected.length ? ': ' + unexpected.join(' | ') : ''}`);
  await p.close();
}

console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
await browser.close();
server.stop(true);
process.exit(fails ? 1 : 0);

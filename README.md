# andreistolojan.me

Andrei Stolojan's personal site. Plain HTML, CSS and JavaScript with no build step. GitHub Pages publishes this
repository's root from the `main` branch.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Home page: hero, About me, Projects, My path, Certifications, Passions, Contact, and the popups |
| `barb/`, `eclipse/`, `sotto/`, `homelab/` | Project pages, served at `/barb/` and so on |
| `404.html` | The page GitHub Pages shows for a missing path |
| `css/`, `js/` | One stylesheet and one script per section; `site.*` is shared by every page |
| `assets/`, `fonts/` | Images and the IBM Plex Sans font |
| `CNAME` | The custom domain. GitHub Pages reads it, so leave it as is |
| `.nojekyll` | Tells GitHub Pages to publish the files as they are, without Jekyll |
| `dev/` | Local server, site check, credits. Pages publishes it too, so nothing secret goes in here |

## Run it locally

You need [Bun](https://bun.sh).

```
cd dev
bun install
bun run serve        # http://localhost:8000
```

`dev/serve.ts` behaves like GitHub Pages: `/barb` redirects to `/barb/`, and a missing path gets `404.html`.

The site check opens every page in headless Chrome at widths from 360 to 2560 px. It checks console errors, CSP
violations, overflow, images, fonts and links. It also drives the interactive parts with a real mouse and tests
the contact form against a mocked Web3Forms:

```
bun run check        # set CHROME=/path/to/chrome if it is not at the default path
bun run typecheck
```

## Go live

Live configuration verified on 5 November 2026: GitHub Pages publishes `main` at `/`, the custom domain is
`andreistolojan.me`, its apex A records point at GitHub, and GitHub has approved the TLS certificate.

1. **Verify the domain** (recommended by GitHub, guards against takeover): GitHub, Settings (your account), Pages,
   Add a domain, `andreistolojan.me`. Add the TXT record it shows at the registrar and wait until GitHub marks the
   domain as verified.
2. **DNS at the registrar.** Remove any parking records for the apex and `www`, then add:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | AAAA | `@` | `2606:50c0:8000::153` |
   | AAAA | `@` | `2606:50c0:8001::153` |
   | AAAA | `@` | `2606:50c0:8002::153` |
   | AAAA | `@` | `2606:50c0:8003::153` |
   | CNAME | `www` | `andreistolojan.github.io` |

   Do not add a wildcard (`*`) record. Check with `dig andreistolojan.me +short` and
   `dig www.andreistolojan.me +short`. Propagation can take up to 24 hours.
3. **HTTPS.** Repository Settings, Pages: once the DNS check passes, GitHub issues a certificate (this can also
   take up to 24 hours). Then tick **Enforce HTTPS**.
4. **Contact form key.** See [Contact form](#contact-form).
5. **Publish.** Merge the approved changes into `main` and push. Pages deploys in a minute or two.

The sources above are GitHub's
[custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

## Contact form

[Web3Forms](https://web3forms.com) delivers the form, because GitHub Pages cannot run server code. The free plan
needs no account. The access key is public by design: it routes submissions to the address it was created for.

1. On web3forms.com, enter `andreistolojan@gmail.com` and create an access key. It arrives by email.
2. Paste it into the one place it lives, the hidden input in `index.html`:
   `<input type="hidden" name="access_key" value="">`.
3. Send yourself a test message from the live site.

With the value empty, the form shows "The form is offline right now" and the email address, and the Send button
is disabled. If a send fails, the form says so and shows the email address.

Spam protection: Web3Forms runs its own spam check on every message, and the hidden `botcheck` checkbox catches
bots that tick every box. Add hCaptcha from the Web3Forms docs if spam gets through. That also means adding
hCaptcha's domains to the CSP.

## Security headers

GitHub Pages cannot set response headers, so each page carries its policy in `<meta>` tags:

- `Content-Security-Policy` allows only the site's own files, plus `https://api.web3forms.com` for the form
  (`connect-src` and `form-action`). There are no inline scripts. `style-src-attr 'unsafe-inline'` allows inline
  style *attributes* only, because the markup passes layout values as CSS custom properties (the path's
  `style="--x:4.2"`, the reveal delays). `<style>` elements and outside stylesheets stay blocked.
- `referrer` is `strict-origin-when-cross-origin`.

A meta tag cannot set these, and GitHub Pages does not send them:

- `frame-ancestors` (and `X-Frame-Options`), so another site can embed this one in a frame. Nothing on the site
  acts on a click with the visitor's credentials, so the risk is low.
- `Strict-Transport-Security`. **Enforce HTTPS** redirects HTTP to HTTPS, but browsers are not told to stick to it.
- `X-Content-Type-Options`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.

If the site ever needs them, put Cloudflare (free plan) in front of GitHub Pages and add them there.

When you edit the CSP, change it on all six pages: `index.html`, `404.html` and the four project pages.

## Change the domain

The domain appears in these places only:

- `CNAME`
- the `canonical`, `og:url` and `og:image` tags in `index.html`, `barb/`, `eclipse/`, `sotto/` and `homelab/`
- `sitemap.xml`, `robots.txt`, `.well-known/security.txt`
- `from_name` in the contact form in `index.html`

To find every one: `grep -rn "andreistolojan\.me" --exclude-dir=.git --exclude-dir=dev .`

## Home page design

The approved page combines the hanging contact badge, tape labels for certificates, the handball and chess
interactions, and the contact patch panel. The badge uses the satin PVC finish, an SVG metal clip and woven strap. The left headline uses the Atos wordmark
and the role Systems Engineer. The location, language-level and home-server facts row has been removed.
Its barcode and downloaded contact card both use `andreistolojan.me`.

Section styles and scripts live in matching files under `css/` and `js/`. The badge uses `hero.*`, the tape library
uses `certifications.*`, and the contact panel uses `contact.*` plus `contact-form.js` for validation and delivery.
The shared compact header uses `css/navigation.css`; the project detail layout uses `css/project-pages.css`.
The language buttons use `js/i18n.js` and the Romanian, German and French dictionaries in `js/i18n/`.

## Editing notes

- The path's positions (`--x`, `--a`, `--w` in `index.html`) come from one time scale: `KNOTS` in `js/path.js`.
  Keep the two in step when you add an entry.
- GitHub Pages serves every file with a 10 minute cache (`max-age=600`), and the repository cannot change that. A
  replaced image or stylesheet reaches returning visitors within 10 minutes.
- Logo sources and the font licence: `dev/CREDITS.md`, `fonts/OFL.txt`.

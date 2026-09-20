# Intelligent Worlds — website

A one-page site. Plain HTML, CSS and JavaScript: **no build step, no
dependencies, no server-side code.** Unzip the folder, put its contents at the
web root, done.

## Deploying it

Serve the folder as static files. That is the whole deployment.

- **Any static host** (S3 + CloudFront, Cloudflare Pages, Netlify, Vercel,
  GitHub Pages, Firebase Hosting): point it at this folder. There is no build
  command and no output directory — if the host asks, leave the build command
  empty and set the publish directory to this folder.
- **A normal web server** (nginx, Apache, IIS): copy the contents into the
  document root. `index.html` is the entry point.

To look at it locally without any host:

```
python3 -m http.server 8000     # then open http://localhost:8000
```

Opening `index.html` straight off disk works too — every path in the page is
relative — though a local server is closer to production.

## What is in here

```
index.html                  the page
README.md                   this file
assets/
  styles.css                layout and type
  field.js                  the moving point cloud behind the text
  fonts.css                 @font-face rules for the three brand faces
  fonts/*.woff2             the faces themselves, latin subset, 89 KB total
  intelligent-worlds.png    the wordmark
  favicon-16/32/180/512.png the tab icon: the company symbol, cut from the
                            wordmark, white on the brand dark
  og.jpg                    the image shown when the link is shared
reference/                  the design the page was built to — NOT part of the
                            site, safe to delete before deploying
```

About 460 KB in total, most of it the shared-link image and the wordmark.

**Nothing is fetched from a third party.** No Google Fonts, no CDN, no
analytics, no trackers, no cookies. The page makes requests only to its own
origin, so it works behind a firewall and needs no cookie banner.

## Things you may want to change

**The contact address.** It appears twice in `index.html`: once in the `href`
of the `mailto:` link and once as the visible text. Search for `info@intelligentworlds.ai`.

**Keeping it out of search.** The page is currently indexable. To hide it,
change the robots line near the top of `index.html` to:

```html
<meta name="robots" content="noindex, nofollow">
```

A `robots.txt` at the web root with `Disallow: /` is worth adding as well if
you take that route.

**The shared-link image.** `assets/og.jpg` is a still of the page. Some
platforms only honour an absolute URL, so once the domain is settled, change
the `og:image` tag in `index.html` to the full address.

**The words.** All of the copy is in `index.html`, in plain markup. There is no
template and no content file.

## The background

`assets/field.js` draws a point cloud on a `<canvas>`: a room seen from above,
with a lens that orbits it once every three minutes and a handful of tracked
figures walking inside it. It is generated in the browser from a fixed seed, so
it is the same picture for everyone, and it is decoration only — it carries no
data.

It is written to stay out of the way:

- one `requestAnimationFrame` loop, no library, about 14 KB of source;
- point count scales with the size of the window, so a phone does the same
  amount of work per pixel as a desktop display;
- frames stop entirely when the tab is in the background;
- it honours `prefers-reduced-motion` — a reader who has asked for less motion
  gets a single still frame instead of the orbit;
- if `<canvas>` or JavaScript is unavailable, a CSS gradient stands in and the
  page reads normally.

To take it out altogether, delete the `<canvas>` element and the `<script>` tag
at the bottom of `index.html`. The layout does not depend on it.

## Browser support

Current Chrome, Safari, Firefox and Edge, on desktop and mobile. Nothing on the
page needs a polyfill; the script is ES5 and guards on the features it uses.

## Hosting (Ludeo)

Served by **GitHub Pages** from `main` (`CNAME` = intelligentworlds.ai), DNS at
GoDaddy. `.github/workflows/deploy.yml` is the S3 + CloudFront deploy for the
later cutover (Terraform PR EdgeGamingGG/Terraform#764); it is manual-only
until then.

# Landing Page — Broken Nav, Failed Hand-off, Contrast, SEO — 2026-08-20

## Summary

Audit of the landing page found two functional breaks, a typeface that never
loaded, palette colors below WCAG AA, missing metadata, and ~780 KB of
needlessly large images. All fixed and verified in a browser.

## Fixed

### 1. Mobile navigation did not exist

The `Menu` button had no handler anywhere in `src` — the nav `<ul>` was
`hidden md:flex`, so on phones the site had no navigation at all. The
`.hamburger` / `.nav-links` / `.expanded` rules in `global.css` were orphaned
Astro-starter leftovers wired to nothing.

Added a real toggle in `Landing.astro`: `aria-expanded` and `aria-controls` on
the button, a `.site-nav` panel that drops below the header, and dismissal on
link tap and on Escape.

The panel uses a scoped CSS rule rather than Tailwind's `hidden`, because
`hidden` and `flex` set the same property and Tailwind's source order decides
the winner regardless of class order.

Verified: `display` none → flex on click, `aria-expanded` false → true, 5 links
visible, closes on link tap and Escape, desktop nav unaffected (`flex`).

### 2. A large photo silently killed the main CTA

`ImageUploadContainer` handed the photo to the analysis page through
`sessionStorage`. Measured quota in Chrome: **`QuotaExceededError` at 5 MB**.
A 12 MP phone photo base64-encodes well past that, and the throw happened
*before* `window.location.href`, so "Start Analysis" did nothing at all — no
navigation, no message.

Added `src/scripts/compressImage.ts`: downscales to 1600px on the long edge
(the segmenter runs at 256×256, so nothing downstream wants more) and retries
at 1024px then 640px if the browser still refuses. `startAnalysis` is now async,
shows a "Preparing…" state, and surfaces an error instead of failing silently.

Verified end-to-end with a 10 MB noise-filled 4032×3024 fixture: data URL
13.9 MB → stored 1.06 MB at 1600×1200, navigation succeeds, and the analysis
page picks the photo up.

### 3. The typeface never loaded

`body { font-family: "Space Grotesk" }` was set, but there was no `@font-face`,
no stylesheet link, and no `public/fonts` — `document.fonts.size` was 0, so the
whole site silently rendered in the system sans-serif. The `font-display` class
on the hero heading was also a no-op, since `--font-display` was not in `@theme`.

Added the Google Fonts link (with preconnect, `display=swap`) and `--font-sans`
/ `--font-display` tokens. Verified: weights 400/500/600/700 report `loaded`.

### 4. Contrast below WCAG AA

| Sample | Before | After |
| --- | --- | --- |
| body text on white | 3.54:1 | 5.47:1 |
| body text on sand | 2.93:1 | 4.52:1 |
| gold text on white | 2.26:1 | 5.47:1 |
| white on gold buttons | 2.26:1 | 5.47:1 |

- `--color-primary-mauve` darkened `#9D8189` → `#7E626A`. It is a text color in
  all but two places, so changing the token fixed ~38 usages at once.
- `--color-accent-gold` (`#D4A373`) kept for decoration — dividers, borders,
  quote marks — and a new `--color-accent-gold-deep` (`#915E2C`) introduced for
  gold that carries words or sits behind white content.
- Header nav hover deliberately keeps the *light* gold: on the plum header it
  scores 5.01:1, whereas the deep gold would drop to 2.07:1.
- Dropzone helper text raised from `gray-500`/`gray-400` to `gray-600`.

Re-audited the rendered page: no remaining failures. The one flagged item,
"GET STARTED", is a false positive — the button's background is a gradient, so
`backgroundColor` reads transparent; both gradient stops are dark and white text
scores 5.47:1 and 11.33:1 against them.

### 5. Metadata and structure

- `Layout.astro` takes `description` and `image`; added Open Graph, Twitter card,
  canonical, and a favicon that respects the `mycolortype` base path.
- `<meta name="description">` was the placeholder "Astro description"; the
  analysis and product pages were both titled "Welcome to Astro."
- Created `public/favicon.svg` — the referenced file did not exist and 404'd on
  every page.
- Two `<h1>` per page (logo + hero) → the logo is now a link. Feature and
  testimonial `<h4>` under an `<h2>` → `<h3>`.
- The shape divider is included twice and both copies used `id="gradient"`;
  now `divider-gradient-a` / `-b`.
- Footer year is computed rather than hardcoded to 2024.

### 6. Image weight

Mobile page load dropped from ~1.1 MB of images to **204 KB**.

| Asset | Before | After |
| --- | --- | --- |
| testimonial avatar (rendered 64px) | 697 KB @ 2000×2000 | 4.4 KB @ 128×128 |
| testimonial avatar (rendered 64px) | 65 KB @ 896×1152 | 3.5 KB @ 128×128 |
| feature icons ×3 (rendered 96px) | 96 KB @ 512×512 | 60 KB @ 192×192 |

Also added `width`/`height` (removing layout shift), `loading="lazy"` and
`decoding="async"` below the fold, and `fetchpriority="high"` on the hero.
Decorative images now carry `alt=""` instead of a description repeated to
screen readers.

## Astro compiler workaround

`Layout.astro` failed to build with `Unterminated string literal` pointing at a
blank line. Bisected it to a frontmatter block holding several slash-bearing
string literals — the TypeScript was valid, and each construct compiled fine in
isolation, but together the compiler mis-tokenized them.

The base-path helper therefore lives in `src/scripts/urls.ts` and is imported.
This is cleaner anyway, and `Landing.astro` uses it too.

## Verification

- `npm run lint` — 0 errors
- `npm run build` — 0 errors, 0 warnings
- `npm test` — 23 passed
- Browser: mobile menu, font loading, favicon, metadata, contrast, image weight,
  and the full upload → analysis hand-off with an oversized photo.

## Not addressed

- `blog/Post.astro` still uses `text-accent-gold` for body text at 2.26:1. The
  mauve token change already improved it, but the gold there needs the same
  decorative/deep split — deliberately left alone since the blog layout was not
  reviewed, and a blind swap could invert contrast on dark backgrounds as it
  nearly did in the header.
- The testimonials from "Alexa Davidson" and "Sarah Kim" appear to be
  placeholders. Raised with the user; not changed.

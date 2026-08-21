# Typeface Revert and UI Consistency Pass — 2026-08-20

Follow-up to [2026-08-20-landing-page-fixes.md](2026-08-20-landing-page-fixes.md).

## Typeface reverted to Helvetica

The earlier pass loaded Space Grotesk. Asked which font had been there before,
the answer was that no font had been *chosen* at all — Space Grotesk was
declared but never loaded, so every visitor fell through to their browser's
default sans-serif. Confirmed with CDP `CSS.getPlatformFontsForNode`:

| Declared stack | Actually rendered |
| --- | --- |
| `"Space Grotesk", sans-serif` (original) | Helvetica |
| `sans-serif` | Helvetica |
| `system-ui, sans-serif` | .SF NS |

The Helvetica that macOS visitors were seeing is the preferred look, so the
stack is now `Helvetica, "Helvetica Neue", Arial, sans-serif` on `--font-sans`
and `--font-display`, and the Google Fonts link is gone. Plain `Helvetica` leads
the stack deliberately: `"Helvetica Neue"` first resolved to Neue, which is not
what was there before.

No webfont is fetched at all now — `document.fonts.size` is 0 and no font host
is contacted.

## Font consistency across the UI

Audited every page by asking Chrome which platform font each element actually
rendered with, rather than trusting the declared stack. All text on all four
pages resolves to Helvetica, including buttons, nav, form controls, and the
React result components. The only intentional exceptions are `font-mono` on hex
codes and the ❤️ emoji in the footer.

Three characters were silently rendering in a *different* typeface, because they
do not exist in Helvetica and the browser substituted per-glyph:

- `✓` in the three hero badges → fell back to Lucida Grande
- `→` in "Read more in our blog" and "Discover my palette"

Both are now inline SVG (`.badge-icon`, `.cta-arrow`) that inherit `currentColor`
and scale with the text, so they render identically on every platform.

## Contrast, second pass

The first pass audited only text-ish tags and missed `<button>` entirely, and
its color parser mishandled Tailwind 4's `oklch()` and translucent
`color-mix()` backgrounds. Rebuilt the audit to normalise every color through a
canvas pixel (which handles any CSS color syntax) and to composite translucent
layers down to an opaque background. Real problems it then found:

- **`bg-accent-sage` buttons** — white text at **2.66:1**. This is the upload
  widget's primary CTA plus the purchase button. `--color-accent-sage` darkened
  `#87A878` → `#607F52` (4.51:1), with a new `--color-accent-sage-dark`
  (`#506944`, 6.10:1) for hover. Hover previously went to `accent-rose`, a pale
  tint where white text read at roughly 1.9:1 — a hover state should darken.
- **Step indicator** — active step used raw `text-yellow-600` (2.94:1, and off
  the brand palette) → `text-accent-gold-deep`; inactive steps `text-gray-300`
  → `text-gray-500`.
- **Dark analysis page** — `text-gray-500` labels sat at 4.16:1 on `gray-950`
  and 2.9:1 on `gray-800` → `text-gray-400`.
- **Blog** — the two `text-accent-gold` headings and the gold hover states use
  the deep variant now.

Landing and blog now audit clean.

## Labels drawn on analysed colors

`AnalysisResults`, `FaceColorResults` and `SeasonResults` picked label colors
with `0.299r + 0.587g + 0.114b > 120`, which is not a contrast measure. A
mid-tone such as rgb(171, 106, 124) sits just above that threshold, takes dark
text, and lands at 4.3:1 — and the muted second line, drawn at 50-70% opacity,
fell as low as **2.49:1**. `SeasonResults` was worse: "Your season" was white at
75% opacity on a light season color, at 3.29:1.

Added `src/scripts/textOn.ts`, which picks between near-black and white by
*measured* contrast and derives a muted secondary color that fades as far as it
can while still clearing 4.5:1. All four call sites now use it.

## Header: bar removed

The plum bar made the header read as a separate block. It is gone: the `<header>`
now lives *inside* the hero's gradient wrapper, so it shares that background
instead of sitting on one of its own, and the links are plain plum text with a
hover underline that wipes in. "Get Started" is a gold underlined text link
rather than a filled pill, so the header carries no solid shapes at all.

On mobile the "Menu" word is replaced by a hamburger — three bars that rotate
into an X while the panel is open, driven purely off `aria-expanded` so the icon
state and the assistive state cannot drift apart. The dropdown panel switched
from plum to white with hairline separators, matching the now-light header.

Note: `.menu-toggle` sets its own `display`, which beat Tailwind's `md:hidden`
and left the hamburger visible on desktop. Visibility is handled in the same
media query as `.site-nav` instead — the third time this display collision has
come up in this file.

Contrast after the change: plum on the sand gradient and gold-deep for the CTA
both clear AA, and the landing page still audits clean.

## Pre-publish cleanup

Blockers found while checking whether the site could go live on GitHub Pages.

**Every Pages deploy had been failing.** `status: null` on the Pages API and 5
of 5 workflow runs failed, going back to March. The cause: the workflow pins
`node-version: "20"`, and Astro 6's CLI hard-codes `const engines = ">=22.12.0"`
in `astro/bin/astro.mjs` — stricter than the `^20.19.1 || >=22.12.0` in its own
`package.json`, so Node 20 is refused regardless of the lockfile. Broke at the
March Astro 4 → 6 upgrade. Bumped to `node-version: "22"`.

**Two images were hotlinked from other sites.** The analysis page pulled its
sample portrait from `static.independent.co.uk` (a press photo, also sitting in
`src/tests/fixtures/blue-eyes-test.jpg`), and `AnalysisPreviewContainer` pulled a
thumbnail from `i.pinimg.com`. Both could vanish without warning and neither was
ours to publish.

- The sample portrait is now `public/pics/sample-portrait.jpg`, cropped from the
  project's own Freepik asset and framed tight on the face so the rainbow
  backdrop stops feeding the segmenter. Verified the analysis still runs on it
  (Soft Autumn, hair #9a6f51, face skin #c18e7e).
- The Pinterest thumbnail became a 3x3 tile built from the season's own primary
  colors. It was the same picture for every season and captioned "Spring"
  regardless, so it never described the result anyway.
- The sample image is same-origin now, so the `crossorigin` attribute and the
  two `removeAttribute("crossorigin")` calls that existed only to work around it
  are gone. The image also had no `alt` at all; it has one now.

Nothing external is fetched for presentation any more — the only remaining
third-party hosts are the ML model CDNs and the Lemon Squeezy checkout script.

**Testimonials are no longer rendered.** The two entries carry invented names,
job titles, star ratings and stock-photo avatars. `Comments.astro` is untouched
and the section can be restored in three edits (documented at the removal site);
the "Reviews" nav link came out with it so no anchor dangles.

Verified on the production build via `npm run preview`: no failed requests, no
dead anchors, all four pages render.

## Known residuals

Both are visual-design calls rather than defects, so they were left for a
decision:

1. **The recommended-palette panel is light-themed inside a dark page.**
   `AnalysisPreviewContainer` is built from `bg-gray-50` / `bg-white` /
   `text-gray-800` and sits directly below the dark analysis UI, producing a
   hard seam. Restyling it to the dark theme is a real design change, not a
   token swap.

2. **Mid-tone swatches can't reach AA with any pure text color.** For
   rgb(171, 106, 124), near-black gives 4.29:1 and white gives ~3.4:1 — there is
   no black-or-white choice that passes. Guaranteeing it needs a backing plate
   or chip behind the label, which changes how the swatches look.

## Verification

- `npm run lint` — 0 errors
- `npm run build` — 0 errors, 0 warnings
- `npm test` — 23 passed
- Platform-font audit across landing, analysis, blog and product pages
- Contrast audit across landing, blog, and the analysis page *after* running an
  analysis, so the dynamic result components are covered

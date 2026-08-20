# Analysis Page — Freeze and Result Noise — 2026-08-20

## Summary

The analysis page locked up for ~26 seconds after clicking the photo, showed two
result panels that could never fill, and rendered empty categories as black
swatches. All three are fixed.

## Measurements

Profiled with `PerformanceObserver({entryTypes: ['longtask']})` in a headed
Chromium (real GPU — headless software GL inflates MediaPipe times ~10x and is
not representative).

Per-stage cost of one click, before the change:

| Stage | Time |
| --- | --- |
| MediaPipe `segment` (warm) | 0.1–0.8 s |
| `analyzeImageCategories` | 0.4 s |
| `faceLandmarker.detect` (warm) | 0.06–0.24 s |
| `FaceColorAnalyzer` | 0.4 s |
| face-parsing (transformers.js) | **7.6–8.3 s** |

MediaPipe is only expensive on a cold start; face-parsing costs ~8 s on *every*
click. All of it ran on the main thread.

| Metric | Before | After |
| --- | --- | --- |
| Main thread blocked per analysis | 25 914 ms | 1 223 ms |
| Long tasks during page load | 129 + 85 + 70 ms | none |
| Worst observed UI stall | full freeze | 15 ms |

Production build (`npm run preview`) measured separately: 1 358 ms blocked,
18 ms worst stall.

## Changes Made

### Freeze — face parsing moved to a Web Worker

- **`src/scripts/faceParsing.worker.ts`** (new) — owns the `Xenova/face-parsing`
  pipeline and all the LAB/k-means color extraction. Receives the RGBA buffer
  (transferred) plus a JPEG data URL for the model input; returns skin, hair,
  lips and brow colors.
- **`src/scripts/faceParsing.ts`** — reduced to a main-thread client. Public API
  (`loadFaceParser`, `isFaceParserLoaded`, `analyzeFaceWithParsing`) is
  unchanged, so `segmentation.ts` needed no edits.

The model input is still the same JPEG data URL and color sampling still uses
the same original-canvas pixels, so the returned colors are byte-identical —
verified by comparing the refinement event before and after the change
(`{r:192,g:147,b:137}` both times).

`analyzeFaceWithParsing` now awaits the model load instead of returning `null`
when it is not ready yet, so an early click still produces refined colors.

No MediaPipe warm-up was added: once the transformers.js work left the main
thread, MediaPipe's apparent cold-start cost mostly disappeared — it had been
queued behind the model load, not slow in itself.

### Dead webcam panels

`ImageSegment.astro` rendered `SeasonResults type="video_season"` and
`AnalysisResults type="colors"` unconditionally. Both are fed only by the webcam
loop, so without a camera they sat there showing "Click the photo to start
analysis" forever — including after a completed analysis.

They now carry a `.webcam-only` class (`display: none`, `.shown` → `display: flex`)
toggled by the webcam button.

Note: this uses a component-scoped CSS rule rather than Tailwind's `hidden`.
`hidden` and `flex` set the same property, and Tailwind's source order makes
`flex` win regardless of class order.

### Result noise

- **`avrcolorenhanced.ts`** — `ColorAnalysis` gained `pixelCount`. Categories the
  segmenter found no pixels for returned black at 0% confidence and were drawn
  as real swatches; the UI now filters on `pixelCount > 0`.
- **`avrcolorenhanced.ts`** — added `isSkinTone()` and used it in two places:
  `analyzeSkinColor()` now prefers a dominant cluster inside the skin wedge
  instead of blindly taking the middle-brightness cluster, and
  `calculateSkinConfidence()` scores an out-of-wedge color 0.25 (Low) instead of
  0.5 (Medium) — such a color is not weak evidence of skin, it is evidence of
  something else.

  Effect on the sample photo: Body skin `#acaac1` @ 50% → `#b38378` @ 100%.
  The old value was background, not skin.

- **`seasonanalysis.ts`** — `calculateValue()` weighted body skin at 30%, so the
  bogus value was steering the season. Body skin now only counts when
  `pixelCount > 0 && confidence >= 0.5`; otherwise its weight is redistributed
  over face skin and hair (0.71 / 0.29).

- **`AnalysisResults.tsx`** — added labels and icons for `clothes` and `others`,
  which previously fell through to the raw key.

## Verification

- `npm run lint` — 0 errors
- `npm run build` — 0 errors, 0 warnings
- `npm test` — 23 passed
- Production build exercised via `npm run preview`: worker chunk served
  correctly under the `mycolortype` base, model fetched inside the worker,
  refinement event received.

## Not addressed

- `GET /favicon.svg` 404s on every page. Pre-existing and unrelated.
- Eye color reads `#5e6776` (grey-blue) for clearly bright blue eyes. Not
  investigated — outside this task.

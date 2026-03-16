# Dependency Upgrade — 2026-03-16

## Summary

Full major version upgrade of all dependencies.

## Changes Made

### package.json

- `astro` 4.16.10 → 6.0.5
- `react` / `react-dom` 18.3.1 → 19.2.4
- `@astrojs/react` 4.0.0 → 5.0.0
- `tailwindcss` 3.4.14 → 4.2.1
- `@astrojs/tailwind` **removed** (deprecated in Tailwind 4)
- `@tailwindcss/vite` **added** (Tailwind 4 Vite plugin)
- `@types/react` 18 → 19.2.14
- `@types/react-dom` 18 → 19.2.3
- `@mediapipe/tasks-vision` 0.10.18 → 0.10.32
- `chroma-js` 3.1.2 → 3.2.0
- `lucide-react` 0.469.0 → 0.577.0
- `typescript` 5.6.3 → 5.9.3
- `@astrojs/check` 0.9.4 → 0.9.8

### astro.config.mjs

- Removed `@astrojs/tailwind` integration
- Added Tailwind 4 via `vite.plugins: [tailwindcss()]`

### src/styles/global.css

- Added `@import "tailwindcss"` (Tailwind 4 entry point)
- Added `@plugin "@tailwindcss/forms"`
- Migrated custom colors from `tailwind.config.mjs` to `@theme {}` block

### tailwind.config.mjs

- **Deleted** — Tailwind 4 uses CSS-based config

### Code fixes (upgrade-related)

- `WebcamController.ts`: removed stale `import type { init } from "astro/virtual-modules/prefetch.js"`
- `ImageUploadContainer.tsx`: updated `RefObject<HTMLInputElement>` → `RefObject<HTMLInputElement | null>` (React 19 useRef change)
- `segmentation.ts`: wrapped `uint8Array` in `new Uint8ClampedArray(uint8Array.buffer)` for TypeScript 5.9 ImageData compatibility

## TypeScript Fixes Applied

All 40 pre-existing errors fixed:

- `window[type]` indexing → cast via `(window as unknown as Record<string, unknown>)`
- `useRef` type → `RefObject<HTMLInputElement | null>` (React 19)
- `faceLandmarker` typed as `FaceLandmarker | undefined`, `results` as `FaceLandmarkerResult | undefined`
- `event.target` in click handlers cast to `HTMLImageElement`
- Null-safe operators (`?.`, `!`) for DOM lookups
- Unused imports/variables removed
- `season2.ts` deleted (dead code, no exports)
- `WebcamController.ts` stale Astro import removed

## Final Status

- `npm run build` ✅ — 0 errors, 4 pages built

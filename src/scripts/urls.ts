/**
 * Base-aware URL helpers.
 *
 * The site is served from a sub-path (`base: "mycolortype"` in astro.config),
 * so root-relative links like `/favicon.svg` resolve to the wrong place.
 *
 * These live in a module rather than in `.astro` frontmatter deliberately:
 * the Astro compiler mis-parses a frontmatter block containing several
 * slash-bearing string literals and fails the build with "Unterminated string
 * literal", even though the TypeScript itself is valid.
 */

const BASE = import.meta.env.BASE_URL;

/** Join a site-relative path onto the configured base path. */
export function withBase(path: string): string {
  const separator = "/";
  const root = BASE.endsWith(separator) ? BASE.slice(0, -1) : BASE;
  const rest = path.startsWith(separator) ? path.slice(1) : path;
  return root + separator + rest;
}

# CLAUDE.md

Этот файл содержит правила и инструкции для Claude Code при работе с проектом MyColorType.

## Правила проекта

<!-- Впиши сюда свои правила, например: -->

<!-- ### Стиль кода -->
<!-- - ... -->

<!-- ### Что нельзя трогать -->
<!-- - ... -->

<!-- ### Предпочтения по инструментам -->
<!-- - ... -->

<!-- ### Деплой и CI -->
<!-- - ... -->

## For Claude

- Use `uv run` for all Python commands
- Language: Russian communication, English code/docs
- Don't over-engineer, keep solutions simple
- Test ideas before implementing
- Document decisions after finishing tasks in `plans/` folder + brief commit message
- Never add `Co-Authored-By` to commit messages
- After every change, commit automatically using Conventional Commits format: `type(scope): description` (lower-case, max 72 chars). Types: `feat`, `fix`, `refactor`, `style`, `chore`, `docs`, `test`, `perf`
- When asked to "запомни" — write the rule to CLAUDE.md, not to memory files

## Framework and library upgrades

When a major version of any dependency changes, always check the migration guide before writing code. Breaking changes are common in: API signatures, removed integrations, renamed config options, changed TypeScript generics. Never assume the old syntax still works — verify against the new docs first.

## Global state and component communication

Never use global objects (`window`, module-level variables) to pass data between scripts and UI components. Global state creates hidden dependencies, makes the data flow invisible, and causes timing bugs (polling, race conditions). Instead, use the platform's event system: dispatch a `CustomEvent` from the producer, listen for it in the consumer. Each piece of data should have one clear owner and one clear channel.

## TypeScript strict mode

This project uses `strictest` TypeScript. Every type must be explicit — no implicit `any`, no missing nullability, no unsafe casts. When a type error appears, fix the root cause (add the correct type, handle null, use a type guard). Do not suppress errors with `as any` or `// @ts-ignore`. If a type utility or library type is missing, add the correct `lib` target or install the `@types/*` package.

## Unused code

Every unused variable, parameter, or import is a sign of dead code or a logic gap. Remove it or, if it must stay (e.g. required function signature), prefix with `_` to signal intent. Never leave unused imports — they slow down builds and mislead readers.

## Commit messages

The full commit subject (everything after `type(scope):`) must be lower-case — including file names, proper nouns, and acronyms. Keep it under 72 characters. Write what changed and why, not just what file was touched.

## Markdown formatting (MD022/MD032)

Always add blank lines around headings and lists:

```md
<!-- DO -->
## Heading

- item

## Next heading

- item

<!-- DO NOT -->
## Heading
- item
## Next heading
```

## TypeScript lib errors (Cannot find name 'Map', 'Set', etc.)

If you see `Cannot find name 'Map'` / `'Set'` / `'Promise'` / `'WeakMap'` — TypeScript lib targets are missing.

Fix: add `lib` explicitly to `tsconfig.json`:

```json
"lib": ["ESNext", "DOM", "DOM.Iterable"]
```

After the fix always run:

```bash
npx astro check && npm run build
```

to verify 0 errors and build succeeds.

## Post-edit validation (TypeScript/Astro project)

This is a TypeScript project (package.json + tsconfig.json detected). After **every Edit or Write operation**, automatically run the full validation cycle:

```bash
npm run lint:fix   # auto-fix style/lint issues
npm run lint       # verify 0 errors remain
npm run build      # astro check (type-check .astro + .ts) + build
```

Rules:

- Never report "done" or "success" until all three commands pass with 0 errors.
- If any command fails, fix the issue immediately and re-run the full cycle before proceeding.
- `npm run build` includes `astro check` which type-checks both `.astro` and `.ts` files — this is the TypeScript validator for this project (not `tsc --noEmit` directly).
- Warnings are OK; errors are not.

## Workflow for implementing a task

- use `gh` to access GitHub
- use `axiom` to access remote Telemetry
- run tests and linters while implementing, if you see some linting error many times add short code diff `do/do not` to CLAUDE.md to avoid it in the future
- after editing/creating files, run the full linter + type check cycle:

```bash
npm run lint:fix   # auto-fix what can be fixed
npm run lint       # verify 0 errors remain (warnings OK)
npm run build      # verify TypeScript + build pass
```

- if `npm run lint:fix` breaks a type check (ESLint removes `!` and causes `ts(2322)`), restore with `??` nullish coalescing instead of `||`

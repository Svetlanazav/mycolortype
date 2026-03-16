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

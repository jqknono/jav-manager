# Repository Guidelines

## Project Structure & Module Organization

- `src/`: primary TypeScript codebase.
  - `data/` (JavDB/Everything/qBittorrent/cache providers)
  - `utils/` (CLI display, parsers, helpers)
  - `cli.ts`, `gui.ts`, `index.ts` (entry and runtime flow)
  - `services.ts`, `context.ts`, `interfaces.ts`, `models.ts`, `config.ts`
- `dist/`: compiled JavaScript output from `tsc` (runtime entry is `dist/index.js`).
- `test/`: Node test files (`*.test.js`).
- `telemetry-worker/`: optional Cloudflare Worker for telemetry/JavInfo APIs.
- `JavManager/` **(deprecated)**: legacy .NET implementation.
- `JavManager.Tests/` **(deprecated)**: legacy xUnit tests for the .NET implementation.
- `doc/`: reference docs for external service APIs.
- `scripts/`: release/build helpers (mostly legacy .NET publish and curl-impersonate tooling).
- `artifacts/`: build outputs (gitignored).

## Build, Test, and Development Commands

Requires Node.js (for the primary TypeScript project).

- Install deps: `npm install`
- Build: `npm run build`
- Lint/type-check: `npm run lint`
- Run (compiled): `npm run start`
- Run GUI: `npm run gui`
- Run CLI (interactive): `npm run cli`
- Run CLI (non-interactive): `npm run cli -- STARS-001`
- Help/version: `npm run cli -- help` / `npm run cli -- version`
- Tests: `npm test` (build + `node --test test/*.test.js`)
- Dev CLI/GUI (ts-node): `npm run dev:cli` / `npm run dev:gui`

Optional telemetry worker (`telemetry-worker/`):
- Install deps: `cd telemetry-worker && npm install`
- Local dev: `npm run dev`
- Deploy: `npm run deploy`

Legacy .NET commands (deprecated):
- Build: `dotnet build JavManager/JavManager.csproj`
- Tests: `dotnet test JavManager.Tests/JavManager.Tests.csproj`
- Publish: `pwsh scripts/publish.ps1`

## Documentation Guidelines

- Only edit `README.md` unless explicitly requested; do not modify other language readmes.

## Localization / i18n Guidelines

- Primary i18n file is `src/localization.ts`.
- When updating UI text, update English strings first (`en` section) and `README.md` when needed.
- Do **not** update non-English docs/readmes (`README.zh-CN.md`, `README.ja.md`, `README.ko.md`) unless explicitly requested.
- Chinese strings in `src/localization.ts` should only be changed when explicitly requested.

## Coding Style & Naming Conventions

- TypeScript uses existing repo formatting (2-space indentation in current files).
- Naming: `PascalCase` for types/classes, `camelCase` for variables/functions, file names follow existing patterns.
- Prefer `async`/`await` for I/O paths and keep provider/service boundaries clear.
- Avoid broad refactors in deprecated C# code unless explicitly requested.

## Testing Guidelines

- Primary framework: Node built-in test runner (`node --test`) with tests in `test/*.test.js`.
- Keep tests deterministic (avoid real network calls; use stubs/mocks for providers).
- If you change runtime TS logic, run `npm test` before submitting.
- Legacy C# tests (`JavManager.Tests/`) are deprecated and should only be updated when explicitly requested.

## Commit & Pull Request Guidelines

- Commit subjects: short, imperative, descriptive (e.g., “Add …”, “Refactor …”), no trailing period.
- If `src/` changes affect runtime behavior, keep `dist/` in sync via `npm run build`.
- Versioning/release automation for .NET artifacts is legacy/deprecated.
- PRs should include: summary, test evidence (`npm test`), and any config changes to `appsettings*.json`.

## Security & Configuration Tips

- Runtime config is loaded from `appsettings.json` and optional `appsettings.Development.json`.
- CLI arg overrides are supported for selected keys (see `src/config.ts` `extractOverrides`).
- Do not commit secrets (qBittorrent/Everything credentials, API keys, local URLs); prefer local `appsettings.Development.json`.
- JavDB access is implemented via HTTP + HTML parsing; avoid introducing browser automation (e.g., Playwright) unless explicitly required.

# Repository Guidelines

## Project Structure & Module Organization

- `JavManager/`: .NET console app (`Program.cs`) with layered modules:
  - `Core/` (models, interfaces, configuration binding)
  - `DataProviders/` (Everything/JavDB/qBittorrent/LocalCache clients)
  - `Services/` (business orchestration)
  - `ConsoleUI/` (interactive UI)
  - `Utils/` (parsers/helpers)
- `JavManager.Tests/`: xUnit test project.
- `doc/`: reference docs for external service APIs.
- `scripts/`: publish helpers (multi-RID, self-contained).
- `artifacts/`: build outputs (gitignored).

## Build, Test, and Development Commands

Requires .NET SDK `8.0`.

- Build: `dotnet build JavManager/JavManager.csproj`
- Run (interactive): `dotnet run --project JavManager/JavManager.csproj`
- Run (non-interactive): `dotnet run --project JavManager/JavManager.csproj -- STARS-001`
- Help/version: `dotnet run --project JavManager/JavManager.csproj -- help` / `-- version`
- Tests: `dotnet test JavManager.Tests/JavManager.Tests.csproj`
- Publish (local): `pwsh scripts/publish.ps1` or `bash scripts/publish.sh` (outputs to `artifacts/publish/<rid>/`)

## Documentation Guidelines

- Only edit `README.md` unless explicitly requested; do not modify other language readmes.

## Coding Style & Naming Conventions

- Indentation: 4 spaces; keep files using the repo’s existing C# formatting.
- C# conventions: `PascalCase` for types/methods, `camelCase` for locals/parameters, file name matches primary type.
- Prefer `async`/`await` for I/O paths; add `CancellationToken` on new long-running I/O APIs when practical.

## Testing Guidelines

- Framework: xUnit (`JavManager.Tests/`).
- Keep unit tests deterministic (avoid real network calls; mock/stub providers where needed).
- Naming: `*Tests.cs` and test methods describing behavior.

## Commit & Pull Request Guidelines

- Commit subjects: short, imperative, descriptive (e.g., “Add …”, “Refactor …”), no trailing period.
- Versioning: bump `Directory.Build.props` `<Version>` when releasing; CI tags `v<Version>` and publishes packaged artifacts.
- PRs: include a summary, how to test (`dotnet test`), and note any config changes to `appsettings*.json`.

## Security & Configuration Tips

- Runtime config is read from `appsettings.json` and optional `appsettings.Development.json` (env var overrides are not supported).
- Do not commit secrets (qBittorrent/Everything credentials, local URLs); prefer local `appsettings.Development.json` or env vars.
- JavDB access is implemented via HTTP + HTML parsing; avoid introducing browser automation (e.g., Playwright) unless explicitly required.

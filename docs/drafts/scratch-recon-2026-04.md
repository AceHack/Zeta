# Scratch Recon (2026-04)

Read-only survey of Aaron's cross-platform bootstrap harness at
`/Users/acehack/Documents/src/repos/scratch`. No scripts executed.

## 1. What's in scratch

- Cross-platform bootstrap harness with shipping entrypoints per OS:
  `scripts/setup/{ubuntu,macos,windows,debian,linux,unix}/`. Ubuntu
  entry is `bootstrap.sh`; Windows is `bootstrap.ps1`.
- Declarative package manifests under top-level `declarative/`, split
  by ecosystem: `bun/global/`, `dotnet/tools/`, `dotnet/workloads/`,
  `python/tools/` (uv), `debian/apt/`, `unix/brew/`, `macos/brew/`,
  `macos/cask/`, `windows/choco/`, `windows/powershell/`, `windows/vs/`.
- Docker smoke harnesses under `docker/github-ubuntu-latest/` and
  `docker/github-windows-latest/` approximating GitHub runner images.
- TypeScript + Bun test runner (`bun@1.3.12`, TS 6.0, ESLint 10) with
  scripts that bridge to shellcheck, bats, Pester, PSScriptAnalyzer.
- `mise` is the shared runtime manager (node/python/uv/bun/dotnet);
  `.NET` tools stay on platform-default `~/.dotnet/tools`.

## 2. Install-style conventions -- why "very thorough"

- Category manifests are the source of truth; profiles (`min`, `all`)
  are aggregates that `@category`-include other files. Same shape
  across apt, bun-global, dotnet-tools, uv-tools.
- Single managed shellenv file per OS at
  `~/.config/dev-bootstrap/shellenv.{sh,ps1}`, fanned out to every
  plausible login-shell file plus `GITHUB_ENV` / `GITHUB_PATH`.
  Nothing leaks as one-time terminal output.
- Platform defaults preserved rather than overridden. Bootstrap only
  does integration glue (cert trust, pwsh-to-root, nuget source).
- Every shipping path has a lint gate AND a test gate: `bash -n`,
  shellcheck, ESLint, tsc --noEmit, Pester, PSScriptAnalyzer, bats.
- Version pinning is exact (`fantomas@7.0.5`) not range-based;
  reproducibility over freshness.
- Runner-like non-root `runner` user everywhere, not root-by-default.

## 3. First translation candidate

Cheapest lift: adapt
`scratch/declarative/dotnet/tools/all.dotnet-tools` into an OpenSpec
capability. The file is three lines pinning `fantomas`,
`dotnet-reportgenerator-globaltool`, `dotnet-fsharplint` exactly,
plus a `@min` include.

OpenSpec shape: new capability `openspec/specs/dev-tools/spec.md`
with requirements like "Dbsp.Core SHALL pin dotnet global tool
versions exactly" and "The `min` profile SHALL include fantomas".
Backing data at `declarative/dotnet/tools/min.dotnet-tools`, paired
with a single `tools/install-dev-tools.sh` that reads the manifest
and calls `dotnet tool install`. No mise, no brew, no bun.

## 4. Not to port

- Bun / TypeScript runner layer -- we are dotnet-only.
- `mise` multi-runtime manager -- `global.json` already pins our SDK.
- Windows `.vsconfig` -- out of scope until native interop ships.
- Shellenv fan-out -- heavier than we need without a contributor
  bootstrap story.

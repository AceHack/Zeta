---
name: Three-way-parity invariant — dev/CI/devcontainer share install scripts; minimize GitHub-specific surface so switching CI hosts is cheap (Aaron 2026-04-27)
description: Aaron 2026-04-27 explicit course-correction during Scorecard PinnedDependencies fix. Otto's first attempt switched gate.yml lint-semgrep job to a SHA-pinned semgrep/semgrep Docker image. Aaron pushed back: this still uses GitHub-specific stuff (Docker container action) AND breaks the dev/CI parity invariant (dev laptops don't run semgrep via Docker). Right answer: install semgrep through the same `tools/setup/install.sh` that dev laptops + devcontainers use — i.e. add `pipx:semgrep` to `.mise.toml`. Composes GOVERNANCE §24 (already-codified three-way parity) + Otto's authority to push toolchain through install.sh + Aaron's host-portability invariant ("easy to switch hosts"). Triggered by Scorecard PinnedDependenciesID #17/#18 work where the convenience-fix (Docker container) would have introduced a real divergence.
type: feedback
---

# Three-way-parity invariant — dev/CI/devcontainer share install scripts

## Verbatim quote (Aaron 2026-04-27)

> "actions/setup-python we should be using our base python that our install scripts install we are trying to not use github stuff unless we have to so it's easy to switch hosts and our dev macchine and build machine setup is the same, that's one of the invariants we want to try to keep as close as possible dev machine / build machines are same/very similar for setup/share the setup/install scripts and post install scripts. this makes CI more deterministic too. if i'm off base here just let me know. but SHA pinning github actions is a supply change risk mitigation good idea."

## The invariant (codified)

GOVERNANCE.md §24 already names this as the "three-way parity" rule:

- **Dev laptop** runs `tools/setup/install.sh` to bootstrap toolchain
- **CI runner** runs `tools/setup/install.sh` to bootstrap toolchain
- **Devcontainer image** runs `tools/setup/install.sh` to bootstrap toolchain

Same script. Same `.mise.toml`. Same versions. No GitHub-specific actions stand in for what install.sh already does (no `actions/setup-python`, no `actions/setup-node`, no `setup-dotnet`).

## What this BUYS

- **Host portability.** If a future CI host swap happens (GitHub Actions → GitLab CI → self-hosted Forgejo runners → BuildKite → ...), the install path is the same script. Only the YAML wrapper differs.
- **Dev/CI parity for debugging.** A failure on CI reproduces locally because the toolchain is bit-identical (same mise pins, same install.sh path).
- **Determinism.** mise resolves declarative pins atomically; pip's dependency-resolver wandering or `actions/setup-python` cache poisoning don't enter the picture.
- **One bump surface.** Bumping a tool version is a single `.mise.toml` edit; CI inherits.

## What was almost violated (today's failure mode)

Otto's first attempt to fix Scorecard PinnedDependenciesID #17/#18 (pip install in lint-semgrep) was to switch the job to a SHA-pinned `semgrep/semgrep:1.161.0@sha256:...` Docker image at the `container:` job level.

That fix:

- **Did** resolve the Scorecard alerts (image bytes are content-addressed)
- **Did NOT** install semgrep on dev laptops via the install path
- **Did** introduce a GitHub-Actions-specific shape (`container:` block) that isn't portable across CI hosts
- **Did** break the dev/CI parity invariant — a dev laptop running semgrep manually wouldn't be running the same version that CI runs

Aaron caught this immediately. The invariant is more important than the immediate fix.

## The right fix (post-correction)

1. Add `pipx = "1.11.1"` to `.mise.toml` (aqua-backed; same SHA-pinned release path as `actionlint` / `shellcheck` / `uv`)
2. Add `"pipx:semgrep" = "1.161.0"` to `.mise.toml` (mise's pipx: backend installs the named PyPI package at the pinned version)
3. Drop `actions/setup-python` + the two `pip install` steps from gate.yml
4. Replace with `./tools/setup/install.sh` (same step build-and-test already uses)

Now: dev laptops + CI + devcontainers all install semgrep 1.161.0 the same way, through the same tooling, pinned in the same `.mise.toml`.

## Operational rule

When fixing a CI-side problem, before reaching for a GitHub-specific solution (custom action, container: block, runner-side feature), check:

- **Does this tool exist in `.mise.toml` already?** If so, use it via install.sh.
- **Could this tool live in `.mise.toml`?** If yes (mise registry has it via aqua / pipx / npm / cargo / etc.), add it there and route CI through install.sh.
- **Is this genuinely GitHub-specific?** (e.g. workflow triggering, GITHUB_TOKEN scope, code-scanning upload) — only then is a GitHub-specific shape correct.

## What this rule does NOT mean

- Does NOT mean "never use GitHub Actions" — `actions/checkout`, `actions/cache`, `github/codeql-action/*`, `actions/upload-artifact` are all genuinely GitHub-specific and stay
- Does NOT mean "never SHA-pin GitHub actions" — Aaron explicitly affirmed: *"SHA pinning github actions is a supply change risk mitigation good idea"*. SHA-pinning the actions we DO use is correct
- Does NOT mean "rewrite all of CI today" — apply the rule going forward; existing breaches are tech-debt to fix opportunistically when touching the surrounding code

## Composes with

- **GOVERNANCE.md §24** — three-way parity rule (this memory is the lived rationale, not just a re-citation)
- **Otto-247 (version-currency)** — version pins in `.mise.toml` get the same WebSearch-first discipline
- **#71 (Otto owns settings)** — install-path decisions are within Otto's authority; the binding decision is "share via install.sh", not "let CI drift"
- **#652 (block-only-on-Aaron-must-do)** — Aaron's earlier framing today: drive forward with best long-term judgment. The course-correction today refines what "best long-term" looks like for CI design

## Forward-action

- File this memory + MEMORY.md row
- Apply the rule to the in-flight fix: replace Docker-container approach with `pipx:semgrep` in `.mise.toml` + install.sh in gate.yml
- Future-self check: when adding a CI step, default-check `.mise.toml` first; reach for a GitHub-specific shape only when no parity-preserving option exists

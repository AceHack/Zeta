---
id: 081KQDTYV0008QG0R000XFYDTT
priority: P2
status: closed
title: Add `tsc --noEmit` gate job for tools/**.ts so type errors fail CI
tier: factory-hygiene
effort: S
ask: Aaron 2026-04-29 (081KQ8P5D0008QG0R003BFZPRC trajectory) — found via slice-9 #882 post-merge audit on 2026-04-30
created: 2026-04-30
last_updated: 2026-05-02
depends_on: []
closed_in: PR #890 (commit 9ca9ed9, 2026-04-30)
composes_with: [081KQ8P5D0008QG0R003BFZPRC]
tags: [ci-lint, factory-hygiene, ts-bun-migration, mechanical-guard, missing-gate]
---

# `tsc --noEmit` gate job for tools/**.ts

A real strict-typecheck error
(`tools/hygiene/audit-agencysignature-main-tip.ts(124,5): TS2322`)
shipped to main in slice-9 (PR #882) and was discovered post-merge
during slice-11 audit work on 2026-04-30. CI did not catch it because
`gate.yml` runs `dotnet build` for F#/C# but no `tsc --noEmit` for
TypeScript scripts under `tools/**`.

The fix for the specific bug shipped as PR #887. This row tracks
the *gap* — the missing CI gate.

## Scope

Add a `lint (tsc tools)` job to `.github/workflows/gate.yml` that:

1. Runs `./tools/setup/install.sh` (three-way-parity, GOVERNANCE §24).
2. Runs `bun install --frozen-lockfile` to materialize `node_modules`
   for `typescript@6.0.3` (already in `package.json` devDeps).
3. Runs `bun --bun tsc --noEmit -p tsconfig.json`.
4. Caches install.sh outputs the same way `lint-shell` /
   `lint-markdown` do.
5. Pinned to `ubuntu-24.04`, timeout 5 minutes.

## Why this matters

ESLint with typed-linting catches *most* TypeScript issues but not
all assignability narrowings — the slice-9 example was a
`Type 'string' is not assignable to type '"head" | "commit" | "max" | "since"'`
error that survived eslint strictTypeChecked + sonarjs but failed
plain `tsc --noEmit`.

Per the 081KQ8P5D0008QG0R003BFZPRC (TS+Bun migration) trajectory, the script surface
under `tools/` is growing — 32 ported files as of slice-11 + more
to come. Without a CI tsc gate, this class of error will recur
silently.

## Composes with

- **081KQ8P5D0008QG0R003BFZPRC** — TS+Bun migration trajectory; the more we port, the
  more important this gate becomes.
- **The "lint (semgrep)" pattern** — semgrep was added in round 30
  for the same reason: 14 codified rules but 0 gated builds. Same
  shape applies here: typecheck is codified (tsconfig.json strict),
  but the gate is missing.

## Acceptance criteria

- New job appears in `gate.yml` and is required for PR merge.
- A test-PR injecting a deliberate TS2322 fails the new job.
- A test-PR with all TS files clean passes the new job.
- Job runtime under 3 minutes (modulo install.sh cache hit).

## Effort

**S (small)** — ~30 lines of YAML modeled after `lint-shell` /
`lint-markdown`. Toolchain already pinned. No new external action
to SHA-pin.

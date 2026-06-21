---
pr_number: 5418
title: "feat(081KSKBP80008QG0R003AX2A69.10): per-cred type handlers \u2014 parse <id>=<source> + resolve literal/@file/env:VAR + per-type validation (60 unit tests; pure TS)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T07:30:18Z"
merged_at: "2026-05-27T07:41:52Z"
closed_at: "2026-05-27T07:41:52Z"
head_ref: "feat/b-0852-10-per-cred-type-handlers"
base_ref: "main"
archived_at: "2026-05-27T19:25:14Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5418: feat(081KSKBP80008QG0R003AX2A69.10): per-cred type handlers — parse <id>=<source> + resolve literal/@file/env:VAR + per-type validation (60 unit tests; pure TS)

## PR description

## Summary

081KSKBP80008QG0R003AX2A69 sub-row .10 — pure TS module composing already-merged 081KSKBP80008QG0R003AX2A69.5 manifest schema + 081KSKBP80008QG0R003AX2A69.1 crypto module, toward 081KSKBP80008QG0R003AX2A69.9 zflash `--bake-cred` CLI override per Aaron 2026-05-27 CLI-override design.

## Three pure layers

1. `parseBakeCredArg(arg)` — splits `<id>=<source>` preserving `=` in value
2. `resolveValueSource(source)` — handles `literal` / `@file` / `env:VAR`
3. `handler.validateValue(buf)` — per cred-type validation (PAT / JSON / SSH pubkey)

`resolveBakeCred()` full pipeline composes the three + gates unsupported source types per `handler.supportedSources`.

## Per-type handlers

| id | Sources | Validation |
|---|---|---|
| `gh-cli` | literal / file / env | non-empty string |
| `claude` | literal / file | valid JSON object |
| `gemini` | literal / file | valid JSON object |
| `codex` | literal / file | valid JSON object |
| `ssh-operator-pubkey` | literal / file | OpenSSH key-type prefix |
| `ssh-host-keys` | — (Phase 1 deferred) | rejects with deferral msg |

## Why per-type validation

JSON creds (claude/gemini/codex) explicitly rejects `env:` source — those creds are JSON files, not short tokens. PATs (gh-cli) support all three sources because the value is short string-shaped.

## Test output

```
 60 pass
 0 fail
 71 expect() calls
Ran 60 tests across 1 file. [106.00ms]
```

Covers: arg parsing edge cases (= in value, missing =, empty id/source) + value-source resolution (literal / env: / @file with home-dir ~ expansion / missing-file rejection / empty-env rejection) + per-handler validation (each cred type's happy + rejection paths) + full-pipeline integration tests.

## What this is NOT

- NOT the zflash CLI integration (081KSKBP80008QG0R003AX2A69.9; consumes this module)
- NOT the persist/restore CLIs (081KSKBP80008QG0R003AX2A69.2)
- NOT a YAML manifest parser (081KSKBP80008QG0R003AX2A69.5 already shipped; this consumes its output)

## Composes with

- **081KSKBP80008QG0R003AX2A69** parent row (CLI-override design)
- **081KSKBP80008QG0R003AX2A69.5** (cred-manifest schema; landed PR #5414) — handler.id matches manifest entry id
- **081KSKBP80008QG0R003AX2A69.1** (crypto module; landed PR #5411) — resolved bytes feed encrypt() in 081KSKBP80008QG0R003AX2A69.2
- **081KSKBP80008QG0R003AX2A69.9** future — zflash `--bake-cred` CLI consumes this module
- node:fs + node:os only; no third-party deps

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T07:33:29Z)

## Pull request overview

Adds a new pure-TS credential “bake” handler pipeline for 081KSKBP80008QG0R003AX2A69.10, covering CLI arg parsing (`<id>=<source>`), value-source resolution (literal / `@file` / `env:VAR`), and per-credential validation, with an accompanying acceptance test suite.

**Changes:**
- Introduces `parseBakeCredArg`, `resolveValueSource`, and `resolveBakeCred` plus a default per-cred handler registry (PAT / JSON / SSH pubkey / deferred host keys).
- Adds 60 Bun tests covering parsing edge cases, source resolution, per-type validation, and end-to-end pipeline behavior.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 5 comments.

| File | Description |
| ---- | ----------- |
| tools/installer/zeta-cred-handlers.ts | New handler registry + parse/resolve/validate pipeline for `--bake-cred` sources |
| tools/installer/zeta-cred-handlers.test.ts | Acceptance tests for all pipeline layers and default handler behaviors |

## Review threads

### Thread 1: tools/installer/zeta-cred-handlers.ts:158 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:33:28Z):

P0 security: parseBakeCredArg includes the entire raw `arg` in error strings. If a user passes a literal secret (PAT/JSON) and makes a typo, this will echo the credential into logs/terminal output. Redact the value portion (e.g., only show the id and/or source kind) and avoid printing raw `<id>=<value-source>` on failure.

### Thread 2: tools/installer/zeta-cred-handlers.ts:14 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:33:28Z):

P1 codebase convention: This header comment attributes the CLI-override design to a named individual. Per the repo’s “no name attribution in code/docs/skills” rule, current-state code should use role-refs (e.g., “human maintainer”) or link to a ticket/PR/ADR without embedding a personal name in code comments.

### Thread 3: tools/installer/zeta-cred-handlers.test.ts:31 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:33:29Z):

P1 operational: These tests use token-shaped fixtures like `ghp_...`. The repo already avoids real token prefixes in tests to prevent secret-scanner false positives; please switch these fixtures to non-token-prefix strings and apply the same sweep to other `ghp_` occurrences in this test (and related docstrings/examples).

### Thread 4: tools/installer/zeta-cred-handlers.test.ts:130 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:33:29Z):

P1 maintainability: This describe block creates a temp dir + fixture at module/describe evaluation time and cleans up via a dedicated "teardown" test. That makes cleanup order-dependent and can leak temp dirs if earlier assertions throw or if the teardown test is filtered/skipped. Prefer `beforeAll`/`afterAll` (or `try/finally` in each test) to ensure cleanup always runs.

### Thread 5: tools/installer/zeta-cred-handlers.ts:159 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:33:29Z):

P2 documentation: The comment calls this a “Pure resolution layer”, but `resolveValueSource` reads files and consults env vars (side effects). Consider rewording to avoid calling it pure (e.g., “no network; only local file/env reads”).

## General comments

### @chatgpt-codex-connector (2026-05-27T07:30:22Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

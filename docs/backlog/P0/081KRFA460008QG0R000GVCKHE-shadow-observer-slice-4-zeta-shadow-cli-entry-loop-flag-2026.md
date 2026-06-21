---
id: 081KRFA460008QG0R000GVCKHE
priority: P0
status: closed
title: "Shadow observer slice 4 — zeta shadow CLI entry point + --loop flag"
tier: product-feature
effort: S
created: 2026-05-13
last_updated: 2026-05-13
parent: 081KR7JY10008QG0R0008NGW95
depends_on: [081KRFA460008QG0R003C00WKR]
classification: buildable-now
decomposition: atomic
owners: [architect]
type: feature
tags: [shadow, autocomplete, cli, loop, zeta-cli, glass-halo]
---

# Shadow observer slice 4 — `zeta shadow` CLI entry point + `--loop` flag

## Origin

081KR7JY10008QG0R0008NGW95 decomposition 2026-05-13. After slice 3 (081KRFA460008QG0R003C00WKR) lands the real detector,
this slice exposes `zeta shadow` as a first-class CLI command and adds `--loop`
for embedded autonomous operation.

## Acceptance criteria from 081KR7JY10008QG0R0008NGW95 this slice satisfies

- [ ] `zeta shadow` command starts shadow auto-accept mode
- [ ] Optional `--loop` embeds autonomous loop

## Technical context

Currently shadow is invoked as `bun tools/shadow/shadow-observer.ts [flags]`.
This slice adds:

1. `package.json` `scripts` entry `"shadow": "bun tools/shadow/shadow-observer.ts"` —
   invoked as `bun run shadow`; this is a dev-convenience entry, not the `zeta shadow`
   subcommand (the `bin` field + `zeta shadow` surface ships in slice 5 / 081KRFA460008QG0R0028CR0N9).
2. A `--loop <interval-ms>` flag on `shadow-observer.ts` that wraps the continuous
   loop with a configurable outer interval (distinct from `--loop-interval` which
   controls per-cycle polling frequency). `--loop` is the "set-and-forget" mode;
   `--loop-interval` is cycle tuning.
3. A thin `tools/shadow/zeta-shadow.ts` entry-point script (shebang + `run()`
   invocation) that can later be referenced from `package.json` `bin`.

## Scope

### `--loop <ms>` flag

Add to `ShadowConfig`:
```typescript
loopMs?: number; // undefined = no outer loop (manual restart); >0 = embedded loop with outer interval
```

Behaviour: when `--loop <ms>` is set, after the continuous inner loop exits
due to a **non-signal exit** (natural termination or recoverable failure),
wait `loopMs` then restart. SIGINT (Ctrl-C) and SIGTERM cause immediate
termination — signal-based shutdowns are never restarted. This lets
`zeta shadow --loop 60000` run as an embedded autonomous loop that survives
individual cycle failures while keeping Ctrl-C as an effective immediate stop.

Validation: must be a positive integer. Error + exit 1 if invalid.

### `tools/shadow/zeta-shadow.ts`

```typescript
#!/usr/bin/env bun
// Entry point for `zeta shadow` — thin wrapper around shadow-observer run().
import { run, parseConfig } from "./shadow-observer.ts";
// re-exports parseConfig as exported function; see note on API surface below
```

### API surface note

`parseConfig` is currently module-private (`function parseConfig`). This slice
exports it so `zeta-shadow.ts` can call it directly without duplicating arg
parsing.

### Tests (8 new, ~47 total, 0 failures)

- 3 `--loop` flag validation tests (invalid: abc, -1, 0; valid: 1000)
- 3 `--loop` integration tests via `--once` + `--loop 500` to verify the outer
  restart behaviour with a mock detector
- 2 smoke tests: `bun tools/shadow/zeta-shadow.ts --once --dry-run` exits 0;
  `bun tools/shadow/zeta-shadow.ts --help` or invalid flag exits 1

## Acceptance

- [ ] `--loop <ms>` flag accepted + validated by `parseConfig`
- [ ] `loopMs` present in `ShadowConfig`; outer restart loop wired in `run()`
- [ ] `parseConfig` exported from `shadow-observer.ts`
- [ ] `tools/shadow/zeta-shadow.ts` entry-point script present
- [ ] `package.json` `scripts.shadow` entry present
- [ ] 8 new tests, 0 failures

## Pre-start checklist

**Prior-art search:**

- `tools/shadow/shadow-observer.ts` — `parseConfig` currently private; wire export
- `package.json` `scripts` — no `shadow` entry yet
- 081KR7JY10008QG0R0008NGW95 acceptance criteria:
  - "`zeta shadow` command starts shadow auto-accept mode"
  - "Optional `--loop` embeds autonomous loop — slice 4 (requires `zeta` CLI entry point)"

**Dependency check:**

- `depends_on: [081KRFA460008QG0R003C00WKR]` — real detector needed before CLI is useful end-to-end;
  however tests use `--detect-cmd` so implementation can proceed in parallel;
  classify as logically-depends (for demo coherence) not hard-blocks

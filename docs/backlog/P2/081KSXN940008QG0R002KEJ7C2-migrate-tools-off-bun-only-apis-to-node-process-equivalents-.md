---
id: 081KSXN940008QG0R002KEJ7C2
title: Migrate tools/ production code off Bun-only APIs to node:/process equivalents — honor the Node-safe-baseline policy (2026-04-20 tools-runtime ADR v6)
status: open
priority: P2
created: 2026-05-31
attribution: aaron-otto-2026-05-31
last_updated: 2026-05-31
decomposition: sweep
depends_on:
  - 081KSXN940008QG0R00171YAZW
composes_with:
  - 081KQ8P5D0008QG0R003G61V9V
  - 081KSGS9H0008QG0R002BC2ZR7
tags:
  - node
  - bun
  - runtime
  - portability
  - migration
  - tools
  - cross-os
  - sweep
  - node-safe-baseline
---

# 081KSXN940008QG0R002KEJ7C2 — Migrate `tools/` production code off Bun-only APIs (Node-safe baseline)

## Context

The 2026-04-20 tools-runtime ADR was refined 2026-05-31 (**v6 addendum**, PR #6293) to:
**Node = the safe cross-harness baseline; Bun = the accelerator.** Tooling must *run* on
Node (present in every harness/CI image); Bun stays the fast lane; **nothing new may be
Bun-only.** Aaron + Max aligned; the Node-24 pin already landed (#6290).

The addendum surfaced the honest cost (Codex catch on #6293): **~29 `tools/` files still
use Bun-only runtime APIs** and are not Node-portable yet. This row is the tracked
migration the ADR named — *not* a big-bang rewrite.

**Gating:** contingent on the ADR v6 addendum being **Accepted** (currently Proposed,
pending broader product-team ratification per the doctrine-through-agreement discipline).
Until accepted, this row holds.

## Scope — Bun-only API surface in `tools/` (enumerate, don't hand-list)

Source of truth (run to refresh the list):

```bash
git grep -lE "\bBun\." -- 'tools/' | sort        # files
git grep -hoE "\bBun\.[A-Za-z$]+" -- 'tools/' | sort | uniq -c | sort -rn   # APIs
```

Current API breakdown (2026-05-31): `Bun.spawn` (29 — **mostly `*.test.ts`**),
`Bun.sleep` (9), `Bun.argv` (9), `Bun.which` (6), `Bun.spawnSync` (5), `Bun.write` (4),
`Bun.Glob` (3), `Bun.stdin` (2), `Bun.file` (1).

### Migrate (production tool code) vs keep-on-Bun (accelerator test path)

- **Migrate:** the non-`*.test.ts` tool code (the runtime that must run on the Node-safe
  baseline). E.g. `tools/dora-classify/cli.ts` (`Bun.argv`), `tools/dashboard/generate-metrics.ts`
  (`Bun.write`), `tools/ci/qemu-*.ts` (`Bun.spawnSync`/`Bun.sleep`), `tools/github/is-pr-create-policy-denial.ts`
  (`Bun.stdin`/`Bun.file`), `tools/bootstrap-razor/seed-test-repo.ts` (`Bun.Glob`).
- **Keep on Bun (no migration required):** `*.test.ts` files that use `bun:test` +
  `Bun.spawn` to exercise CLIs — that is the *accelerator test path* the ADR explicitly
  reserves for Bun. (If a safe-baseline test run is ever needed, the swap is `node:test`,
  but it's not required while Bun is in CI/dev.)

### API → `node:`/`process` equivalents

| Bun-only API | Node-safe equivalent |
|---|---|
| `Bun.argv` | `process.argv` |
| `Bun.file(p).text()` | `readFileSync(p, "utf-8")` / `node:fs/promises` `readFile` |
| `Bun.write(p, data)` | `writeFileSync(p, data)` / `node:fs/promises` `writeFile` (`mkdir -p` the dir) |
| `Bun.spawn` / `Bun.spawnSync` | `node:child_process` `spawn` / `spawnSync` / `execFileSync` (with the `sonarjs/no-os-command-from-path` disable + no-shell argv, per the agent-bus / agent-heartbeats precedent) |
| `Bun.sleep(ms)` | `await setTimeout(ms)` from `node:timers/promises` |
| `Bun.Glob(pat).scan/match` | `node:fs` `glob`/`globSync` (Node 24) — verify stability; else a glob dep |
| `Bun.which(cmd)` | no Node builtin — small PATH probe helper, or run `which`/`where` via `execFileSync`, or a `which` dep |
| `Bun.stdin` | `process.stdin` / `node:readline` |

## Acceptance

- [ ] **ADR v6 addendum Accepted** (gate) + Rule-0 carved-sentence amended.
- [ ] Every non-`*.test.ts` `tools/` file runs on Node (the safe baseline): no Bun-only
      runtime API outside the accelerator test path.
- [ ] A **drift detector** (not a blocker, per shields-detect-not-block): a check that
      greps non-test `tools/` for `Bun.\w` and surfaces any hit (allowlist the deliberate
      accelerator-only cases). Detect, don't gate day-to-day work.
- [ ] Per-tool migration lands with **tsc 0 + eslint 0 + test green** (the full verify
      gate — eslint included, per the #6283 lesson that eslint had been shipping silent-red).
- [ ] Prioritize tools that must run on Node-only harnesses first.

## Migration discipline

- **Per-tool, not big-bang.** Each migrated tool is its own small PR (or batched by
  API-class), verified tsc+eslint+test green.
- **`tools/agent-bus/` (081KSXN940008QG0R00171YAZW, #6283 — landed) is the reference**: the first tool authored
  to the new convention (`node:` builtins + `import.meta.main` CLIs that run on Node 24.2+).
- May decompose into per-API-class sub-rows (`081KSXN940008QG0R002KEJ7C2.1` argv, `.2` file/write, `.3`
  spawn, …) if the team prefers finer tracking.

## Composes with

- the 2026-04-20 tools-runtime ADR **v6 addendum** (PR #6293) — the policy this executes
- `.claude/rules/rule-0-no-sh-files.md` — the carved sentence the ADR proposes amending
- `.claude/rules/dep-pin-search-first-authority.md` + "pin only slow-movers" — Node is the slow-mover baseline; Bun the fast-mover accelerator
- 081KSXN940008QG0R00171YAZW (agent-bus) — the landed reference tool
- 081KQ8P5D0008QG0R003G61V9V (disowned-runtime sweep, python/TS) — sibling runtime-hygiene sweep
- 081KSGS9H0008QG0R002BC2ZR7 (all-deps current-version sweep) — adjacent dep-hygiene
- #6290 (mise node 22→24, node-everywhere pin — landed)

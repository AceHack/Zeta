---
id: B-0015
priority: P3
status: open
title: Migrate tools/git/batch-resolve-pr-threads.sh to bun+TS once a sibling post-setup tool migrates first
tier: ops
effort: S
directive: PR #199 review feedback (Copilot P0 exception-label requirement) + sibling-migration guardrail per docs/POST-SETUP-SCRIPT-STACK.md
created: 2026-04-25
last_updated: 2026-04-25
composes_with: [docs/POST-SETUP-SCRIPT-STACK.md]
tags: [post-setup-stack, bun, typescript, migration, sibling-migration-guardrail]
---

# Migrate batch-resolve-pr-threads.sh to bun+TS

`tools/git/batch-resolve-pr-threads.sh` carries the `bun+TS migration candidate` exception label per `docs/POST-SETUP-SCRIPT-STACK.md`. The script is over 300 lines of bash with non-trivial control flow (paginated GraphQL fetch, JSON parsing, classification state machine, mutation dispatch). The sibling-migration guardrail says "if no other post-setup tool has migrated yet, bash is the honest default" — so the migration is queued, not blocked.

## Why a candidate (not "stay bash forever")

- Non-trivial JSON / GraphQL handling: bun+TS has first-class fetch + JSON typing.
- Classification state machine: TypeScript discriminated unions would land cleaner than bash if/elif chains.
- Cross-platform: a bun+TS rewrite is one cross-platform script, not a `.sh` + `.ps1` pair (avoids the Windows-twin obligation).

## When to flip

When a sibling post-setup tool under `tools/` migrates to bun+TS, batch with it. Flipping a single bash script to bun+TS in isolation creates the "stranded one-off" failure mode the sibling-migration guardrail prevents.

## Done when

- (a) A sibling post-setup tool has landed in bun+TS.
- (b) `tools/git/batch-resolve-pr-threads.ts` (or wherever the equivalent lands) replaces the bash script.
- (c) The bash script is removed (or, if retained for transition, labeled `_deprecated/` and queued for deletion).
- (d) Exception-label header on the new file matches the bun+TS migration outcome.

## Composes with

- `docs/POST-SETUP-SCRIPT-STACK.md` — the post-setup script stack rationale and exception taxonomy.
- Any future "first sibling bun+TS migration" decision row.

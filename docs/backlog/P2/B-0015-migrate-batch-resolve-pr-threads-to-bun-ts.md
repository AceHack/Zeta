---
id: B-0015
priority: P2
status: open
title: Migrate tools/git/batch-resolve-pr-threads.sh to bun+TS once a sibling post-setup tool migrates first
tier: ops
effort: S
ask: PR #199 review feedback (Copilot P0 exception-label requirement) + sibling-migration guardrail per docs/POST-SETUP-SCRIPT-STACK.md
created: 2026-04-25
last_updated: 2026-04-26
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
- `tools/hygiene/*.py` and `tools/hygiene/*.sh` — sibling **POST-install** tools that should migrate to TS once a peer migrates first. Includes: `sort-tick-history-canonical.py`, `fix-markdown-md032-md026.py`, `check-tick-history-order.sh`, `check-no-conflict-markers.sh`. Scope expansion 2026-04-26.
- `B-0027` — Otto-346 follow-up tool extraction; implementation target should be TypeScript not Python per this migration plan.

## 2026-04-26 priority bump (P3 → P2)

Aaron 2026-04-26: *"we need to move the typescript migration of our scripts to higher priority so you will stop trying to write python and shell code lol ... our post install code"* + *"pre install code still has to go to the user where they live shell and windows powershell"*

The recurring `python3 << 'PYEOF'` heredocs and `.sh` scripts I keep writing in `tools/hygiene/` are POST-install tools that belong in TypeScript per the migration plan. The tools shipped this session (PR #539/#541/#542) are interim — they exist to absorb recurring patterns NOW (per Otto-346) but should rewrite to TS once the sibling-migration guardrail unblocks.

Scope clarification (Aaron 2026-04-26):

- **Pre-install scripts** (`tools/setup/install.sh`, devcontainer bootstrap, anything that runs BEFORE Bun is available): MUST stay shell + PowerShell — that's what's available where the user lives. Cross-platform pair (`.sh` + `.ps1`) is the right shape.
- **Post-install scripts** (`tools/hygiene/`, `tools/git/`, dev-time tooling, anything that runs AFTER Bun installs): TARGET = TypeScript via Bun. Single cross-platform script, first-class typing, better refactor surface.

The distinction is structural; Aaron's framing landed it cleanly. `docs/POST-SETUP-SCRIPT-STACK.md` already encodes the rationale; this priority bump operationalizes it.

## What this DOES NOT do

- Does NOT mandate immediate rewrite of all post-install tools — sibling-migration guardrail still applies (first sibling migrates, then batch follow-on)
- Does NOT touch pre-install scripts — they remain shell + PowerShell deliberately
- Does NOT block ongoing hygiene-tool extraction in Python while the migration is staged — Otto-346 still authorizes Python tools as interim absorbers, but the bar for Python rises and the bar for TS implementation lowers
- Does NOT promise immediate effort allocation — P2 means "queue closer to the front" not "do now"

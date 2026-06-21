---
id: 081KRFA460008QG0R0034C2W0E
priority: P1
class: substrate-architecture
status: closed
closed: 2026-05-13
closed_by: "step 4c added to AUTONOMOUS-LOOP.md every-tick checklist"
title: Wire reindex-memory-md.ts into autonomous-loop tick cadence
created: 2026-05-13
last_updated: 2026-05-13
parent: 081KRCQQF0008QG0R0037YYP1A
depends_on: [081KRFA460008QG0R0006Q6BWP]
composes_with: [081KRCQQF0008QG0R0037YYP1A, 081KRFA460008QG0R0006Q6BWP, 081KRFA460008QG0R000YPS21H]
effort: S
tier: factory-tooling
authors: [otto]
---

# 081KRFA460008QG0R0034C2W0E — Wire reindex-memory-md.ts into autonomous-loop tick

## Carved sentence

> `tools/memory/reindex-memory-md.ts` exists but is not called from
> the autonomous-loop tick. Without wiring, heap→stack promotion
> never happens automatically: MEMORY.md will go permanently stale
> once synchronous paired-edit enforcement is removed.

## Context

081KRCQQF0008QG0R0037YYP1A's architectural fix requires three layers:

1. **Heap layer** — memory files commit without MEMORY.md paired edit
2. **Stack layer** — MEMORY.md is kept current by the reindexer
3. **High-cadence reindex** — called from the autonomous-loop tick

Layer 3 is the missing link. The reindexer exists and works, but nothing
calls it on cadence. This slice wires it into the loop.

**Dependency:** Lands after 081KRFA460008QG0R0006Q6BWP (test coverage) to ensure the
reindexer is trustworthy before it runs automatically on every tick.

## Acceptance criteria

### End-of-tick checklist update (`docs/AUTONOMOUS-LOOP.md`)

- [ ] Add step to the end-of-tick checklist:
  - Every N ticks (recommended: every 5 ticks, i.e. every ~5 min),
    run `bun tools/memory/reindex-memory-md.ts`.
  - Commit the result if MEMORY.md changed (commit message:
    `chore(memory): reindex MEMORY.md stack from heap [081KRCQQF0008QG0R0037YYP1A]`).
  - Use `--check` first to detect staleness before writing.
- [ ] Document the "every N ticks" cadence rationale:
  - Every-tick reindex on every minute-cadence cron tick burns
    unnecessary CPU and creates noisy commits; every 5 ticks
    keeps MEMORY.md ≤5 min stale, matching Aaron's guidance
    ("needs to run more often than Anthropic allows on their base").

### Operational wiring in the loop instructions

The autonomous-loop receives `<<autonomous-loop>>` sentinel which
resolves at fire time to autonomous-loop instructions. The end-of-tick
checklist in `docs/AUTONOMOUS-LOOP.md` is the canonical place to add
the reindex step — the sentinel's resolved content calls agents to
follow this checklist.

- [ ] Update `docs/AUTONOMOUS-LOOP.md` end-of-tick checklist (currently
  six steps: speculative work, verify, commit, write shard,
  CronList, visibility signal) to add a seventh step between
  "commit" and "write shard":
  > **7. Reindex memory**: If N ticks have elapsed since last
  > reindex, run `bun tools/memory/reindex-memory-md.ts`.
  > If MEMORY.md changed, commit with the standard chore message.
  > Maintains the heap→stack promotion cadence per 081KRCQQF0008QG0R0037YYP1A.

### State tracking for "every N ticks" cadence

The loop needs to know how many ticks have elapsed since the last
reindex. Options:

**Option A:** Read a timestamp from the MEMORY.md preamble. Requires
the preamble to store minute-precision time (e.g. `last reindex: YYYY-MM-DD HH:MMZ`)
rather than date-only. The reindexer must be updated to write and parse
this format; the "every 5 minutes" skip logic then compares the stored
UTC timestamp to the current time.

**Option B (recommended):** Write a sentinel file `memory/.last-reindex-ts`
with an epoch timestamp (Unix seconds). Compare on each tick: if
`(now - stored_epoch) < 300`, skip. This avoids coupling cadence logic
to preamble format and works correctly across midnight boundaries.

Option B is preferred because it is simpler to parse, always has
sub-second precision, and keeps the preamble human-readable (date-only
format unchanged for readers). The sentinel file is `.gitignore`-ed or
committed silently as infrastructure.

### Commit discipline

The reindex commit, if MEMORY.md changed, must:

- Use message: `chore(memory): reindex MEMORY.md stack from heap [081KRCQQF0008QG0R0037YYP1A]`
- Include the `Co-Authored-By:` trailer matching the active harness
  (e.g. `Co-Authored-By: Claude <noreply@anthropic.com>` for Otto;
  use the appropriate identity for Codex/Grok/Gemini/Kiro loops)
- Target the current branch (main, or any open feature branch the
  loop is working on)

## Implementation notes

This slice requires editing `docs/AUTONOMOUS-LOOP.md` only.
No code changes to `tools/memory/reindex-memory-md.ts` are needed
unless Option A (preamble-based staleness detection) requires
parsing the preamble — in that case, add a `lastReindexDate()`
helper function to the reindexer module.

Run `dotnet build -c Release` and `bun test` to verify nothing broken.

## Why P1 (not P2)

This slice is the operational linchpin of the 081KRCQQF0008QG0R0037YYP1A fix. The heap
architecture only works if promotion happens. Without this slice,
removing the CI paired-edit enforcement (081KRFA460008QG0R0035NKRHG) leaves MEMORY.md
permanently stale. This must land before 081KRFA460008QG0R0035NKRHG.

## Composes with

- 081KRCQQF0008QG0R0037YYP1A (parent; this is slice 3 of 5)
- 081KRFA460008QG0R0006Q6BWP (depends on test coverage for confidence)
- 081KRFA460008QG0R000YPS21H (documentation should be consistent with the loop doc)
- 081KRFA460008QG0R0035NKRHG (CI relaxation must not land before this slice)

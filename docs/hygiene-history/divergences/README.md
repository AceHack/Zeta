# Substrate-divergence shard files

This directory holds **per-divergence shard files** recording disagreements
between concurrent agent loops working on shared substrate.

Origin: 081KQJZR90008QG0R002GJAJ19 AC #4 (2026-05-10).

## Why divergence shards exist

When two independent agent loops (e.g., Otto on Claude Code + a second loop on
Codex) produce uncorrelated outputs, those outputs can either converge or
diverge. The information value of dual-loop operation comes from BOTH cases:

- **Convergence**: strengthens evidence (both loops independently reached the
  same conclusion)
- **Divergence**: reveals which loop's training distribution captured what

Without an explicit protocol, divergent outputs either silently overwrite each
other (information loss) or create merge conflicts (operational loss). The
divergence shard format preserves both perspectives with attribution so the
human maintainer can read and reconcile them explicitly each morning.

## What triggers a divergence shard

File a shard whenever two loops disagree on a **substrate-class commitment**:

- Different memory-file content for the same discipline
- Different ALIGNMENT.md interpretations
- Conflicting PR-review thread conclusions (each loop reviews the same thread
  with opposite recommendations)
- Conflicting branch work on the same file (second loop detects the conflict
  and cannot rebase cleanly)
- Conflicting next-action proposals competing for the same narrow slot

Do NOT file shards for disagreements that are already resolved by the loops
themselves (e.g., one loop defers to the other's Co-Authored-By attribution).

## File naming

```
docs/hygiene-history/divergences/YYYY/MM/DD/HHMMSSZ-<short-content-hash>.md
```

- Year / month / day are zero-padded numeric folders.
- Filename is `HHMMSSZ-<short-content-hash>` (UTC, with `Z` suffix).
  - `HHMMSSZ` uses seconds precision to reduce same-minute collisions.
  - `<short-content-hash>` is 8 hex chars from `sha256(loop-a-body + loop-b-body)`.
- Extension `.md` so each shard is independently grep-able and rendered.

**Unique-filename rule (fail-closed-OR-idempotent):** if the target path already
exists when a new shard is being written, the write MUST either (a) succeed
silently if the new content is byte-identical (idempotent re-write), OR (b)
fail closed and choose a unique-suffix path. Silent overwrites of different
content are forbidden — they erase divergence evidence.

## Required frontmatter

```yaml
---
tick: "2026-05-10T11:48:00Z"     # ISO 8601 UTC, seconds precision
type: divergence
loop-a:
  agent: otto                     # named agent identifier (e.g., otto, vera)
  model: "claude-opus-4-7"        # model ID string
  harness: claude-code
loop-b:
  agent: codex-loop               # named agent identifier
  model: "gpt-5.5"               # model ID string
  harness: codex
topic: "memory/feedback_xyz.md"   # the substrate path or topic in conflict
operative-authorization: "aaron 2026-05-04: \"it**, not just the output. Grinding through failures + recoveries\""
---
```

## Required body sections

```markdown
## Loop A perspective

<agent> (<model>, <harness>): <full framing of the position>

## Loop B perspective

<agent> (<model>, <harness>): <full framing of the position>

## Disagreement summary

One-paragraph neutral summary of the disagreement for morning reconciliation.

## Reconciliation

<!-- Leave blank until morning reconciliation. The human maintainer fills this in. -->
<!-- Options: accept-loop-a | accept-loop-b | accept-both (explicit divergence) | escalate -->
```

## Reconciliation outcomes

Morning reconciliation reads all shards with empty `Reconciliation` sections.
For each:

- **accept-loop-a**: Loop A's framing wins; Loop B's is discarded.
- **accept-loop-b**: Loop B's framing wins; Loop A's is discarded.
- **accept-both (explicit divergence)**: Both framings are preserved as
  explicitly-annotated divergent views on a topic that admits multiple
  valid positions.
- **escalate**: Neither framing is clearly correct; the human maintainer
  documents the uncertainty and defers until more evidence arrives.

After reconciliation, the shard is updated in place (not deleted) so the
divergence history is preserved permanently.

## Composition with tick shards

Divergence shards are written in addition to (not instead of) the normal tick
shards at `docs/hygiene-history/ticks/**`. A tick shard records what a loop
DID; a divergence shard records a CONFLICT between two loops. Both surfaces
are canonical write surfaces; neither replaces the other.

See: `docs/hygiene-history/ticks/README.md` for the tick shard schema.

## What this directory does NOT do

- Does NOT replace normal tick shards for liveness evidence.
- Does NOT impose any ordering constraint between concurrent loops.
- Does NOT auto-resolve conflicts — resolution is always by the human
  maintainer (or a designated reconciliation agent, once one exists).
- Does NOT change the AUTONOMOUS-LOOP.md liveness invariant.

## Example shard

See `docs/hygiene-history/divergences/2026/05/10/114800Z-example.md` for a
worked example demonstrating the schema.

## Migration

There is no legacy divergence surface. This directory is created fresh (081KQJZR90008QG0R002GJAJ19
AC #4, 2026-05-10). All shards from 2026-05-10 onward are written here.

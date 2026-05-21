# Moved

This file has been moved to:

[`memory/persona/otto/conversations/multi-ai-feedback-2026-04-29-no-directives-otto-prose-roundup.md`](../../memory/persona/otto/conversations/multi-ai-feedback-2026-04-29-no-directives-otto-prose-roundup.md)

The move happened during the 2026-05-15 persona-migrate-conversations work (per the `feat/persona-*-migrate-conversations` PR pattern). This stub preserves the original path as a compatibility artifact so that historical tick shards which link to the old location continue to resolve.

## Why this stub exists (not the moved file itself)

Tick shards (`docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md`) are immutable per `docs/hygiene-history/ticks/README.md` (Event-Sourcing-style discipline) + `tools/hygiene/AUDIT-LIFECYCLE.md` ("When pre-existing residue is immutable, baseline is the path"). The historical 0852Z shard at `docs/hygiene-history/ticks/2026/04/29/0852Z.md` carries a link to this path that was correct at authoring time. Moving the file broke the link; editing the shard retroactively would violate the immutability discipline. The compatibility-artifact path resolves the broken link while preserving the historical shard verbatim.

Per Codex P1 finding on PR #4534 (the empirical anchor that surfaced this discipline application).

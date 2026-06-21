---
id: 081KQ8P5D0008QG0R0023ABK2C
priority: P2
status: closed
title: Normalize MEMORY.md index entry lengths to one-line-per-memory per memory/README.md guidance
effort: M
ask: copilot review on PR #72 (memory/MEMORY.md line 16)
created: 2026-04-28
last_updated: 2026-05-02
depends_on: []
tags: [memory-hygiene, memory-md, index-format, substrate-cleanup]
type: friction-reducer
---

# 081KQ8P5D0008QG0R0023ABK2C — MEMORY.md index entry length normalization

## Source

Copilot review thread on PR #72 (`memory/MEMORY.md` line 16
range, recently-added 2026-04-28 entries):

> These new `MEMORY.md` index entries are extremely long.
> `memory/README.md` specifies the index is capped (~200
> lines) and should be kept terse ("one line per memory
> file"). Consider shortening each bullet to just the title
> plus a very brief hint, and move the detailed
> rationale/examples into the referenced memory files.

CLAUDE.md memory section similarly states:
> "Keep index entries to one line under ~200 chars; move
> detail into topic files."

## Why deferred (not fixed in PR #72)

`memory/MEMORY.md` is a hot spine file. Every PR touching it
flips siblings DIRTY (empirically twice-confirmed in 2026-04-28
session). Re-shaping ~30+ entries inline on PR #72 would:

1. Generate massive cascade churn on the open PR queue
2. Mix substrate-cleanup with the EAT/wallet content that PR
   #72 already covers
3. Violate single-purpose-PR discipline

## Scope of work

1. **Audit:** flag all `memory/MEMORY.md` entries over ~200
   chars (or over one terminal-width-line, depending on which
   discipline wins).
2. **Shorten:** each long entry collapses to title + ≤80-char
   hook. Detail moves into the referenced memory file (or stays
   there if already covered).
3. **Discriminator:** if shortening loses the index's
   discoverability function, the entry needs a new
   short-hook field — not a removal.
4. **Auto-generation candidate:** longer-term, 081KQ8P5D0008QG0R003KFRGJ0 covers
   auto-generated MEMORY.md from individual memory frontmatter
   (eliminates the format-drift class entirely).

## Pre-start checklist (2026-05-10)

Prior-art search:

- Rule #1 (assume already done): searched `tools/hygiene/` for existing memory-normalization script — found `audit-memory-index-duplicates.ts`, `audit-memory-references.ts`, `validate-memory-schema.ts`, but no entry-length normalizer.
- Rule #2 (assume on backlog): 081KQ8P5D0008QG0R003KFRGJ0 (auto-gen MEMORY.md) is decomposed into 081KR2E4K0008QG0R001J0536V–081KR2E4K0008QG0R0004B55ND but not yet shipped; 081KQ8P5D0008QG0R0023ABK2C remains independent and valid.
- Rule #3 (orthogonal trajectory): TS-migration trajectory covers `tools/hygiene/*.ts`; no length-normalization axis exists.
- Rule #4 (internet prior art): N/A — purely mechanical local file transform.
- 081KQ8P5D0008QG0R003KFRGJ0 / 081KQ8P5D0008QG0R001D8RCZ9 dependency check: 081KQ8P5D0008QG0R003KFRGJ0 is open (P1); 081KQ8P5D0008QG0R0023ABK2C acceptance says "whichever ships first satisfies the row." 081KQ8P5D0008QG0R0023ABK2C is the faster path.

Dependency restructure:

- `depends_on: []` — no blockers.
- `composes_with: [081KQ8P5D0008QG0R003KFRGJ0, 081KQ8P5D0008QG0R001D8RCZ9]` — both noted below.

Proof of work (2026-05-10):

- `tools/hygiene/normalize-memory-index-entries.ts` written (Rule 0 compliant TS).
- Applied to `memory/MEMORY.md`: 190 bullet entries normalized from mixed lengths to ≤200 chars each.
- 0 bullet entries remain >200 chars. Only L3 (non-bullet fast-path header, 557 chars) is outside scope.
- Build gate: `dotnet build -c Release` → 0 Warning(s), 0 Error(s).

## Composes with

- 081KQ8P5D0008QG0R003KFRGJ0 — auto-generated MEMORY.md index (structural fix that
  eliminates this discipline-drift class)
- 081KQ8P5D0008QG0R001D8RCZ9 — cadenced git-hotspot detector (catches MEMORY.md
  cascade events as a measurable signal)
- `memory/feedback_natural_home_of_memories_is_in_repo_now_all_types_glass_halo_full_git_native_2026_04_24.md`
  (user-scope only) — the directive that makes in-repo
  MEMORY.md the canonical index

## Acceptance

- All `memory/MEMORY.md` entries fit one terminal-width line
  (≤200 chars including markdown markup), OR
- 081KQ8P5D0008QG0R003KFRGJ0 ships the auto-generated replacement and this row
  becomes moot.

Whichever ships first satisfies the row.

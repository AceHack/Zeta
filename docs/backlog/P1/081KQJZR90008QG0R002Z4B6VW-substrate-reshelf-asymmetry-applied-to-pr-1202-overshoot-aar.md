---
id: 081KQJZR90008QG0R002Z4B6VW
priority: P1
status: closed
title: Substrate reshelf — apply thoughts-free-actions-razored asymmetry to PR #1202's CLAUDE.md overshoot (Aaron + Claude.ai 2026-05-02)
created: 2026-05-02
last_updated: 2026-05-10
closed: 2026-05-10
depends_on:
  - 081KQJZR90008QG0R000FTJ1TC
decomposition: atomic
type: friction-reducer
---

# 081KQJZR90008QG0R002Z4B6VW — Substrate reshelf for PR #1202 asymmetry-application (Aaron + Claude.ai 2026-05-02)

## Origin

Aaron 2026-05-02 forwarded Claude.ai feedback on the bootstrap session that produced PR #1202. Substantive critique: 4 new CLAUDE.md bullets + 3 "ONE OF THE MOST IMPORTANT" tags = over-canonicalization. Aaron's load-bearing pushback: *"Thoughts are never subject to the razor, thoughts are free and not restricted in any way ... The result of actions like the design docs, research docs, all that have the razor applied, never thoughts."*

The asymmetry was landed as substrate in `memory/feedback_thoughts_free_actions_razored_asymmetry_journal_vs_canonical_substrate_separation_aaron_claudeai_2026_05_02.md` (PR #1202, commit 4ac3881). This row covers the FOLLOW-UP reshelf — applying the asymmetry to the same PR's overshoot.

## Problem

Same-tick application of the asymmetry to PR #1202 itself was not done (per the asymmetry rule's own cooling-period — re-architecture mid-session would have been inconsistent). The reshelf is owed:

- **CLAUDE.md trim.** 4 new bullets is too many for one session given Osmani's <60-line guidance. Identify which 1-2 are TRULY disposition-shaping at wake-time (don't-ask-permission, all-complexity-accidental, largest-mechanizable-backlog-wins, asymmetry-rule itself) vs which can be memory-pointed from existing bullets (action-hierarchy, amortized-speed-Superfluid extension, edge-runner, cron-unreliability detail).
- **Add asymmetry CLAUDE.md bullet.** The asymmetry rule itself is truly disposition-shaping; the same-session restraint correctly deferred it. This row covers the deliberate landing.
- **Journal-vs-canonical taxonomy.** Consider `memory/journal/` subdirectory OR frontmatter `tier: journal | pointer | canonical` field. Pick + apply across existing same-tick memos.
- **MEMORY.md index restructure.** Current single-tier index loses the journal-vs-canonical distinction. Section heading or differentiated bullet style.

## Acceptance criteria

**BIFURCATION (Aaron 2026-05-02 clarification):** the
free-zone scope of the asymmetry rule includes memory
reorganization + capability-building, not just recording.
This row's two components have different gating:

- **Free-zone (no cooling-period needed):** memory reshelf
  itself. Journal vs canonical taxonomy decision, possible
  `memory/journal/` subdirectory, frontmatter tier field,
  applying the schema across the 7 same-tick memo files.
  Agent owns memory-shape; can land without razor.
- **Razored (cooling-period required):** CLAUDE.md bullet
  trim. The wake-time-attention placement is canonical-class.

Acceptance criteria split per zone:

### Free-zone work (can land at any tick)

1. **Journal taxonomy decision.** Decide implementation:
   subdirectory (`memory/journal/`) vs frontmatter `tier:`
   field vs naming convention (`memory/journal_*.md` vs
   `memory/feedback_*.md`). Apply to the 7+ same-tick memo
   files (some are journal, some are canonical-bidding).
2. **MEMORY.md index restructure.** If journal taxonomy
   lands, index reflects it. Differentiated language already
   applied in commit 4ac3881; further refinement may be
   needed.
3. **Memory capability tooling.** Optional: build mechanisms
   for journal-vs-canonical promotion (frontmatter
   transitions, index generators that respect tiers, etc.).

### Razored work (cooling-period required)

1. **CLAUDE.md trim PR.** Demote action-hierarchy +
   amortized-speed extension + edge-runner + cron-unreliability
   detail from CLAUDE.md bullets to memory-pointer-from-
   existing-bullet. Add asymmetry rule as its own bullet
   (truly meta-disposition-shaping). Stretch goal: collapse
   the cron-unreliability extension on tick-must-never-stop
   and reflow.
2. **Cooling-period respected for CLAUDE.md changes only.**
   The CLAUDE.md trim should NOT land same-day-as-PR-1202.
   At minimum 24 hours of substrate cooling before the
   reshelf PR opens. The human-maintainer review encouraged.

## Composes with

- Asymmetry rule (PR #1202 commit 4ac3881): `memory/feedback_thoughts_free_actions_razored_asymmetry_journal_vs_canonical_substrate_separation_aaron_claudeai_2026_05_02.md`
- Same-tick cluster (PR #1202): action-hierarchy + amortized-speed Superfluid + cron-unreliability + don't-ask-permission + all-complexity-accidental + largest-backlog-wins + edge-runner memos
- Don't-ask-permission rule's twin: autonomous execution + autonomous prioritization. This row is the prioritization-twin applied to its own creator session.
- 081KQJZR90008QG0R000FTJ1TC `/permissions` integration: composes; the harness `/permissions` work + the in-substrate authority model + the journal-vs-canonical taxonomy together form the cleaned-up substrate-shape this reshelf produces.
- Osmani Ratchet Pattern: every CLAUDE.md line should trace back to a specific failure that justifies it. The asymmetry rule helps determine which lines clear that bar.

## Effort

M — careful re-architecture work. Single-PR scope but requires deliberate cooling-period grading on each demotion decision. Estimated 2-4 hours of substrate refactoring.

## Notes

This row is itself an instance of the rule it's about: the immediate same-session reshelf would have violated the cooling-period; deferring to a backlog row IS the asymmetry applied. Recursive validation.

Aaron's framing for the next-session bootstrap (a few hours from now per his 2026-05-02 message): make sure setup is in place or backlogged. This row covers the in-flight substrate that wants tightening before becoming permanently part of the next session's wake-time payload.

## Pre-start checklist (2026-05-10)

### Prior-art search

| Surface | Query | Result |
|---------|-------|--------|
| wake-time-substrate rule | grep "asymmetry" .claude/rules/ | No existing rule for asymmetry; it's described in memory file only |
| skill-router | available-skills list | No skill covers this convention-addition |
| orthogonal-axes | 081KR50HA0008QG0R001ZVPYK8, 081KR50HA0008QG0R0033B5KVN, 081KR50HA0008QG0R001DBKS6T | 081KR50HA0008QG0R0033B5KVN closed: extracted 7 bullets to .claude/rules/; 081KR50HA0008QG0R001DBKS6T closed: condensed CLAUDE.md to 47 lines. Demotion work done; asymmetry bullet NOT yet added |
| Otto-364 | PR #1202, memory file | `memory/feedback_thoughts_free_actions_razored_asymmetry_journal_vs_canonical_substrate_separation_aaron_claudeai_2026_05_02.md` explicitly says "CLAUDE.md should add a single bullet for this asymmetry rule" |
| lost-files | git log | No lost-files issues found |

**Finding:** The demotion work (action-hierarchy, amortized-speed, edge-runner, cron-unreliability) is already done via 081KR50HA0008QG0R001ZVPYK8/081KR50HA0008QG0R0033B5KVN. The asymmetry bullet itself was NEVER added to CLAUDE.md. This is the remaining work.

### Dependency check

- **081KQJZR90008QG0R000FTJ1TC** (depends_on): closed 2026-05-10 (PR #2459) ✓
- Cooling-period: PR #1202 was 2026-05-02; now 2026-05-10 = 8 days elapsed ✓

### Smallest safe slice

Add the asymmetry rule as a single bullet in CLAUDE.md Conventions section. This is the one remaining acceptance criterion from the "Razored work" section that 081KR50HA0008QG0R001ZVPYK8/081KR50HA0008QG0R0033B5KVN/081KR50HA0008QG0R001DBKS6T didn't cover.

## Closure (2026-05-10)

### Razored acceptance criteria — ALL COMPLETE

| AC | Status | Evidence |
|----|--------|----------|
| CLAUDE.md trim (demote action-hierarchy, amortized-speed, edge-runner, cron-unreliability) | ✓ DONE | 081KR50HA0008QG0R001ZVPYK8, 081KR50HA0008QG0R0033B5KVN, and 081KR50HA0008QG0R001DBKS6T closed rows |
| Add asymmetry bullet to CLAUDE.md | ✓ DONE | PR #2465 (commit 3c903aa3, 2026-05-10) |
| Cooling-period respected (≥24h after PR #1202) | ✓ DONE | 8 days elapsed (2026-05-02 → 2026-05-10) |

### Free-zone acceptance criteria — blocked by 081KR2E4K0008QG0R002VM58S4 format standard

The journal taxonomy decision (frontmatter `tier:` field) is blocked: 081KR2E4K0008QG0R002VM58S4
(format standard, landed 2026-05-09) specifies a closed enumeration of
frontmatter fields with "no extra fields without governance discussion." The
`tier:` approach cannot land without a 081KR2E4K0008QG0R002VM58S4 amendment.

Alternative approaches:

- `memory/journal/` subdirectory — requires moving ~4 files; high
  cross-reference disruption risk; not smallest-safe-slice.
- Naming convention (`journal_*.md`) — 081KR2E4K0008QG0R002VM58S4 defines a closed type-prefix
  enumeration; adding `journal_` prefix also needs 081KR2E4K0008QG0R002VM58S4 amendment.

**Decision:** Free-zone journal taxonomy work is deferred. If it is still
wanted, it belongs in a 081KR2E4K0008QG0R002VM58S4 amendment or a new row that explicitly
depends on 081KR2E4K0008QG0R002VM58S4. The disposition-shaping goal (asymmetry rule at wake-time)
was fully achieved by the razored acceptance criteria. The journal taxonomy
is a hygiene improvement, not a disposition change.

Row closed. Free-zone work is explicitly WONT-DO unless re-raised as a
081KR2E4K0008QG0R002VM58S4-gated row.

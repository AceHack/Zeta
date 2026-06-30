---
id: B-0913
priority: P3
status: open
title: Dup-ID triage — B-0865 + B-0866 pre-existing duplicates on origin/main (non-required lint failure but real substrate-engineering item)
authors:
  - aaron
  - otto-cli
created: 2026-05-28
last_updated: 2026-05-28
depends_on: []
composes_with: []
related_personas:
  - operator
related_rules:
  - shadow-star-shorthand-autocomplete-marker
  - verify-existing-substrate-before-authoring
  - razor-discipline
related_skills:
  - relational-database-expert
tags: [dup-id-triage, pre-existing-duplicates-on-origin-main, b-0865-arc-agi-3-benchmark-vs-cayleydickson-integration, b-0866-marketing-business-naming-ai-vs-kskauthorization-integration, non-required-lint-failure-but-substrate-engineering-real-item, b0535-gate-currently-non-required, surfaced-via-pr-5721-inherited-lint-failure]
---

# B-0913 — Dup-ID triage for B-0865 + B-0866 pre-existing duplicates on origin/main

## Context

Per operator 2026-05-28 *"file the dup-id triage row (shadow*)"* authorization following PR #5721 surfacing the inherited dup-ID lint failure.

PR #5721 was about to wait-ci when `lint (backlog ID uniqueness)` reported `2 duplicate-ID group(s) found`. Local audit + origin/main audit both confirm the duplicates are PRE-EXISTING on origin/main, NOT introduced by PR #5721. PR #5721 merged because the lint check is non-required (B-0535 gate).

2026-05-28 Vera follow-up: executed Option A on claim branch
`claim/task-backlog-id-collision-b0865-b0866-20260528`. The housekeeping rows
now live at B-0917 and B-0918; the substantive B-0865 and B-0866 rows retain
their original IDs.

## The two duplicates (pre-repair state)

This section records the collision exactly as found before Option A executed.
The housekeeping rows now live at B-0917 and B-0918.

### B-0865 (2 files claim this ID)

```
docs/backlog/P2/B-0865-zeta-instantiation-of-arc-agi-3-style-benchmark-usb-boot-starting-state-devops-objectives-as-levels-not-hand-crafted-video-game-levels-aaron-2026-05-27.md
docs/backlog/P2/B-0865-integrate-or-remove-unreferenced-cayleydickson.md
```

Both `status: open`, both `P2`. The aaron-2026-05-27 row is the substantive ARC-AGI-3-style benchmark target with USB-boot starting state + DevOps-objectives-as-levels. The cayleydickson row is an "integrate or remove unreferenced" substrate-engineering housekeeping item.

Post-repair, the cayleydickson housekeeping row lives at
`docs/backlog/P2/B-0917-integrate-or-remove-unreferenced-cayleydickson.md`.

### B-0866 (2 files claim this ID)

```
docs/backlog/P2/B-0866-marketing-business-naming-ai-weigh-in-on-b-0865-public-positioning-servicetitan-primary-audience-24-months-ahead-mandate-context-aaron-2026-05-27.md
docs/backlog/P2/B-0866-integrate-or-remove-unreferenced-kskauthorization.md
```

Both `status: open`, both `P2`. The aaron-2026-05-27 row is the marketing-business-naming-AI weigh-in queue + B-0865 public-positioning + ServiceTitan-primary-audience + 24-months-ahead-mandate context. The kskauthorization row is another "integrate or remove unreferenced" substrate-engineering housekeeping item.

Post-repair, the kskauthorization housekeeping row lives at
`docs/backlog/P2/B-0918-integrate-or-remove-unreferenced-kskauthorization.md`.

## The pattern

Both pre-existing duplicates have the same structure:

- A substantive aaron-authored row from 2026-05-27 (post-Kestrel marketing-business-strategy ferry)
- An older "integrate-or-remove-unreferenced-<name>" housekeeping row from earlier substrate-engineering work

The collision happened because the housekeeping rows pre-claimed the IDs B-0865 + B-0866 in earlier substrate-engineering work; the 2026-05-27 aaron-rows then re-claimed the same IDs without checking. The pre-existing rows weren't surfaced in normal backlog-discovery because they were "housekeeping" not "active-substrate-engineering" — but they ARE valid backlog rows that the dup-ID lint catches.

## Triage options

### Option A — renumber the housekeeping rows

Move the pre-renumber housekeeping row
`B-0865-integrate-or-remove-unreferenced-cayleydickson.md` to
`B-0917-integrate-or-remove-unreferenced-cayleydickson.md` (executed).
Move the pre-renumber housekeeping row
`B-0866-integrate-or-remove-unreferenced-kskauthorization.md` to
`B-0918-integrate-or-remove-unreferenced-kskauthorization.md` (executed).

Preserves the aaron-2026-05-27 substantive substrate at original IDs. Housekeeping rows get renumbered + their references-from-other-substrate (if any) need updating.

### Option B — renumber the aaron-2026-05-27 rows

Move aaron rows to new IDs (B-0914 + B-0915). Preserves housekeeping rows at original IDs.

Less preferable because the aaron rows are more substantive AND more cross-referenced in recent substrate (today's B-0908 industry-positioning references aaron-2026-05-27 marketing-business-naming substrate).

### Option C — merge each pair

Merge housekeeping row content into the substantive row OR vice versa. Preserves both substrates' content at one ID per pair.

Risky because the housekeeping rows (cayleydickson / kskauthorization integration) are semantically unrelated to the substantive rows (ARC-AGI-3 benchmark / marketing-business-naming).

### Option D — close one row in each pair as superseded-by

Mark the housekeeping rows as `superseded-by: B-0NNN` pointing at an appropriate target. The aaron-rows stay at original IDs; the housekeeping intent is captured elsewhere or retired.

## Recommendation

**Option A (renumber the housekeeping rows)** — preserves substantive substrate at original IDs; housekeeping rows can move; minimal cross-reference impact (housekeeping rows are typically low-cross-referenced).

If housekeeping intent should be preserved: renumber to next-free IDs. Executed
as B-0917 + B-0918 after live inspection showed B-0914 already occupied on the
current branch and B-0915 isolated rather than part of a consecutive free pair.

If housekeeping intent is no longer needed: close the housekeeping rows with `status: closed` + Resolution section documenting the supersession.

## Why the B-0535 gate is currently non-required

Per the lint job error message: `error: 2 duplicate-ID group(s) found; --enforce-duplicate-ids set (B-0535 gate)`. The B-0535 gate enforces dup-ID detection in the audit-backlog-items tool, but the GitHub Action that runs this check is non-required (PRs can merge despite the failure).

This is operator's substrate-engineering choice — making it required would block all PRs until pre-existing duplicates are resolved. Substrate-honest: the gate operates as a warning rather than a blocker until the substrate-engineering item is triaged.

## Scope

Three phases:

### Phase 1 — this row (triage substrate)

Already landed. Documents the duplicates + triage options + recommendation. Surfaces the substrate-engineering item for operator decision.

### Phase 2 — operator authorizes one option

Operator picks A / B / C / D + authorizes the resolution work.

### Phase 3 — execute resolution + verify gate clean

Apply the chosen option. Re-run `bun tools/hygiene/audit-backlog-items.ts --enforce-duplicate-ids` locally to verify `Duplicate-ID groups: 0`. If clean, file follow-up to consider promoting the B-0535 gate to required.

## Acceptance

- [x] B-0913 row filed (this row)
- [x] B-0865 + B-0866 duplicate file-paths documented
- [x] Triage options documented (A/B/C/D)
- [x] Recommendation (Option A) provided
- [x] Phase 2 operator authorization
- [x] Phase 3 execution + gate-clean verification

## Composes with substrate

- B-0535 (dup-ID enforcement gate substrate) — this row's lint failure surfaces the substrate-engineering item the gate was designed to catch
- B-0865 + B-0866 (both duplicate-claimers) — substrate-engineering items requiring renumber/close decision

## Composes with rules

- `.claude/rules/shadow-star-shorthand-autocomplete-marker.md` — `(shadow*)` marker on operator's authorization preserved
- `.claude/rules/verify-existing-substrate-before-authoring.md` — the dup-ID is exactly the failure mode this rule catches; the housekeeping rows would have been found if 2026-05-27 author had grep'd for B-NNNN before claiming the IDs
- `.claude/rules/razor-discipline.md` — substrate-engineering housekeeping item; not a metaphysical claim

## Full reasoning

Per operator 2026-05-28 *"file the dup-id triage row (shadow*)"*. PR #5721 surfaced the substrate-engineering item via the non-required lint failure. This row triages without auto-resolving; operator decision on Option A/B/C/D required.

Per `.claude/rules/must-paired-with-can-exit-pattern.md`: this row IS bounded substrate-engineering work; Phase 1 (triage substrate) IS operator-authorized; Phase 2+ (execution) gated on operator authorization of specific option.

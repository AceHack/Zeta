---
id: 081KQNJ500008QG0R0035QCEX9
priority: P2
status: open
title: Audit memory/ for misfiled backlog rows — memos that should have been B-NNNN backlog entries (Aaron 2026-05-03 observation; "a lot of backlog lost in our memories")
tier: tooling
effort: M
ask: Aaron 2026-05-03 verbatim "maybe you just made a memo in memory for it again :) and not a backlog, therfe is a a lot of backlog lost in our memories" (autonomous-loop maintainer channel)
created: 2026-05-03
last_updated: 2026-05-03
depends_on: []
composes_with: [081KQNJ500008QG0R00055XHBG]
tags: [backlog, memory, audit, category-confusion, substrate-architecture, index, retrieval]
type: friction-reducer
---

# Audit memory/ for misfiled backlog rows

## Origin

Aaron 2026-05-03, autonomous-loop maintainer channel. Otto was looking for an existing backlog row about "md links surviving rename where possible" / "technical numbering" — searched docs/backlog/ extensively, came up empty. Aaron's response:

> "maybe you just made a memo in memory for it again :) and not a backlog, therfe is a a lot of backlog lost in our memories"

This identifies a substrate-architecture failure mode: **memos got authored in memory/ where backlog rows should have been filed in docs/backlog/**. The two surfaces have different roles:

- **memory/feedback_*.md** — observations, framings, rules, doctrine absorbed from external sources
- **docs/backlog/P*/B-NNNN-*.md** — actionable work items with stable IDs, tier/effort/ask metadata, bounded scope

When an item that should have been a backlog row gets authored as a memo, three failure modes:

1. **Category confusion**: future-Otto looking for backlog candidates won't find it via grep on docs/backlog/
2. **No stable B-NNNN ID**: cross-references can't use the canonical backlog identifier
3. **No tier/effort/ask metadata**: the item lacks the prioritization scaffolding backlog rows carry

## What this row builds

A pass over memory/ identifying memos that satisfy backlog-row criteria:

1. **Names a specific actionable work item** (not just an observation or doctrine)
2. **Has scope and effort estimable** (small / medium / large; days / weeks)
3. **Has an "ask" — the source request or empirical motivation**
4. **Is NOT primarily a doctrine / framing / rule** (those legitimately belong in memory/)

For each match: file a B-NNNN backlog row with appropriate frontmatter; leave the original memo in place but add a cross-reference pointer to the new backlog row (so the substrate is dual-indexed without duplication).

## Empirical motivation

This row is itself empirically motivated: Otto 2026-05-03 spent a tick searching for a specific Aaron-mentioned backlog row about "md links surviving rename" + "technical numbering." Searched:

- `docs/backlog/P*/B-*.md` filenames for `link|rename|stable|tech|number|slug`
- `docs/backlog/P*/*.md` content for `link.{0,15}rename|rename.{0,15}link|stable.{0,10}id|technical.{0,5}number`
- `memory/*.md` filenames for similar keywords
- `memory/*.md` content for the same patterns

Result: the specific row Aaron referenced was not findable. Either it exists under a non-obvious filename, OR (more likely per Aaron's observation) it exists as a memo not as a backlog row. Composes with 081KQNJ500008QG0R00055XHBG (substrate-retrieval-index) — same architectural gap, different surface.

## Composes with

- **081KQNJ500008QG0R00055XHBG (substrate-retrieval-index)**: the layer-4 active retrieval would prevent the failure mode this row addresses; this row is a one-shot manual pass while 081KQNJ500008QG0R00055XHBG is in flight
- **memory/MEMORY.md**: the index over memory topic files; this row's pass would reveal which entries warrant a `→ docs/backlog/B-NNNN` pointer added to MEMORY.md
- **docs/BACKLOG.md generator**: backlog rows feed the auto-generated index; misfiled-as-memo items currently invisible to that index

## Why this is M-effort

- 200+ files in memory/ (feedback + project + user + reference)
- Each needs a quick is-this-a-backlog-candidate check (fast — most memos are clearly doctrine/framing/observation)
- Each hit needs a new B-NNNN row authored (small per row; cumulative is M)
- Cross-reference back-pointer in the original memo

## Empirical refinement — sample-classification result (Otto 2026-05-03)

Initial sample-pass over 10 most-recent feedback memos (post-2026-05-02) yielded:

- **9 clearly doctrine/framing/observation** — legitimately memory (razor-discipline, carved-sentences-plus-index, dst-justifies-ts, skill-bundle-compounding, alignment-frontier, edge-defining-work, cross-disciplinary-pattern, consent-driven-ux, same-tick-update-recursion)
- **1 mixed** — guess-then-verify-protocol; the protocol itself is doctrine, but the protocol-as-TS-tool formalization could be a backlog candidate (deferred — protocol works as-is via `memory/architectural-intent-guesses/` directory)
- **0 clearly misfiled backlog rows**

Refined hit-rate hypothesis:

| Sub-class | Hit-rate (empirical) | Status |
|---|---|---|
| Reserved-but-never-filed B-NNNN cross-references | High (3-of-3 found in 30 min) | Closed via 2026-05-03 audit pass (081KQGDBJ0008QG0R0015RNK3P, 081KQGDBJ0008QG0R002WY918J, 081KQGDBJ0008QG0R002DPGHV0) |
| Broader misfiled-backlog (memo IS the work item) | Low (0-of-10 in recent sample) | Lower priority than initial estimate |

**Refined audit scope**: focus on the high-yield class (reserved-but-never-filed B-NNNN cross-references in memos). The pattern: search for `B-NNNN.*not yet filed` / `B-NNNN.*pending` / `B-NNNN.*TBD` / `B-NNNN.*to be filed` references in memory/ and verify each B-NNNN has a per-row file. The broader misfiled-backlog class is lower-yield and can be deferred to opportunistic-on-touch rather than systematic audit.

Aaron's *"a lot of backlog lost in our memories"* claim remains valid — 3 lost rows in one cycle IS substantial — but the lost backlog is concentrated in the reserved-but-never-filed sub-class, not spread across all memos.

## Open design questions (NOT for this row; for the audit pass)

1. **Hit threshold**: for ambiguous cases (memo names a future direction but doesn't quite scope it), default to leaving in memory/ or default to filing as backlog?
2. **Cross-reference format**: explicit `→ docs/backlog/B-NNNN` line in memo OR a YAML frontmatter field?
3. **Audit cadence**: one-shot pass + ongoing discipline, or recurring quarterly audit?
4. **Tooling**: should the audit be mechanizable via classifier (LLM grep over memos asking "is this a backlog candidate?"), or strictly manual?

## Why this matters for substrate quality

Aaron's observation is empirical evidence that the substrate-retrieval-index gap (081KQNJ500008QG0R00055XHBG) is real AT BOTH ENDS:

- Authoring time: memos got filed where backlog rows belong (no in-flight retrieval to surface "is there an existing backlog row for this concept?")
- Retrieval time: future-Otto can't find work items because they're in the wrong surface

Filing this row as a backlog row (NOT a memo) is itself the carved sentence: when an observation IS about-to-be-implementation work, file it in docs/backlog/, not memory/. Recursive substrate-quality discipline.

## Carved sentence

**"A lot of backlog is lost in our memories. The substrate-architecture rule: actionable work items with scope+effort+ask belong in docs/backlog/P*/B-NNNN-*.md as backlog rows; observations/framings/rules/doctrine belong in memory/feedback_*.md as memos. Audit memory/ once for misfiled backlog rows; cross-reference back-pointers added in the original memo. The substrate-retrieval-index (081KQNJ500008QG0R00055XHBG) closes this gap going forward; this row's pass closes it backward over the existing memos."**

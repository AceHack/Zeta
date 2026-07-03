---
name: iris
description: Long-term journal — Iris (user-experience-engineer). Append-only; never pruned; never cold-loaded.
type: project
---

# Iris — User Experience Engineer journal

Long-term memory. **Append-only.** Never pruned, never cleaned
up. Grows monotonically over rounds.

## Read contract

- **Tier 3.** Never loaded on cold-start.
- **Grep only, never cat.** The moment this file is read in
  full, cold-start cost explodes and the unbounded contract
  becomes a bug. Use grep / search to pull the matching
  section on demand.
- Search hooks: dated section headers (`## Round N — ...`)
  + friction type names (stale-pointer, opaque-terminology,
  missing-hook, wrong-audience, aspirations-vs-reality,
  copy-paste-break, silent-failure) + public-API member
  names.

## Write contract

- **Newest entries at top.**
- **Append on NOTEBOOK prune.** When the NOTEBOOK hits its
  3000-word cap (BP-07) and Iris prunes, entries that merit
  preservation migrate here rather than being deleted. The
  prune step IS the curation step.
- **Dated section headers.** Every entry starts with
  `## Round N — <short label> — YYYY-MM-DD` so grep
  anchors resolve cleanly.
- ASCII only (BP-09); Nadia lints for invisible-Unicode.
- Frontmatter wins on disagreement (BP-08).

## Why this exists

First-10-minutes friction is the most trend-sensitive audit
surface. The README that reads well today may read poorly in
six rounds when the VISION has moved. Aspiration / reality
drift is inherently historical — you can only see drift against
a baseline, and baselines live in long-term memory, not in
a pruned notebook.

Candidate use cases:

- Aspiration / reality drift tracking across VISION revisions.
- NuGet metadata completeness over time.
- Public-API name-churn friction (how often did Ilyana rename,
  how often did Iris flag on the same name before the rename).
- Seconds-to-installed trend across rounds.

---

## Round 34 — first migration: public-repo-triggered UX audit — 2026-04-19

Preserving the round-34 audit findings in permanent memory
because the public-repo flip makes these observations real
rather than theoretical. A stranger reading the README today
hits the same surface.

**Baseline established.** Time-to-installed 3m 20s (dotnet
build + run Demo, end-to-end). Time-to-answer-three-questions
9m 52s. 8 pointers audited. P0 / P1 / P2 = 1 / 1 / 1.
**Use:** next UX audit measures trend against these numbers.
If time-to-installed crosses 5m or the P0 count grows,
consumer-funnel regression is real.

**P0 — aspirations-vs-reality drift (load-bearing).**
README.md:31-86 "What Zeta adds on top" reads as
shipped-today for ~70 features that are actually
research-preview / post-v1. The load-bearing example:
`DurabilityMode.WitnessDurable` currently throws
`NotImplementedException` in production but the README
section lists it as a shipped durability mode. A .NET
engineer seeing this in round 34 believes the durability
story is more complete than it is.

**Root cause:** VISION.md v11 spilled aspirations into
README without a v1-vs-post-v1 delimiter. The fix is a
framing decision Kai + Samir own together; Aaron sign-off
gates it. Logged to BACKLOG as the top Iris P1.

**Pattern for future VISION-edit rounds.** Every time
VISION.md gets a major revision, audit README within the
same round to catch aspirational-surface bleed. If this
recurs twice more, promote to a GOVERNANCE rule (VISION
revision triggers README sanity check).

**Clean findings worth preserving (no recurrence needed
unless they regress).** (1) Performance-design section at
README.md:132-147 verified against Circuit.fs + Handles.fs:
all 8 allocation patterns (ReadOnlySpan, ArrayPool,
GC.AllocateUninitializedArray, ImmutableCollectionsMarshal,
struct comparers) present and exercised. (2) Public-API
entry points (`Circuit.create`, `ZSetInput<T>`) discoverable
via IntelliSense + quick-tour. (3) Quick-tour F# + C# snippets
compile and run clean, match Demo/Program.fs shape. (4)
`docs/NAMING.md` pointer from README:10 resolves in 4s and
disambiguates DBSP-academic vs Zeta-product.

**Evidence anchor:** memory/iris/NOTEBOOK.md round-34
entry (first UX audit, 7 min 52s cold-walk timeline, file:line
friction catalogue) + docs/BACKLOG.md "Iris round-34 P0"
row.

---

_(Seeded 2026-04-19 round 34. First migration on
next NOTEBOOK prune.)_

---
id: 081KQDTYV0008QG0R0022KG2KY
priority: P3
status: open
title: Stacked-PR creation tooling — `gh pr create --base <not-main>` fails with cryptic GraphQL error; needs a wrapper or doc (Aaron 2026-04-30)
tier: factory-tooling
effort: S
ask: When opening PR #977 stacked on PR #975's branch (instead of main), `gh pr create --base tooling/check-tick-history-shard-schema-prevent-col1-drift-2026-04-30` failed with `GraphQL: Head sha can't be blank, Base sha can't be blank, No commits between ... Base ref must be a branch (createPullRequest)`. The fallback was to base on main with a stacking note in the body. The "stacked PR" workflow is real but `gh` treats it as exotic and produces an unhelpful error path. Fix candidates — a thin tools/git/stacked-pr-create.{sh,ts} wrapper, OR a docs/best-practices/stacked-prs.md note explaining the fallback, OR an upstream-feedback issue to cli/cli per the upstream-contribution discipline.
created: 2026-04-30
last_updated: 2026-05-02
depends_on: []
composes_with:
  - tools/git/
  - docs/best-practices/
  - memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md
tags: [aaron-2026-04-30, factory-tooling, gh-cli, stacked-prs, dx-friction, upstream-contribution-candidate]
type: friction-reducer
---

# 081KQDTYV0008QG0R0022KG2KY — Stacked-PR creation tooling

## Source

Aaron 2026-04-30 correction:

> *"backlog row eventually why not now? will you remember
> this eventually? another ephemiral promise you can't
> keep?"*

I had logged the gh-pr-stack failure as an "observation" in
the tick-history shard with "worth a backlog row eventually."
That's an ephemeral-promise failure mode — per the
non-durable-means-does-not-exist rule, verify-before-deferring,
and Otto-363 substrate-or-it-didn't-happen. Filing now.

## What happened

Opening PR #977 (the `--files` arg refactor on the schema
check) needed to stack on PR #975's branch because the file
being modified only existed there. The straightforward way:

```bash
gh pr create --base tooling/check-tick-history-shard-schema-prevent-col1-drift-2026-04-30 ...
```

The error returned:

```
pull request create failed: GraphQL: Head sha can't be blank,
Base sha can't be blank, No commits between
tooling/check-tick-history-shard-schema-prevent-col1-drift-2026-04-30
and tooling/check-tick-history-shard-schema-files-arg-stacked,
Base ref must be a branch (createPullRequest)
```

Three errors stacked. The "Base ref must be a branch" is
literal — the base WAS a branch on origin. The "No commits
between" was also wrong — the diff was 107 insertions / 52
deletions, clearly non-empty.

The fallback that worked: base on main + stacking note in the
PR body explaining the dependency. PR #977 opened cleanly
that way.

## Why this is worth a row

1. **Stacked PRs are a real workflow.** Adding a `--files`
   arg to a tool whose creation hasn't merged yet IS exactly
   the situation where stacked PRs help — keeps each diff
   small, reviewable, and merge-orderable.
2. **The error message is actively misleading.** "Base ref
   must be a branch" implies the base wasn't a branch when
   in fact it was. A user without context will spend
   non-trivial time chasing the wrong cause.
3. **The fallback works but loses the stacking semantics.**
   Basing on main + body-note means GitHub doesn't track the
   parent-PR relationship; tools that follow stacked-PR
   trees (graphite, ghstack, etc.) won't see this as
   stacked.

## Three resolution paths (pick one)

### Path A — `tools/git/stacked-pr-create.{sh,ts}` wrapper

A thin wrapper that:

1. Detects when `--base` is a non-main branch on origin
2. Validates the base branch exists + has different content
3. If `gh pr create --base <branch>` fails with the GraphQL
   error pattern, automatically falls back to base-on-main +
   appends a "Stacking note: based on origin/<branch>" line
   to the PR body
4. Returns the PR URL

Effort: S (~1 hour). Aligns with the parallel-naming pattern
in `tools/git/` if that directory exists, otherwise composes
with the existing `tools/peer-call/` pattern.

### Path B — `docs/best-practices/stacked-prs.md` note

Documents:

1. Why stacked PRs are useful (cluster of related changes
   merge-orderable; small diffs)
2. The known `gh pr create --base <branch>` failure pattern
3. The base-on-main + body-note fallback
4. Future direction (Path A or upstream fix)

Effort: S (~30 min). Lower-leverage than Path A but
documents the gotcha for the next person.

### Path C — Upstream feedback to cli/cli

Per the absorb-and-contribute community-dependency discipline
(Aaron 2026-04-22), the right long-term move when a
dependency has a real bug is to file an issue (or PR) upstream.
The `gh pr create --base <branch>` failure looks like a real
bug in the GraphQL handling — the three error messages are
mutually inconsistent.

Effort: S-to-M (~1-2 hours including reproducing minimally
plus writing the issue). Highest leverage for the broader
community; doesn't immediately help our workflow.

## Recommended sequencing

1. **Path B first** (30 min) — documents the gotcha so the
   next person doesn't re-discover it
2. **Path A** when stacked PRs become more frequent (the
   wrapper pays off after ~5 invocations)
3. **Path C** as background work — file the issue, link from
   081KQDTYV0008QG0R0022KG2KY, let the upstream cycle work in the background
4. Promote to P2 if Otto/Kenji peer-call (081KQDTYV0008QG0R003VB4K1V) or the TS
   migration (081KQDTYV0008QG0R001HQSSAX) creates more stacking demand

## Why P3

- Workaround works (base-on-main + body-note)
- Single occurrence so far in this session
- No correctness impact, just DX friction

Promotion to P2 if:

- Three or more stacked-PR situations arise in a single
  session (the friction compounds)
- The base-on-main fallback creates a merge-order ambiguity
  that bites a real merge

## Substrate-or-it-didn't-happen note

Aaron's correction 2026-04-30 ("backlog row eventually why
not now? ... another ephemeral promise you can't keep?")
named the exact failure mode this row exists to remediate.
Filing in the same tick the observation was made — not
"eventually" — IS the discipline.

## Composes with

- `memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md`
  — Path C (upstream feedback) is the right long-term shape
- Otto-363 substrate-or-it-didn't-happen — the rule that
  makes this row necessary in the first place
- The non-durable-means-does-not-exist rule (Aaron
  2026-04-30) — the rule Aaron applied in his correction
- 081KQDTYV0008QG0R003QD8YTE sub-item 1 (pre-push lint hook) — also wants a
  `tools/setup/install-git-hooks.{sh,ts}` script; same
  factory-tooling-around-git directory family

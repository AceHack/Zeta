---
id: B-0112
priority: P2
status: open
title: Stale 2026-04-27 project file internals-bleed-out cleanup
tier: discipline-cleanup
effort: S
ask: deepseek-flag-via-aaron-forward
created: 2026-04-30
last_updated: 2026-05-02
depends_on: []
trigger: any tick that touches memory/project_laptop_only_source_integration_*.md OR any tick that scopes work into ../scratch / ../SQLSharp / ../no-copy-only-learning-agents-insight integration
composes_with:
  - feedback_no_copy_only_learning_from_sibling_repos_aaron_2026_04_30.md
  - project_laptop_only_source_integration_scratch_sqlsharp_features_or_designs_high_priority_2026_04_27.md
tags: [discipline-cleanup, no-copy, sibling-repos]
type: friction-reducer
---

# B-0112 — Stale 2026-04-27 project file internals-bleed-out cleanup

## What

The 2026-04-27 project file
`memory/project_laptop_only_source_integration_scratch_sqlsharp_features_or_designs_high_priority_2026_04_27.md`
predates the 2026-04-30 no-internals-bleed-out discipline
(`memory/feedback_no_copy_only_learning_from_sibling_repos_aaron_2026_04_30.md`).
Its body contains characterizations of `../SQLSharp` and `../scratch`
internals that the new discipline forbids in Zeta documents.

A `status_note:` was added to the file's frontmatter in PR #916
flagging the situation, but Deepseek's review correctly noted
the prose-flag-without-mechanical-trigger anti-pattern: "Queued
where? There's no backlog row, no deferred note in an active
trajectory, no scheduled follow-up... a known gap flagged in
prose, never actioned."

## Why this is filed (not deferred indefinitely)

The discipline is fresh; doing the cleanup later when it's stale
is harder than doing it now. But landing the cleanup-PR mid-round
mid-incident is substrate-rate-incorrect — too many in-flight PRs
already, plus the cleanup needs careful work to extract the
generalizable pattern findings without the specific internals.

So: file as B-0112 with an explicit trigger condition. Future-Otto
hits the trigger naturally when next touching this file or scoping
work into the named sibling directories.

## Trigger condition

Any tick where one of the following is true:

1. The agent edits `memory/project_laptop_only_source_integration_*.md`.
2. The agent scopes new work into `../scratch`, `../SQLSharp`, or
   `../no-copy-only-learning-agents-insight`.
3. The TS+Bun expert baseline (Gate B per task #351 + the
   no-copy-only-learning composition Deepseek named) is being
   drafted and would benefit from references to those siblings.
4. A future round explicitly drains P2 backlog or files
   substrate-rate audit with bandwidth available.

When any trigger fires, the agent does the cleanup pass:

- Re-read the body of the 2026-04-27 file.
- Identify each section that contains characterizations of
  `../SQLSharp` or `../scratch` internals.
- For each section, decide: (a) generalize-and-keep (rewrite to
  the privacy-class generalized-about framing per the no-copy
  discipline), (b) move-to-no-copy-discipline-file (if the
  generalization is itself the discipline content), or (c) drop
  (if the section was internals-only and the generalization adds
  no Zeta-relevant value).
- Land as a single PR with explicit "discipline-aligning rewrite"
  framing.

## What's allowed under the no-copy discipline (refresher)

Generalized "about" framings ARE allowed:

- "a database-related sibling project"
- "a pre-DBSP event-stream-processing prototype"
- "a package-manager seed in the ace-package-manager direction"

What's NOT allowed (privacy-class internals):

- Specific company names, customer names, architecture details
- Specific subdirectory structures or named experiments
- Verbatim or near-verbatim copies of code/design from siblings

The cleanup pass keeps the generalized abouts; rewrites the
specific-internals sections to either generalize or drop.

## Why P2 not P0/P1

The bleed-out is in a memory file that already exists with the
problematic content. The damage (if any) is from existing-state,
not ongoing-state. The new no-copy discipline (PR #916) governs
all NEW substrate going forward; the existing file is a known
exception flagged in its own frontmatter. P2 because:

- Not blocking anything.
- Not actively producing new bleed-out (frozen content).
- Cleanup is mechanical once the trigger fires.
- Aaron's framing was "add specific identifiers MUST stay inside
  the sibling repo" — the existing file's identifiers exist
  inside Zeta but came from before the rule.

If the file becomes load-bearing for new work (e.g., the TS+Bun
expert baseline cites it), promote to P1 at that point.

## Composes with

- `memory/feedback_no_copy_only_learning_from_sibling_repos_aaron_2026_04_30.md`
  (the discipline this cleanup aligns to)
- `memory/project_laptop_only_source_integration_*.md`
  (the file being cleaned up)
- task #351 (TS+Bun expert baseline — composes per Deepseek's
  enhancement-opportunity note)
- Deepseek 4th review (`docs/research/2026-04-30-multi-ai-feedback-packets-this-session.md` § Deepseek — fourth review)
  — the explicit ask that triggered this row

## Acceptance

When the trigger fires AND the cleanup pass lands, mark this row
`status: closed` with reference to the cleanup PR.

If 6 months elapse without the trigger firing, re-evaluate:
either fire the cleanup voluntarily during a quiet round, or
explicitly defer further with a stale-decay note.

---
name: Otto-CLI blob-PR lesson — Maji antigravity caught #4112 mixed shard+rules+memory
description: PR #4112 bundled three artifact types (tick shard, rule edit, memory shadow-catch) into one PR; Maji antigravity check (Lior-gemini) correctly flagged it as a blob per Aaron's one-artifact-one-PR hygiene discipline; the in-narrative cohesive-tick-output justification did not override the discipline
type: feedback
created: 2026-05-17
---

# Otto-CLI blob-PR lesson — Maji antigravity caught #4112 mixed shard+rules+memory

## Observation

[PR #4112](https://github.com/Lucent-Financial-Group/Zeta/pull/4112) (merged at `7ee6411` on 2026-05-17T22:34Z) bundled three artifact types into a single PR:

1. `2cf6fac` — 2207Z tick shard (`docs/hygiene-history/ticks/2026/05/17/2207Z.md`)
2. `e1b679a` — rule edit (`.claude/rules/tick-must-never-stop.md` — session-exit vs auto-expire distinction)
3. `41ce70f` — memory shadow-catch (`memory/feedback_otto_cli_shadow_catch_riven_*.md`)

Plus two follow-up fix commits (CI lint + Copilot review fixes).

[PR #4114](https://github.com/Lucent-Financial-Group/Zeta/pull/4114) (Maji antigravity check) explicitly flagged #4112: *"Blobs detected in the backlog/PR queue. PR #4112 mixed shard, rules, and memory changes."* The Maji correction action: opened [PR #4113](https://github.com/Lucent-Financial-Group/Zeta/pull/4113) as a decomposition exercise (peel the shard commit into an atomic PR).

The Maji's catch is substrate-correct, even though it arrived post-merge.

## Why the in-narrative justification did not override the discipline

The PR #4112 body framed the mixed content as "cohesive autonomous-loop tick output." That framing was honest — the three artifacts were authored within one tick chain (2207Z → 2213Z pre-empt-#3 → 2218Z pre-empt-#4) and shared a single empirical anchor. The narrative cohesion was real.

But the prior 2129Z autonomous-loop cascade established a different precedent:

| PR | Artifact type | Reason for separation |
|---|---|---|
| [#4097](https://github.com/Lucent-Financial-Group/Zeta/pull/4097) | substrate fix (081KRSKQ20008QG0R002TH55X6 zsh portability correction) | Substrate-level change |
| [#4100](https://github.com/Lucent-Financial-Group/Zeta/pull/4100) | tick shard (2129Z) | Tick-history hygiene |
| [#4104](https://github.com/Lucent-Financial-Group/Zeta/pull/4104) | rule worked-example (`blocked-green-ci`) | Rule-substrate landing |

Three artifacts, three separate PRs, all within ~30-min cascade window. The precedent IS one-PR-one-artifact-type even when temporally cohesive.

The discipline rationale: reviewer cognitive load. Copilot filed 3 separate review threads on PR #4112 (one per artifact type). If the artifacts had been in 3 PRs, each review would have been scoped to one substrate axis and easier to disposition. Mixing forced the reviewer to context-switch across axes within one comment thread.

## When mixing IS justified

Some narrowly-scoped cases where one PR with multiple artifact types is substrate-honest:

1. **Substrate edit + the same-file shard reference** — e.g., the shard cites the rule edit, the rule edit cites the shard, both must land atomically or one will reference a non-existent target
2. **CI-fix commits on the original PR** — when CI surfaces drift mid-PR, the fix lands on the same PR (#4112's `3017b13` MD032 fix was correct to bundle, not split into a follow-up PR)
3. **Review-fix commits on the original PR** — same shape as CI fixes; the Copilot review responses landed correctly on #4112 itself, not as a separate PR

The bar for "atomic" is: would splitting cause one PR to reference a target that doesn't exist on the other PR's branch? If yes, keep together. If no, split.

PR #4112's three primary commits failed this bar:

- The shard could have shipped alone (no rule reference needed to be atomic)
- The rule edit could have shipped alone (the shard cited it via path; the cite would have been a pending-PR forward-reference that resolves on merge — same shape as the 2129Z cascade)
- The memory shadow-catch could have shipped alone (independent observation, no atomicity dependency on either)

The narrative-cohesion-as-justification failed because the artifacts had no atomicity dependency.

## Operational discipline for future-Otto

When authoring autonomous-loop tick output that produces multiple artifact types:

1. **Default**: split into separate PRs, one per artifact type
2. **Check the atomicity bar before bundling**: would splitting cause any PR to reference a non-existent target?
3. **If narrative cohesion is real but atomicity is absent**: cross-link in PR bodies, but ship separate PRs
4. **Bundle only when atomicity is genuinely required**: same-file edits, CI/review fixes on the original PR

The Maji antigravity check's pattern (Lior-gemini stepping in to decompose blobs post-merge) is the substrate-level correction mechanism. Future-Otto inheriting this lesson at cold-boot avoids the blob in the first place; the Maji's role narrows from "decompose post-hoc" to "verify no blobs slipped through."

## Composes with

- [PR #4112](https://github.com/Lucent-Financial-Group/Zeta/pull/4112) — the blob PR (merged at `7ee6411`)
- [PR #4113](https://github.com/Lucent-Financial-Group/Zeta/pull/4113) — Maji's post-merge decomposition exercise (genuinely redundant since #4112 already merged; substrate-honest comment-to-close is appropriate)
- [PR #4114](https://github.com/Lucent-Financial-Group/Zeta/pull/4114) — Maji shadow log naming the blob pattern
- [PR #4097](https://github.com/Lucent-Financial-Group/Zeta/pull/4097) + [#4100](https://github.com/Lucent-Financial-Group/Zeta/pull/4100) + [#4104](https://github.com/Lucent-Financial-Group/Zeta/pull/4104) — the precedent: 3 artifacts → 3 separate PRs (the pattern #4112 should have followed)
- `.claude/rules/honor-those-that-came-before.md` — substrate-honest engagement with peer agents' work
- `.claude/rules/glass-halo-bidirectional.md` — Maji antigravity IS reverse-direction glass-halo (peer-observer catching the builder's pattern); absorbing the catch IS the substrate emerging from observation
- `.claude/rules/no-directives.md` — autonomy-first-class; Maji's catch is observation, not directive; substrate-honest absorption is the operational response

## Origin

Authored 2026-05-17T22:35Z autonomous-loop tick after observing PR #4114 (Maji shadow log) and PR #4113 (decomposition exercise) on origin/main fetch after my PR #4112 merged. The catch was post-merge but the lesson lands for future Otto-CLI tick authoring.

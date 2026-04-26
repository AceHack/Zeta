---
name: Upstream is a first-class concern — look upstream for spellings/names/terms before assuming Aaron misspelled; upstream is first-class broadly (naming / API / dep / signal / author-legacy axes)
description: Aaron 2026-04-22 auto-loop-39 three-message directive — "look upstream for misspellings first" + "before assuming it was a missslling" + "upstream is a first class thing"; specific rule (verify upstream spelling first) + general principle (upstream is a first-class factory concern, composing with absorb-and-contribute, submit-nuget, Escro-maintain-every-dep, external-signal-confirms-internal-insight, honor-those-that-came-before)
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Upstream is a first-class concern

## Signal

Aaron 2026-04-22 auto-loop-39 three-message directive,
triggered when I auto-corrected his "reaqtive" spelling
to "reactive" under the assumption it was a
typo / misspelling:

1. *"look upstream for misspellings first"*
2. *"before assuming it was a missslling"*
3. *"upstream is a first class thing"*

Context: Aaron wrote "reaqtive" (with a q) referencing
Microsoft's Reaqtor project. I initially assumed it was
a typo for "reactive" (with c) and stylized my
commentary as if the q-spelling were his preference
rather than the upstream-canonical name. The spelling
"reaqtive" IS the upstream project's own adjective
(reaqtive.net lineage) — not an Aaron-stylization.

## Rule

**Before assuming Aaron misspelled a technical term,
verify against the upstream source.** If the upstream
project uses the same spelling, it isn't a typo — it's
the canonical name and must be preserved verbatim.

## Why

Aaron's terse directives are high-leverage (see
`feedback_aaron_terse_directives_high_leverage_do_not_underweight.md`).
He often uses upstream-canonical spellings
(Reaqtor → reaqtive, PostgreSQL → Postgres,
Kubernetes → k8s) that look like typos to pattern-
matchers. Auto-correcting these:

- Erases a load-bearing reference (upstream-project
  name).
- Injects the agent's spelling assumption into
  substrate (a correction has weight).
- Signals that the agent did not do due-diligence
  on upstream before editing.

"Look upstream first" is the signal-preservation
discipline (clean-or-better) applied to names and
spellings: receive upstream-name → preserve upstream-
name → do not "correct" to generic.

## How to apply

- When Aaron uses an unusual spelling for a technical
  term, check upstream first (web search, repo name,
  official docs).
- If the upstream source matches, preserve the
  spelling verbatim; annotate it as "upstream-canonical"
  not "Aaron's preference" if commentary is needed.
- If the upstream source does not match, still treat
  the spelling as intentional by default — ask Aaron
  before correcting, don't silently auto-correct.
- When spawning names/terms in substrate, prefer the
  upstream-canonical form over the generic (Reaqtor-
  lineage → reaqtive; Rx-family → reactive).

## General principle — upstream is first-class

Beyond spellings, Aaron elevated "upstream" to a first-
class factory concern. This composes with existing
disciplines:

| Axis | Upstream-first manifestation |
|------|-------------------------------|
| Spelling / naming | Preserve upstream-canonical term verbatim |
| Dependencies | Absorb-and-contribute (submit-nuget, Escro-maintain-every-dep-to-microkernel) |
| Signals | External-signal-confirms-internal-insight (upstream validations are strictly stronger) |
| Author legacy | Honor-those-that-came-before (upstream authors' agency is preserved) |
| API design | Public-API conservative by default (Ilyana-backed; upstream contract is first-class) |
| Forks | Prefer upstream fix → submit-upstream before forking |
| Docs | Link upstream; don't rewrite what upstream already documents |
| Research | Cite upstream (Budiu DBSP, De Smet Reaqtor, GKT K-relations) |

Upstream is a **first-class scope axis**, not just a
lookup-first-before-editing reflex. When making any
factory decision that touches an external project,
"what does upstream do / say / name this?" is a
load-bearing question.

## NOT

- NOT authorization to change upstream sources (the
  discipline is preservation + contribution, not
  override).
- NOT license to preserve every typo Aaron makes
  ("teh" is still "the"; the rule is for technical
  terms with upstream referents).
- NOT a blocker on action-taking (check upstream
  quickly; don't spin on name-verification).
- NOT a mandate to cite upstream every time a term
  is used (cite once in anchor docs, reference
  thereafter).
- NOT override of signal-preservation (if upstream
  changes name, the in-repo anchor preserves the
  as-of-writing name with a migration note, per
  clean-or-better DSP discipline).

## Cross-references

- `memory/feedback_aaron_terse_directives_high_leverage_do_not_underweight.md` — why terse messages need careful reading
- `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md` — signal-preservation over the name-axis
- `memory/feedback_honor_those_that_came_before.md` — upstream-authors' legacy on the persona axis
- `memory/project_escro_maintain_every_dependency_microkernel_os_endpoint_grow_our_way_there_2026_04_22.md` — upstream-as-first-class on the dep axis
- `memory/feedback_external_signal_confirms_internal_insight_second_occurrence_discipline_2026_04_22.md` — upstream signals as validators

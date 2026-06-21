---
name: 081KRSKQ20008QG0R0014PPGZM slice 2 audit — memory/persona surface; verbatim-preservation constraint requires editorial-footnote pattern (not direct edit)
description: 10 citation edges across 4 unique dangling refs, ALL inside verbatim-preservation conversation files (Ani + Kestrel). Per substrate-or-it-didnt-happen rule, verbatim content cannot be edited. Resolution pattern differs from slice 1's 4-option menu — for slice 2, the only safe resolution is editorial-footnote at the top of each citing conversation file naming the dangling refs + their in-repo projections.
type: feedback
created: 2026-05-17T06:49Z
---

# 081KRSKQ20008QG0R0014PPGZM slice 2 audit — verbatim-preservation constraint

## Audit output (`--surfaces memory/persona`, 2026-05-17T06:49Z)

**10 citation edges across 4 unique dangling refs**, all inside
`memory/ani/conversations/*` (6 edges across 5 files) and
`memory/kestrel/conversations/*` (2 edges in 1 file):

| Unique dangling ref | citing files | total edges |
|---|---|---:|
| `feedback_aaron_whole_system_attention_optimization_over_coincidence_networks_of_memories_*_2026_05_14.md` | 3 Ani conversations | 3 |
| `feedback_aaron_responsibility_chain_explicit_request_keeps_otto_anthropic_clean_2026_05_15.md` | 4 Ani conversations | 4 |
| `feedback_aaron_greek_people_designed_language_structure_natural_evolution_math_symbols_*_2026_05_14.md` | 1 Ani conversation | 1 |
| `feedback_aaron_zeta_is_memory_preservation_specialist_first_*_2026_05_15.md` | 1 Kestrel conversation | 2 |

## The verbatim-preservation constraint

All 10 citations are inside conversation files that preserve
**verbatim** content of conversations with external AI participants
(Ani via Grok, Kestrel via claude.ai). Per
[`.claude/rules/substrate-or-it-didnt-happen.md`](../.claude/rules/substrate-or-it-didnt-happen.md):

> When the human maintainer / external reviewers send an
> architecture-changing / doctrine-superseding / multi-AI review
> packet, preserve verbatim in `docs/research/` BEFORE summarizing.

This extends to `memory/<persona>/*/conversations/` per the same
discipline — these files are the substrate record of what the
external participant ACTUALLY SAID, not Otto's interpretation. The
dangling-ref citations were authored by the external participants
(Ani, Kestrel) within their natural conversation prose. Editing
them would:

1. Violate verbatim preservation (the cited refs WERE what the
   participant said, even if the path no longer resolves cleanly)
2. Retroactively rewrite the conversation record (substrate-honest
   rule: corrections preserve alongside originals; nothing erased)
3. Create the same kind of drift the audit tool is meant to catch
   (citation drift from original substrate)

## Resolution pattern for slice 2 (different from slice 1)

The 4-option menu from
[slice-1 recipe memo](./feedback_otto_cli_b0611_slice1_audit_recipe_4_of_6_have_footnote_fallback_pattern_intentional_dangling_2026_05_17.md)
**does not apply cleanly** to verbatim conversation content. The
appropriate pattern is:

**Option E — Editorial footnote**: add a top-of-file editorial
section (clearly distinct from the verbatim conversation body)
that lists the dangling refs cited in this conversation file +
names their in-repo projection. Format example:

```markdown
---
[frontmatter]
---

## Editorial note — dangling-ref projections (added 2026-05-NN)

This conversation cites the following memory files that exist
user-scope only. In-repo projections for cold-boot agents:

- `feedback_<name>_2026_05_NN.md` → `memory/CURRENT-<persona>.md`
  section "<N>" or `.claude/rules/<rule-name>.md` body
- ... (one line per unique dangling ref)

---

[verbatim conversation body, UNCHANGED]
```

This keeps the verbatim record intact while making the substrate
discoverable for cold-boot agents.

**Audit tool implication**: the tool's path-existence check would
still flag these refs. To pass exit-0 under Option E, the tool
would need to recognize editorial-footnote blocks OR opt the
files into an allowlist (composing with the audit-tool semi-
automation acceptance bullet in 081KRSKQ20008QG0R0014PPGZM). Until then, slice 2
work is bounded by:

- Authoring editorial footnotes on 5 Ani conversation files +
  1 Kestrel conversation file (6 files total)
- The 6 files cover all 10 citation edges
- Per-file pattern is mechanical once the projection mapping is
  established

## Per-file work estimate

For each of the 6 conversation files: 1 editorial-footnote section
+ ~4 lines per cited ref. Most files cite 1-2 refs; one file
(`memory/ani/conversations/2026-05-15-aaron-ani-grok-post-m-acc-adoption-constraint-11-default-oracle.md`)
cites 2 refs. One file (`memory/ani/conversations/2026-05-15-aaron-ani-grok-plateau-bounded-extract-share-link.md`)
cites 2 refs. Total: ~30 lines of editorial footnote across 6
files. Small commit.

## In-repo projection targets (research needed at safe-window)

For each of the 4 unique dangling refs, the projection target needs
verification by reading the relevant CURRENT-*.md files:

- `feedback_aaron_whole_system_attention_optimization_over_coincidence_networks_*_2026_05_14.md`
  → likely projects into `memory/CURRENT-aaron.md` (god/coincidence
  network framing)
- `feedback_aaron_responsibility_chain_explicit_request_keeps_otto_anthropic_clean_2026_05_15.md`
  → likely projects into `memory/CURRENT-aaron.md` (responsibility
  chain framing)
- `feedback_aaron_greek_people_designed_language_structure_natural_evolution_math_symbols_*_2026_05_14.md`
  → likely projects into `memory/CURRENT-aaron.md` (Greek-language
  origin of ARG framing)
- `feedback_aaron_zeta_is_memory_preservation_specialist_first_everything_else_second_*_2026_05_15.md`
  → ALREADY has fallback established at
  `.claude/rules/persistence-choice-architecture-for-zeta-ais.md`
  rule body + `memory/CURRENT-aaron.md` (per slice-1 recipe);
  cleanup is consistent with the existing pattern

## Composes with

- 081KRSKQ20008QG0R0014PPGZM — parent backlog row (this memo is slice-2 prep)
- Slice-1 recipe memo
  (`memory/feedback_otto_cli_b0611_slice1_audit_recipe_*_2026_05_17.md`)
  — slice 1 (skills + rules) used the 4-option menu; slice 2
  needs Option E (editorial footnote)
- `.claude/rules/substrate-or-it-didnt-happen.md` — verbatim
  preservation discipline; the constraint that distinguishes
  slice 2 from slice 1
- `.claude/rules/honor-those-that-came-before.md` — protects
  external-participant content; editorial footnote preserves
  what was said while elevating in-repo discoverability

## Substrate-honest framing

This memo is slice-2 prep. The work itself requires:

1. Confirm projection targets by reading the 3 `memory/CURRENT-*.md`
   files at safe window (the 4th projection is already established
   per slice 1 work)
2. Author 6 editorial-footnote sections on the citing conversation
   files
3. Commit + push (slice-2-scope, one PR)
4. Audit tool may STILL exit-1 unless allowlist semi-automation
   lands (composes with 081KRSKQ20008QG0R0014PPGZM's audit-tool semi-automation
   acceptance bullet)

The Option E pattern is a real addition to the resolution menu
that slice-1 recipe did not foresee. The 4 patterns from slice 1
(in-repo projection, footnote-fallback, deletion, hybrid) +
Option E (editorial footnote on verbatim files) = 5 patterns
total that the cleanup work composes from.

This is genuinely new substrate, not narration of deferral.

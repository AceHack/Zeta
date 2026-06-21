---
name: 081KRSKQ20008QG0R0014PPGZM slice 3 audit — docs/research surface; mixed verbatim AND Otto-authored files require per-file pattern selection
description: 9 citation edges across 8 unique dangling refs in docs/research. Mixed file types — some verbatim AI conversation preservation (Option E from slice 2), some Otto-authored research syntheses (Option A/B/C/D from slice 1). Per-file pattern selection needed; not uniform like slice 2.
type: feedback
created: 2026-05-17T06:59Z
---

# 081KRSKQ20008QG0R0014PPGZM slice 3 audit — docs/research mixed file types

## Audit output (`--surfaces docs/research`, 2026-05-17T06:59Z)

**9 citation edges across 8 unique dangling refs.** Per-file:

| Citing file | line | dangling ref (truncated) | File type |
|---|---:|---|---|
| `docs/research/2026-05-02-aaron-gate-yml-is-immune-system-recognition-claudeai-engagement.md` | 117 | `feedback_gate_yml_is_immune_system_*_2026_05_*` | verbatim (claudeai exchange) |
| `docs/research/2026-04-30-multi-ai-feedback-packets-this-session.md` | 538 | `feedback_aaron_visibility_constraint_no_changes_he_cant_see_2026_04_28.md` | verbatim (multi-AI feedback) |
| `docs/research/crystallization-loop.md` | 676 | `feedback_kanban_factory_metaphor_blade_crystallize_pipeline.md` | Otto-authored synthesis |
| `docs/research/2026-05-01-claudeai-tenth-through-fourteenth-ferries-addison-cognitive-trajectory-wwjd-trust-architecture-aaron-forwarded.md` | 43 | `feedback_naming_consent_rules_aaron_addison_max_first_names_*` | verbatim (forwarded packet) |
| ↑ same file ↑ | 46 | `feedback_lfg_corrections_wave_addison_co_owner_ksk_robotics_*` | verbatim (forwarded packet) |
| `docs/research/2026-05-04-b-0140-bash-to-ts-migration-audit-table.md` | 76 | `feedback_bash_compatibility_target_four_shells_macos_32_ubuntu_git_bash_wsl_*` | Otto-authored audit table |
| `docs/research/2026-05-02-karpathy-aiengineer-summit-*.md` | 64 | `feedback_otto_339_words_shift_weights_substrate_is_identity.md` | verbatim (talk transcript) |
| `docs/research/meta-cognition-survey-2026-04-21.md` | 35 | `feedback_three_filter_discipline_f1_f2_f3_mandatory_before_any_kernel_promotion.*` | Otto-authored survey |
| ↑ same file ↑ | 156 | (same ref as line 35) | Otto-authored survey |

## File-type partition

**Verbatim preservation files (5 of 8 unique refs)**: per
[`.claude/rules/substrate-or-it-didnt-happen.md`](../.claude/rules/substrate-or-it-didnt-happen.md)
"verbatim-preservation in docs/research" discipline → apply
**Option E** (editorial footnote) per slice-2 recipe memo.

**Otto-authored research files (3 of 8 unique refs)**: these are
synthesis / audit / survey files Otto authored. Verbatim
preservation does not apply. → apply **Option A/B/C/D** menu
per slice-1 recipe memo.

The split is roughly 5:3 by unique ref, but most edges (5+ of 9)
are in verbatim files.

## Resolution pattern for slice 3 (hybrid)

The 4 verbatim files use Option E (editorial footnote at top).
The 3 Otto-authored files use the 4-option menu per-citation:

- `crystallization-loop.md:676` — citation is to a kanban-metaphor
  feedback file. Inspect to determine if load-bearing OR orphaned;
  resolution likely Option B (delete) OR Option A (in-repo
  projection if load-bearing)
- `2026-05-04-b-0140-bash-to-ts-migration-audit-table.md:76` —
  citation to a bash-compatibility-target memory. The 081KQGDBJ0008QG0R0022EW5ZE work
  may have moved on; resolution likely Option B or Option C
- `meta-cognition-survey-2026-04-21.md:35 + 156` — citation to a
  three-filter-discipline memory. The survey is dated; resolution
  per-citation depends on whether the filter discipline is still
  current substrate

## Compositional observation across slices 1-3

Pattern frequency after 3 slices:

| Pattern | Slice 1 (skills+rules) | Slice 2 (memory/persona) | Slice 3 (docs/research) | Total edges |
|---|---:|---:|---:|---:|
| Already has footnote-fallback (no work) | 4 of 6 | 0 of 10 | 0 of 9 | 4 |
| Option E (editorial footnote on verbatim) | 0 | 10 | ~5 | 15 |
| Option A/B/C/D (in-repo projection / delete / footnote) | 2 | 0 | ~4 | 6 |

**Total work-requiring edges**: 21 (15 Option E + 6 Option A-D).
**Total no-work edges**: 4 (existing footnote-fallback).
**Total**: 25 edges audited across 3 surfaces.

Slice 4 (docs/backlog, 17 dangling refs — by far the largest)
remains unaudited at the per-edge level. It likely has a mix
similar to slice 3.

## Composes with

- 081KRSKQ20008QG0R0014PPGZM — parent backlog row
- Slice-1 recipe memo (4-option menu)
- Slice-2 recipe memo (Option E pattern)
- `.claude/rules/substrate-or-it-didnt-happen.md` — verbatim
  preservation discipline

## Substrate-honest framing

Slice 3 is the first slice with MIXED file types within one
surface. The hybrid pattern (Option A-D + Option E per-file) is
the natural composition of the two prior recipe memos.

The "no work needed" count (4 edges already footnoted-fallback
in slice 1) is interesting — it means the established discipline
is partially self-correcting. New authoring under the established
footnote pattern would naturally satisfy a future audit.

This memo extends the per-slice recipe substrate without adding
a new resolution pattern (Options A-E remain the menu). Slice 4
prep (docs/backlog, 17 refs) will likely follow the same hybrid
shape but needs its own audit to confirm.

---
id: B-0006
priority: P1
status: open
title: MEMORY.md compression pass — distill entries to true one-liners; bring file under ~200-line cap
tier: maintenance
effort: M
directive: maintainer Aaron 2026-04-25 (implicit via the README cap; surfaced explicitly by Otto-295 expand-compress dynamic)
created: 2026-04-25
last_updated: 2026-04-25
composes_with: []
tags: [memory-hygiene, MEMORY.md, distillation, compression, otto-291-pacing, otto-294-smooth-shape, otto-295-monoidal-manifold, factory-maintenance]
---

# MEMORY.md compression pass

**Invariant problem statement** (deliberately
number-free per Otto-294 antifragile-smooth + Otto-285
precise-pointer rigor — hard-coded line counts go
stale within sessions and turn this row into a
broken reference): `memory/MEMORY.md` is materially
over the README cap of **~200 lines** with
**one-line entries** (under ~200 chars). The cap is
load-bearing because Claude Code truncates the file
at the cap, breaking the fast-path index role
documented in CLAUDE.md memory bootstrap. Multiple
sessions have added multi-line entries; the
expansion direction (per Otto-295 monoidal-manifold
expand-compress dynamic) has fired aggressively while
the compression direction has lagged. Current state:
run `wc -l memory/MEMORY.md` for the live count;
the row is owed independent of the specific number.

## Why this is owed now (P1, not deferred)

Per Otto-295 (`memory/feedback_otto_295_substrate_is_monoidal_manifold_n_dimensional_expanding_via_experience_compressing_via_pressure_distillation_rodneys_razor_2026_04_25.md`),
the substrate is a monoidal manifold simultaneously
expanding (via experience) and compressing (via pressure
/ distillation / Rodney's Razor). The expansion direction
has been firing aggressively across recent rounds (Otto-NNN
cluster, ferry imports, persona memories, user disclosures);
the compression direction on MEMORY.md specifically has
NOT been keeping pace. Result: the index is failing its
fast-path role.

The fast-path role MATTERS:

- **Per the auto-memory header** (the leading line of
  CLAUDE.md memory bootstrap): *"📌 Fast path: read
  `CURRENT-aaron.md` and `CURRENT-amara.md` first.
  These per-maintainer distillations show what's
  currently in force. Raw memories below are the
  history; CURRENT files are the projection."*
- **CURRENT-* files are tier-1 distillation** of
  MEMORY.md. The full-detail memories under
  `memory/**/*.md` are tier-3. **MEMORY.md is tier-2
  — the index from one to the other.** When tier-2
  oversizes, the dependency chain breaks.
- **Truncation symptom**: the system reminder at
  session start: *"Only part of it was loaded. Keep
  index entries to one line under ~200 chars; move
  detail into topic files."* Truncated index = the
  navigation surface for the entire memory system is
  partial.

## What "compression pass" means here

For each existing entry in `memory/MEMORY.md`:

1. **Identify the load-bearing claim** in one sentence.
2. **Extract the body** into the underlying file (most
   already exist — entries became long because authors
   inlined detail meant for the body).
3. **Replace the entry** with a true one-liner under
   ~200 chars: `[Hook — what's surprising / non-obvious
   in one sentence. Optionally a tag like "Aaron <date>"
   or "Otto-NNN" for ordering.](underlying-file.md)`
4. **Verify the body file is canonical** — if entry
   detail wasn't yet in the body, move it there.

After the pass, the file should be:

- ≤ 200 lines (matching README cap)
- Each entry one line under ~200 chars
- Each entry has a working link to the body file
- Entries ordered with most-recent at top (per existing
  convention)

## Acceptance signals

The compression pass is "good enough to ship" when:

- `wc -l memory/MEMORY.md` ≤ 200
- No entry exceeds ~200 chars
- Every body file referenced from MEMORY.md exists +
  contains the detail that used to live in the index
- A peer-Claude session loading the file does not see
  the truncation warning
- Fast-path discipline (read CURRENT-* + scan MEMORY.md +
  drill into specific body file) works under typical
  context budget

## Risks + mitigations

- **Information loss** if compression is too aggressive
  → mitigation: every entry's detail moves to a body
  file (Otto-238 retractability — the detail isn't
  destroyed, just relocated). Pre-pass: verify body
  files exist for every entry; create missing body
  files first.
- **Cross-reference breakage** if compression renames
  entries → mitigation: only the index entry changes;
  body file paths stay constant. Cross-references that
  point at body files are unaffected.
- **Compression-induced flatness** (loss of ordering
  hierarchy) → mitigation: keep top-of-file CURRENT-*
  pointer; keep AutoDream timestamp; keep most-recent
  ordering convention; the structural top-of-file
  doesn't compress.
- **Substrate slippage** during the pass (someone adds
  long entries while pass is in flight) → mitigation:
  do the pass on a single branch, single PR, with
  explicit "no MEMORY.md edits during compression-pass
  PR review" note in the PR description; merge atomically.

## Why P1 (not P0/P2/P3)

- **Not P0**: factory still functions; navigation is
  degraded but not broken; CURRENT-* files cover the
  fast-path needs partially.
- **P1 fits**: within 2-3 rounds; substantial maintenance
  payoff; unblocks the substrate's compression direction
  per Otto-295.
- **Not P2**: not research-grade — this is mechanical
  distillation against the existing README cap; no
  research question.
- **Not P3**: actively-degrading state, not deferred-
  someday.

## Effort estimate

- **M (medium)**: distillation pass across ~50 entries
  plus verification each body file is canonical + PR
  review + handle in-flight edits during the review
  window. Single-author single-PR; no review-cluster
  needed.
- Could grow to L if many entries lack body files and
  body files have to be created from scratch (would
  require full re-derivation of the original memory
  content from MEMORY.md, which isn't always sufficient).

## Composes with

- **`memory/feedback_otto_295_substrate_is_monoidal_manifold_n_dimensional_expanding_via_experience_compressing_via_pressure_distillation_rodneys_razor_2026_04_25.md`**
  — explicit case for compression as the missing half.
- **`memory/feedback_otto_291_seed_linguistic_kernel_extension_deployment_discipline_consumer_maji_recalculation_2026_04_25.md`**
  — pacing discipline applies during the pass: don't
  collapse all entries in one shot if it overloads
  consumer Maji; one entry-class at a time if needed.
- **`memory/feedback_otto_294_antifragile_hardening_shape_is_round_smooth_fuzzy_quantum_trampoline_meme_protection_not_sharp_non_differentiable_2026_04_25.md`**
  — compression smooths the manifold; sprawling entries
  are sharp where one-liners are smooth.
- **`memory/feedback_definitional_precision_changes_future_without_war_otto_286_2026_04_25.md`**
  (canonical) — precise definitions transfer best when
  compressed; the body file IS the precise definition,
  the index is the routable summary.
- **`memory/feedback_write_code_from_reader_perspective_why_did_you_choose_this_otto_282_2026_04_25.md`**
  — write the index entry from the reader's
  perspective: "what's surprising / non-obvious here
  that would make me click through?"
- **`memory/persona/best-practices-scratch.md`** — has
  similar size-discipline (3000-word cap), enforced.
  Same shape applied to MEMORY.md.
- **`docs/backlog/P2/B-0005-split-aurora-from-courier-ferry-archive-generalize-named-entity-conversation-imports.md`**
  — same family of substrate-hygiene work (B-0005 is
  ontology hygiene; B-0006 is index hygiene).

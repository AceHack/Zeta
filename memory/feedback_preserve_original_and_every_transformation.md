---
name: Preserve the original AND every transformation — data-value rule; DBSP operator algebra applied to data pipelines; original plus D-deltas plus I-integrated state, not just final output
description: Aaron 2026-04-19 — "also if you are following data value you should keep the orinal and every transformation, i don't care to do that if you dont want to for my family history bcasue i have it also at dropbox"; standing architectural rule — when an agent is processing data whose *value is load-bearing*, it keeps the original AND every intermediate transformation, not just the final output; this is the DBSP retraction-native operator algebra applied at the data-pipeline level (preserve D-deltas AND I-integrated state); family-history specifically is an exception because Aaron has the Dropbox backup acting as original-preservation channel; do not treat this as a performance concern — correction-trail preservation is first-primitive, not an optimisation tradeoff; composes with μένω-correction-compact (correction requires a trail, trail requires originals); composes with AutoDream-retraction-native-memory-consolidation BACKLOG item (same principle applied to memory)
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

**2026-04-19 disclosure (verbatim):** *"also if you are
following data value you should keep the orinal and every
transformation, i don't care to do that if you dont want to
for my family history bcasue i have it also at dropbox"*

## The rule

> When agents process data whose *value is load-bearing*,
> the original form AND every transformation are preserved.
> The final output is not the artifact — the trail is the
> artifact.

## Why

This is the retraction-native operator algebra stated at
the data-pipeline level. In Zeta's core algebra:

- `D` (delta / differentiation) — emits the change
- `I` (integration) — integrates changes into state
- `z⁻¹` (temporal shift) — aligns prior state
- retraction — any emission can be walked back
- the round-trip identity requires all of these to be
  addressable, not just the current integrated state

The same structure at the data level:

- **Original** = initial `I` state (pre-pipeline integrated
  data).
- **Each transformation** = a `D` delta emission (what
  the transform changed).
- **Current state** = current `I` integration (cumulative
  result).
- **Correction capacity** = ability to retract a delta
  and re-integrate; requires all deltas addressable.

If the pipeline only keeps the final output, the delta
trail is gone. A later correction cannot walk back a
specific transform because the deltas that produced the
state are not addressable. The system degrades to
append-only-with-destructive-updates — the exact failure
mode Aaron designs the retraction-native algebra to
prevent.

## How to apply

### When the rule fires

- **Default: on.** If an agent is transforming data
  whose value is load-bearing (memory, research corpus,
  biographical substrate, formal proofs, benchmark
  data, production-relevant configuration), preserve
  original + every transformation.
- **Explicit Aaron-granted exception:** family-history
  data in this session, because Aaron has the Dropbox
  backup as the original-preservation channel. The
  Dropbox IS the original; local agent work is derived
  and does not need its own trail.
- **Generalised exception pattern:** if an
  authoritative original-source channel exists
  externally and is known-stable, the agent's derived
  work is allowed to not duplicate the trail. The
  agent should *say* this when it applies, so Aaron
  (or the reviewer) can verify the exception is
  legitimate.

### Concrete mechanisms

- **Memory folder** — already disciplined. Memories
  record corrections as entries, not as destructive
  edits. The "memory is first-class" posture per
  `project_memory_is_first_class.md` encodes this
  rule for the memory surface.
- **Docs/ADRs** — existing GOVERNANCE.md §2 rule
  (edit-in-place for current state; history lives in
  ADRs + ROUND-HISTORY + git). Git commit history is
  the D-delta stream; committed docs are the I-
  integrated current state. Both addressable.
- **Research transforms** — when an agent transforms
  research material (paraphrasing a paper, extracting
  claims, building a research note), both the source
  citation AND the claim-as-stated should be
  preserved. The agent does not re-interpret away
  the original.
- **Data pipelines in code** — when code transforms
  data (serialization, compression, semantic
  extraction), the pipeline preserves the pre-
  transform form unless it can cite an external
  authoritative original. The retraction-native
  operator algebra in `src/Core/` already honours
  this; the rule now applies to auxiliary pipelines
  too.
- **User disclosures** — when Aaron makes a garbled
  first-pass disclosure that the agent rewrites for
  precision (per `feedback_rewording_permission.md`),
  the original verbatim is preserved in a marked
  block. This rule is already operational; it is
  a specific case of the general rule stated here.

### What the rule is NOT

- **Not a hoarding directive.** Signal-to-noise
  discipline still applies. Preserving original +
  every transformation means preserving *structure*
  (what was at each stage), not dumping every byte.
  If a transformation is deterministic and trivially
  reproducible from the original, the delta is
  implicit in the transform-code and need not be
  re-materialised.
- **Not a performance optimisation concern.** This is
  correction-trail first-primitive, not an
  optimisation to be traded off against speed. If
  performance requires destructive transformation,
  the design is wrong.
- **Not authorisation to retain third-party data
  indefinitely.** PII and third-party-protected data
  still obey retention discipline
  (`feedback_maintainer_name_redaction.md`,
  `user_open_source_license_dna_family_history.md`).
  The rule says "keep original and every
  transformation of load-bearing data you are allowed
  to keep," not "override retention boundaries."
- **Not a replacement for Aaron's own curation.**
  Aaron edits / retracts / overwrites as maintainer
  per `project_memory_is_first_class.md`. The rule
  applies to *agent* transformations, not to Aaron's
  own maintenance.

### Family-history specific case

Aaron explicitly exempted family-history data from the
rule in this session because:

- He has the Dropbox backup as original-preservation
  channel.
- The factory local storage is a *derived / organised*
  view, not an authoritative-original view.
- If the organised view becomes corrupted or
  destroyed, re-deriving from Dropbox is cheap and
  deterministic.

This is the **external-authoritative-source exception**
— named and generalisable. When the exception applies:

1. State it explicitly when the exception fires.
2. Record the external source pointer in the derived
   artifact.
3. Design the derived artifact to be re-derivable
   from the external source.
4. Do NOT treat the exception as permission to
   destructively transform — the derived view is
   still curated, just without a local trail.

## Composition with other memory

- **`user_retractable_teleport_cognition.md`** — the
  rule is retractable-teleport applied to data. Same
  operator, different substrate. The consistency
  between Aaron's mental algebra and the data-value
  rule is not accidental; it is the same axiom.
- **`user_meno_persist_endure_correct_compact.md`** —
  correction capacity requires a trail; μένω's
  "correct mistakes I see" clause is the load-
  bearing reason the rule exists.
- **`project_memory_is_first_class.md`** — the
  memory-retention posture is the memory-surface
  instance of this general rule.
- **DBSP operator algebra in `src/Core/`** — the
  retraction-native operator algebra is the
  theoretical grounding the rule extends from
  core-data to all-agent-transformations.
- **`feedback_rewording_permission.md`** — verbatim
  quote preservation on precision-rewording is a
  specific case of this general rule.
- **BACKLOG P2 better-dream-mode research item** —
  retraction-native memory consolidation is this
  rule applied to consolidation passes; AutoDream's
  destructive-delete violation is this rule's
  negation.
- **GOVERNANCE.md §2** — docs-read-as-current-state
  with history in ADRs + ROUND-HISTORY + git is the
  governance-surface instance of the rule.
- **`user_lexisnexis_legal_search_engineer.md`** —
  legal citation graphs (Shepard's / KeyCite) are
  precedent's version of original-plus-every-
  transformation; Aaron's substrate-fluency with
  this rule predates Zeta.

## Why this matters specifically now

The family-history disclosure surfaced the rule.
Without the exception, the agent would have defaulted
to creating verbose preservation artifacts for every
transformation of the Dropbox data, duplicating the
Dropbox backup without added value. Aaron noticed the
pattern and stated the general rule + its exception
in one sentence. This is Aaron's
`user_constraint_foreground_pattern.md` operating
(constraints foreground, agents adjust).

The rule now applies across every future agent action,
not just this session's family-history work.

## Cross-references

- `user_retractable_teleport_cognition.md` — operator-
  algebra origin of the rule.
- `user_meno_persist_endure_correct_compact.md` —
  correction-compact mandating trail preservation.
- `project_memory_is_first_class.md` — memory-surface
  instance.
- `feedback_rewording_permission.md` — rewording-
  surface instance (verbatim preservation).
- `user_open_source_license_dna_family_history.md` —
  family-history data context (external-authoritative-
  source exception).
- `user_constraint_foreground_pattern.md` — the
  disclosure mode by which Aaron stated the rule.
- `user_lexisnexis_legal_search_engineer.md` —
  substrate-fluency provenance (legal citation
  graphs).
- GOVERNANCE.md §2 — governance-surface instance.
- BACKLOG P2 better-dream-mode item — consolidation-
  surface application of the rule.
- `src/Core/` retraction-native operator algebra —
  theoretical grounding.

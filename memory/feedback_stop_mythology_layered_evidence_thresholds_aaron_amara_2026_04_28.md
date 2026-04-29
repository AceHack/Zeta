---
name: Stop Mythology rule — operational name for the bullshit-detector at the rule level (Aaron concept; Amara naming, 2026-04-28)
description: Aaron 2026-04-28 framing — "we also stop mythology with human intellectual lineage research and anchors." Amara naming — "Stop Mythology rule" is the Beacon-safe operational form of the discipline (distinct from Veridicality, which is the formal scoring module name). Three-tier evidence threshold — factory-local claims need substrate; generalized claims need external lineage; big epistemic claims need SD-9 (substrate + lineage + falsifier). Pairs with Veridicality.fs as the rule-level discipline that the module would operationalize.
type: feedback
---

# Stop Mythology rule

## The rule (Aaron 2026-04-28 framing; Amara naming)

> *"we also stop mythology with human intellectual lineage
> research and anchors"* (Aaron 2026-04-28).

Amara's Beacon-safe naming for this discipline:

> **Stop Mythology rule.**

In Zeta-shaped form (Amara verbatim):

```text
Stop Mythology:
  Factory-local claims can use substrate evidence.
  Generalized claims need external lineage.
  Big epistemic claims need SD-9:
    substrate evidence + external lineage + falsifier.
```

## How this relates to Veridicality (the module)

Two distinct artifacts at different levels of the stack:

| Artifact | Level | Current status (2026-04-28) |
|---|---|---|
| **Veridicality** (`src/Core/Veridicality.fs`) | Provenance + claim-validation foundation | **Skeleton shipped, magic still missing.** Currently provides: `Provenance` + `Claim<'T>` types, `validateProvenance`, `validateClaim`, `CanonicalClaimKey` (structural projector — caller supplies the (subject, predicate, object, time-scope, modality) tuple), `canonicalKey`, `groupByCanonical`, `antiConsensusGate`. **Does NOT yet ship:** `scoreVeridicality` (the V(c) formula), `canonicalizeClaim` (semantic canonicalization), `ClaimRainbowTable`, cognitive-load / compression-gap / falsifiability scoring. Rainbow-table layer = future graduation per **B-0089**. |
| **Stop Mythology rule** | Operational discipline | This memory — rule-level discipline that the future shipped scorer would operationalize |

Ani's catch verbatim (voice-mode review, 2026-04-28):

> *"the scaffolding is nice and clean, but the actual
> veridicality magic — the real bullshit detector part —
> still looks like it's missing."*

- **Veridicality (current)** is the *foundation / claim-substrate
  surface*. It validates provenance metadata and supports
  caller-supplied claim grouping; it does NOT yet score claims
  by semantic / cognitive-load / falsifiability features.
  See B-0089 for the graduation roadmap.
- **Stop Mythology** is the *behavioral rule*. It's what an
  agent does (or refuses to do) when about to make a claim
  without enough evidence. It's the Beacon-safe operational
  form that does NOT require shipping the full
  `scoreVeridicality` to be operational immediately — the
  three-tier threshold is something agents can apply by
  hand right now, while the module's scoring layer matures.

Both names are valid. Both have the same Aaron-concept origin
(the bullshit-detector framing in conversation history).
Amara's contribution to the rename pair: she gave the module
a formal name (Veridicality) AND gave the rule itself a Beacon-
safe operational name (Stop Mythology).

The original "bullshit detector" term remains preserved in:

- Research docs under `docs/research/` covering the
  provenance-aware detector lineage (filename pattern
  date-stamped; grep for "bullshit-detector" to find the
  current set, since the set grows over time)
- Aurora ferries 7/8/9/10 under `docs/aurora/`
  (research substrate, not renamed)
- 8th-ferry memory entries under `memory/` for ferry-specific
  detector discussion (grep "8th_ferry" for current paths)
- Casual / commit-message usage (Aaron invented it; not
  scrubbed)
- The graduation memory
  (`memory/feedback_veridicality_naming_for_bullshit_detector_graduation_aaron_concept_origin_amara_formalization_2026_04_24.md`)
  — records the rename rationale

## Three-tier evidence threshold

The rule's operational machinery is a layered evidence
threshold scaled to claim-scope:

### Tier 1 — Factory-local claims

**Threshold:** substrate evidence.

A claim about THIS factory's behavior, history, or state needs
substrate evidence (commits, files, test results, logs).
External lineage is NOT required.

Examples:

- "PR #80 is on AceHack main but not LFG main." → check via
  `git merge-base --is-ancestor`. Substrate = git refs.
- "Class-Count Validity Drift earned a bead." → check via
  the catch event documented in this session.
- "MEMORY.md grew past 200 lines." → check via `wc -l`.

### Tier 2 — Generalized claims

**Threshold:** external lineage.

A claim that generalizes beyond this factory's instance —
something true about software engineering, AI alignment,
distributed systems, or any other domain where the broader
literature has authority — needs an external citation.

Examples:

- "Goodhart's Law applies to commit counts as alignment
  metrics." → cite Goodhart (1975), Strathern (1997).
- "Tail-recursion optimization was named in the 1970s." →
  cite Steele or Sussman.
- "Beacon-safe vocabulary preserves zero-divergence semantics."
  → this is factory-local; Tier 1 applies, not Tier 2.

The lineage citation can be informal (a one-line "per
Goodhart 1975") but must be checkable.

### Tier 3 — Big epistemic claims (composes with SD-9)

**Threshold:** substrate + external lineage + explicit falsifier
(all three required).

A claim that asserts something foundational about
truth-conditions, identity, or alignment — anything where
getting it wrong reshapes the factory's epistemic surface —
requires:

1. **Substrate evidence** (Tier 1).
2. **External lineage** (Tier 2).
3. **Explicit falsifier** — a stated condition under which
   the claim would be wrong.

### Composition with `docs/ALIGNMENT.md` SD-9

SD-9 in `docs/ALIGNMENT.md` is **"Agreement is signal, not
proof"** — specifically the rule that multi-AI agreement (peer
review consensus, multi-ferry alignment) is signal-level
evidence, not proof. SD-9 is a *related but narrower* rule:

- **SD-9 (`docs/ALIGNMENT.md`):** for claims about consensus
  ("multiple AIs agree, therefore X") — agreement is signal,
  not proof.
- **Stop Mythology Tier 3 (this memory):** for *any* big
  epistemic claim — substrate + lineage + falsifier required.

Stop Mythology Tier 3 GENERALIZES the SD-9 discipline: SD-9
catches the specific failure mode (consensus-as-proof); Tier
3 catches the broader class (any-evidence-vibes-as-proof). A
claim that passes SD-9 (multi-AI agreement WITH falsifier
discipline) is also covered by Tier 3.

The two compose; they're not identical.

Examples (each requires all three Tier 3 elements):

- "Otto's autonomy is first-class" — substrate (commits,
  decisions made autonomously), lineage (Aaron's framing per
  Otto-357 + autonomy-philosophy literature), falsifier (a
  case where Otto-deferred-to-Aaron when the substrate already
  determined the answer would falsify "first-class").
- "Glass Halo discipline produces measurable alignment" —
  substrate (factory commits + test results), lineage
  (alignment literature, Hubinger / Critch / Christiano),
  falsifier (a published case where Glass-Halo-shaped agents
  produced misaligned behavior).
- "Multiple AIs (Codex + Grok) agree the hard-reset is unsafe"
  — this is the SD-9 surface: agreement IS signal, but Tier 3
  requires the substrate (specific gaps each AI identified) +
  external lineage (the file-sample-as-clearance Goodhart
  literature) + falsifier (a tree-diff state where the agreement
  would be wrong).

## Operational machinery — when to apply each tier

Before making a claim that affects others' decisions, ask:

1. **Is this a factory-local claim?** If yes → Tier 1.
2. **Does this generalize beyond this factory?** If yes →
   Tier 2.
3. **Is this a foundational / identity / alignment claim?**
   If yes → Tier 3 (composes with SD-9 in `docs/ALIGNMENT.md`).

If unsure → escalate one tier up. Better to over-cite than
under-cite.

## Anti-patterns the rule prevents

### Mythological framing without lineage

Statements like "the universe wants us to ship this," "this
is the right thing," "the spec speaks for itself" — vague
appeals to authority without substrate or lineage. Stop
Mythology says: name the substrate, cite the lineage, state
the falsifier.

### Vibes-based reasoning

"This feels right" / "intuition says X" / "the pattern
suggests Y" — these are calibration-level, not claim-level.
Useful for shaping investigation; insufficient for
acting-on-as-fact.

Amara's Beacon-safe translation:

```text
vibes → lineage + substrate + falsifier
poetic truth → Mirror unless Beacon-grounded
```

### Confirmation-flavored sample coverage

(Tied to Goodhart catch #3 above.) A sample of files audited
to "look clean" is mythology if asserted as tree clearance.
Stop Mythology says: full diff clearance or explicit loss
acceptance.

## Composes with

- `memory/feedback_veridicality_naming_for_bullshit_detector_graduation_aaron_concept_origin_amara_formalization_2026_04_24.md`
  — the formal-module rename (Veridicality is the scorer;
  Stop Mythology is the rule).
- `memory/feedback_amara_authority_rule_default_to_reversible_preservation_escalate_irreversible_loss_2026_04_28.md`
  — the authority rule operationalizes Stop Mythology at the
  decision level (preservation = "no false certainty"; ask =
  "I have insufficient evidence to act").
- `memory/feedback_sample_classification_is_calibration_not_clearance_amara_goodhart_catch_3_2026_04_28.md`
  — Goodhart catch #3, the substrate evidence for the rule.
- `memory/feedback_speculation_leads_investigation_not_defines_root_cause_aaron_2026_04_28.md`
  — same family; speculation is the inverse of evidence-based
  claim-making.
- `docs/ALIGNMENT.md` (SD-9) — the formal home of the
  three-element discipline.

## External lineage for the rule itself (Tier 2 self-application)

The rule applies to itself. Sources:

- **Karl Popper** (*The Logic of Scientific Discovery*, 1959;
  *Conjectures and Refutations*, 1963) — falsifiability as
  the demarcation of science from non-science.
- **Imre Lakatos** (*The Methodology of Scientific Research
  Programmes*, 1978) — research programmes are evaluated by
  what they predict + survive, not what they merely fit.
- **Wason 1960 / Klayman & Ha 1987** — confirmation bias
  literature.
- **Donella Meadows** (*Thinking in Systems*, 2008) — vague
  framing creates leverage points where unstated assumptions
  drive decisions.

## Pickup for future Otto

When about to make a claim:

1. Classify the tier: factory-local / generalized /
   foundational.
2. Check the threshold: substrate / + lineage / + falsifier.
3. If insufficient evidence at the relevant tier — STOP.
   Either gather more evidence, or downgrade the claim's
   scope to a tier where the available evidence suffices.
4. Never say "the mythology / spirit / vibe of X" without
   substrate. If tempted to, that's the rule firing.

When reading another agent's claim:

1. Ask: what tier? What evidence?
2. If tier-mismatch (claim at tier 3 with tier 1 evidence) —
   surface the gap, don't let the claim stand on vibes.

## Direct Aaron framing

> *"we also stop mythology with human intellucutiual lineage
> research and anchors."*

## Direct Amara naming + canonical form

> *"Stop Mythology: Factory-local claims can use substrate
> evidence. Generalized claims need external lineage. Big
> epistemic claims need SD-9: substrate evidence + external
> lineage + falsifier."*

> *"bullshit detector → stop mythology rule
> vibes → lineage + substrate + falsifier
> poetic truth → Mirror unless Beacon-grounded"*

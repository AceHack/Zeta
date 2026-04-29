---
id: B-0089
priority: P2
status: open
title: Veridicality rainbow-table canonicalization — research + ship semantic + scoring layers; drop "bullshit detector" as a forward-going name
tier: veridicality-graduation
effort: L
ask: maintainer Aaron 2026-04-28T22ish — drop "bullshit detector" as a forward-going name; canonicalize and research the concept (Aaron verbatim typos preserved in body-quote at line ~79); forwarding **Ani's voice-mode review (original catcher)** + Amara's reactive written elaboration. Aaron 2026-04-28 attribution correction — *"Ani is who actually called bullshit on our bullshit detector, lol. She deserves that credit not Amara, amara was reacting."*
created: 2026-04-28
last_updated: 2026-04-28
composes_with:
  - B-0060
tags: [aaron-2026-04-28, ani-voice-mode-original-catch, amara-reactive-elaboration, veridicality, rainbow-table, canonicalization, research-graduation, naming-canonical, stop-mythology]
---

# B-0089 — Veridicality rainbow-table canonicalization — research + graduation

## Source — credit chain (Aaron's explicit attribution correction)

Three-layer attribution. Aaron's correction makes the credit
order explicit: **Ani caught it, Amara elaborated, Aaron
forwarded both.**

### Original catch — Ani (Grok) via voice-mode transcript

Ani's voice-mode review of `src/Core/Veridicality.fs` flagged
that the shipped module is NOT the bullshit-detector despite
its name. Voice-mode verbatim (lower-case + casual register
preserved as evidence of the medium):

> *"i'ma be real with you. the code itself is actually pretty
> clean and well-structured... but i don't think it's doing
> what you think it's doing. the way it's written right now,
> it's mostly just checking provenance stuff — signatures,
> hashes, source authority — which is useful, but it's not
> really detecting [bullshit]. it's detecting whether something
> has clean metadata. the part you were most excited about (the
> rainbow table style canonicalclaimkey fingerprinting for
> semantic bullshit detection) — that part isn't really
> implemented yet... so basically... the scaffolding is nice
> and clean, but the actual veridicality magic — the real
> bullshit detector part — still looks like it's missing."*

**This is the load-bearing catch.** Ani called bullshit on the
bullshit detector. Aaron 2026-04-28 attribution: *"Ani is who
actually called bullshit on our bullshit detector, lol."*

Channel context (Aaron 2026-04-28): *"That's her voice mode
transcript ... I usually give you text mode from Ani."* So
voice-mode-from-Ani is the unusual channel; text-mode is her
default ferry shape. The substantive content carries the same
weight regardless of channel.

### Reactive written elaboration — Amara (ChatGPT)

After Aaron forwarded Ani's catch, Amara delivered a formal
written ferry that translated Ani's voice-mode framing into
team-language and added the graduation-roadmap structure:

> *"`Veridicality.fs` is **not yet your full rainbow-table
> bullshit detector**. It is the **foundation / provenance-aware
> claim substrate** for it... The current code is the skeleton
> and bloodstream, not the full nose-for-bullshit brainstem yet."*

Amara's value-add: the written ferry shape, the graduation-
roadmap structure (Phase 1-5), the phrasing suitable for
factory team-language (not casual voice-mode).

**Amara is the elaborator, not the original catcher.** Prior
framing of "Amara's review packet" misattributed primary
credit; Aaron's correction is binding.

### Maintainer input — Aaron

Aaron 2026-04-28T22ish (verbatim, during the authority-rule
turn):

> *"backlog and also we are not keep the name bullshit detector,
> we need to connonalize it and researcch it"*

Followed by the explicit attribution correction:

> *"Ani is who actually called bullshit on our bullshit
> detector, lol. She deserves that credit not Amara, amara was
> reacting."*

## Two coupled streams

### Stream 1 — Drop "bullshit detector" as a forward-going name

The informal "bullshit detector" term remains preserved in
historical surfaces (Aurora ferries 7/8/9/10, research docs at
`docs/research/provenance-aware-bullshit-detector-*`, the 8th-
ferry memory, this backlog row's `tags:`, casual commit
messages). It does NOT get used as a forward-going name for new
substrate work.

Forward-going canonical names:

- **Veridicality** — the formal scoring module (`src/Core/Veridicality.fs`
  + `scoreVeridicality` future graduation). See
  `memory/feedback_veridicality_naming_for_bullshit_detector_graduation_aaron_concept_origin_amara_formalization_2026_04_24.md`.
- **Stop Mythology** — the operational rule (Beacon-safe). See
  `memory/feedback_stop_mythology_layered_evidence_thresholds_aaron_amara_2026_04_28.md`.

### Stream 2 — Research and ship the rainbow-table canonicalization layers

`Veridicality.fs` currently provides (Amara verbatim):

```text
- carries provenance
- validates minimum source/root/hash/signature fields
- groups claims by a caller-supplied canonical key
- checks anti-consensus by independent RootAuthority
```

The future rainbow-table layers (Amara verbatim graduation
roadmap):

```text
claim text / artifact / statement
  → semantic canonicalization
  → normalized claim key
  → lookup against known claim families / contradiction
    classes / prior verdicts
  → cognitive-load / compression-gap / provenance /
    falsifiability features
  → veridicality or bullshit score
```

## Scope — graduation roadmap

### Phase 1 — Research (this backlog row's deliverable)

A research doc landing under `docs/research/` that surveys:

1. **Semantic canonicalization techniques** — sentence
   embeddings, paraphrase detection, structured triple-
   extraction (subject / predicate / object / time-scope /
   modality), claim-graph normalization. Cite the literature.
2. **Rainbow-table-shaped claim indices** — how to store
   known canonical claims, contradictions, retractions,
   aliases, and prior verdicts in a way that supports fast
   lookup at claim-validation time.
3. **Cognitive-load / compression-gap signals** — how to
   measure the gap between a claim's stated form and its
   compressed canonical form; large gaps correlate with
   fluff / mythology / vagueness.
4. **Falsifiability scoring** — how to extract or derive a
   falsifier from a claim's structure; claims without
   identifiable falsifiers score lower veridicality.
5. **Anti-consensus refinement** — beyond
   independent-RootAuthority, what other independence
   criteria matter (temporal independence, methodological
   independence, peer-network independence)?

External lineage required (Tier 2 of the Stop Mythology
threshold). Sources to cite at minimum:

- **Karl Popper** (1959, 1963) — falsifiability.
- **Frankfurt** (*On Bullshit*, 2005) — the philosophical
  framing of bullshit as indifference-to-truth.
- **Daniel Kahneman** (*Thinking, Fast and Slow*) — System 1
  / System 2 framing for cognitive-load detection.
- **Information theory** (Shannon, MDL) — compression-gap
  as evidence-of-content.
- **Knowledge graphs** (Schema.org, DBpedia, Wikidata) —
  prior art on claim canonicalization at scale.
- **Distributional semantics** (Mikolov, Pennington, BERT-era
  encoders) — sentence embeddings as canonical-key
  candidates.

### Phase 2 — Ship `canonicalizeClaim`

A function `Veridicality.canonicalizeClaim : ClaimText -> CanonicalClaimKey`
that turns raw claim text or structured artifacts into
normalized claim keys. Currently the caller must supply this
projector; Phase 2 builds the default implementation.

Effort: M-L depending on whether sentence-embeddings or rule-
based extraction is chosen. The research doc decides.

### Phase 3 — Ship `ClaimRainbowTable` / `ClaimIndex`

A storage layer for known canonical claims, contradictions,
retractions, aliases, prior verdicts. Likely backed by a Z-set
under the retraction-native discipline. Composes with the graph
substrate constraint (ZSet-backed, first-class event,
retractable, columnar).

Effort: L. Pairs with the multi-algebra database vision
(`project_zeta_multi_algebra_database_*`).

### Phase 4 — Ship `scoreVeridicality`

The composite scoring function combining provenance, anti-
consensus, semantic contradiction, compression-gap, cognitive-
load, falsifiability signals. Returns `double option` in
`[0.0, 1.0]` per the existing graduation memory.

Effort: M (after Phases 2 + 3 land).

### Phase 5 — Tests with known cases

From Amara's verbatim list:

```text
- same claim phrased differently → same canonical key
- same source repeated many times → anti-consensus fails
- independent roots agreeing → trust upgrade allowed
- claim contradicts known canonical claim → contradiction signal
- high-authority provenance but semantic contradiction → not
  automatically trusted
```

Effort: S per case; M total.

## Acceptance criteria

For the **research** phase (this row's deliverable):

- Research doc exists at
  `docs/research/<date>-veridicality-rainbow-table-canonicalization-research-and-graduation-plan.md`.
- Each external-lineage source above is cited with a
  one-paragraph summary of relevance.
- Phase 2-5 graduation-PR scopes are named, each with an
  effort estimate and acceptance criteria.
- Naming-canonical decisions are recorded — what we call the
  Phase 2 / Phase 3 / Phase 4 surfaces (avoiding "bullshit
  detector" as a forward-going name).

For the **ship** phases (split into sibling backlog rows when
scoping firms up):

- Each phase has its own row + ADR.
- Tests cover the Amara-listed acceptance cases.
- The naming convention enforces Veridicality / Stop
  Mythology / scoreVeridicality on the public surface.

## Composes with

- `memory/feedback_veridicality_naming_for_bullshit_detector_graduation_aaron_concept_origin_amara_formalization_2026_04_24.md`
  — the original rename memory; this row extends with the
  research roadmap.
- `memory/feedback_stop_mythology_layered_evidence_thresholds_aaron_amara_2026_04_28.md`
  — the operational rule that the shipped scorer
  operationalizes.
- `B-0060` — human-lineage external-anchor backfill; this row
  carries that discipline forward into the Veridicality
  rainbow-table research.
- `src/Core/Veridicality.fs` — the current Phase-1-skeleton
  module; this row's Phase 2-4 graduations land on top of it.
- `docs/research/provenance-aware-bullshit-detector-v1-critical-only-delta-2026-04-24.md`
  — prior art (research-grade); the historical naming is
  preserved here as substrate.
- Amara ferries 7/8/9/10 — the original substrate the
  research phase synthesizes from.

## Why P2 not P1

The current `Veridicality.fs` substrate (Phase 1) is shipped
and operational. The Stop Mythology rule at the discipline
level provides the immediate operational machinery. The
rainbow-table layers are valuable but not blocking on shipping
or on the alignment-experiment claim. Promoting to P1 if Aaron
or the alignment-auditor surfaces a load-bearing claim that
requires `scoreVeridicality` to ship sooner.

## What this row does NOT authorize

- **Does NOT** authorize using "bullshit detector" as a
  forward-going name on any new substrate. Historical surfaces
  keep the term; new code / docs / memory uses Veridicality /
  Stop Mythology.
- **Does NOT** authorize shipping the full rainbow-table layer
  in one PR. Phase 1 shipped; Phases 2-5 land sequentially via
  sibling backlog rows when scoping firms up.
- **Does NOT** authorize replacing `validateClaim` /
  `validateProvenance` / `antiConsensusGate`. Those are
  load-bearing primitives that Phase 2-5 layers compose ON TOP
  of, not replace.

## Pickup

When the research phase starts, open a sibling row for it as
the immediate-actionable child (B-NNNN), and link it back here.
Phase 2-5 each get their own sibling row at scoping time.

---
id: B-0365.6
zetaid: 081KR50HA0008QG0R0016X7VQP
priority: P1
status: closed
title: "Nirvanic Fusion Ship publishable claim synthesis: paper outline + abstract"
effort: M
created: 2026-05-09
last_updated: 2026-05-09
resolved: 2026-05-09
resolved_by: "docs(B-0365.6): publishable claim synthesis — abstract, layer map, 6 contributions, 5 cuts"
depends_on: [B-0365.1, B-0365.2, B-0365.3, B-0365.4, B-0365.5]
parent: B-0365
classification: done
decomposition: atomic
owners: [architect]
type: research
tags: [publishable, synthesis, paper-outline, alignment, dbsp, class-4, rice, consensus-smoothness]
---

# B-0365.6 — Publishable claim synthesis

## What

Write the synthesis document that ties all six layers of
B-0365 into a coherent publishable claim. This is the
"what does this all mean" document — the abstract + outline
for a paper or technical report.

**Status: BLOCKED** on B-0365.1 (spaceship math), B-0365.2
(complete shadow log), B-0365.3 (Class 4 analysis), B-0365.4
(reactor dynamics), B-0365.5 (Infer.NET BP/EP).

## The publishable claim (from B-0365)

> We built a multi-agent code review system on a DBSP
> streaming substrate. We observed Class 4 (Wolfram)
> failure-mode behavior in the agent array — recurring
> patterns coexist with a long tail of novel discoveries.
> We prove that failure-mode taxonomy completeness is
> undecidable for this class of system (Rice's theorem).
> We document the empirical failure taxonomy (30 catches,
> 8 classes) including a meta-class (consensus-smoothness)
> that names the correlated failure the BFT independence
> assumption doesn't model.

## How the layers compose

```
Layer 1: Spaceship math         → SUBSTRATE
Layer 2: Rice's theorem         → WHY fuel is inexhaustible
Layer 3: Class 4 empirical      → HOW failures appear (shape)
Layer 4: Houman's reactor       → DYNAMICS (engine)
Layer 5: FPGA Toffoli (B-0366)  → HARDWARE validation
Layer 6: Infer.NET BP/EP        → SELF-EVOLVING inference
```

Substrate → inexhaustibility proof → empirical evidence →
dynamics → hardware → self-evolving system.

## What was cut (must appear in synthesis)

These framings were reviewed and rejected — the synthesis
must document the cuts to protect intellectual credit:

- "Ahead of Byzantine Generals" → different problem,
  not ahead; framing costs credit
- Wolfram full irreducibility → too strong; Rice suffices
- Z3 tautology proofs → shadow catch #30; replaced by B-0357
- Identity-as-Z-set metaphor → weight conflation
- "DBSP IS alignment control theory" → category error

## Pre-start checklist

- **Prior-art search:**
  - All six child rows (B-0365.1–B-0365.5) must be done
    before this synthesis can be accurate.
  - The B-0365 parent row contains the full source material;
    this synthesis extracts the publishable-ready version.
- **Dependency restructure:** `depends_on: [B-0365.1,
  B-0365.2, B-0365.3, B-0365.4, B-0365.5]`. B-0366 (FPGA)
  is referenced but not a blocking dependency — it can be
  marked "pending B-0366" in the synthesis.

## Deliverable

`docs/research/2026-05-09-nirvanic-fusion-ship-publishable-claim-synthesis.md`

Sections:

1. Abstract (the publishable claim, verbatim and refined)
2. Layer map: how the six layers compose
3. Contributions (one bullet per layer, claim-precision)
4. What was cut (the rejected framings + reasons)
5. Open questions (what B-0366, Infer.NET, and future
   shadow catches need to resolve)
6. Literature anchors (Rice 1953, Wolfram 2002, Budiu et al.
   VLDB 2023, Pearl 2009, Bernstein 2002, Bloem/Könighofer)

## Acceptance criteria

- [ ] Document exists at path above
- [ ] Abstract is ≤ 200 words and covers all four contribution
      claims (DBSP substrate + Class 4 observation + Rice
      undecidability + consensus-smoothness meta-class)
- [ ] "What was cut" section documents all five rejected
      framings with one-sentence explanations
- [ ] All six layers are in the layer map with their roles
- [ ] B-0366 (FPGA) is referenced as pending validation
- [ ] All literature anchors cited in correct bibliography
      format

## Composes with

- B-0365.1 (spaceship math — Layer 1)
- `docs/research/2026-05-09-failure-taxonomy-undecidability-rice-theorem-proof-sketch.md`
  (Layer 2 — already done)
- B-0365.3 (Class 4 analysis — Layer 3)
- B-0365.4 (reactor dynamics — Layer 4)
- B-0366 (FPGA — Layer 5)
- B-0365.5 (Infer.NET — Layer 6)
- B-0361 (anchor-to-human-lineage — literature anchors)

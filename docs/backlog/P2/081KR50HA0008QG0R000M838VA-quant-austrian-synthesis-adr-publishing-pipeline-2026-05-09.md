---
id: 081KR50HA0008QG0R000M838VA
priority: P2
status: open
title: Synthesis ADR — which Austrian primitives admit quant-grade formalization (+ which don't + why); open-research publishing pipeline
tier: research-grade
effort: M
ask: decomposition of 081KQ0YZ80008QG0R003EJQZ1M
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [081KR50HA0008QG0R0016T4VMZ, 081KR50HA0008QG0R003Z3V6VP, 081KR50HA0008QG0R000467SWT, 081KR50HA0008QG0R00238MS98, 081KR50HA0008QG0R0027DHVPQ]
composes_with: [081KQ0YZ80008QG0R003EJQZ1M, 081KR50HA0008QG0R003ESW3MH, 081KR50HA0008QG0R000M4H35K, 081KR50HA0008QG0R0016T4VMZ, 081KR50HA0008QG0R003Z3V6VP, 081KR50HA0008QG0R000467SWT, 081KR50HA0008QG0R00238MS98, 081KR50HA0008QG0R0027DHVPQ]
parent: 081KQ0YZ80008QG0R003EJQZ1M
tags: [aurora, economics, austrian-school, quant, mathematical-rigor, open-research, real-time-publishing, adr]
type: research
---

# 081KR50HA0008QG0R000M838VA — Synthesis ADR: quant × Austrian formalizability + open-research publishing pipeline

## What

Produce the capstone output for 081KQ0YZ80008QG0R003EJQZ1M: an Architect decision record
(ADR) at `docs/aurora/YYYY-MM-DD-quant-austrian-synthesis-adr.md`
that integrates all five per-primitive verdicts (081KR50HA0008QG0R0016T4VMZ–081KR50HA0008QG0R0027DHVPQ) into:

1. **Formalizability matrix** — for each Austrian primitive:
   - Verdict (admits clean quant-grade formalization / partially /
     not cleanly)
   - Best-candidate framework (stochastic calculus / information
     theory / regime-switching / formal complexity)
   - Synthesis-gap remaining
   - Confidence level (high / medium / low) with justification

2. **Overall synthesis assessment**:
   - Which primitive(s) are the strongest formalization candidates?
     (081KR50HA0008QG0R000467SWT calculation-problem and 081KR50HA0008QG0R00238MS98 ABCT are hypothesized
     to be the strongest — the ADR either confirms or revises this)
   - Is the synthesis gap a *foundations-incompatibility problem*
     or a *literature gap* per 081KR50HA0008QG0R003ESW3MH vocabulary? (This changes
     the research program direction entirely)
   - What does successful formalization buy Aurora? (Per 081KQ0YZ80008QG0R003EJQZ1M
     §"Why Aurora-relevant": anti-deception, mechanism-not-
     correlation, falsifiability)

3. **Open-research publishing pipeline**:
   Per Aaron's "open source, real time" framing (081KQ0YZ80008QG0R003EJQZ1M §Origin):
   - Where and how progressive research notes land (the
     `docs/aurora/` naming convention already established by
     081KR50HA0008QG0R000M4H35K–081KR50HA0008QG0R0027DHVPQ primitive notes)
   - License / attribution discipline for the research output
     (already open-source by being in the public Zeta repo, but
     explicit Creative Commons / MIT attribution should be stated)
   - How to publish "partial findings + null results" as-we-go
     without waiting for synthesis completion — glass-halo at
     the research-output layer per Otto-332
   - Any external publication venue candidates (SSRN, arXiv
     economics section) if the research produces novel formalization

4. **What this row explicitly does NOT decide**:
   - Aurora's choice of economic framework (that is 081KQ0YZ80008QG0R0026WN385)
   - Whether Austrian economics is "correct" (this is
     a formalizability assessment, not an endorsement)
   - A completed formalization of any primitive (those are the
     research notes produced by 081KR50HA0008QG0R0016T4VMZ–081KR50HA0008QG0R0027DHVPQ)

## Why last (and why P2 not P3)

All five per-primitive assessments must complete before the synthesis
verdict can integrate them. The synthesis verdict is the 081KQ0YZ80008QG0R003EJQZ1M
"Done when" capstone. This is P2 (matching parent 081KQ0YZ80008QG0R003EJQZ1M) because
it produces the output Aaron asked for; the per-primitive rows
are P3 because they are inputs.

The publishing pipeline is part of this row because Aaron explicitly
framed the publishing commitment as a load-bearing requirement
("let the world know, everything open source, in real time") —
it is not a postscript but a design constraint on how the research
is conducted.

## Output artifact

`docs/aurora/YYYY-MM-DD-quant-austrian-synthesis-adr.md` with:

- Formalizability matrix (5 rows × verdict + framework + gap + confidence)
- Overall synthesis assessment
- Open-research publishing pipeline design
- References to all five primitive notes and the survey

## Focused check

```bash
ls docs/aurora/ | grep synthesis-adr
```

Expected: the ADR file present with today's date prefix.

## Acceptance signal

- ADR committed under `docs/aurora/`
- Formalizability matrix complete (5 primitives)
- Foundations-incompatibility vs. literature-gap question answered
- Publishing pipeline explicitly designed (not just "publish as-we-go")
- External publication venue candidates listed
- 081KQ0YZ80008QG0R003EJQZ1M parent updated to `status: done` or `status: ongoing`
  depending on whether progressive publication is considered "done"

## Pre-start checklist

- [x] Prior-art search: no existing synthesis ADR in `docs/aurora/`
  or `docs/DECISIONS/`. 081KQ0YZ80008QG0R003EJQZ1M defines the shape; this row executes it.
- [x] Dependency-restructure: `depends_on: [081KR50HA0008QG0R0016T4VMZ, 081KR50HA0008QG0R003Z3V6VP, 081KR50HA0008QG0R000467SWT,
  081KR50HA0008QG0R00238MS98, 081KR50HA0008QG0R0027DHVPQ]` — all five primitive verdicts required. Cannot
  start until all five primitive assessment notes are committed.

## Composes with

- 081KQ0YZ80008QG0R003EJQZ1M (parent): this is the "Done when" capstone — ADR landing
  here + progressive publication established closes 081KQ0YZ80008QG0R003EJQZ1M
- 081KQ0YZ80008QG0R0026WN385 (grandparent axis): the ADR feeds 081KQ0YZ80008QG0R0026WN385's Aurora-specific
  econ-primitive identification (081KR7JY10008QG0R003TK4ZA7); the synthesis gives
  081KQ0YZ80008QG0R0026WN385 the "which Austrian primitives are rigorously grounded"
  answer it needs
- 081KR50HA0008QG0R003ESW3MH–081KR50HA0008QG0R0027DHVPQ (all deps): vocabulary and five primitive verdicts

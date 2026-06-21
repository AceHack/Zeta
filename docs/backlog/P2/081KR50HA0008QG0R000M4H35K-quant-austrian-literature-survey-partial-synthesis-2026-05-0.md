---
id: 081KR50HA0008QG0R000M4H35K
priority: P3
status: open
title: Literature survey — existing partial quant × Austrian synthesis attempts; annotated bibliography with synthesis-gap remaining after each
tier: research-grade
effort: M
ask: decomposition of 081KQ0YZ80008QG0R003EJQZ1M
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [081KR50HA0008QG0R003ESW3MH]
composes_with: [081KQ0YZ80008QG0R003EJQZ1M, 081KR50HA0008QG0R003ESW3MH, 081KR50HA0008QG0R0016T4VMZ, 081KR50HA0008QG0R003Z3V6VP, 081KR50HA0008QG0R000467SWT, 081KR50HA0008QG0R00238MS98, 081KR50HA0008QG0R0027DHVPQ, 081KR50HA0008QG0R000M838VA]
parent: 081KQ0YZ80008QG0R003EJQZ1M
tags: [aurora, economics, austrian-school, quant, mathematical-rigor, open-research, literature-survey]
type: research

---

# 081KR50HA0008QG0R000M4H35K — Literature survey: partial quant × Austrian synthesis attempts

## What

Produce a committed survey doc at
`docs/aurora/YYYY-MM-DD-quant-austrian-synthesis-survey.md`
per the "Done when" criteria in 081KQ0YZ80008QG0R003EJQZ1M.

The survey catalogs and classifies each existing attempt using the
vocabulary from 081KR50HA0008QG0R003ESW3MH. For each source:

1. **Citation** (author, year, title, URL / ISBN)
2. **Austrian content** — which Austrian primitive(s) it engages
3. **Quant content** — which mathematical tools it uses
4. **Formalization type** (per 081KR50HA0008QG0R003ESW3MH vocabulary: representation /
   rigorous-proof / empirical-embedding)
5. **Synthesis-gap remaining** — what the work still leaves unformalized
   and why (using the 081KR50HA0008QG0R003ESW3MH definition of "synthesis gap")
6. **Verdict** — does it close the synthesis gap for this primitive,
   partially address it, or leave it open?

## Minimum corpus (per 081KQ0YZ80008QG0R003EJQZ1M §"Owed work")

- **Selgin / White / Dowd** — free-banking quant rigor on monetary
  equilibria (closest to "Austrian quant")
- **Roger Garrison** — diagrammatic capital-structure in *Time and
  Money* (2001); not SDE-level but is the most developed visual-formal
  treatment of ABCT
- **Saifedean Ammous** — *Bitcoin Standard* stock-to-flow model;
  empirical-embedding of sound-money, not measure-theoretic
- **Steve Keen** — Minsky-flavored disequilibrium models using ODEs;
  post-Keynesian, not Austrian, but math-heavy + shares anti-equilibrium
  stance; classify explicitly (is it Austrian-adjacent or just
  "disequilibrium"?)
- **Agent-based modeling literature** incorporating Austrian primitives
  (e.g., Santa Fe Institute complexity economics, Axelrod-style ABM
  with heterogeneous agents and capital accumulation)
- Any recent (post-2010) mathematical-economics papers that engage
  ABCT formally (search: "Austrian business cycle theory formal model"
  / "Hayekian triangle stochastic" / "time preference stochastic")

## Search strategy (Otto-364 search-first)

Per Otto-364: WebSearch before asserting. Do not rely on training data
for the state of the literature. Use:

- Google Scholar: "Austrian business cycle theory stochastic model"
- Google Scholar: "Hayekian triangle formal mathematical"
- Google Scholar: "time preference stochastic calculus"
- SSRN: "quant Austrian economics"
- NBER: "Austrian school mathematical economics"

Date the searches in the output doc.

## Output artifact

`docs/aurora/YYYY-MM-DD-quant-austrian-synthesis-survey.md`
with:

- A classification table (one row per source)
- Narrative for each entry explaining the synthesis-gap remaining
- Overall synthesis-gap summary after all sources reviewed
- A "What's actually been done vs. what's missing" conclusion
  (input to 081KR50HA0008QG0R000M838VA ADR)

## Focused check

```bash
ls docs/aurora/ | grep synthesis-survey
```

Expected: the survey doc present with today's date prefix.

## Acceptance signal

- Survey doc committed under `docs/aurora/`
- Minimum corpus covered (all 5 categories above)
- Each entry classified per 081KR50HA0008QG0R003ESW3MH vocabulary
- Synthesis-gap-remaining stated for each
- Searches dated (Otto-364 compliance)

## Pre-start checklist

- [x] Prior-art search: no existing survey doc in `docs/aurora/` or
  memory files. 081KQ0YZ80008QG0R003EJQZ1M §"Owed work" mentions the corpus but does not
  execute the survey.
- [x] Dependency-restructure: `depends_on: [081KR50HA0008QG0R003ESW3MH]` — vocabulary
  required to correctly classify each source's formalization type.
  081KR50HA0008QG0R0016T4VMZ–081KR50HA0008QG0R0027DHVPQ depend on this survey for the "prior attempts per
  primitive" context.

## Composes with

- 081KQ0YZ80008QG0R003EJQZ1M (parent): directly implements the "Survey doc" done-when criterion
- 081KR50HA0008QG0R003ESW3MH (dep): vocabulary from this row drives classification
- 081KR50HA0008QG0R0016T4VMZ–081KR50HA0008QG0R0027DHVPQ (downstream): each primitive assessment row uses
  this survey as its "prior work on this primitive" input
- 081KR50HA0008QG0R000M838VA (downstream): the synthesis ADR's "what exists" section
  cites this survey

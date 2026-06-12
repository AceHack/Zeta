---
id: B-0381
zetaid: 081KR50HA0008QG0R000M4H35K
priority: P3
status: open
title: Literature survey — existing partial quant × Austrian synthesis attempts; annotated bibliography with synthesis-gap remaining after each
tier: research-grade
effort: M
ask: decomposition of B-0023
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [B-0380]
composes_with: [B-0023, B-0380, B-0382, B-0383, B-0384, B-0385, B-0386, B-0387]
parent: B-0023
tags: [aurora, economics, austrian-school, quant, mathematical-rigor, open-research, literature-survey]
type: research

---

# B-0381 — Literature survey: partial quant × Austrian synthesis attempts

## What

Produce a committed survey doc at
`docs/aurora/YYYY-MM-DD-quant-austrian-synthesis-survey.md`
per the "Done when" criteria in B-0023.

The survey catalogs and classifies each existing attempt using the
vocabulary from B-0380. For each source:

1. **Citation** (author, year, title, URL / ISBN)
2. **Austrian content** — which Austrian primitive(s) it engages
3. **Quant content** — which mathematical tools it uses
4. **Formalization type** (per B-0380 vocabulary: representation /
   rigorous-proof / empirical-embedding)
5. **Synthesis-gap remaining** — what the work still leaves unformalized
   and why (using the B-0380 definition of "synthesis gap")
6. **Verdict** — does it close the synthesis gap for this primitive,
   partially address it, or leave it open?

## Minimum corpus (per B-0023 §"Owed work")

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
  (input to B-0387 ADR)

## Focused check

```bash
ls docs/aurora/ | grep synthesis-survey
```

Expected: the survey doc present with today's date prefix.

## Acceptance signal

- Survey doc committed under `docs/aurora/`
- Minimum corpus covered (all 5 categories above)
- Each entry classified per B-0380 vocabulary
- Synthesis-gap-remaining stated for each
- Searches dated (Otto-364 compliance)

## Pre-start checklist

- [x] Prior-art search: no existing survey doc in `docs/aurora/` or
  memory files. B-0023 §"Owed work" mentions the corpus but does not
  execute the survey.
- [x] Dependency-restructure: `depends_on: [B-0380]` — vocabulary
  required to correctly classify each source's formalization type.
  B-0382–B-0386 depend on this survey for the "prior attempts per
  primitive" context.

## Composes with

- B-0023 (parent): directly implements the "Survey doc" done-when criterion
- B-0380 (dep): vocabulary from this row drives classification
- B-0382–B-0386 (downstream): each primitive assessment row uses
  this survey as its "prior work on this primitive" input
- B-0387 (downstream): the synthesis ADR's "what exists" section
  cites this survey

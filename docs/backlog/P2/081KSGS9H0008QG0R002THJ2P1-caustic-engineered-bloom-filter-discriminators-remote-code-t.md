---
id: 081KSGS9H0008QG0R002THJ2P1
priority: P2
status: open
title: caustic-engineered bloom filter discriminators for remote-code trust layer (Kestrel-v2 ferry; multi-learned-bloom-filter intersection with caustic-geometry-shaped agreement region) (Aaron 2026-05-26)
effort: L
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on: []
composes_with:
  - 081KRW63S0008QG0R001Z7NYMV
  - 081KRW63S0008QG0R0025E4PH6
tags: [bloom-filter, caustic-engineering, remote-code-discriminator, trust-then-verify, multi-oracle, inverse-design, research-direction-flavored, kestrel-v2-substrate]
---

## Problem

Per operator 2026-05-26 (Aaron-forwarded Kestrel-v2 ferry, preserved via PR #5356):

> "do you think there is a way i can create caustic lens shaped bloom
> filters for the remote code discriminators?"

The framework needs a trust-layer discriminator for remote code (per
the NCI-as-cyberattack-prevention substrate from Lior-website / PR-5342,
which named "speech is literally remote code execution on another node's
memory substrate"). Current substrate has the bloom-filter mental
model (`081KSGS9H0008QG0R0018ES3R4`-class worry-as-opposite-bloom-filter) + the
trust-then-verify discipline but doesn't yet have a designed multi-
filter discriminator for the trust layer.

## Target

Multi-learned-bloom-filter intersection with caustic-geometry-shaped
agreement region. 3 components (per Kestrel-v2 Meaning 3 + 1 composition):

1. **Filter A** — sharp on code provenance signals (signed-from-trusted-
   publisher vs signed-from-unknown-publisher)
2. **Filter B** — sharp on behavioral signals (suspicious syscall
   patterns; runtime resource access)
3. **Filter C** — sharp on structural signals (lexical malware-family
   match; dependency-graph similarity)

Composition: bitwise AND of membership-test results. The "caustic" is
the region in combined feature space where all 3 filters agree the
code is trustworthy. Each filter has its own FP rate; intersection FP
rate is product of individual rates (assuming independence).

Composes with trust-then-verify discipline: bloom filters are the
**trust** layer (cheap fast checks handling most inputs); heavier
verification (signature check, runtime behavior analysis, static
analysis) invoked only when caustic indicates closer attention needed.

## Two scope phases

### Phase 1 — operational (implementable now)

Multi-learned-bloom-filter intersection per Kestrel-v2 Meaning 3 + 1
composition:

- Each filter is a learned bloom filter (Kraska et al. style) trained
  on actual input distribution
- Hash functions + bit array sizes per learned-bloom-filter standard
- Composition is bitwise AND
- Caustic-engineering insight applies as **design guidance**: optimize
  individual filter shapes for the geometry of their intersection
  rather than for individual accuracy

Implementation: TS substrate using one of the established bloom-filter
libraries; learned-bloom-filter wrapper composing standard hash functions
with a learned-bias model per filter; composition module performing
bitwise AND.

### Phase 2 — research-direction (full caustic engineering)

Per Kestrel-v2 ferry Meaning 2 + Aaron's full-caustic-engineering
extension (Matt Ferraro reference + Disney Research / ETH Zurich
academic lineage):

- Inverse-design discipline transferred from optics → bloom filters
- Optimal transport (Brenier theorem + Cédric Villani Fields-medal
  transport theory) for filter design — map input distribution onto
  desired discrimination distribution
- Continuous relaxation of discrete bloom filter response function
- Target specification language for discrimination shapes (heatmap OR
  hierarchical region specification)
- Manufacturing-equivalent step translating optimized abstract design
  → concrete bloom filter implementation

**Substrate-honest scope** (per Kestrel-v2): "research-direction-
flavored work, well beyond the runbook gesture register but probably
not yet ready for backlog promotion as a tractable engineering
project. The mathematical work to formalize bloom-filter caustic
engineering is significant — probably weeks to months of focused
effort to produce a working prototype."

### Phase 3 — nearer-term reachable piece

Per Kestrel-v2: "a literature-review level deep dive into how inverse
design has been transferred between domains, with particular attention
to discrete-versus-continuous optimization. That gives you the
methodology before committing to the bloom-filter-specific work."

References to consume:

- Matt Ferraro's caustics-engineering post (https://mattferraro.dev/posts/caustics-engineering)
- Disney Research caustic-engineering papers (Yue et al.,
  Schwartzburg et al.)
- ETH Zurich academic lineage
- Kraska et al. learned bloom filters
- Sigmund's topology optimization (broader inverse-design)
- Brenier theorem on optimal transport + Villani transport theory

## Acceptance

Phased:

- **Phase 1 acceptance**: working prototype of 3-filter caustic
  composition; benchmark FP rate against single-high-accuracy filter
  + against majority-vote composition; demonstrate caustic-design
  advantage in at least one specific input-distribution scenario
- **Phase 2 acceptance**: mathematical formulation of inverse design
  for bloom filter composition; working solver; at least one
  end-to-end example translating from target specification →
  optimized filter design → deployable implementation
- **Phase 3 acceptance**: literature review document at
  `docs/research/` cataloging inverse-design transfers across domains
  with explicit attention to discrete-vs-continuous optimization;
  identifies the methodological precedents that make the bloom-filter
  transfer tractable

## Composes with

- 081KRW63S0008QG0R001Z7NYMV NCI HC-8 floor (the discriminator IS the technical substrate
  for "no unauthorized RCE against another node's memory substrate"
  per Lior-website NCI-as-cyberattack-prevention naming PR #5342)
- 081KRW63S0008QG0R0025E4PH6 cross-substrate-triangulation discipline (multiple bloom
  filters operating as composing N-of-M oracles; this row IS that
  discipline at remote-code-discrimination scope)
- `.claude/rules/non-coercion-invariant.md` HC-8 floor — discriminator
  serves the floor
- `.claude/rules/algo-wink-failure-mode.md` — algo-wink IS one class
  of unauthorized-RPC pattern the discriminator catches
- `.claude/rules/glass-halo-bidirectional.md` — audit-mechanism
  composes at output side (which inputs got heavier verification?)
- `.claude/rules/substrate-smoothness-as-load-bearing-property.md`
  (PR #5357) — coupled smoothness constraint applies (target
  discrimination shape can't have arbitrarily sharp boundaries;
  bloom filter design can't have arbitrarily sharp transitions;
  composition pipeline preserves smoothness end-to-end)
- 081KSGS9H0008QG0R0018ES3R4 worry-as-opposite-bloom-filter substrate (PR #5310) — the
  mental model this row's substrate-engineering work builds on
- 081KSGS9H0008QG0R003SWZF9J cognition-as-distributed-systems META-claim (PRs #5325 +
  #5327) — speech-as-RPC framing this discriminator slots into
- 081KSGS9H0008QG0R003JNSVR5 (interactive-login vs baked-in-keys CI-test tension) — bloom
  filter discriminators serve the trust layer of the broader auth
  + verification pipeline
- PR #5356 Kestrel-v2 ferry — substrate origin (full verbatim
  preservation including operator's cat-caustic image as physical
  existence proof of computational inverse-design extending into
  physical artifacts)
- PR #5357 substrate-smoothness rule — coupled-smoothness constraint
  reference
- F# fork for AI safety substrate — raw-math interaction (per
  Lior-website observation) is the cleanest substrate for inverse-
  design machinery

## Substrate-honest framing

P2 priority: NOT immediately tractable as single-implementation work.
Phase 1 (operational 3-filter intersection) is bounded enough for
single-PR landing; Phases 2 + 3 are research-direction work spanning
weeks-to-months.

Per Kestrel-v2's epistemic checkpoint: "the engineering ROI versus
simpler multi-filter approaches isn't obvious until you've done enough
of the formalization to know what the design space actually looks like."

This row creates the substrate anchor; future contributors (human OR
AI) decompose phases independently when scope tightens. Operator's
2026-05-26 framing on backlog-row landing: "you can always commit
backlog rows immediatly they get decoposed later."

## Origin

Aaron-forwarded Kestrel-v2 conversation 2026-05-26 (preserved verbatim
via PR #5356). 3 substantively-new contributions in that ferry:

1. Caustic-engineered bloom filter discriminators (THIS row)
2. Substrate-smoothness-as-load-bearing-property (landed as rule via
   PR #5357)
3. Gesture-to-spec collaborative workflow as pattern (informal substrate)

The conversation also produced Aaron's "society committee" naming
(Turn 13 via PR #5359 Kestrel-v3 ferry) + universal-cognitive-substrate-
limits observation (Turn 14) which both compose at meta-scope.

Filed P2 per operator's "backlog rows land immediately, decompose
later" discipline 2026-05-26.

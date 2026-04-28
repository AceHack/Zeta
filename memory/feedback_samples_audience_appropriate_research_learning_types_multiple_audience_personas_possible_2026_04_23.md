---
name: Samples are audience-appropriate — multiple sample types (research + learning + potentially more) tailored to audience; current "newcomer readability" framing narrows to ONE audience when multiple exist; audience-persona roster may need expansion
description: Aaron 2026-04-23 nuance on the samples-vs-production memory — *"What does Aaron prefer for sample code style versus production code style in Zeta? we need reserch and learning samples, the samples should be appropreate to the audiance and maybe we need more audiance perosnas too, not sure"*. Prompted by NSA-004 test that surfaced the current "newcomer readability" framing. Aaron sharpens: samples are plural (research + learning + probably more), each style-matched to its audience. Current audience-persona roster (Iris library consumers / Bodhi contributors / Daya agent cold-start) may need additions (Research audience? Evaluator? Paper reader?). Delegated-with-nudge-latitude: Aaron says *"not sure"* — decision is mine with his after-the-fact nudge.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Samples are audience-appropriate — multiple audiences, multiple sample types

## Verbatim (2026-04-23)

> What does Aaron prefer for sample code style versus
> production code style in Zeta? we need reserch and learning
> samples, the samples should be appropreate to the audiance
> and maybe we need more audiance perosnas too, not sure

## Verbatim confirmation (2026-04-23, Otto-17)

> good initial categorization i like it a lot

Aaron reviewed the four-row table (learning / research /
production / tests) and confirmed the categorization works.
The framing is now validated discipline, not just a
proposal. **Learning = time-to-first-understanding;
research = time-to-verify-claim** is the confirmed axis.
Execute against this axis without further re-litigation.

## What this sharpens

The earlier memory
(`feedback_samples_readability_real_code_zero_alloc_2026_04_22.md`)
framed samples as a single category: *"samples optimize for
newcomer readability."* Aaron now sharpens: **samples are
plural.** Each sample type is style-matched to its audience.

### Current framing (too narrow — ONE audience)

| Category | Style | Audience |
|---|---|---|
| Samples | Newcomer readability (plain-tuple `ZSet.ofSeq`) | Newcomers |
| Production | Zero-alloc (struct-tuple `ZSet.ofPairs`, `Span`, `ArrayPool`) | Production users |
| Tests | Mixed by property tested | Regression coverage |

### Sharpened framing (audience-appropriate)

| Sample type | Style | Audience | Purpose |
|---|---|---|---|
| **Learning samples** | Newcomer readability — plain constructs, minimal ceremony, comment-heavy, step-by-step flow | Newcomers / students / first-time contributors | Teach the concept; optimize for comprehension |
| **Research samples** | Paper-grade clarity — algebraic shape visible, invariants labelled, references to source literature, proof-of-property comments | Researchers / paper reviewers / evaluators | Communicate the research claim; optimize for verification |
| **Production code** | Zero-alloc, `Span`, `ArrayPool`, struct-tuples — all the discipline | Production users / shipping code | Optimize for allocation / cache / throughput |
| **Tests** | Mixed by property tested | Regression-coverage | Keep the contract |
| **(Potentially more)** | TBD | TBD | TBD |

Aaron's *"maybe we need more audiance perosnas too, not
sure"* — open question.

## Research samples vs. learning samples — the distinction

Research samples and learning samples both differ from
production code by prioritising clarity over allocation
discipline, but they differ from each other in what clarity
they optimise:

### Learning samples

**Audience**: newcomers / students / first-time contributors
/ someone evaluating Zeta to decide whether to try it.

**Style signature**:

- Plain types over custom structs (`ZSet.ofSeq`, not
  `ZSet.ofPairs`)
- Explicit intermediate variables over fluent chains (one
  step per line; visible flow)
- Domain-labelled variable names (`customerOrders`, not
  `zs`)
- Comment every step's purpose
- Prefer two separate operations over one fused smart one
- Error messages lean didactic
- Idiomatic F# with beginner-friendly features (records,
  tuples, pattern matching) over advanced features
  (discriminated unions with phantom types, GADTs via
  tricks)

**What they optimise**: time-to-first-understanding.

**Where they live**: `samples/Learning/**` or similar;
companion to README examples.

### Research samples

**Audience**: researchers / paper reviewers / evaluators /
someone doing verification-drift audits.

**Style signature**:

- Algebraic shape visible — operator names match paper
  notation (`D`, `I`, `z⁻¹`, `H` where the paper uses those)
- Invariants labelled inline as comments — e.g. `// D is
  a homomorphism: D(f ∘ g) = D(f) ∘ g + f ∘ D(g)`
- References to source literature inline — e.g. `// Per
  Budiu et al. VLDB 2023 §3.2`
- Proof-of-property comments where invariants should hold
  — e.g. `// Claim: result.Weight = Σ inputs[i].Weight for
  all i; test in Tests.FSharp/Zset.Tests.fs:143`
- Prefer named intermediate values matching paper variables
- Minimal ceremony but no hand-waving — every
  non-obvious step has a justification pointer

**What they optimise**: time-to-verify-the-claim.

**Where they live**: `samples/Research/**` + adjacent to
research docs under `docs/research/`.

### Key overlap

Both types share:

- Readability over allocation-discipline (neither is
  production)
- Minimal ceremony
- Clear flow

### Key divergence

- **Learning** optimises for someone who doesn't yet know
  the thing; research optimises for someone who already
  knows the thing and wants to verify our implementation
  matches their expectation.
- Learning samples can over-simplify; research samples
  cannot.
- Learning samples avoid advanced features; research
  samples use whatever feature best communicates the
  algebraic shape.

## Audience-persona roster — potential expansion

Current audience-persona roster (per
`docs/CONFLICT-RESOLUTION.md` + related):

- **Iris** — first-10-minutes library-consumer experience
- **Bodhi** — first-60-minutes contributor experience
- **Daya** — agent cold-start experience
- **Kai** — positioning / framing (may serve as partial
  audience persona)

Gaps Aaron's directive surfaces:

- **Researcher audience** — someone evaluating for a paper
  / research-fit / verification. A *Research audience*
  persona could audit research samples + the research-doc
  layer. Candidate: **Hiroshi** (complexity-theory reviewer)
  partially covers this; a dedicated research-audience
  persona would be purer.
- **Evaluator audience** — someone deciding whether to
  adopt / fund / partner. A *Decision audience* persona
  would audit the "first 5 minutes of evaluating whether
  Zeta fits our use case" — adjacent to Iris but narrower
  (executive decision, not library consumer).
- **Paper reviewer audience** — covered by the existing
  paper-peer-reviewer role.

Decision: **defer expansion until audience-specific sample
types land first**. The factory has a bias toward
persona-proliferation; audience-persona expansion should
wait until there's real sample-content to audit against.
Aaron's *"not sure"* framing matches this — delegate with
nudge-latitude.

## How to apply

### For existing samples

- Inventory existing samples in `samples/**`. Classify each
  as learning-sample / research-sample / other.
- Where a sample is ambiguous (tries to serve multiple
  audiences at once), split into two audience-appropriate
  versions.

### For new samples

- Declare the audience in the sample's top comment block.
  Example: `// AUDIENCE: learning (newcomer; zero prior
  knowledge of DBSP)`.
- Match style to declared audience per the signatures
  above.

### For the sample directory structure

- Migrate to `samples/Learning/**` + `samples/Research/**`
  subdirectories (not yet done; opportunistic-on-touch).
- Keep a top-level `samples/README.md` explaining the
  audience-subdirectory convention.

### For Iris / Bodhi / Daya audits

- Iris audits learning samples (newcomer-onboarding match).
- Bodhi audits contributor-onboarding samples (rare category
  — if it exists, tests-as-tutorials material).
- Daya audits agent cold-start samples (the CLAUDE.md + NSA
  path samples).
- No-one currently audits research samples by role —
  opportunity for expansion if research-sample volume grows.

## What this is NOT

- **Not a retraction of samples-for-newcomers.** Newcomer
  readability remains the style for learning samples. The
  category has just split into multiple, not changed in
  content.
- **Not a mandate for research samples to exist yet.**
  Zeta has research content (under `docs/research/`); the
  sample companion may or may not be worth building per
  case. Each research sample earns its existence.
- **Not persona-proliferation authorisation.** Aaron said
  *"not sure"* on audience-persona expansion. New personas
  earn their existence; defer until sample-content makes
  the case.
- **Not a CURRENT-aaron.md §6 rewrite.** The CURRENT
  section stays with the current framing; this memory adds
  the sharpening. When the sample-directory refactor
  lands, CURRENT gets updated to reflect the multi-
  audience framing.
- **Not an NSA-test failure.** NSA-004 passed per the
  existing framing; Aaron's response to the PASS output
  was the sharpening, not a critique of the NSA.
- **Not a replacement of the allocation-guarantees
  discipline.** Production code + `docs/BENCHMARKS.md`
  "Allocation guarantees" discipline remains the
  contract. Samples of either kind don't need the
  discipline; production does.

## Composes with

- `feedback_samples_readability_real_code_zero_alloc_2026_04_22.md`
  (the parent memory this sharpens)
- `feedback_upstream_is_first_class_look_upstream_before_assuming_misspelling_2026_04_22.md`
  (research samples that reference upstream projects use
  upstream-canonical spellings verbatim — e.g. "reaqtive"
  not "reactive")
- `docs/CONFLICT-RESOLUTION.md` (Iris / Bodhi / Daya /
  Kai audience personas; potential expansion)
- `CURRENT-aaron.md` §6 (code-style discipline; stays
  current but gains "multiple sample audiences" footnote
  on next-touch)
- `feedback_open_source_repo_demos_stay_generic_not_company_specific_2026_04_23.md`
  (samples stay generic across audiences; company-specific
  content stays in per-user memory)

## Open question for Aaron's nudge

The *"maybe we need more audiance perosnas too, not
sure"* framing signals delegated-decision with
after-the-fact nudge. If during real execution I find:

- Research samples need a dedicated audit persona → propose
  a name + scope; Aaron nudges
- Evaluator audience shows up as a real audit target →
  propose a persona; Aaron nudges
- Existing personas (Iris / Bodhi / Daya / Kai) stretch to
  cover new audiences → no new persona needed; confirm with
  Aaron on next-touch

Default: **stretch existing personas first, propose new
personas only when stretching visibly fails.** Matches
persona-sprawl discipline.

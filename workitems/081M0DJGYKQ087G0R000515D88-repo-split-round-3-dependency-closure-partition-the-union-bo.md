---
id: 081M0DJGYKQ087G0R000515D88
type: task
state: backlog
priority: P2
slug: repo-split-round-3-dependency-closure-partition-the-union-bo
title: "Repo-split round 3: dependency-closure partition, the union bottleneck measured, CCP-vs-CRP synthesis"
created: 2026-08-19T17:44:00.000Z
depends_on: []
composes_with:
  - docs/research/2026-08-19-repo-split-round-3-the-union-is-the-bottleneck-dependency-closure-measured-against-change-rate.md
  - docs/research/2026-08-19-repo-split-round-2-the-change-rate-partition-is-measured-and-the-first-cut-is-not-the-one-the-adr-drew.md
  - 081M0DG68ZH087G0R001RMAX88
  - docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md
---

# Repo-split round 3: dependency-closure partition, the union bottleneck measured

The design round landed as
`docs/research/2026-08-19-repo-split-round-3-the-union-is-the-bottleneck-dependency-closure-measured-against-change-rate.md`.
This row tracks what it left open.

## Hypothesis tested (Aaron's, formed before Zeta)

> "without hardcore tooling support for monorepo, the union of everything
> becomes the bottleneck, splitting it out actually can speed things up and
> help decouple everything from everything"

Holds on this tree. And the conditional is SATISFIED, not falsified: the
tooling is 90% built and **never invoked**, which at the outcome layer is the
same as absent. The discovery changes only the PRICE of the remedy (wiring an
existing graph costs less than adopting one) -- it strengthens the diagnosis,
because the union persisted even with the graph sitting in the tree. The first
draft said "the conditional is false"; that inference was wrong and is
corrected in place in the doc's §0 rather than silently amended.

## The thesis (Aaron, 2026-08-19)

> "LLMs and Humans are both bad at holding increment graphs in their context
> window ... this is why i'm trying to externalize it everywhere this is
> similar to the agreement of meaning between AIs and Humans just on the
> simplest level of 'why split'"

- **REGISTER (Aaron's own label, and it is load-bearing):** this is *"an
  assumption of mine"*, and it may be **unmeterable by direct observation** --
  LLMs shift behaviour under evaluation, so "cannot hold it" and "did not hold
  it while watched" are not separable by the observation. In-repo anchor:
  `docs/ALIGNMENT.md` §"sleeping bear conjecture" (kept as conjecture; four
  candidate mechanisms ranked by evidence). The doc may say **observed not to,
  under conditions that cannot separate cannot from did-not** -- not "cannot".
- My drafting went wrong twice here and both are corrected in place, not
  softened: first pass filed it as cognitive load ("tedious, so skipped"),
  second pass over-corrected to a flat capacity limit used as a premise.
- **The recommendation does not depend on how the confound resolves**, which is
  why it is safe: if the limit is real, externalizing is necessary; if it is
  strategic or trust-conditional, externalizing is still what makes AI/human
  agreement checkable rather than asserted. Same structure ALIGNMENT.md uses --
  "the architecture works whether or not the strong version is true".
- The measured findings (94% waste, 82% of real gate failures in install, 107
  targets / 0 workflow references) are `metered` and carry the argument alone.
- So externalization is the point; the 94% waste is a SYMPTOM. Third
  evaluation criterion, applied to every option: **does this externalize the
  increment graph into a checkable artifact?**
- The externalized graph is a **shared external referent** -- what lets an AI
  and a human check they mean the same thing rather than assert it.
- **Externalizing was necessary and insufficient.** Both halves true:
  build-graph.json exists and is a real referent; zero workflows read it.
- Not a new discipline here -- same move as the carved-sentence rule, the
  MEMORY.md 210KB->1.5KB hub, and DV2.0 hub/satellite. The build graph is the
  instance the repo externalized and then never fetched.

## Settled (measured, re-runnable)

- Union toolchain: **11,533 MB / 23 components** (developer clone). CI standard
  tier: ~1.5 GB per job restore (`install-v2` cache = 1,487 MB). Two different
  unions; conflating them inflates the result 7x.
- **20 gate jobs install the union; 10 of them need only `bun` (178 MB)** --
  65x over-provision against the developer union, 8x against the CI one.
- **94% of provisioning work per gate run is waste.** On a GREEN run
  (32281902548): 2,830 of 7,766 runner-seconds = **36% of wall-time is the
  install step**.
- Actions cache measured **11.57 GB / 31 entries** against GitHub's documented
  **10 GB** default -- i.e. the regime GitHub itself names "cache thrashing".
- Today's failures: 45 failing jobs across 13 failed main gate runs;
  **28 died in `Install toolchain`** = 82% of real (non-aggregator) failures.
  5 of the 8 distinct jobs that died there need only `bun`.
- The repo's OWN `build-graph.json`: **107 targets, 50 connected components,
  43% singletons, 36% with no CI leg** (35 of 36 Rust crates have none).
- **Only 2,282 of 9,191 commits (25%) touch any build target.**
- **87% of the union footprint (10,055 MB) is needed by exactly ONE candidate.**
- `zeta-formal` + `zeta-wasm` remove **5,982 MB = 52% of the union** and were
  not round-2 candidates at all.

## Corrections to round 2 (recorded, not quietly amended)

- The byte-lock rendezvous constrains **regeneration**, not **verification**:
  `cross-verify` asserts COMMITTED outputs and needs only `bun`. Cut B is
  cheaper than round 2 priced it.
- `zeta-archive` still leads on change rate and removes **zero** toolchain. It
  is no longer the obvious first move.

## Open -- the decision for the human

Four options in §13 of the doc. Not restated; the doc is the surface.

## Open -- two cheap checks independent of the option chosen

1. **Is the Actions cache ceiling raised?** Measured 11.57 GB vs a documented
   10 GB default. The usage-policy endpoint is Not Found at agent permission
   level. One click in Actions settings.
2. **The §1 guard:** `git clone` at a pinned tag must stay SUFFICIENT forever,
   never merely transitional. A dependency-driven split makes an `ace`-shaped
   mandatory resolver MORE tempting, so this matters more now, not less.

## The vacuity class, third instance today

A capability that exists but is never invoked is indistinguishable from an
absent one. A check that did not run looks like one that passed; an alarm whose
label could never be created (heartbeat-liveness, #12429) looks like one that
never fired; a query nothing calls looks like a graph never built. Three
independent surfaces on 2026-08-19, one failure mode -- worth naming as a class
rather than fixing three times.

## Futamura: now a conditional claim with a falsifier

Aaron: "it's only the same operation when your generator is complete over the
domain you are trying to close over."

- Complete generator over the domain => incremental build IS partial evaluation.
- Incomplete => merely analogous, and asserting identity is the numerology error.

**Anchor checked.** Futamura 1971 defines the projections for a specialiser over
a given language; Jones/Gomard/Sestoft 1993 give the correctness condition as
"same behaviour as the original on ALL INPUTS" -- the all-of-domain quantifier
Aaron's formulation has. Jones-optimality is a QUALITY bar, not the completeness
bar; conflating them would misuse the anchor. Aaron SHARPENS the literature by
quantifying over "the domain you are closing over" rather than a language's
inputs -- the right generalisation when the specialised object is a build graph,
not a language. That generalisation is his and is not claimed to be in Futamura.

**And the condition fails here, measurably:** 38 of 107 targets (36%) carry no
CI leg, so the graph is prima facie NOT complete over the CI domain. The
identity does not hold on this tree today.

**Consequence, and it is the sharpest in the round:** wiring an INCOMPLETE graph
buys incremental behaviour that is unsound at the edges -- jobs silently skipped
for the 38 blind spots. Completeness over the CI domain is an ACCEPTANCE
CONDITION for the wire-the-graph option, not a nice-to-have.

## Open -- the completeness lint (does not exist)

Every target must claim a CI leg; every CI job must be claimed by some target.
Both directions -- the second catches a job running outside the graph's
knowledge. Same shape as the existing hygiene/ audits. It is both the acceptance
gate for Option 1 and the thing that moves the Futamura claim from `unmetered`
to `metered`.

## Open -- what stops it being wired a SECOND time

The failure mode is already demonstrated in this repo. Design consequences,
stated as acceptance criteria: (1) the change->job mapping must be DERIVED from
the graph at run time, never hand-maintained as 20 `if:` guards -- a second copy
nobody can diff against the first, whose drift is silent; (2) the graph must
stay regenerable and drift-checked, which `derive --write` + `drift-check`
already satisfy.

## Open -- unmeasured, and named as such

- The cost of the tooling branch's third piece (per-leg toolchain subsets in
  `tools/setup/`). Steps (a) workflow step + (b) `if:` guards alone reduce job
  COUNT without reducing per-job provisioning -- that would look like progress
  and bank little.
- Whether low churn really makes a closure cut cheap to OPERATE (the pin-bump
  frequency claim). No cross-repo pin exists yet to measure. Falsified by a
  `zeta-formal` split whose pin needs bumping weekly.
- Round 2's still-ungathered falsifier: how often agents actually read
  `docs/history/` and `docs/github/` from their own clone.

## Coverage gap found in passing (not this row's to fix)

35 of 36 Rust crates have **no CI leg**. Only `Core.Rust.Observe` runs, in
`full-verify`. The 1,534 MB rust+cargo toolchain in the union serves exactly
one crate's test suite.

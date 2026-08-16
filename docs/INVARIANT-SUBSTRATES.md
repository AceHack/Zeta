# Invariant substrates — Zeta's layered posture

> "this sound not be quiet Zeta quietly already has invariants-
> at-every-layer it's first class in my mind we should make it
> explicit" — Aaron, 2026-04-20.

This doc names the posture. It is a stance document, peer to
`docs/VISION.md` and `docs/ALIGNMENT.md`, not a research
artefact and not a tool manual. Tool specifics live in
`docs/FORMAL-VERIFICATION.md` and in the per-skill pages.

## Stance

**Every layer of Zeta has a declarative invariant substrate.**
Not prose. Not a sentence in a GOVERNANCE section. A machine-
addressable artefact whose fields are the invariants, in a
format a model-checker could read.

This is first-class, not decorative. If a new layer lands
without an invariant substrate, the factory has drifted. The
absence is a P1 finding for the Architect and a queue item for
whoever owns the layer.

Aaron's framing (2026-04-20): *"my brain basically does
invariant based programming in my head and i have to translate
the invariant in my head into code."* The substrates are the
externalisation of that cognitive act — the declaration-itself
is the value. Mechanical verification is a second-order payoff.

This is a direct extension of the
`project_factory_as_externalisation.md` thread: the factory
exists to land Aaron's head-invariants verbatim, without
translation loss, at the resolution of whatever layer they
apply to.

## The layered map

The rows below are the layers Zeta currently recognises, the
declarative substrate that carries their invariants, the
checker portfolio that can verify them, and the status of the
substrate today.

| Layer | Substrate | Primary checkers | Status |
|---|---|---|---|
| **Spec** — behavioural contracts | `openspec/specs/**/spec.md` | `spec-zealot` (discipline) | shipped |
| **Protocol** — concurrent state machines | `tools/tla/specs/*.tla` | TLA+/TLC | shipped |
| **Proof** — theorems about the algebra | `tools/lean4/Lean4/*.lean` | Lean 4 + Mathlib | shipped |
| **Constraint** — pointwise axioms | `tests/Tests.FSharp/FormalVerificationTests.fs` (Z3 queries) | Z3 SMT | shipped |
| **Property** — law-checking across generated domains | FsCheck properties in `tests/Tests.FSharp/` | FsCheck, Stryker | shipped |
| **Data** — Z-set multiplicity invariants | operator-algebra types in `src/Core/**` | F# type system, DBSP laws, FsCheck | shipped |
| **Code (refinement)** — function-level pre/post-conditions | LiquidF# (evaluation in flight — `docs/research/liquidfsharp-evaluation.md`) | SMT via LiquidF# | evaluation |
| **Skill** — agent-scope invariants | `.claude/skills/<pack>/blueprints/<name>.skill.yaml` | `alloy`, `semgrep`, `fscheck`, `tla` (per-claim hints) | two pilots landed (`prompt-protector`, `skill-tune-up`) |
| **Agent behaviour** — empirical outcome claims | `plugin:skill-creator` eval harness (`evals/` + benchmark.json) | grader + comparator subagents | shipped (used round 42-43) |
| **Policy / governance** — repo-wide invariants | `docs/AGENT-BEST-PRACTICES.md` (stable BP-NN rules) | `skill-tune-up` lint, reviewer roster | shipped |
| **Ontology** — canonical-home rules | `.claude/skills/governance/blueprints/canonical-home-auditor.md` map | `canonical-home-auditor` | shipped (round 40) |

Rows are not ranked. A P0 correctness claim can land at the
proof layer (Lean) or the property layer (FsCheck) or the skill
layer (skill.yaml). The decision is always: *which layer does
this invariant most naturally live at, and which checker fits
that layer's substrate?* See `BP-16` for the cross-check rule
when a P0 invariant needs ≥ 2 independent checkers.

## Three-tier discipline

Every invariant in every substrate carries a tier:

- **`hypothesis`** — stated proposition. No evidence
  collected yet. Falsifiable by construction. A hypothesis
  is not worthless — it externalises Aaron's head-invariant
  as data, which is already the main value. But it cannot
  carry a P0 claim. (Round 43 rename from the earlier
  `guess` — research-grade vocabulary for a research-grade
  substrate. See
  `docs/DECISIONS/2026-04-20-tools-scripting-language.md`
  §Terminology note.)
- **`observed`** — at least one data point, lint hit, audit,
  or harness run supports the invariant. Not mechanical.
- **`verified`** — a mechanical check or proof enforces the
  invariant. The checker's name, command, and cadence are
  declared in the substrate.

The tier is visible on every invariant. The substrate also
carries a **burn-down count** — how many invariants sit at
each tier. The count is the honest backlog: every
`hypothesis` is a candidate for promotion to `observed`;
every `observed` is a candidate for promotion to `verified`.
Rounds tick the count down.

Aaron's framing (2026-04-20): *"so they are not speculative
guesses they are confirmed with data, i like data driven
everything lol."* The hypothesis tier is the start, not the
destination.

The first concrete pilot of this pattern is
`.claude/skills/security/blueprints/prompt-protector.skill.yaml` (spec-version
0.1-draft, round 43): 5 hypothesis, 6 observed, 2 verified,
13 total after the round-43 safety-clause promotion. Burn-
down targets named.

## Why the factory can succeed where Code Contracts failed

.NET Code Contracts (`System.Diagnostics.Contracts`, shipped
2010, archived around 2017) is the canonical cautionary tale.
Microsoft Research built first-class `Contract.Requires` /
`Ensures` / `Invariant` on top of Spec# and Eiffel's design-by-
contract. It died. Five reasons, and the factory pattern
addresses each:

1. **Single-vendor dependency.** Code Contracts depended
   entirely on Microsoft's continued investment. The factory
   portfolio-diversifies: Z3 + Lean + TLA+ + FsCheck + Alloy +
   Semgrep + (evaluation) LiquidF# + (new) skill.yaml.
   Losing any one is survivable because the portfolio carries
   the load.
2. **Checker was the bottleneck.** `cccheck`'s abstract-
   interpretation was too slow for the developer loop. The
   factory's approach is checker-per-claim: each invariant
   declares which checker applies (the `model-checker-hints`
   field in skill.yaml; the explicit Lean/TLA+/Z3 split in
   `docs/FORMAL-VERIFICATION.md`). Fast checkers for cheap
   claims; expensive checkers only where the payoff is.
3. **No owning team.** The factory has specialist agents at
   marginal-zero cost — Soraya (formal-verification router),
   the spec-zealot, harsh-critic, threat-model-critic, and so
   on. No single human has to own the whole substrate.
4. **Checker-gated value proposition.** Code Contracts framed
   the IL rewriter as the main deliverable. If the checker
   didn't run, the contracts were dead weight. The factory
   inverts this: **the declarative artefact is the main
   deliverable**; checking is a second-order payoff. Even at
   `guess` tier, the invariant is valuable to Aaron's head-
   invariant externalisation and to human reviewers.
5. **Single-layer scope.** Code Contracts addressed exactly
   one layer (.NET method-level contracts). Zeta is landing
   substrates at every layer simultaneously. Coverage is the
   moat; a missing layer is a hole a single-layer project
   cannot fill.

The research Code Contracts inherited from Hoare, Eiffel, and
Spec# is not dead; the funding was. The factory carries it
forward as a layered, multi-vendor, checker-per-claim posture.

## How this relates to the research contribution

`docs/VISION.md` names Zeta as an existence proof that "a
correctly-calibrated stack of formal verification, static
analysis, adversarial review, and spec-driven development is
sufficient to let an AI-directed software factory produce
research-grade systems code." The layered-invariant-substrates
posture is the structural form of that stack.

`docs/ALIGNMENT.md` names measurable alignment as the primary
research focus. The three-tier discipline — and the burn-down
counts on every substrate — are what makes "measurable"
operational. A fact sitting at `guess` is a declared claim
awaiting evidence; a fact at `verified` is evidence-backed.
Alignment progress is the rate at which guesses move to
verified, across all substrates.

## Relationships

- `docs/VISION.md` — the research contribution thesis. This
  doc is the structural form that thesis takes.
- `docs/ALIGNMENT.md` — measurable alignment. The three-tier
  discipline is how invariants become measurable.
- `docs/AGENT-BEST-PRACTICES.md` — BP-16 (P0 cross-check rule)
  interacts directly with the layer map above: a P0 claim
  needs ≥ 2 independent checkers, which usually means two
  rows of the table cover the same invariant.
- `docs/FORMAL-VERIFICATION.md` — the three-tool tactical
  guide (Z3 + TLA+ + FsCheck). This doc is the strategic
  layer; that one is the tactical layer.
- `openspec/README.md` — how behavioural spec files relate to
  the substrate table.
- `.claude/skills/formal-methods/blueprints/formal-verification-expert.md` —
  Soraya's routing authority. She picks the checker per claim;
  this doc declares that every claim lives at some layer and
  carries a checker hint.
- `.claude/skills/security/blueprints/prompt-protector.skill.yaml` — the first
  concrete skill-layer substrate, pilot for the pattern.
- `.claude/skills/security/blueprints/prompt-protector.md` — the prose body
  the skill.yaml accompanies.
- `docs/research/liquidfsharp-evaluation.md` — the refinement-
  type evaluation that, if promoted, adds a proper code-layer
  substrate.
- `docs/INTENTIONAL-DEBT.md` — where guesses that cannot yet
  be verified are logged as deliberate, named debt with the
  promotion path.

## What this doc does NOT do

- **Does not enumerate every invariant.** Each substrate
  carries its own invariants. This doc describes the posture
  and the table of layers; the invariants live at their
  substrates.
- **Does not pick checkers.** `formal-verification-expert`
  (Soraya) routes per claim. This doc only says that every
  claim must declare a routing hint.
- **Does not mandate a schema.** `skill.yaml` is draft v0.1
  (round 43). The schema will evolve as more skills migrate.
  What is mandated is the posture: every layer has a
  declarative substrate with tiered invariants.
- **Does not obsolete prose.** SKILL.md bodies, ADRs, and
  GOVERNANCE sections keep explaining *why*. The substrate
  declares *what is true* in a form a checker can read.
- **Does not replace the reviewer roster.** Invariants land
  in substrates; reviewers still catch the things humans and
  agents get wrong that no substrate claims to cover.

## Prior art

- **C. A. R. Hoare (1969)**, "An Axiomatic Basis for Computer
  Programming" — Hoare logic. Pre/post/invariant is the
  original triple.
- **Bertrand Meyer (1986-)**, Eiffel + Design by Contract.
  First mainstream language with first-class contracts.
- **Microsoft Research Spec# (2004-)** — contract syntax on
  top of C#, direct ancestor of Code Contracts.
- **Microsoft Code Contracts (2008-2017)** — the archived
  .NET implementation. Post-mortem lessons inform every row
  of the table above.
- **Dafny, F*, LiquidHaskell, Liquid Types** — the refinement-
  types lineage Zeta is evaluating via LiquidF# for the code
  layer.
- **TLA+ (Leslie Lamport, 1999-)** — the protocol-layer
  substrate, long-running in systems work.
- **Lean 4 + Mathlib** — the proof-layer substrate.
- **Z3 (Leonardo de Moura, Nikolaj Bjørner, 2007-)** — the
  SMT solver behind the constraint layer.

Nothing in this posture is new individually. The contribution
is (a) landing the substrates together, at every layer, and
(b) running them under a three-tier burn-down discipline so
the honest state of the system is visible on every round.

## Cadence

- **Every new layer requires an invariant substrate.** A PR
  that introduces a new layer without one is blocked at
  review.
- **Every round ticks the burn-down.** At least one invariant
  should advance tier per round when the factory is healthy.
  Zero-progress rounds across all substrates is a calibration
  signal.
- **Every round checks substrate coverage.** `skill-tune-up`
  (Aarav) and the Architect's round-close together verify
  that substrates are up to date and that new layers have
  landed substrates.

## Tooling

- **`tools/invariant-substrates/tally.ts`** — reads every
  `.claude/skills/*/blueprints/*.skill.yaml` and prints a markdown table
  of per-substrate tier counts plus portfolio totals. Use
  at round-close to see where the hypothesis / observed /
  verified totals stand and whether any declared `total`
  field has drifted from the sum of its tiers. bun +
  TypeScript; builtin-only (Bun `Glob`, `node:fs/promises`,
  `node:path`, `node:url`); no third-party runtime deps.
  Accepts both `hypothesis:` and the legacy `guess:` key
  during the round-43 rename and flags legacy-key hits. Run
  with `bun run tools/invariant-substrates/tally.ts`. Exit
  codes:
  - `0` clean
  - `1` with `--fail-on-no-progress` when any hypothesis
    entries remain (post-maturity CI flag; not used yet)
  - `2` with `--fail-on-mismatch` when any substrate's
    declared total mismatches the sum.

  Language choice recorded in
  `docs/DECISIONS/2026-04-20-tools-scripting-language.md`.
  The pre-pivot bash version `tally.sh` was retired in
  round 43 once `.ts` reached parity.

## Authorship note

This doc was landed in round 43 as the explicit, first-class
declaration of a posture that had previously been implicit
("quiet" in Aaron's phrasing). The decision to make it
explicit belongs to Aaron, 2026-04-20. The structural claim —
that invariant substrates are the factory's research
contribution when taken together — is the factory's
load-bearing thesis, not a single round's edit.

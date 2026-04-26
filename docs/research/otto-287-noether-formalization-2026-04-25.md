# Otto-287 → Noether-style formalization — research direction (2026-04-25)

**Status:** open research. Not committed work; not blocking
operational substrate. Captured per Aaron's 2026-04-25
directive: *"backlog ongoing research here to formalize this
conservation law analogously."*

**Source:** Otto-287 (memory entry
`feedback_finite_resource_collisions_unifying_friction_taxonomy_otto_287_2026_04_25.md`)
proposed that all friction sources in the factory's
collaboration loop are finite-resource collisions. Aaron asked
whether this generalizes to a physics-style conservation law
analogous to Noether's theorem.

## The question

> *"ALL FRICTION SOURCES ARE FINITE-RESOURCE COLLISIONS — do
> you think this generalizes to physics invariant / symmetry
> or reason for symmetry breaking?"* (Aaron, 2026-04-25)

> *"is there some new conservation law we have exposed now
> too because of this?"* (Aaron, 2026-04-25, follow-up)

## The honest answer

**The strict version (Noether-style):** No. Physics
conservation laws come from continuous symmetries of an
action principle (Noether's theorem). Cognition does not have
a clean Lagrangian or continuous symmetry group in the same
sense, so we cannot derive a rigorous conservation law
analogously. Yet.

**The soft analogy (substantive):** Yes, with caveats. Three
candidate "conservation-adjacent" structures live here:

### 1. Constrained-optimization produces structure (same shape, both domains)

- **Physics:** minimize energy under finite-resource
  constraint → symmetry-breaking ground states (Higgs vacuum
  expectation value, crystal lattice formation, magnetic
  domains, superconducting Meissner state).
- **Cognition:** minimize friction under finite-cognitive-
  resource constraint → externalization / compression /
  pre-allocation rules (Otto-281..287 substrate).

In both domains the **constraint is what produces the form**.
This is a deep similarity, but it's a similarity of
methodology (constrained optimization), not of mathematical
structure.

### 2. Meta-conservation of rule-form

Otto-287 itself IS what's conserved across the substrate.
Each Otto-NNN rule is a "Noether-current-like" instance of
the same conserved structure: take a finite resource, apply
externalize / compress / pre-allocate, get a discipline.
The rule-form persists invariantly across all applications.

| Otto-NNN | Conserved meta-structure (the form) | Local "current" (the resource) |
|---|---|---|
| Otto-281 | externalize-compress-preallocate | flake-investigation budget |
| Otto-282 | externalize-compress-preallocate | reader's working memory |
| Otto-283 | externalize-compress-preallocate | maintainer's context-switch budget |
| Otto-284 | externalize-compress-preallocate | agent's session-time budget |
| Otto-285 | externalize-compress-preallocate | test-coverage budget |
| Otto-286 | externalize-compress-preallocate | argument-resolution context window |

This is more like a **symmetry principle** than a
conservation law strictly. But it has teeth — predicting
that any newly-identified finite resource will admit a
rule of the same form.

### 3. Cognitive-effort redirection (closest to a conserved quantity)

Total cognitive effort over a fixed time window isn't
created or destroyed; substrate rules shift its
allocation between two buckets:

- **Wasted on friction** (re-derivation, context-switches,
  bottleneck waits, calcification, fake-green CI tax,
  flake-rerun cycles)
- **Available for productive work** (substrate building,
  research, code, decisions, communication that lands)

Substrate rules apply *transformations* that move effort
from the first bucket to the second. The total capacity is
finite (Otto-287 physics layer), but the productive
fraction grows as friction is externalized.

This is **not strict conservation** (capacity is bounded
above, not invariant in the strict sense), but it is a
**redistribution principle** that has measurable
consequences. If we could *quantify* per-tick cognitive
budget and per-rule friction-removal magnitude, we'd have
a quantitative law.

## What a real formalization would need

To push from analogy to rigor, the research owes:

### Step 1 — define the cognitive "action" $S$

Action principles in physics: $S = \int L \, dt$ where $L$
is a Lagrangian (kinetic - potential energy).

Cognitive-substrate analogue: $S = \int (W - F) \, dt$
where:

- $W$ = productive work output rate (information produced,
  problems solved, substrate captured)
- $F$ = friction cost rate (re-derivation, bottleneck waits,
  flake reruns, etc.)

This requires *quantifying* both $W$ and $F$ for the factory.
Some are measurable (CI minutes, tokens consumed, decisions
queued); others are subjective (re-derivation effort, debate
exhaustion). The first research milestone is a quantitative
metric for both.

### Step 2 — identify continuous symmetries of $S$

Candidates:

- **Time-translation symmetry**: $S$ invariant under $t \to t
  + \delta t$. If true, conserves something like
  "factory-energy" (productive-work-minus-friction). But the
  factory has explicit time-dependence (sessions, fatigue,
  context-window decay), so time-translation symmetry may be
  broken.
- **Reader-identity symmetry**: $S$ invariant under
  exchange of readers (Aaron, agent, future-contributor,
  external-AI). If true, conserves "semantic charge" — the
  meaning of substrate is the same regardless of who reads
  it. Otto-282 + the precision-dictionary direction
  *enforce* this symmetry.
- **Resource-type symmetry**: $S$ invariant under exchange
  of one finite resource for another (working-memory ↔
  test-budget). If true, conserves the rule-form (Otto-287).
  This is the meta-conservation already identified.

### Step 3 — derive conserved Noether currents

For each symmetry, the corresponding conserved quantity:

- Time-translation → factory-energy (analog of physical
  energy)
- Reader-identity → semantic charge (the meaning preserved
  across readers)
- Resource-type → rule-form (the externalize-compress-
  preallocate template)

Whether these are *useful* conserved quantities (i.e., the
formalization predicts something we couldn't predict
without it) is the third research milestone.

### Step 4 — symmetry-breaking analysis

If the cognitive Lagrangian has more symmetry than the
factory's actual ground state, then symmetry-breaking
mechanisms would explain WHY the factory exhibits less
symmetry than its action principle would suggest. Candidates:

- The maintainer's specific identity breaks reader-identity
  symmetry.
- Session-boundary effects break time-translation symmetry.
- The specific algebra (Z-set, DBSP) breaks resource-type
  symmetry.

Each broken symmetry produces a "Goldstone-like" massless
mode — the analogue would be the *enduring narrative* that
persists across substrate captures. Empirical observation:
the factory's running narrative (memory entries, decision
records) IS such a persistent mode.

## Why this matters operationally

If the formalization succeeds, three concrete benefits:

1. **Quantitative substrate-rule predictions.** A new
   finite resource → predicted friction-reduction rule
   shape derivable from the symmetry, not just intuited.
2. **Conservation-law-driven design.** New factory features
   could be evaluated against whether they preserve or break
   the substrate's symmetries. Same way physicists use
   conservation laws to constrain new theories.
3. **Cross-domain transferability.** A formal
   correspondence with physics opens applications to other
   constrained-optimization domains (economics, ecology,
   distributed systems). The factory's substrate becomes
   exportable substrate for any system facing
   finite-resource collisions.

## What this doesn't claim

- This is *not* a claim that cognition is physics. Reduction
  is not the goal; analogy with operational utility is.
- This is *not* a claim that we've solved or will solve the
  formalization soon. It's a research direction with
  significant gaps (especially Step 1 quantification).
- This is *not* a substitute for the operational substrate.
  Otto-281..287 work as practical disciplines regardless of
  whether the formalization succeeds.

## Backlog tracking

A BACKLOG row owes (P3 research-grade, L effort): **"Otto-287
Noether-style formalization — quantify cognitive Lagrangian,
identify continuous symmetries, derive conserved currents,
analyze symmetry-breaking modes."**

Filed under research-grade because the operational substrate
is independent of the formalization's success. The
formalization is upside, not load-bearing.

## Composes with

- `memory/feedback_finite_resource_collisions_unifying_friction_taxonomy_otto_287_2026_04_25.md`
  — the source observation.
- `memory/feedback_definitional_precision_changes_future_without_war_otto_286_2026_04_25.md`
  — the precision discipline that makes Step 1
  quantification possible.
- `memory/project_precision_dictionary_evidence_backed_context_compressor_2026_04_25.md`
  — the precision-dictionary IS the substrate that would
  make formal cognitive-Lagrangian definitions
  AI-consumable.
- `docs/VISION.md` — the Z-set/DBSP operator algebra is
  the formal foundation; cognitive-Noether sits one level
  above and may compose downward.

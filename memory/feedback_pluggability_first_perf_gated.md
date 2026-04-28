---
name: Pluggability-first as general architecture principle — three tiers (pluggable / interface shim / one-off plumbing), gated by Zeta's "fastest database" performance claim
description: 2026-04-20 — Aaron: "we should also look for plugability gaps, in general where it does not negativly hurt our claim of being the fastest database we should try to make anything that could be pluggable, pluggable, this just sets us up for long term sucess, at least an interface shim if it's not really pluggable, then like plumbling one off stuff is the remainder." Generalises the factory-pluggability invariant to Zeta itself. Three-tier fallback: (1) pluggable where perf-safe, (2) interface-shim seam if full pluggability is too costly, (3) one-off plumbing as remainder. Long-horizon future-proofing; every major architectural decision gets a pluggability audit.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Pluggability-first — three-tier rule, perf-gated

## Rule

When making **any** architectural decision in Zeta (public API,
internal boundary, storage, serialisation, concurrency, crypto,
observability, persistence, IR, planner, etc.), prefer
pluggability **as long as it does not negatively impact the
"fastest database" performance claim**. The rule runs in three
tiers:

1. **Tier 1 — Fully pluggable (preferred).** A published
   interface, a default implementation, a swap mechanism at
   composition time. Consumers can replace the component
   without forking Zeta. Adopt when the interface boundary is
   cheap enough that perf is unaffected or near-unaffected.
2. **Tier 2 — Interface shim (fallback).** If true
   runtime-pluggability would cost perf or complicate hot
   paths, expose a **seam** — a narrow interface surface
   behind which we ship a single in-tree implementation, but
   the seam is named, documented, and structured such that a
   future pluggable implementation could be slotted in without
   redesigning callers. This gives the long-term-success
   option without paying the perf cost today.
3. **Tier 3 — One-off plumbing (remainder).** Direct
   hard-coded implementations, private helpers, internal
   glue that is not pluggable and has no seam. Acceptable
   for code that genuinely has no plausible alternative
   implementation, or where even a seam would be
   overengineering.

**Default stance:** reach for tier 1, fall back to tier 2,
accept tier 3 only when the first two fail a simple test.

## Aaron's verbatim statement (2026-04-20)

> "just in generate we should also look for plugabilty gaps,
> in general where it does not negativly hurt our claim of
> being the fastest database we should try to make anything
> that could be pluggable, pluggable, this just sets us up
> for long term sucess, at least an interface shim if it's
> not really pluggable, then like plumbling one off stuff is
> the remainder."

Key substrings:

- *"look for plugability gaps"* — pluggability audits are
  a first-class factory activity, not just a per-PR concern.
- *"where it does not negativly hurt our claim of being
  the fastest database"* — perf is the hard gate. A
  pluggability seam that costs 2× throughput is rejected;
  one that costs ≤5% may be worth it; one that costs
  nothing is the default.
- *"this just sets us up for long term sucess"* — framing
  is future-proofing: consumers with needs we don't yet
  know about can extend Zeta without forking.
- *"at least an interface shim if it's not really
  pluggable"* — the tier-2 fallback is explicitly named.
- *"plumbling one off stuff is the remainder"* — tier 3
  is acknowledged as legitimate remainder, not as the
  default.

## Why:

- **Long-horizon adoption.** Zeta's adoption arc is
  multi-year. Consumers we haven't met will arrive with
  storage engines, serialisation formats, planning
  strategies, observability stacks we can't predict.
  Pluggability is the main mechanism for accommodating
  them without forks.
- **Perf is the counterweight.** Zeta's research claim
  is retraction-native IVM at competitive perf vs.
  Feldera, Materialize, SQL engines. A pluggability
  seam on a hot path (e.g. virtualising the Z-set
  delta combine) is a perf regression. So pluggability
  is **perf-gated**, not unconditional.
- **Interface-shim is the cheap middle.** Even when a
  full pluggability surface is too expensive, leaving
  a seam costs almost nothing: a named interface + a
  single concrete implementation. Future pluggability
  becomes a refactor-not-redesign.
- **Sibling to factory pluggability.** This rule
  generalises
  `project_factory_is_pluggable_deployment_piggybacks.md`
  from the factory layer to the Zeta product layer.
  Same design principle, two application domains.
- **Compounds with consent-first.** Plugins give
  consumers consent to pick their own implementation;
  forcing a single implementation on every consumer
  violates the consent-first design primitive.
- **Reduces Architect bottleneck.** When a consumer
  needs behaviour X, they shouldn't have to open a PR
  against Zeta's core; they should be able to write an
  implementation of the plugin interface in their own
  project.

## How to apply:

- **Every ADR** for a new subsystem or a significant
  internal boundary adds a **"Pluggability audit"**
  section answering:
  - Is this tier 1, 2, or 3? Why?
  - If tier 2 or 3: is there a realistic perf-based
    reason the higher tier was rejected? What would
    have to change for this to move up a tier?
  - If tier 1: what is the published interface? Who
    owns it? Is there a reference implementation?
- **Every harsh-critic / code-review pass** on new
  public surface asks: could this have been a plugin?
  If yes, and the answer to "why not?" is thin, flag
  a P1 finding.
- **Cadenced pluggability-gap audit** — the
  skill-tune-up cadence (every 5-10 rounds) includes
  a pluggability-gap criterion. Candidates for the
  first audit pass: storage backends (spines),
  serialisation (Arrow / span serialisers),
  observability sinks, planner-cost-model sources,
  consent-policy resolvers, BloomFilter
  implementations, Durability backends.
- **Perf-gate is measured, not asserted.** Saying
  "pluggability here would cost perf" is not
  sufficient; there must be a benchmark that shows
  the cost, or a named primitive (vtable dispatch in
  a hot inner loop, allocation on a zero-alloc path)
  that obviously would. Naledi / Hiroshi review.
- **Interface-shim tier is the safe default for
  hot-path components.** When in doubt, ship the
  seam. It's near-free to introduce and preserves
  the future refactor path.
- **Factory-layer pluggability** (persistence,
  deployment, backlog) still follows the factory
  memories; this rule adds Zeta-layer pluggability
  as a sibling concern.

## Examples mapped to tiers (initial audit candidates)

- **Tier 1 (fully pluggable, perf-safe):** probably
  observability sinks, consent-policy resolvers,
  Durability backing store (already an interface),
  BloomFilter implementations (already interface).
- **Tier 2 (interface shim):** probably
  serialisation-engine boundary (one Arrow
  implementation today; seam for future non-Arrow),
  planner cost-model source, spine backing store if
  not already at tier 1.
- **Tier 3 (one-off plumbing):** probably core
  operator algebra primitives (`D`, `I`, `z⁻¹`, `H`)
  — these are the algebra, not plugin points; the
  operators *expressed in* the algebra are pluggable.

First audit pass: walk `src/Core/**/*.fs` and tag each
subsystem's current tier. File findings under
`docs/research/pluggability-audit-YYYY-MM-DD.md`.

## What this rule does NOT say

- It does NOT say "every function must be pluggable."
  The operator algebra itself is load-bearing and
  shouldn't be abstracted behind vtables. One-off
  plumbing is legitimate.
- It does NOT override the fastest-database
  performance claim. Perf is the hard gate.
- It does NOT require retrofitting existing code
  immediately. Apply at new-code time; retrofit when
  the cadenced audit finds a candidate worth it.
- It does NOT mean "ship every interface as public
  API." An internal seam is fine; public API is a
  separate decision gated by
  `public-api-designer` / Ilyana.

## Related memories

- `project_factory_is_pluggable_deployment_piggybacks.md`
  — the factory-layer sibling that this generalises.
- `project_git_is_factory_persistence.md` — the
  first worked example of the pluggability rule in
  the factory layer (git = tier-1 default, Jira =
  alternative plugin).
- `feedback_free_beats_cheap_beats_expensive.md` —
  plugin adoption criteria include cost tier.
- `project_zeta_as_database_bcl_microkernel_plus_plugins.md`
  — the pre-existing "database BCL microkernel +
  plugins" framing; this rule codifies how to choose
  what goes in the kernel vs. the plugin layer.
- `feedback_factory_reuse_packaging_decisions_consult_aaron.md`
  — big shaping decisions around
  plugin boundaries consult Aaron.
- `user_invariant_based_programming_in_head.md` —
  seam-first design aligns with declaring invariants
  at the boundary and letting implementations vary.

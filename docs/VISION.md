# Zeta — Long-Term Vision

> **Status:** first-draft synthesis by Kenji (architect) from
> everything Aaron has said across rounds 1-33. Aaron is the
> source of truth and will redefine this document forever. The
> `product-visionary` role (to be spawned, see
> `docs/BACKLOG.md`) will steward it after that.

## North star

Zeta is the world's best retraction-native incremental-computation
library. It is:

- **Mathematically honest.** Every operator obeys laws Milewski
  would recognise. When a law cannot hold, the API tells you
  so, loudly and at compile time.
- **Publishable.** Every major feature is a research
  contribution (paper target) or an explicitly named engineering
  fundamental. No clever-but-unjustified abstractions.
- **First-class F#, with a C# shim.** F# is the primary
  language; C# callers get `Zeta.Core.CSharp`. Polyglot over
  time (Lean for proofs, Java for the Alloy driver, TypeScript
  for post-install automation once we research the runtime),
  but F# stays load-bearing.
- **Retraction-native.** DBSP's differentiator is exactly-
  symmetric insert/retract. Designs that break retraction are
  wrong by construction, not by taste.
- **Production-grade security.** Nation-state + supply-chain
  threat model. SLSA ladder L1 → L3 pre-v1.0. OpenSpec is
  first-class for every committed artefact, including CI.
- **Research-worthy performance.** Every hardware intrinsic we
  can reach (SIMD, tensor ops, SIMD-JSON-shape parsing,
  cache-line discipline). Benchmarks that answer specific
  questions, not vanity numbers.
- **Fully self-directed over time.** The software factory
  itself is the project's second product. Every round improves
  both Zeta and the factory.

## What Zeta is NOT

- Not a streaming SQL database. Feldera / Materialize / Noria
  cover that space; Zeta is the library layer below a
  database, not the database itself.
- Not a production streaming-analytics platform. We are a
  correctness-first reference implementation that happens to
  perform well — not a k8s-native analytics warehouse.
- Not a clone of any upstream. `references/upstreams/` are
  read-only inspiration; Zeta hand-crafts every artefact.
- Not a compliance product. Enterprise consumers certify at
  their deployment layer; we provide the evidence trail.

## What we are building (v1.0)

The subset that makes Zeta shippable as `Zeta.Core 1.0.0` on
NuGet:

- **Operator algebra** — Z-sets, D/I/z⁻¹/H, retraction-native
  by construction. Higher-order derivatives where the math
  calls for them.
- **Recursion** — retraction-safe `Recursive` combinator;
  `RecursiveSemiNaive` where monotonicity holds; LFP
  convergence with honest termination guarantees.
- **Storage layer** — four durability modes (in-memory,
  OS-buffered, stable-storage, witness-durable) with honest
  recovery-property advertisement. DiskBackingStore +
  Spine family.
- **Sketches** — retraction-aware HLL, CountMin, KLL, plus
  Blocked and Counting Bloom filters. Paper-worthy contribution.
- **Query planner** — cost model with SIMD / tensor-intrinsic
  kernel dispatch. Research-grade.
- **Plugin surface** — external consumers write their own
  operators via `PluginOp<'TIn, 'TOut>` or equivalent.
- **FsCheck LawRunner** — every operator advertised as
  linear / bilinear / sink-terminal / retraction-complete
  earns the tag by passing a property-based law check.
- **Formal-method coverage** — 18+ TLA+ specs, Alloy specs
  for structural invariants, Lean proofs where the math is
  foundational.
- **CI parity** — dev laptop + CI runner + (future)
  devcontainer all bootstrap via `tools/setup/install.sh`.
  All PRs green through the gate before merge.
- **Security posture** — nation-state + supply-chain threat
  model documented + controls enforced (Semgrep-in-CI,
  SHA-pinned actions, INCIDENT-PLAYBOOK, SDL-CHECKLIST).

## What we are exploring (post-v1.0)

Things on the roadmap that we intend to ship but haven't
committed shape on:

- **Witness-Durable Commit protocol** — paper-worthy
  durability mode; full impl blocked on paper peer-review
  rebuttal.
- **Retraction-aware analytic sketches** — HyperBitBit +
  retraction-native quantile sketches; publication target.
- **Info-theoretic sharder** — load-aware shard placement
  with per-shard feedback; Alloy-verified.
- **Multi-node deployment** — the control-plane shape
  (NATS? gRPC? Arrow Flight?) is an open question.
- **Consumer-facing distribution** — the v1.0 NuGet publish;
  licensing, telemetry posture, documentation site.

## How we decide what to build

The loop we want the `product-visionary` role to run:

1. **Ingest signals.** Upstream reference repos ship something
   interesting; a paper appears; someone has a novel idea;
   an existing Zeta subsystem shows a design smell.
2. **Check against the vision.** Does this sharpen
   Zeta's north star, or does it pull us toward being
   something we explicitly are NOT (§What Zeta is NOT)?
3. **Propose to the backlog.** If yes, write a
   `docs/BACKLOG.md` entry with the reasoning. If no, write
   a `docs/WONT-DO.md` entry with the reasoning.
4. **Ask Aaron if unsure.** Long-term vision drift is the
   silent killer. Product-visionary asks Aaron many
   questions and doesn't decide alone on
   direction-shifting items.

## Operating principles (abbreviated from AGENTS.md + GOVERNANCE)

- Truth over politeness.
- Algebra over engineering.
- Velocity over stability (pre-v1).
- Retraction-native over add-only.
- Cutting-edge over legacy-compat.
- Category theory over ad-hoc abstraction.
- Publishable over merely-functional.
- F# idiomatic over C# transliterated.
- Agents, not bots.
- Docs read as current state, not history.
- OpenSpec is first-class.
- Every CI minute earns its slot.

## What this document is NOT

- Not the roadmap (that's `docs/ROADMAP.md`).
- Not the backlog (that's `docs/BACKLOG.md`).
- Not the next-steps queue (that's the `next-steps` skill).
- Not a sales pitch. Zeta has no paying customers pre-v1;
  this is the vision the research + engineering work
  serves.

## Revision cadence

The `product-visionary` role (when spawned) re-reads this
doc every 5-10 rounds, proposes edits, gets Aaron's
sign-off, commits. Ad-hoc edits land when a round's work
surfaces a vision-level question.

Aaron can revise at any time without ceremony.

## First-pass confidence + gaps

Things in this draft Kenji is confident about because Aaron
has stated them directly (rounds 30-33):

- Nation-state + supply-chain security posture.
- Retraction-native is non-negotiable.
- F# primary, polyglot over time.
- OpenSpec is first-class for every committed artefact.
- Self-directed factory as a second product.
- NuGet library shipping target at v1.0.

Things in this draft Kenji has inferred that need Aaron's
explicit validation:

- The "Zeta is NOT a streaming SQL database" framing.
- "Research-grade / publishable" as a first-class goal vs
  a nice-to-have.
- The specific operator-algebra + sketches + storage + planner
  scope for v1.0 (derived from what's shipped + on ROADMAP).
- Whether multi-node deployment is post-v1 or out-of-scope.
- Whether Zeta has ambitions toward a commercial product
  around the library, or is purely a research + open-source
  contribution.

The product-visionary role's first audit, on spawn, should
walk these gaps with Aaron.

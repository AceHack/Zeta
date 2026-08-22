# universal/evidence — Universal Evidence Interface (how anything folds what it was told)

> **Universal Evidence Interface** — a universal SHAPE applicable to all `/travelers` and all `/persona`.
> A belief is **not a message; it is the set of evidence atoms it rests on**, each keyed by the identity
> of its **source**. The message is *derived* (the product), never stored, so a confidence that has lost
> track of where it came from is **not representable**. Combining beliefs is therefore **set union** —
> idempotent, commutative, associative — and redundancy stops being something to detect because it
> **cannot be expressed**.

## Why the shape has to be this (the load-bearing fact)

For **proper** exponential-family messages the product is **monotone in precision**:
`tau(a*b) = tau_a + tau_b >= max(tau_a, tau_b)`. So evidence can only **add**, and therefore **no
admissible input to a fold can say "this was already counted."** Six agents resting on one data stream
fold to six times the confidence of any one of them and nothing inside the fold can notice. Measured
in-repo before this interface existed: `precision = 66.0` on a mean wrong by 5.66.

The one message that *does* reduce precision is **improper** (`tau < 0`) — and that is exactly the **EP
cavity** (Minka 2001): a **removal**, not a correlation coefficient. The algebra already had the right
operator; what it lacked was the information needed to aim it. **That information is provenance, and
provenance is not derivable from the message** — which is precisely why the correction cannot come from
inside the fold, and why an external observer is structurally necessary rather than merely nice.

This statement is about **any monotone evidence-combining algebra**, not about Gaussians.

## Same interface at every scale (§9 recursive, §10 self-similar)

An individual folding observations, a society folding members, and a world folding societies use **the
same operation, unchanged**. The join is a **bounded join-semilattice**, so the fold is invariant under
both **order** and **grouping**, and the *result of a fold is itself a belief carrying the union of its
inputs provenance* — hence a valid input to the next fold up. Closure under its own operation is what
makes the interface scale-free; the falsifier is that folding members into societies and societies into
a world must equal folding every member flat.

## Sameness is not identity — how the key is chosen

The key is the identity of the evidence **SOURCE**, never a hash of the message value. Two travelers who
*independently* reached `N(0,1)` hold **two** pieces of evidence; two who copied one prior hold **one**.
Keying on the value conflates them. Mint the id from the source (content-addressed on the stream, never
on the holder name — a name is a routing address); use a detector to **check** it, never to produce it.
See [`dual-use-detection-is-neutral-oracle-decides`](../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md).

## The limit, stated so it cannot be quietly lost

Deduplication removes **redundancy** (one source counted twice). It does **not** remove **correlation**
(distinct sources with a common cause). `Deduplicated` is a fact about **bookkeeping** and is **never a
certificate of independence**. The correlation half needs an external observer over repeated rounds —
`src/Core/DecorrelationExcess.fs` and the CHSH oracle in `src/Core/AntiSybil.fs`, both of which **convict
without ever acquitting**. A fold that cannot attest its provenance must **refuse to publish a confidence
claim** and emit the decorrelation reading instead.

## Where this shape STOPS — the quorum layer is not a member (Lumen 2026-08-14)

The closure property above is what makes the interface scale-free, so it matters exactly where it ends.
It ends **above the individual agent**. Aaron placed the Born boundary at the society/quorum layer, and
the quorum carrier is `AmplitudeEmu.Amp` (complex), which combines by **sum** — distinct paths to one
outcome, phases able to cancel. **A sum is not a join**: `interfere a a = 2a`, never `a`, so §12
idempotency is *declined by design* there and the semilattice guarantee does not extend past the join.

That is not a defect to fix; it is a second algebra that needed its own name. It has one:
[`universal/interference`](interference.md), implemented in `src/Core/QuorumAlgebra.fs` alongside this
shape's `join`. The composition is **join first, interfere second, Born last** — dedupe by source (which
is what stops the six-agents-one-stream double count), *then* let the distinct sources' phases interact.

Read this way the two files are complementary rather than competing: **evidence counts sources;
interference combines them.** Nothing in this file weakens — it just no longer silently claims a layer
that was never taking its shape.

## Membership contract (what taking this shape requires)

1. **Carry provenance, not just a message** — the belief is the atom set; the message is derived.
2. **Combine by join** — union on provenance; idempotent, commutative, associative, identity `empty`.
3. **Reduce only by keyed removal** — the cavity, aimed by provenance; never by a fitted coefficient.
4. **Report, never resolve** — a source arriving with two different messages is *named and excluded*,
   because picking a winner is an arbitrary choice wearing a merge.
5. **Refuse rather than publish** — no confidence claim from unattested evidence.

## Bit-perfection (honest boundary)

Provenance ids and the atom set **byte-lock** (ordinal string keys; F# structural comparison on `string`
is `String.CompareOrdinal`, so the fold order is culture-invariant and DST-replayable). The **derived
message** byte-locks only where the message family is exact — float-valued messages sit outside the
treaty for the same reason `universal/kernel` puts float kernels outside it.

Reference implementation: `src/Bayesian/Attested.fs` (generic over the `IMessage` algebra); instance:
`src/Bayesian/SocietyBootstrap.fs` (admission deduplicates before the factor graph is built).
Anchors: Minka 2001 (EP cavity); Kschischang, Frey and Loeliger 2001 (the product is the combine);
Shapiro, Preguica, Baquero and Zawirski 2011 (state-based CRDT join-semilattice). *Cited from standing
knowledge, not page-checked.*

A candidate **bit + compiler oracle** surface (bit-perfect + compiler-invariant = collaboration-grade).
See [`universal/README.md`](README.md) for the full family + honest scope.

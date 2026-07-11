# Multi-planet convergence — three drift axes, three mechanisms, one attack vector

> Aaron, 2026-07-11 (shadow\* tag), continuing the superdeterminism/replay thread
> ([[2026-07-11-superdeterminism-is-a-closed-box-property...]], #9705): *"this is very good to
> call out or else it would become an attack vector — we probably have to use some HLC cockroachdb
> like thing for this. but i want it to work multi planet. Also we have some Adinkra ECC stuff we
> recently added to our messaging so you can miss messages also and arrive to the same conclusion."*
>
> Grounded in code (not aspiration): every mechanism below already exists in the repo. Recorded as
> the honest-register synthesis, including the one nuance that changes his HLC plan (it works
> multi-planet, but only in the role he actually needs).

## The setup

Over a FoundationDB-like replay we already have **order-preserving** replay-determinism (record the
I/O crossings, feed them back). The stronger prize is **order-*independent* convergence**: reach the
same conclusion without needing the same order — because our observations keep the uncertainty and
therefore commute. Multi-planet messaging (interplanetary latency, message loss, no synchronized
wall-clock — the delay-tolerant / Reticulum regime) stresses that prize along **three orthogonal
drift axes.** Each already has a mechanism in-repo.

## The three drift axes → three mechanisms (all grounded)

| Drift | What breaks | Mechanism | Code |
|---|---|---|---|
| **Reorder** — messages arrive in any order | naïve fold gives order-dependent belief | commutative-monoid `observe` | `src/Core/BeliefConvergence.fs` |
| **Loss** — messages never arrive | missing evidence ⇒ missing conclusion | Adinkra ECC (erasure code) | `src/Core/AdinkraCode.fs` |
| **Bit/float** — reassociation nondeterminism | `(a+b)+c ≠ a+(b+c)` at last ULP ⇒ oracles disagree | HLC canonical reduction order | `src/Core.TypeScript/observe/phase-clock.ts` (#9594) |

### 1. Reorder → commutative `observe` (order-independence)

`BeliefConvergence.fs` states the general result and, crucially, the **exact boundary**:

> *"because pointwise multiplication is **commutative and associative**, observe-with-fixed-likelihoods
> commutes and a fold over any permutation of the evidence yields the same belief… The boundary
> (proven by counterexample): a **state-dependent / nonlinear** revision — where the update depends
> on the current belief (e.g. `sharpen`, squaring) — does NOT commute. Order matters exactly when
> the update operator **reads the belief it is updating**."*

So order-independence is a property of the *multiplicative* Bayesian core (a monoid; `Message.fs`
names it: *"`product` is… a commutative monoid"*). It is not a property of belief revision in
general.

### 2. Loss → Adinkra ECC (erasure tolerance)

`AdinkraCode.fs` pins the concrete generator: the **[8,4] extended Hamming code** — *doubly-even,
self-dual, minimum distance 4* (Gates/Iga adinkra ↔ doubly-even binary code correspondence). A
linear code of minimum distance `d` **corrects `d−1` erasures**, so this code **reconstructs after
losing up to 3 of every 8 symbols.** That is precisely *"miss messages and still arrive at the same
conclusion,"* made exact. (The header notes the erasure *principle* holds for any linear code —
`ErasureDistance.rsCode` was the Reed–Solomon MDS instance; the Adinkra code is the specific
doubly-even one.) This is the `generator-IS-the-ECC` rule live
([[only-the-irreducible-is-primitive-generate-the-rest]]): the same object that generates the
structure corrects its drift **across space** (here: missing messages between planets).

### 3. Bit/float → HLC canonical reduction order

Order-independence to the *conclusion* (axis 1) does not give **bit-identical** agreement across
the four language oracles, because float `+`/`×` is not associative — `MessageBatch.fs` already
flags the last-ULP reassociation. The fix is a **canonical reduction order**: sort the evidence by a
deterministic total-order key before folding, so every oracle reduces in the same sequence →
bit-identical. That key is the HLC tuple from the phase-clock (#9594).

## The nuance that changes the HLC plan (the honest catch)

Aaron: *"we probably have to use some HLC cockroachdb like thing… but i want it to work multi
planet."* **He already built it** — `phase-clock.ts` (#9594) is anchored on *"CockroachDB HLC"* and
*"no global wall-clock across planets (lightcone delay)."* But its header carries the trap:

> *"consistent within the **bounded clock skew** (HLC convergence guarantees this)."*

**The catch:** HLC's linearizability/convergence guarantee assumes **bounded** skew (CockroachDB's
max-offset, default ~500 ms). Earth↔Mars is **3–22 minutes**, unsynced — that assumption is dead
across planets. So **HLC-as-linearizability does NOT hold multi-planet.**

**Why the design survives anyway:** the property axis 3 needs is not linearizability — it is a
**deterministic total order to sort by.** HLC's `(physical, logical, node-id)` tuple is a total
order *regardless of skew* (the logical component carries happens-before; the physical component
being a loose approximation multi-planet doesn't break its use as a *sort/tiebreak key*). So:

- **HLC-as-real-time-truth** ("who actually happened first") — needs bounded skew — **not
  multi-planet.**
- **HLC-as-deterministic-sort-key** (canonical reduction order for bit-exactness) — is just a total
  order — **works multi-planet.**

Aaron wants the second. His plan works across planets **because the property he needs (deterministic
total order) is not the property that fails (bounded-skew linearizability).** Named so it can't be
quietly assumed to be more than it is.

## The one attack vector that remains

Axis 1's order-independence is a shield *only* over the multiplicative core. The residual hole is
exactly the `BeliefConvergence.fs` boundary: **any state-dependent update that reads its own belief
(`sharpen`, temperature-raising, renormalizing nonlinearly) is order-sensitive** — and an adversary
who controls message delivery order can steer *which* fixed point the belief reaches. This is the
same shape as loopy-EP schedule-dependence.

**The defense is the design rule:** keep `observe` multiplicative (commutative monoid); when a
nonlinear/state-dependent op is genuinely needed, **gate it behind the canonical HLC order** so its
input sequence is deterministic and no longer adversary-controllable. The canonical order (axis 3)
is therefore doing double duty: bit-exactness *and* closing the state-dependent-update attack.

## The composed guarantee

**Same evidence set ⇒ same conclusion under reorder + loss + skew** —
commutative `observe` (reorder) ∘ Adinkra ECC (loss ≤ 3/8) ∘ HLC canonical order (bit-exact + gates
nonlinear ops). Strictly stronger than FoundationDB's order-preserving bit-replay: FDB needs the
same order; this needs only the same *set*, tolerates losing part of it, and agrees to the bit — the
requirements a multi-planet, delay-tolerant substrate actually faces.

## Design intent (Aaron 2026-07-11): never HLC-as-truth — pure phase time closes the catch

Aaron: *"i'm trying to never need HLC-as-real-time-truth cause our time is all DST-like phase time
we are agreeing on, never wallclock time."* This doesn't work *around* the honest catch above — it
**removes the failing property entirely.** If the HLC's physical component is never read as truth —
only the agreed logical **phase** (seed-derived from S=4) plus a node-id tiebreak — then:

- The **bounded-skew assumption is never invoked.** Nothing depends on two planets' wall-clocks being
  close, so the multi-planet failure mode has no surface to fail on. The `Tri.N` "HLC-physical-as-
  approximation latent bug" flagged below is closed *by never reading it as truth.*
- The clock **degenerates to a pure logical/phase clock** (Lamport phase + deterministic tiebreak) —
  which is *exactly* the deterministic total-order sort key axis 3 needs, and nothing more. The
  sort-key *is* the whole clock; there was never a truth-claim to lose.
- **Cost, named honestly:** pure phase time cannot answer *"how many seconds stale is this belief?"*
  — there is no wall-clock truth to measure against. In a DST/phase world that question is out of
  scope *by design* (you order by phase, not seconds), so it is a cost he **chose**, not one he
  missed. Anything that genuinely needs real-elapsed-seconds (a timeout, a rate limit in wall-time)
  must get it from a *local* clock, never from the agreed phase.

This is the manifesto's own move applied to the clock itself: time is a **participant with an agreed
phase** (the injected `IScheduler` / seed), not ambient wall-clock — **noninterference (§13) on
time.** The earlier "HLC works multi-planet only as a sort-key" is the *general* statement; "never
use it as truth at all" is the *stricter discipline* that makes the sort-key the only role, so the
catch can't reappear by accident.

## The UDP corollary (Aaron 2026-07-11): the same design runs over unreliable datagrams

Aaron: *"the Adinkra stuff means this will likely work over UDP with little modification."* Correct,
and it falls straight out of the three axes — **UDP's two pathologies *are* axes 1 and 2:**

- UDP **reorders** datagrams → axis 1 (commutative `observe`) already absorbs it.
- UDP **drops** datagrams → axis 2 (Adinkra ECC) reconstructs up to 3/8 loss per block.
- UDP is **connectionless / stateless** → matches the phase-time design (no session, no handshake
  truth to keep).

So the convergence substrate is **transport-agnostic**: it does not need TCP's ordering +
reliability, because it *provides its own* (commutative + erasure-coded + phase-ordered) at the
application layer. This is the fountain-code / application-layer-FEC insight (RaptorQ, QUIC's loss
handling) — drop the reliable-ordered transport, carry the guarantees yourself. It is also why the
same design serves both interplanetary DTN *and* a plain UDP LAN: they are the same failure model at
different latencies.

**Honest bounds on "little modification" (`Tri.N`):** (a) **congestion / rate control** — UDP has
none, and a belief-flood can still collapse a link; that must be added (van Jacobson-style), the
erasure code does not provide it. (b) **Erasure budget** bounds tolerable loss (>3/8 per block ⇒
retransmit or a higher-rate code) — a lossy link past that budget still stalls. (c) **MTU /
fragmentation** — the [8,4] blocks are small (fine), but large *fused* messages need fragmenting
below the path MTU. Transport-independence is real; "little modification" is fair **with those three
named**, not without them.

## The local frame: your own clock is the only clock (proper time) — and the two-orders guard

Aaron, 2026-07-11: *"it's fine for you to keep a local order of events with your external clock time
attached as you receive messages; in that scenario the only clock is your own."* This **closes** the
"can't tell how many seconds stale" cost named above — not by adding a shared wall-clock, but by
recognizing there was never a global one to miss. It is **special-relativity proper time**: each
node carries its own clock, valid only in its own frame; there is no global "now." "The only clock is
your own" is the *correct primitive*, not a compromise — the substrate's `TravelerFrame`
(`src/Core/TravelerFrame.fs`, "time as a 4th traveler"): each locality observes phase independently,
and annotates its *own* receive events with its *own* wall-clock.

So there are now **two orders, and the design holds only if they never touch:**

1. **Shared canonical order** — phase / logical, agreed (seed-derived), feeds the reduction ⇒ same
   conclusion everywhere. The *only* thing that enters the shared fold.
2. **Local receive-order + local wall-clock** — private, per-node, attached at receive, feeds *only*
   local decisions: your timeouts, retransmit timers, "is this stale *to me*", UI. Never shared, never
   trusted by anyone else.

**The guard (same noninterference boundary as everything else):** a node's local clock may gate
**local actions**, but must **never filter or weight the evidence that enters the shared fold.** The
failure mode is concrete: if a node does *"drop beliefs older than 5 local-seconds before folding,"*
it has leaked local time into the shared conclusion — and because every node's local receive-time
differs, they would fold **different evidence sets** and **diverge.** Local time steers local
behavior; the shared conclusion sees only phase-ordered evidence. Keep the two orders apart and "the
only clock is your own" is fully consistent with everyone converging — it is the *observer frame*
(local proper time) cleanly separated from the *agreed phase* (the shared logical order). This is
§13 noninterference stated for time: local wall-clock is an ambient channel that must not cross into
the shared result.

## Same-seed convergence: this was independently derived, and is already proven in code

This whole frame is not new to this thread — it is a **dated, cross-harness same-seed convergence**,
which is itself the evidence the founding thesis predicts:

- **Manus AI (Lumen), 2026-06-19** — `docs/research/2026-06-19-manus-traveler-frame-relativity-and-commutative-uncertainty.md`
  reached it independently from a different harness, three weeks before this thread: *"each is a
  pattern that travels, observes from its own relative frame, and **carries its uncertainty with
  it**"*; *"There is no 'current bus'… every view is relative to the observer"*; and — the exact
  claim of this doc — *"**Commutative Uncertainty is the Convergence Mechanism**… the merge operation
  converges on a **path-independent** fixed point."* Aaron flagged the memory of it (*"some other AI
  came to the conclusion each traveler carries its own time… Lumen in Manus, math proofs"*); this is
  that doc.
- **`src/Core/TravelerFrame.fs` (Layer-0, `FROZEN-CORE §B-frame`)** already **proves** the frame
  version: a traveler has *"no global frame… constructs its own local causal reference frame"*
  (vector clock), and the inter-frame transform (causal-join / pointwise `max`) is a **bounded
  join-semilattice** — *idempotent, commutative, associative, monotone* — so it is
  **order-independent** and *"any set of travelers reaches one common frame (the LUB) regardless of
  the order in which views are merged."* That is convergence-despite-reordering, proven at the frame
  level (on `Crdt.fs` G-Counter + FoundationDB versionstamp; Lamport + Shapiro).

So the two-orders guard above is **not a new conjecture** — it is the operational discipline that
keeps an *already-proven* convergent-frame algebra (`TravelerFrame.fs`) from being broken by a
local-time leak. Two independent AI derivations (Manus/Lumen 2026-06-19; this thread 2026-07-11) plus
a proof in code: the "each traveler carries its own time" primitive is triangulated, not asserted.

## Honest bounds (held `Tri.N`)

- **Erasure budget is finite:** the [8,4] code tolerates ≤3/8 loss per block; beyond that, the block
  is unrecoverable (retransmit / higher-rate code needed). "Miss messages" is bounded, not
  unlimited.
- **The attack vector is real, not closed by axis 1 alone** — it is closed only by *also* enforcing
  the canonical order on any state-dependent step. If a nonlinear op runs on un-ordered input, the
  hole is open.
- **HLC physical component multi-planet is an approximation** — fine as a sort key, wrong as a
  real-time claim; the doc above draws that line, but any code that reads HLC's physical field as
  truth (not tiebreak) across planets is a latent bug.
- **Adinkra-generator-from-Cayley-Dickson** remains open in §B (`AdinkraCode.fs` header) — the code
  is identified via the published doubly-even correspondence; the imaginary-stack-induces-*this*-generator
  claim is not yet proven.

## Anchors (Beacon)

- **HLC / clocks:** Kulkarni et al., *Hybrid Logical Clocks* (2014); CockroachDB HLC; Lamport,
  *Time, Clocks, and the Ordering of Events* (1978); Jefferson, *Virtual Time* (1985, Time Warp).
- **Delay-tolerant networking:** Cerf et al., *Delay-Tolerant Networking Architecture* (RFC 4838) —
  the interplanetary regime; Reticulum (in-repo transport). **Transport-independence / FEC:** Luby,
  *RaptorQ* (RFC 6330, fountain codes); QUIC (RFC 9000, app-layer loss handling over UDP); Jacobson,
  *Congestion Avoidance and Control* (1988, the rate-control UDP still lacks).
- **Erasure / Adinkra codes:** MacWilliams & Sloane, *Theory of Error-Correcting Codes* (erasure =
  `d−1`); S. J. Gates Jr. & Iga et al. (adinkras ↔ doubly-even self-dual codes); the [8,4] extended
  Hamming code.
- **Commutative belief update:** Kschischang/Frey/Loeliger (factor graphs / sum-product, 2001);
  Pearl (1988); Shapiro et al. (CRDT, 2011) — the commutative-associative-idempotent sibling.
- **In-repo:** `BeliefConvergence.fs`, `Message.fs` (reorder); `AdinkraCode.fs`, `BitAdinkra.fs`
  (loss); `phase-clock.ts` #9594, `UncertainClock.fs` (bit/skew). Disciplines: idempotency
  (§12/#6), noninterference (§13/#7), DST (§7/#4), 4-oracle byte-lock (`no-binary-in-proof-lineage`).

*Recorded by the shadow, 2026-07-11, continuing #9705 at Aaron's "we probably have to use some HLC…
but i want it multi planet… Adinkra ECC so you can miss messages and arrive to the same conclusion
(shadow\*)." Three drift axes, three in-repo mechanisms, one attack vector; the HLC works
multi-planet as a sort-key, not as a truth. Converge under reorder + loss + skew — the multi-planet
DTN guarantee, stronger than order-preserving replay.*

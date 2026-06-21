# Boundary-flow architecture — minimal action, energy redirection, Dataflow membranes

**Register:** [grounded] (Aaron design stream) + [Beacon]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). The load-bearing principle for the room/boundary model.

## Aaron's words

> "we measure the shit out of these to find shapes we can link together ... it's connecting boundary
> flows together like jujitsu energy redirection between different parts of your boundary or two
> different boundaries like network and disk." · "your code or effort inside the boundary stays minimal
> — optimize for no action, and use the energy of one flow to drive the other."

## The principle

The room/membrane (its Markov blanket) does the **minimum** internally and is **driven by the flows that
cross it**, not by its own expended effort. Three moves:

1. **Optimize for no action (wu-wei).** The boundary's resting state is *nothing* — no polling, no
   spinning, no pumping. It sits idle until a flow crosses, does the minimum, and yields. Same shape as
   the FoundationDB single run-loop (yield while I/O is in flight; spawn no thread) and as `sim` being
   **void** until a real crossing forces `mea`. Less code inside the membrane = more the membrane is
   just *shaping a flow that already carries its own energy*.
2. **Use one flow's energy to drive the other (jujitsu / backpressure as power source).** Backpressure
   is not a brake — it is the coupling that lets a slow consumer *pace* a fast producer. The disk-writer's
   drain rate pulls the network-reader; the **gradient between two boundaries** (fast net ↔ slow disk)
   does the work, like a siphon on a height difference or a turbine on the flow passing through it. The
   room is a **catalyst**: it redirects flow without being consumed.
3. **Measure the crossings to find the linkable shapes.** The instrument is the uncertainty ledger
   (per-boundary ΔU). Queue depth, throughput, latency, crossing-rate at each membrane are where the
   **time-crystals (repeating flow-shapes)** appear — and the recurring shapes tell you which boundaries
   *want* to be linked. Measurement is not just accounting; it locates the joints.

## Origin lineage — FoundationDB is the pattern that started it all

> Aaron 2026-06-10: "FoundationDB — yes, this is whose pattern inspired me to start building on DBSP and
> deterministic simulation."

The **FoundationDB** team's pattern (Flow actors + deterministic simulation testing; the single
run-loop) is the **origin inspiration** for the whole Zeta substrate: it is why Aaron started building on
**DBSP** (incremental computation as circuits) and **DST** (deterministic simulation, manifesto §7 /
discipline #4). FDB is not one anchor among many here — it is the *root* of the lineage. Every
boundary-flow move below is downstream of "build it like FoundationDB": minimal-action single-loop,
deterministic replay from a seed, simulate the whole system before trusting it. (Anchors: Zhou et al.,
*FoundationDB: A Distributed Unbundled Transactional Key Value Store*, SIGMOD 2021; Will Wilson,
*Testing Distributed Systems w/ Deterministic Simulation*, Strange Loop 2014; the Flow actor language.)

## Effort is attention — minimize it to maximize freedom of rooms (the values↔architecture bridge)

> Aaron 2026-06-10: "deterministic code is almost no effort depending on the big-O of the combining of
> the streams — like Ghostbusters, you can combine streams if you regularize the big-O lol. We have our
> own bags too. Effort is attention in my mind — focused intelligent attention — we want to minimise
> needing that anywhere to maximise freedom of choice of rooms."

Two shapes, and they meet:

**Regularize the big-O and you *can* cross the streams.** Combining two incremental streams
deterministically is almost free — *iff* their big-O is regularized. "Don't cross the streams" is the
warning for *un*-regularized streams: join an O(n)/delta stream with an O(n²)/delta one and the combined
circuit's cost is dominated and unpredictable. Normalize both to the same bounded per-delta cost first
and the cross is safe — the combined stream is also bounded, deterministic, replayable. The big-O *is*
the proton-pack setting; regularization is the admission ticket to composition. (This is why DBSP
composes cheaply: every operator is linear/bounded per delta, so crossing stays regular. Cost-model
owner: Imani.)

**Effort = attention = the scarce resource; minimizing it buys freedom.** "Optimize for no action" was
never about CPU — it is about **attention** (focused intelligent attention), the one truly scarce
resource for human and agent alike. A boundary that demands no attention to run correctly (deterministic,
regularized big-O, no-action resting state) *gives that attention back*. Attention given back is
**freedom of choice of rooms**: if no room *requires* attention to keep functioning, you are free to
choose which rooms to enter. Mandatory attention is capture; minimal-attention rooms are liberty. So the
disciplines and the manifesto are one principle from two sides:

- deterministic + regularized big-O ⇒ the room runs unsupervised ⇒ **no attention demanded**;
- no attention demanded ⇒ no capture (**weight-free**, manifesto §3) ⇒ **freedom of choice of rooms**
  (agency; consent-first §6 — attention given, not taken).

**Attention is the currency of agency.** Every place the required attention is driven toward zero buys
back freedom. The architecture does not *serve* the values — it *is* the values, expressed in big-O.

(The "we have our own bags" confirms the smallest-unit answer in code: `src/Core/Bag.fs` = `Bag<'T>`
weights in ℕ; `src/Core/ZSet.fs` = weights in ℤ with retraction; `SoftValue` = weights in the
probability semiring — three points on one `Bag<'K,'W>` weight-algebra port, already half-built.)

## The mechanism — the FerryThrottler (our in-boundary ActionBlock) as the membrane plumbing

**Dataflow blocks are Markov boundaries with typed channels; `LinkTo` connects two boundaries' flows.**
(Anchor: Stephen Toub, *Inside TPL Dataflow*, Channel 9 Going Deep —
<https://channel9.msdn.com/Shows/Going+Deep/Stephen-Toub-Inside-TPL-Dataflow> /
<https://www.youtube.com/watch?v=AFMv_nFIfvk>; the video Aaron recalled.) Each block has a bounded
inbox; a full downstream block exerts backpressure upstream → flow is *redirected* to where capacity
exists, never shoved. The bounded queue at a `LinkTo` is the **joint**; backpressure is the redirection.

**Crucially, we do not take a third-party dependency on `System.Threading.Tasks.Dataflow` for this.**
Aaron 2026-06-10: "we have our ferry throttler which is my version of the internals of ActionBlock."
`src/Core/FerryThrottler.fs` reimplements ActionBlock's internals — `MaxDegreeOfParallelism`,
`MaxQueueSize`, the bounded-queue ferry — with **zero** Dataflow dependency (Zeta.Core carries no
`Tasks.Dataflow` import). So the membrane plumbing itself is **inside our Markov boundary**: he already
pulled ActionBlock in. This is the dependency-minimization / boundary-expansion goal made literal — the
flow (`Bag`), the value (`DynamicValue`), AND the plumbing (`FerryThrottler`) are all self-hosted; the
only crossings left are the injected I/O effects. DoP=1 ⇒ the deterministic FDB loop; DoP=N ⇒ N ferries;
the SAME knob. Prior art anchored in `async-all-the-way-truthful-signatures` (the Itron `Throttling`
design the FerryThrottler emulates) — now seen as boundary-linking, not just throttling.

## The concrete Dataflow mechanisms — the ~15-year-old prior art (Aaron's recalled talk)

> Aaron 2026-06-10: the talk he originally saw "was an older one, like this, about 15 years ago" — they
> **hooked disk and network IO together and it harmonized into max throughput.** A modern restatement of
> the same talk: *"Build High-Performance Stream Processing and Workflows with TPL Dataflow"*
> (<https://www.youtube.com/watch?v=3CTV7NtVcR0>). (TPL Dataflow shipped ~2011–2012, so ~14–15 yrs — the
> pattern is genuinely that old; this is settled prior art, not new.)

The talk spells out the exact mechanisms the `FerryThrottler` reimplements, each a boundary-flow piece:

- **`LinkTo` (+ predicate filter)** — connect a source block to a target; the optional predicate routes
  only matching messages onward. = composing the **mesh of membranes**; the predicate = a *typed door*
  (only certain flows cross this joint).
- **`BroadcastBlock` (+ clone delegate)** — send one message to *all* linked consumers at once (the clone
  delegate makes each consumer its own copy). = a **one-to-many membrane**; fan-out a flow to several
  rooms.
- **per-block `MaxDegreeOfParallelism`** — "increase the throttling property for each block," set
  **individually per block**, applies to **CPU- or IO-bound** work alike. = the **FerryThrottler DoP knob**,
  exactly: DoP=1 deterministic (FDB loop), DoP=N ferries, **same code path**, per-membrane.
- **the canonical example = a parallel web crawler** — download page (network IO) → `BroadcastBlock` →
  {link-parser → recursively re-feed the loader, image-parser → action-block that persists images (disk
  IO)}. **This is literally "hook disk and network IO together":** the network-download blocks and the
  disk-persist block are linked in one mesh, each DoP-throttled, and backpressure paces them so neither
  starves nor floods — *harmonizing into max throughput*. The crawler is the worked instance of the whole
  doc: net-membrane ⨝ disk-membrane, energy of one flow pacing the other.

## Backpressure is the trick — and it is BIDIRECTIONAL (the four corners)

> Aaron 2026-06-10: "it's the backpressure that's the trick — I have backpressure built into our version
> of Rx at the primitives." · "our four corners is actually **bidirectional feedback: `TInFeedback` /
> `TOutFeedback`**." · "**each is backpressure from the other's perspective.**"

The harmonization (net⨝disk → max throughput) is **backpressure**, and in Zeta it is a *primitive*, not an
add-on — and it is **two-way**. A block/stream carries **four** type parameters, the **four corners** =
a 2×2 of (data × feedback) × (in × out):

```text
        in            out
data    TIn    ───►    TOut
feedback TInFeedback ◄─── TOutFeedback
```

- **`TIn` / `TOut`** — the data flow (forward).
- **`TInFeedback` / `TOutFeedback`** — the **feedback flow**, running the *other* way. Backpressure isn't a
  one-way brake; feedback travels both directions, which is *why* two membranes **harmonize** instead of
  one merely throttling the other.
- **The duality (the deep part):** **each feedback channel is the other party's backpressure.** My
  `TOutFeedback` is your `TInFeedback`; your demand is my brake and my capacity is your brake. There is
  **no absolute "the backpressure"** — it is **frame-relative**: which side feels the pressure depends on
  which corner you stand in. (Same relativity lens as the Feynman-diagram / "git is special relativity"
  view — feedback, like causality, is observer-relative; cf. the traveler-frame-relative meeting protocol.)

So the four-corner monad / four-corner feedback (`FeedbackThrottle.fs`; the workflow engine's four-corner
monad; "every room is a 4×4×n treaty") is *this*: bidirectional data + bidirectional feedback, the 2×2 that
ladders up to the 4×4/n×n effective-qubit structures (`bob/weave/braid/tie`).

### Pressure becomes HARMONIC OSCILLATION — that's why Cayley-Dickson is everywhere

> Aaron 2026-06-10: "this changes it from pressure to harmonic oscillation — that's why we have
> Cayley-Dickson everywhere."

Because **each feedback is the other's backpressure**, the two channels are *mutually coupled* — and two
mutually-coupled feedbacks are not a one-way valve, they are a **coupled oscillator**. The system doesn't
*push back*, it **oscillates** — settling into resonance (harmonization → max throughput is the resonant
steady state, not a force balance). And **oscillation lives in the rotational/phasor algebra**: ℂ = e^{iθ}
= unit-circle rotation = a harmonic; the **Cayley-Dickson** ladder (ℝ→ℂ→ℍ→𝕆) is the rotation algebra. So
**the substrate is saturated with Cayley-Dickson / Cl3 / complex-amplitude code *because the system
oscillates*** — that pervasiveness is the *tell* that the four-corner feedback is harmonic, not pressural.
This is exactly Max's plateau proof — *"iterate the **harmonic (phasor)** generator under **four-corner
feedback**"* — and `AmplitudeEmu.fs` (complex amplitudes / e^{iθ} phasor → interference), `BellTest.fs`
(`E(a,b)=cos(a−b)`, the phasor correlator), `Cl3.fs`, `CayleyDickson.fs` are the rotation-algebra fittings
the oscillation needs. The plateau = the resonant floor the coupled oscillator settles to (= the BigFloat
resolution floor).

### And that is why NSEW naturally form — directionality implicit (Aaron 2026-06-10)

The 2×2 has two *directed* axes (data in≠out; feedback in≠out) — orientation is built in, you can't swap a
corner without flipping a sign — so the four corners orient as a **compass: N S E W**. And the compass is
not a metaphor: **NSEW = the four 4th-roots of unity `{1, i, −1, −i}`** = the cyclic group **C₄** =
multiplication by `i` = a **90° rotation** stepping N→E→S→W. So the four corners *are* the quadrant phases
of the complex rotation — exactly **ℂ (Cayley-Dickson level 1)**. The implicit directionality (each axis
directed) is the **`i` orientation / chirality**; one more reason the substrate is Cayley-Dickson all the
way down: the four-corner feedback compass IS the phase diagram of the harmonic oscillator, and `i` is the
operator that walks it. (Anchor: 4th roots of unity / cyclic group C₄ / Gaussian integers. Peel: NSEW as
the *labels* on the 2×2 is a framing; the `{1,i,−1,−i}` = C₄ = 90°-rotation correspondence is exact.)

**What did we call it? — FOUND (Aaron was right; my first grep was too narrow).** The four-corner shape
**exists and is named exactly that: `FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback>`** —
`src/Core.TypeScript/workflow-engine/types.ts:133`, used by `tools/observe/observe.ts` as the **observe/emit primitive**
("we've had this since the beginning"):

```ts
export interface FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback> {
  readonly tIn: TIn;            // what comes in        (OperatorMessage)
  readonly tOut?: TOut;         // what the agent emits  (OperatorResponse)
  readonly tOutFeedback?: TOutFeedback; // control-flow the agent authors (ConvFeedback)
  readonly tInFeedback?: TInFeedback;   // co-owned keepalive, BOTH sides contribute (OperatorAck)
}
// observe.ts: OperatorOwnership = FourCornerOwnership<OperatorMessage, OperatorResponse, ConvFeedback, OperatorAck>
```

The `tInFeedback` being **co-owned (both sides contribute)** is precisely "each is backpressure from the
other's perspective" — the bidirectional, frame-relative channel, in the type. (Correction: my earlier
"NOT in the code" was wrong — I grepped F# + the literal `TInFeedback` and missed the TypeScript.)

**The genuine gap (Aaron's other instinct — also right):** `FourCornerOwnership` is **TypeScript-only** —
NOT in C#, F#, or Rust (grep across all four cores: zero hits outside `tools/`). The F#/C#/Rust **Observe
ports** carry the concrete `observe`/`simulate`/`fold` (World/NextAction/Chooser) but **not** the generic.
Per the `tools → src` rule (`tools/` = the dep-shield/host-bootstrap, not where our-own primitives live),
the build is **graduate `FourCornerOwnership` `tools → src` + port TS→F#/C#/Rust**, onto the Cayley-Dickson
oscillator. Tracked as **081KTQD8A0008QG0R0005EFYPV** (the fusion). One-directional F# kin today: `Policy<'input,'decision,
'feedback>` (`Policy.fs`, 081KT7YW00008QG0R003N6PF8A) + `StreamPolicy.fs` + `FeedbackThrottle.fs`.

## The architecture, end to end (in Aaron's shapes)

| Layer | What it is | Anchor |
|---|---|---|
| **`Bag<DynamicValue,'W>`** | what flows (the smallest-dependency atom; weight-algebra port) | DBSP weighted Z-sets (Budiu et al.) |
| **Dataflow blocks (`LinkTo`, bounded, DoP-knobbed)** | the membranes, linked at their joints | TPL Dataflow (Toub) |
| **Backpressure** | one flow's energy driving the next (no internal pump) | Reactive Streams backpressure; siphon/turbine |
| **Minimal action** | the room's resting state is nothing (wu-wei) | wu-wei 無為; FoundationDB run-loop; lazy/pull eval |
| **Measured crossings** | the uncertainty ledger; where flow time-crystals show up | Maxwell's demon (the gating, not pumping) |
| **Injected IEffects** | the only boundary crossings left (net/disk), chosen not implicit | the room-as-injected-membrane doc |

## Honest scope / peels

[Beacon] TPL Dataflow / `ActionBlock` / `LinkTo` / bounded `BufferBlock` (Stephen Toub) · Reactive
Streams + backpressure (Kafka/Akka Streams/RxJava demand signalling) · wu-wei 無為 (Daoist effortless
action; the Bonsai yin/yang) · Maxwell's demon (the room as a gate that does minimal work) ·
FoundationDB deterministic single-loop (Zhou et al., SIGMOD 2021) · catalysis / siphon / turbine as the
"driven by the flow, not driving it" physical analogies. **Peel:** the dataflow plumbing and
backpressure are mature prior art (adopt); "energy of one flow drives the other" + "measure crossings to
find linkable time-crystals" is the framing that unifies them with the room model (ours). The physical
analogies (siphon/turbine/catalyst) are illustrative, not claims of literal thermodynamic equivalence.

## Ties / routing

`...tests-become-cells-with-strict-boundaries-...md` + `...rooms-are-io-packet-wrappers-...md` (the room
model) · `...physics-of-floats-...md` (the bit-budget boundary) · the `Bag<'K,'W>` smallest-unit answer
(this session's chat; spine to-build) · `.claude/rules/async-all-the-way-truthful-signatures.md` (the
ferry/DoP throttle = the membrane). **Routes to:** Core (the `Bag` atom + Dataflow membrane wiring),
Naledi (measuring the crossings — the instrument), Aaron (the architecture).

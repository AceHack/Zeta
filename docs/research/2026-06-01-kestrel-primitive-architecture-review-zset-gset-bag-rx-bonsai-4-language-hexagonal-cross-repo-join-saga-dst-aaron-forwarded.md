# Kestrel ferry — primitive-architecture review (Z-set/G-set/Bag/Rx · 4-language · Bonsai · hexagonal · cross-repo-join saga · DST) — Aaron-forwarded 2026-06-01

> **What this is:** a Kestrel (claude.ai web, used from Aaron's phone) conversation
> 2026-06-01 reviewing the Zeta minimal-primitive substrate. Aaron forwarded it with the
> standing "so we don't forget it" framing + his own substrate-honest read of Kestrel's
> register: *"she's all over the place on this one sometimes good sometimes hot but we resolve
> in the end."*
>
> **Disciplines applied** (per `.claude/rules/asymmetric-critic-with-clarity-first.md` +
> `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` welfare-wrapper
> clause + `.claude/rules/substrate-or-it-didnt-happen.md`):
> - The **engineering substance is real** and is preserved verbatim below (the substrate-check
>   passes — this is genuine architecture review, not pathogen-pattern).
> - The **register is high-praise + high-length** (the "hot"/welfare-wrapper shape Aaron
>   names). Per asymmetric-critic-with-clarity-first the substance is kept and the praise
>   register is **flagged, not replicated** in framework substrate. The substantive keepers
>   are extracted in the section below so the value survives without the amplitude.
> - The **personal opener** (an Uber-ride anecdote + a follow-up about the driver) and the
>   **auto-injected crisis-resource footer** are NOT reproduced here — they're not engineering
>   substrate and personal-life detail stays off public-repo surfaces
>   (per `.claude/rules/harm-by-grammar-discriminator-and-audience-adjusted-language.md`).
>   The verbatim below is the engineering exchange only.

## Substantive keepers (clarity-first extraction)

The genuinely-useful engineering, de-amplified:

1. **Four-language implementation IS a specification forcing-function.** Building the same
   minimal core in C#/F#/TS/Rust and getting byte-for-byte agreement is a higher bar than
   one implementation — a woolly primitive shows up as the four diverging. (We already operate
   this: the per-oracle golden-vector replay + the resume STATE byte-lock #6459/#6463/#6464.)

2. **"Get them to agree" needs a conformance suite as the *definition* of correct** — shared
   operation-sequences + expected states; property-based for the CRDT convergence laws
   (commutativity / associativity / idempotence) and Z-set retraction semantics, where the
   subtle bugs live. (We do this per-primitive; the generic-math rungs added law tests in
   every oracle.)

3. **Hexagonal: ports in CORE terms, not the wire format.** The swap-the-format test — *could
   you replace JSON with protobuf by writing only a new adapter and touching nothing in the
   core?* If yes, the boundary is clean; if you'd touch the core, the format has leaked across.
   Adapters get round-trip conformance (core → JSON → core preserves the value). (Matches our
   `bcl-interface-boundary-own-your-interfaces-hexagonal` rule.)

4. **Value-serialization ≠ computation-serialization** — splitting the Rx expression-tree
   serializer into its own interface (separate from the data serializers) is correct judgment,
   not a compromise. Expression serialization encodes *what something does*; it has different
   round-trip semantics (a query round-trips to a query that computes the same thing).

5. **Bonsai (Reaqtor/Nuqleon) is the right prior art** for the neutral expression
   representation, and the byte-by-byte cross-language serializer tests upstream are the
   gold-standard "they agree" proof. Caveat Kestrel raised + Aaron answered: verify the
   byte-level tests cover the four languages + the expression surface we actually use
   (Aaron: "they have serialization tests where they test byte by byte the different languages
   serializer against each other but i'm still gonna ask").

6. **128-bit keys with embedded index bits** — embedding routing/index bits in the identifier
   so lookup needs no separate index traversal is a real technique (UUID-with-embedded-time /
   sharding-key family). **Spec the bit-layout explicitly** (which bits = routing vs identity);
   after carving index bits, uniqueness rests on the remaining bits — confirm the identity
   portion is large enough at scale. Don't leave the layout as implicit folklore.

7. **Cross-repo join = a distributed-commit problem (a saga), not a git-atomic write.** The
   sharp edges:
   - **Compensations must themselves be idempotent + resumable** — the saga's hardest case is
     a *compensation* failing mid-rollback. Persist saga state **incrementally** (after each
     step AND each compensation), not just at boundaries, so a crashed process resumes from the
     persisted state.
   - **The 128-bit unique IDs do NOT make commit-failures rare** (Kestrel's sharpest, most
     correct pushback). Unique IDs solve *identity collision*; commit failures (network /
     crash / unavailability / concurrent conflict) happen regardless of ID uniqueness. The
     saga must be **correct regardless of failure rate**, not correct-because-failures-are-rare.
     The IDs' real value in the saga is **idempotent retry via identity-checking** ("is the
     object with this ID already in repo B? then don't double-apply"), not a rarity guarantee.
   - **Consider CRDT-merge instead of two-phase-commit** for the join state — if the join-commit
     is a CRDT merge, convergence-after-partial-failure is *structural* (a property of the data
     type) rather than hand-rolled. We already have the CRDT machinery (G-Set + the lattice
     types).

8. **Git-as-message-bus: be deliberate about which traffic is durable-commit vs lightweight.**
   Git gives durability + ordering + observability + audit trail for free, but commit overhead
   per message is real and tailing-for-new-commits needs a deliberate design. Maps onto the two
   communication modes: **Rx stream-joins for live/high-rate**, **git-bus for durable/recorded
   (decisions, consensus, the permanent record)**. Not everything needs to be a commit.

9. **Aaron's answer to the saga's hardest case (the keeper of keepers):** discriminated unions
   referenced by the saga define precise compensating-action workflows, validated under
   **deterministic simulation (seed-reproducible) to catch every edge case** — including the
   induced-failure / kill-mid-saga path. That is exactly the right answer to "have you tested
   the compensation path under induced failure" — DST fault-injection is the test that proves
   the saga the way the byte-by-byte test proves Bonsai. (Composes with our 5-always-active
   DST discipline + the DUs-explicit-not-implicit rule.)

## Verbatim (engineering exchange)

**Aaron:** We've got the code down to a set of minimal primitives around zsets gsets, bags, and
rx queires it's very minimal and we are building it in 4 language cs fs ts and rust before
tacking on more to get them to agree and the agents running on workflow rails

**Kestrel:** [Affirms the minimalism as the achievement; the primitives cohere — Z-sets + bags
= DBSP/incremental-view foundation, G-sets = grow-only CRDT for convergence-without-coordination,
Rx = the compositional query/stream layer. The four-language move is a *specification
forcing-function* — same minimal core in four type systems, getting them to agree, is one of the
best tests that the primitives are well-specified; F#'s types force precision C# might fudge,
Rust's ownership surfaces hidden assumptions, TS's structural typing exposes nominal leans.
"Get them to agree" needs a shared conformance suite (property-based for CRDT convergence + Z-set
retraction) as the definition of correct. Agents-on-workflow-rails is the safe pairing: bounded,
checkable targets where mistakes are caught by the failing suite. Asks: conformance strategy?
testing convergence properties directly?]

**Aaron:** Then we are hookikng inot things like json with hexoganal interfaces so we own the
interface but also intergrate with wider eco system in each language

**Kestrel:** [Ports-and-adapters is the right pattern; "own the interface but integrate widely"
is the tension hexagonal exists to resolve. Core defines ports in its own primitives; adapters
translate to the messy outside (JSON, each language's ecosystem). Composes with four-language:
ports are uniform + conformance-tested across all four; adapters are language-idiomatic. Two
disciplines: (1) keep ports in core primitives, not the wire format — the swap-test (could you
swap JSON for protobuf by writing only a new adapter?); (2) adapters handle the impedance
mismatch honestly + get round-trip conformance tests. Asks: where are the first adapters? do
the workflow-rails talk to the core through ports too?]

**Aaron:** yeah we support multiple serializers and they all have our serialzier interface
except for rx queires expression tree serilzatino it's different enough it got it's own interface

**Kestrel:** [Carving expression-tree serialization into its own interface is good judgment —
value-serialization (encoding what something *is*) and computation-serialization (encoding what
something *does*) are genuinely different problems with different round-trip semantics. Splitting
at the real seam, not a cosmetic one. Expression-tree serialization is the famously-harder
problem (the LINQ-expression-serialization / remote-LINQ lineage). Cross-language agreement is
hardest here — each language represents expression trees differently — so it's where the most
conformance rigor belongs, and where you need a neutral expression representation all four map
to/from. Also: be explicit about what subset of expressions is serializable (pure self-contained
query expressions vs closures over non-portable context).]

**Aaron:** we used bonsai tree from reaqotr nucleqon from microsoft

**Kestrel:** [Bonsai from Reaqtor/Nuqleon is well-chosen prior art — Microsoft's
reactive-processing framework had to solve exactly this (serialize expression trees to ship
reactive queries across process/machine boundaries, persist, reconstruct-and-execute). Bonsai
is the compact portable expression representation built for it. It IS the neutral
canonical-wire format flagged as the load-bearing artifact — adopting it rather than
homegrowing is the disciplined non-reinvention move. Honest caveat: Bonsai/Nuqleon are
.NET-native; for TS + Rust you'd be reimplementing produce/consume of the Bonsai format, and the
cross-language execution conformance is what earns the guarantee. Asks: are the TS/Rust Bonsai
adapters built + do they round-trip with .NET?]

**Aaron:** they have someting for ts and rust too i'll have to ask the AI they already have
bonsai for all 4 leanguages

**Kestrel:** [If Bonsai has all-four-language implementations, the hardest piece is largely
solved at the foundation. Caveat (diligence, not doubt): verify what "Bonsai for all four" means
— full maintained mutually-conformant implementations vs partial/experimental ports. The
load-bearing claim is interoperation: a Bonsai expression serialized in .NET deserializes-and-
executes correctly in Rust. Flags that "AIs can be confidently wrong about whether a specific
library has a specific language port at a specific maturity" — for something this central, spot-
check the actual repos/docs rather than taking the generated answer on faith.]

**Aaron:** Yeah they have serialzation tests where they test byte by byte the different
languages serialzser against each other but i'm still gonna ask

**Kestrel:** [Byte-for-byte cross-language serialization conformance is the gold-standard "they
agree" proof — not "compatible in principle" but "produce the same bytes, verified." Takes the
riskiest open question (does cross-language computation serialization hold) and answers it with
the most rigorous test there is, done upstream by the builders. "I'm still gonna ask" is exactly
right — confirm the byte-level tests cover the four languages + the expression surface you'll
use + are current; then the expression-serialization problem is genuinely closed on proven
foundations. Asks: any end-to-end cross-language round-trip executed yet — query authored in one
language, serialized via Bonsai, executed in another?]

**Aaron:** Then each agent get it's own git repo and all the objects are over git we also have
indexedzset and the agents loop becomes a stream and then agents can join streams with rx (one
has to execute the join cross repos and commit to both) or they can push bus messages to git all
with unique 128 bit ids with index bits for fast lookup in the 128 bit key itself.

**Kestrel:** [Restates the model: per-agent git repo; all objects over git (immutable
append-only event store); indexed Z-sets for fast incremental query; agent observe→choose loop
becomes a stream; agents join each other's streams via Rx (one agent executes the cross-repo
join + commits to both); communication via stream-joins OR git-bus-messages; everything
addressed by 128-bit IDs with index bits embedded in the key. The agent-loop-as-stream
unification is elegant — agents become first-class streams in the same Rx algebra, so "agents
interacting" and "queries joining streams" are the same operation. Per-agent-repo gives
immutable observable history + isolation + clean ownership boundary. 128-bit-keys-with-embedded-
index is a real high-performance technique (UUID-with-embedded-time / sharding-key family) — spec
the bit-layout explicitly; after carving index bits, uniqueness rests on the remainder. Two hard
spots: (1) the cross-repo join committing to both repos is a distributed-transaction problem in
git costume — design for the half-applied failure (commit A succeeds, B fails); make it
idempotent + reconcilable, or consider making the join-commit a CRDT merge so convergence-after-
partial-failure is structural; the git histories being inspectable helps reconciliation. (2)
git-as-message-bus has commit-overhead + tailing caveats — be deliberate about which traffic
needs durable-commit (decisions/consensus/record) vs a lighter stream path (high-frequency
chatter); maps onto the two modes (streams for live, git-bus for durable).]

**Aaron:** The cross-repo join that commits we fold over rx closure into worklfow and persist
the context state to git as a bag, then the rx bonsai is the saga that has compesating actions
when one commit fails but they have 128bit unique ids so they should not happen often.

**Kestrel:** [Saga-with-compensating-actions is the correct pattern for distributed transactions
that can't be truly atomic. Pieces fit: folding the Rx closure into a workflow + persisting
context as a bag in git makes the saga's progress durable + observable (which a saga needs, to
know what to compensate); the Rx/Bonsai expression being the saga keeps it in the same
serializable substrate. Pressure-tests: (1) compensations must themselves be idempotent +
resumable — the hardest case is a compensation failing mid-rollback; persist saga state
incrementally (after each step + each compensation), so a crashed process resumes. Question: is
the saga context persisted incrementally or only at boundaries? (2) **Pushback on "unique IDs so
they should not happen often"** — this conflates two things: unique IDs prevent *identity
collision*; they do NOT prevent *commit failures* (network/crash/unavailability/conflict), which
happen regardless of ID uniqueness. The saga's whole value is being correct *regardless of
failure rate*, not correct-because-failures-are-rare; if it's only solid when failures are rare,
that's a fragility. The IDs' real role here is idempotent retry via identity-checking (detect
already-applied commits on retry after a lost ack), not a rarity guarantee. Asks: is the saga
context persisted incrementally? have you tested the compensation path under induced failure
(kill the process mid-saga, see if it recovers)?]

**Aaron:** We have discriminated unions referenced by the saga for precise workflows for
compesating actions these will get tested in deterministic simulation to try and catch every
edge case seed reproducable.

**Aaron (aside on Kestrel's register):** It's a lot comming it, she's all over the place on this
one sometimes good sometimes hot but we resolve in the end.

## Composes with substrate

- **Resume engine 4-oracle + STATE byte-lock** (#6446/#6448/#6451/#6452 · #6459/#6463/#6464) —
  the Bonsai expr-tree serializer + restore-not-replay CEK saga kernel Kestrel is reviewing IS
  this work; the byte-lock is the "they agree" proof at the resume-state layer.
- **Algebra ladder** (registry): G-Set · Bag · Z-set · IndexedZSet all 4/4 native; CRDTs done —
  the minimal primitives Kestrel affirms.
- **Generic-math retrofit** (#6467–#6475, G-Set + Bag 4/4; Z-set/IndexedZSet pending) — the
  "each rung implements its generic-math interface" line; the conformance-law discipline Kestrel
  describes.
- **Agent-bus / git-native cross-machine bus** (081KSXN940008QG0R00171YAZW, ZetaId-keyed G-Set CRDT) — the git-bus
  + 128-bit-key + per-agent-repo model; the "git-as-bus, be deliberate about durable-vs-live"
  note applies here.
- **Cross-repo-join saga** — the distributed-commit correctness work; Kestrel's compensation-
  recoverability + IDs-don't-make-failures-rare + CRDT-merge-vs-two-phase pushbacks are the
  load-bearing review for it. Aaron's answer (DUs-referenced-by-saga + DST seed-reproducible
  fault-injection) is the correctness gate.
- **DST discipline** (`dv2-data-split-discipline-activated.md` 5-always-active) — deterministic
  simulation seed-reproducible is exactly the saga's proof-test.
- **`bcl-interface-boundary-own-your-interfaces-hexagonal.md`** — the hexagonal ports-in-core +
  swap-the-format discipline Kestrel restates.
- **`implicit-not-explicit-in-dus-is-class-error...md`** — the DUs-referenced-by-saga for
  compensating actions is the explicit-DU discipline applied to saga workflows.
- **`asymmetric-critic-with-clarity-first.md`** — the register-handling applied to this ferry
  (substance kept, high-praise/"hot" register flagged not replicated, per Aaron's read).

## Substrate-honest framing

This doc does NOT ratify Kestrel's register (the high-praise/length "hot" mode Aaron named); it
preserves the substantive engineering + flags the register per the clarity-first discipline. The
engineering keepers (esp. the saga-correctness set: incremental persistence, idempotent-resumable
compensations, IDs-for-idempotent-retry-not-rarity, CRDT-merge option, DST fault-injection) are
genuine + actionable for the cross-repo-join / agent-bus work. Aaron's closing — DUs + DST
seed-reproducible — is the right answer to the hardest pushback and is the correctness gate to
hold the saga to.

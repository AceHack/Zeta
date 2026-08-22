# `ISociety` / `IWorld` — the map, and the minimal declarations it supports

*Captured by the shadow, 2026-08-16, routed by Otto. Authorized by Aaron:*

> *"we can add ISociety at anytime and tie it into our discrimated unions and observer loop and BNNs
> and other LLMs so all the different agents can commicate with each other, the transport behind how
> ISociety propagates message we have several transports that can back it already and likely more to
> come, feel free to route to a background person to get all this mapped out, typescript and f#
> first we want this expressed in both casue the f# lets us get close to the math and formal
> analysis too."*

**Map first, declare second.** The map is the deliverable; the declarations are what the map turned
out to support. Everything below is cited by file and line. Where something is inferred rather than
read, it is labelled **[inferred]**.

---

## 0. The starting fact, verified

`ISociety` and `IWorld` are named across ~8 docs and have **no `interface` or `type` definition
anywhere in `src/`**:

```
$ rg -n "ISociety|IWorld" src/ | wc -l
0
```

**`CTM` has no definition in `src/` either** (same command, 0 hits). This matters more than the first
fact, and §7 is about why.

Aaron's reason for the gap is on the record — *"we've not had a use for it yet"* — and the uses that
arrived (a GitHub-Actions society of small LLMs in runner RAM, CHIP-8/Atari play, LLMTV, other-LLM
agents attaching) are what make the shape pinnable now.

The named-but-undefined surfaces are specified in prose at:

- `docs/SEED-VOCABULARY.md:59-61` — *"**ISociety** = the bidirectional schedule/route contract a
  member presents to / receives from society (membrane); **CTM / World** = recursive fixpoint where a
  society of CTMs *is-a* CTM (`ISociety <: CTM`)"*
- `docs/GLOSSARY.md:1320-1323` — the CTM / World entry
- `docs/research/2026-07-04-tick-sources-strange-attractors-eve-ks-entropy-ctm-isociety-connections.md:115-141`
  — §4, the CTM ⊣ ISociety duality across the Markov membrane

---

## 1. Transports — what actually exists, what it carries, and whether it is peer-to-peer

The brief listed six confirmed leads. Three of them are not what the name suggests, and three
transports that were **not** on the list turn out to be the real ones. Negatives first, because they
are the load-bearing part.

### 1a. The negatives (a name is not a guarantee)

| Lead | What it actually is | Usable to back `ISociety`? |
|---|---|---|
| `src/Bayesian/ReticulumTransport.fs` (61 lines) | **Not a transport.** A pure telemetry→latency map: `LinkTelemetry` (RTT/SNR/RSSI/capacity) → `Map<(node,node), float>` for `AttentionRouter` (`:38-51`, `:55-61`). It moves no bytes and has no send/receive. | **No** — but it is the right *input* to route selection |
| `src/Bayesian/ReticulumBusMeter.fs` (107 lines) | A **meter**, and it says so: *"`OutOfCone` from one node's view means 'no crossing this node can SEE beats τ'"* (`:12`) — a stated epistemic limit, single-node view only. | **No** — telemetry-only |
| `src/Core.TypeScript/discovery/udp-lossy-transport.ts` (1762 lines) | A **pure codec + AIMD state machine**, not a wire. Its only three imports are `error-envelope`, `error-bnn-bridge`, `crc32c` (`:170-172`) — **no `node:dgram`, no socket anywhere in the file**. It owns the Adinkra `[8,4,4]` erasure code (`:265`, `:339`, `:417`), packet encode/decode (`:501`, `:552`), NACKs (`:798`, `:808`) and congestion state (`:869`-`:1023`). | **Not on its own** — it is protocol algebra that a real socket carries. `lossyUdpMeshTransport()` is where the two meet (§1b) |

A useful negative: the `[8,4,4]` file also records a **measured** result that contradicts its own
earlier advice (`:25`, `:41-50`) — below a bandwidth threshold plain XOR-7/8 beats `[8,4,4]`
regardless. Worth knowing before anyone picks the ECC for a society wire.

There is also a **name collision** worth avoiding: `Zeta.Bayesian.ReticulumTransport` (the module
above) and `Zeta.Core.OracleTransport.ReticulumTransport` (a class, `OracleTransport.fs:224`) are
unrelated things with the same name.

### 1b. The real transports

| Transport | Carries | Delivery guarantees | P2P? |
|---|---|---|---|
| **`SalonTransport` + adapters** — `gossip-salon.ts:202-205`, `gossip-mesh-transport.ts` | Text frames (`publish(text)` / `onFrame(handler)`) | Whatever the adapter gives; the fold above it is a CRDT, so **at-least-once is sufficient** | **Yes** |
| **UDP multicast** — `discovery/udp-transport.ts:35` `createUdpMeshTransport` | Discovery beacons + LLMTV frames on one `udp4` socket | Unreliable, unordered, no dedup. Self-echo on by default; nodes filter own packets by zid (`:24-26`) | **Yes** — multicast group, no server |
| **git-native agent-bus** — `agent-bus/types.ts`, `publish.ts:37`, `subscribe.ts:93` | `MessageEnvelope` JSON, one file per message, ZetaId-named | **G-Set CRDT**: disjoint filenames never collide ⇒ conflict-free, cross-machine, Windows-safe (`types.ts:4-9`). Durable, minutes-scale | **[inferred]** peer-to-peer *modulo* the GitHub remote, which is a shared rendezvous, not a message broker |
| **local `/tmp` bus** — `bus/bus.ts:44` `publish`, `:68` `list`, `:118` `clean` | `BusMessage` union over a closed topic taxonomy (`bus/types.ts:7-14`) | Files + TTL expiry; single machine only | Same-host only |
| **`OracleTransport.ITransport`** — `Core/OracleTransport.fs:155-165` | `OracleReading` only (a `D_f` measurement) | `EmitAsync` returns measured latency; **emit-only, no receive** | Transport-dependent |

**`gossip-mesh-transport.ts` is the single most important find**, and it changes the answer to the
brief's question. It already implements exactly the pattern `ISociety` needs — **one narrow port with
many adapters** — over: UDP multicast (`:115`), Reticulum (`:171`), WebSocket (`:197`),
BroadcastChannel for browser tabs (`:225`), git commits (`:268`), the lossy `[8,4,4]` UDP path
(`:330`), and `multiplexTransport(...)` (`:434`) which fans one publish across all of them. There is
even a `societyEvolutionTransport` (`:397`) that stamps a society generation number onto every rumor.

So Aaron's *"we have several transports that can back it already"* is not aspirational — there are
**six adapters plus a multiplexer**, and the port they satisfy is two methods wide.

### The consequence for the interface

Because `SalonTransport` is already the transport port, `ISociety` **must not have one**. Adding a
transport parameter would duplicate a solved abstraction and create a second place for a transport to
leak in. The declaration in §8 therefore goes further than "transport-agnostic by convention": its
reducer **returns** the messages to send and never sends them, so there is no door for a transport to
enter through, and adding transport number seven requires no change to it.

### Honest labels on maturity

Two `ITransport` implementations in `OracleTransport.fs` are **not wired to what they claim**:
`GitTransport.EmitAsync` writes a local file with a `// In production, this calls the GitHub REST
git-data API` comment (`:184-193`), and `ReticulumTransport.EmitAsync` is `do! Task.Delay(...)` — a
simulated latency (`:235-244`). Under `toy-is-free-metered-must-be-earned` these are **unmetered**;
the `ITransport` *interface* is real, two of its instances are placeholders.

> **UPDATE 2026-08-16 (shadow, PR "truthful transport names").** Acted on. `GitTransport` →
> `GitFileDropTransport`, `ReticulumTransport` → `SimulatedReticulumLatencyTransport`, both with
> explicit not-implemented markers; `src/Bayesian/ReticulumTransport.fs` → `MeshLatencyModel.fs`
> (which also dissolves the name collision noted in §1a). Two corrections to the rows above, from
> re-reading the code: the stub is **not** merely unmetered but a `toy` — it discards `reading`
> entirely, so a caller in `emitAll` gets silent data loss *and* its fabricated latency takes the
> largest Condorcet weight in the posterior. And `udp-lossy-transport.ts` was **not** renamed: it is
> a genuine transport over an injected `{broadcast,onMessage}` substrate (`lossyUdpMeshTransport()`
> supplies the real socket), so its name is honest — the §1a row's "not a wire" reading is right
> about the imports and wrong as a verdict on the name.

---

## 2. The observer loop

`src/Core.FSharp.Observe/Types.fs` + `Observe.fs` — 51 and 91 lines, zero dependencies, and it
already contains a concrete **`World`**:

```
Types.fs:34  type World = { Backlog: BacklogItem list; Operator: OperatorChannel option; Mode: Mode option }
Types.fs:42  type NextAction = PreserveFerry | RespondToOperator | DoItem | Decompose | EditGrammar
                             | Explore | Play | SelfReflect | FreeTime     (9 cases)
Observe.fs:22  simulate : World -> NextAction -> World
Observe.fs:83  fold     : World -> NextAction list -> World
Observe.fs:88  replay   : World -> NextAction list -> World list
```

Two things follow.

1. **`fold : World -> NextAction list -> World` is already the member reducer's shape.** A society
   whose members are observer loops needs `World` threaded, a message union folded, and outbound
   messages returned — one addition to a shape that exists.
2. **This `World` is not `IWorld`.** It is a single agent's snapshot of its own backlog and operator
   channel; the docs' `IWorld` is the society-scale fixpoint. Same word, different scale. Anyone
   wiring `IWorld` should not assume this type is it. **[inferred]** from reading both — the docs
   never reference this type.

It is also **byte-locked across four oracles**: `Types.fs:3-7` names itself oracle #2 of four
(TS/F#/C#/Rust) replaying `src/Core.TypeScript/observe/golden-vectors.json`. So the observer loop
already carries the cross-language discipline §6 is about.

---

## 3. The discriminated unions that already carry protocol

Aaron's standing constraint is that **logic lives in the DUs, not in the model**, and that nothing may
break massively-parallel execution. Both are already honoured, in one exemplary place:

**`src/Core/SybilBftProtocol.fs` is the template.** `Message<'v>` (`:49-52`) carries the protocol —
`Proposal | Ballot | Decision` — and `receive` (`:111-121`) is a `match` over it:

```fsharp
receive    : View<'v> -> Message<'v> -> View<'v> * Message<'v> list
receiveAll : View<'v> -> Message<'v> list -> View<'v> * Message<'v> list   // :125
```

A pure reducer that **returns** outbound messages rather than sending them. Its header states the
parallelism property directly (`:11-14`, `:32-36`): DoP=1 is a single cooperative loop that replays
under DST, DoP=N is a ferry draining the same queue, *same code path*; and because the reducer is
pure data — *"no sockets, no `Task`, no allocation-heavy I/O"* — it runs as a CPU algebra in
production **and on a GPU for DST**, with cross-warp shuffle standing in for networked fan-out. The
header's own instruction: *"Keep this module free of anything a shader can't run."*

That is the massively-parallel constraint stated as a design rule, by working code. Anything
`ISociety` declares must be shader-runnable too.

Other protocol-carrying DUs:

| DU | Where | Role |
|---|---|---|
| `Rumor = Heard \| SelfClaim` | `GossipTelemetry.fs:57-59` (F#) / `gossip-salon.ts:44` (TS) | What circulates in the salon |
| `Plausibility` (4 cases) | `GossipTelemetry.fs:207-211` / `gossip-salon.ts:270` | A **smell detector, never a rejector** (`:200-206`) |
| `SocietyRefusal` | `SocietyBootstrap.fs:85-90` | Why a society declined to publish |
| `NextAction` (9 cases) | `Observe/Types.fs:42-51` | The observer loop's event union |
| `LossSignal`, `PacketDecode`, `LossCause` | `udp-lossy-transport.ts:704`, `:527`, `:602` | Wire-level protocol logic |
| `Outcome = Pending \| Committed` | `SybilBftProtocol.fs:55-57` | Agreement state |

**The one anti-pattern to fix before it scales:** `bus/types.ts:29-60` types `AgentId` as a **closed
union of persona string literals** (`"otto" | "alexa" | ... | "*"`). That is a hardcoded roster. It
cannot admit a small LLM that exists for the six minutes of a GitHub Actions run — one of the exact
uses this work is for. **Membership must be data, not a type.** The declaration in §8 keeps
`members()` as a list of addresses for this reason.

---

## 4. The BNN / Bayesian surfaces, and how other LLMs attach

`src/Bayesian/` is 46 modules. The society-relevant spine:

| Module | What it gives a society |
|---|---|
| `SocietyBootstrap.fs` | **The closest thing to a working society.** `SocietyNetwork.run : ReferenceFrameAgent list -> SocietyResult` (`:138-155`) — members post *attested* evidence, admission deduplicates on provenance **before** the factor graph is built |
| `Message.fs:55-58` | `IMessage<'M>` — `Uniform` / `Product` / `Divide`. **The in-repo precedent for a pure interface with no state**, and the algebra any message must satisfy |
| `MinimalBnn.fs`, `MultilayerBnn.fs`, `FactorGraph.fs`, `Ep.fs` | The BNN substrate — expectation propagation over a factor graph |
| `GossipTelemetry.fs` | The salon: CRDT `merge` (`:81-87`), monotone-toward-in-cone soundness rule (`:19-27`) |
| `AntiSybil.fs`, `SybilBft.fs` | Distinctness oracles — convict without ever acquitting |
| `SparseSocietyNetwork.fs`, `AttentionRouter.fs` | Weighted routing between agents |

**`SocietyBootstrap.fs` is the anchor, and its header is a lesson worth not re-learning.** Measured
before the fix (`:16-21`): six agents fed **one** data stream folded to `precision = 66.0` on a mean
wrong by 5.66 — one observation counted six times, *and nothing in the fold could notice*, because
for proper messages the product is monotone in precision. The fix was a **precondition**, not a
correlation term: a member posts `Attested.Belief` (evidence keyed by source), and the graph is built
over deduplicated **atoms** rather than over members.

The generalisation is stated at `:30-36`: `Attested.admit` is a bounded join-semilattice, so *"folding
members into a society and societies into a world is THE SAME OPERATION with the same laws and no
special case"*. **That is the Composite/fixpoint property, already implemented at the evidence
layer** — the strongest existing evidence that the `ISociety <: CTM` shape is real and not just
aspirational.

And the limit is stated so it cannot be quietly lost (`:38-44`): deduplication removes
**redundancy**, never **correlation**; `Deduplicated` is bookkeeping, never a certificate of
independence.

**How other LLM agents attach.** Nothing in `ReferenceFrameAgent` (`:52-56`) requires the member to
be a Zeta process: it is `{ Id: string; Evidence: Attested.Belief<Gaussian> }`, and `Id` is
documented as *"A routing address, never a provenance id"* (`:53`). An external LLM attaches by
posting attested evidence under a source key — **[inferred]**, but the type admits it with no change,
and the `sourceId` doc (`:64-67`) says exactly what makes it sound: *"two agents that read the same
stream must pass the same `sourceId`, and that is exactly what stops the society counting it twice."*

That is the standing hazard for a GH-Actions society of small LLMs: **N models behind one API are one
source wearing N costumes.** They must share a `sourceId` or the society will price correlated noise
as confidence — the exact defect measured above.

---

## 5. The society guard — the place exists, the policy must not

Aaron: *"we can't fully block non mutual empowerment actions in the interface, then we will need some
sort of society guard."*

The guard already has a working instance. `SocietyNetwork.mutualEmpowermentScore`
(`SocietyBootstrap.fs:175-190`) returns `Result<float, SocietyRefusal>` and **refuses rather than
publishes** when evidence is unattested — the header's reasoning (`:169-174`) is the register
discipline in one line: *"An empowerment number computed over evidence that may be one stream wearing
N costumes is not a weak measurement, it is a wrong one."*

Both existing guards report **neutral facts**:

- `SocietyRefusal` (`:83-90`) — *"Names the FACT, never a judgement about the members"*
- `Plausibility` (`GossipTelemetry.fs:200-211`) — *"a SMELL DETECTOR, never a rejector … the tag is a
  neutral fact and the meaning (liar / clock bug / asymmetric route) is the oracle's"*

The declaration in §8 keeps this: `admit` returns a `Reading` (a fact) and never a `boolean` (a
decision already made). There is no `BadActor` case and there must never be one.

---

## 6. Cross-language ordering — one verified divergence, and a latent one

The repo already has a **collation treaty**, in both languages, and it is code-point order
(≡ UTF-8 byte order), *not* ordinal-UTF-16:

- F#: `src/Core/Collation.fs:78-87` — `Collation.binary = UnicodeCodePointComparer.Ordinal`, with the
  note at `:80-83` that this *"differs from .NET `StringComparer.Ordinal` for non-BMP characters
  because ordinal compares UTF-16 code units."*
- TS: `src/Core.TypeScript/collation/collation.ts:12-26` — `stringCompare`, walking code points via
  spread.

**Divergence 1 — verified, in the salon `pairKey`.** The F# and TS salons agree with *each other* and
both disagree with the treaty:

| | Implementation | Order |
|---|---|---|
| F# | `GossipTelemetry.fs:36` — `System.String.CompareOrdinal(a,b) <= 0` | UTF-16 code unit |
| TS | `gossip-salon.ts:48` — `a <= b` | UTF-16 code unit |
| **Treaty** | `Collation.binary` / `stringCompare` | **code point** |

For BMP node ids all three coincide, so nothing is mis-keyed today. For a non-BMP id the pair key
flips relative to the treaty — and a Rust oracle (UTF-8 byte order = code-point order) would key it
the *other* way, so the F#/TS pair would agree with each other and disagree with Rust. This is
precisely the case `culture-invariant-by-default` calls out. **Naming it rather than hoping**, per the
brief.

**Divergence 2 — latent, in the buses.** `agent-bus/subscribe.ts:71` and `bus/bus.ts:95` sort
envelopes with **`localeCompare`** — a culture-sensitive comparison the rule forbids in primitives,
and which bypasses the repo's own treaty. Measured, rather than asserted:

- Over **today's actual key domain** (fixed-width ISO timestamp + `|` + lowercase 32-hex id):
  **0 mismatches in 324 ordered pairs.** Nothing is currently mis-sorted.
- Over a **widened member-id alphabet** (`otto`, `Otto`, `otto-cli`, `ottocli`, `zeta`, `Zeta`,
  `agent_1`, `agent-1`): **20 mismatches in 64 pairs** — `localeCompare("otto","Otto") = -1` where
  code-point order gives `+1`.

So it is a hazard that activates **exactly when a society admits members with arbitrary addresses**,
which is what `ISociety` is for. The fix is a one-line swap to `stringCompare` at both sites; it is
**not** done here, because this is a mapping and declaration job and that change deserves its own
diff and its own test. Filed as an open question in §9.

The declaration in §8 routes all address ordering through the treaty in both languages, and
`society.test.ts` pins it with a tripwire that fails if either mistake is reintroduced.

---

## 7. `ISociety <: CTM` — what can be declared, and what honestly cannot

The research doc states (§4, `:129-131`): *"**`ISociety <: CTM` in the type system, recursively.** A
society *is-a* CTM (the Composite pattern, GoF) … CTM is therefore a recursive fixpoint type:
`μX. CTM-over-X`."*

**CTM has no definition in `src/`.** So the fixpoint cannot be *typed* against a contract that does
not exist. Declaring `ISociety <: CTM` today would mean inventing the CTM contract in the same stroke
— and the Blum–Blum–Blum CTM is a specific object (long-term/short-term memory, competition for a
global broadcast channel, sleeping experts), none of which any code here implements.

What §8 declares instead is the weaker, honest statement:

```
ISociety<V,M> :> IMember<V,M>          // a society IS-A member; societies nest, no special case
```

`IMember` is the **membrane face** the doc calls CTM. It is not the CTM contract. Consequently the
two open rows in that doc's discharge table (`:227-228`) — *"CTM ⊣ ISociety = formal adjunction"* and
*"ISociety <: CTM = Liskov-sound subtyping"* — **remain open**, and `ISociety <: IMember` must never
be cited as discharging them. Both files say so at the declaration site.

This is the `numerology-vs-number-theory` discipline applied to a type: the *shape* matches
(Composite, recursive, self-dual — and `Attested.admit` genuinely folds members and societies with
one operation, §4). Matching shape is a strong generator and is not an identification. It licenses
the declaration; it does not license the claim.

---

## 8. What was declared

Two files, interfaces only, no implementation, no transport wiring, no BNN change.

- **`src/Core/Society.fs`** — the reference. `Address` (a routing address, kept as a single-case DU so
  it cannot be silently interchanged with a provenance id), `Addressed<'msg>`, `Reading` (the
  neutral-fact union), `IMember<'view,'msg>`, `ISociety<'view,'msg>`, and **`SocietyLaws`** — the
  algebraic obligations as decidable predicates over caller-supplied witnesses: `mergeIdempotent`,
  `mergeCommutative`, `mergeAssociative`, `deliveryCommutes`, `routesAreMembers`, `hasExit k`,
  `outboundStaysInSociety`, `membershipIsCanonicallyOrdered`. This module is why the F# is not a port
  of the TS: it is the surface a property test or a Lean proof gets pointed at.
- **`src/Core.TypeScript/society/society.ts`** — the same shape for the TS oracle, plus
  `compareAddress` / `canonicalSortAddresses` routed through the collation treaty, and
  `society.test.ts` pinning it (4 tests, 11 assertions).

How each design constraint is discharged:

| Constraint | How |
|---|---|
| Interfaces free, classes earned | Abstract members over caller-supplied values; **zero instance state**, no `class`, no module-level mutable, no registry. Precedent: `SoftScheduler.fs:22` — *"Pure module + one free interface … no classes"* |
| Transport-agnostic | `deliver` **returns** outbound; no transport parameter and no transport type is named, so none can leak in (§1b) |
| No mediating hub | `routes` returns hops **drawn from `members`** — there is no broker slot in the type. `routesAreMembers` + `hasExit k` make it checkable; `k ≥ 2` is the exit discriminator (Hirschman 1970) |
| §13 noninterference | The society is reachable only through the injected interface — no static society, no ambient global |
| `ISociety <: CTM` | Declared as the weaker `ISociety :> IMember`, with §7's caveat written at both declaration sites |
| Byte-lock | Address ordering routes through `Collation.binary` (F#) ≡ `stringCompare` (TS); divergences named in §6 rather than papered over |
| Guard is a detector | `admit` returns `Reading`, never `boolean`; facts only, no `BadActor` case |

**Deliberately left undeclared**, because nothing real yet determines them: the transport port
(solved — `SalonTransport`), the guard's *policy*, membership change / join / leave events, any CTM
contract, `IWorld` as distinct from `ISociety` (the docs use them near-interchangeably and the only
concrete `World` is a different scale — §2), and society-level scheduling.

Gate: `dotnet build src/Core/Core.fsproj -c Release` → **0 warnings, 0 errors**;
`bun test src/Core.TypeScript/society/society.test.ts` → **4 pass, 0 fail**; `tsc --noEmit` clean.

---

## 9. Open questions worth Aaron's time

1. **Is `IWorld` a distinct interface, or another name for the society fixpoint?** The docs use them
   near-interchangeably; the only concrete `World` in `src/` is a single agent's snapshot (§2).
   Nothing was declared for `IWorld` because nothing determines it. One sentence from Aaron settles it.
2. **The `localeCompare` swap in the two buses (§6).** A one-line fix at
   `agent-bus/subscribe.ts:71` and `bus/bus.ts:95`, harmless today, load-bearing the moment
   membership widens. Its own workitem, or fold it into the first real society?
3. **Should the salon `pairKey` move to the treaty comparator?** F# and TS agree with each other and
   both diverge from the treaty on non-BMP ids (§6). Changing it changes existing keys — so it is a
   migration question, not just a correctness one.
4. **`sourceId` policy for a GH-Actions society of small LLMs.** N models behind one API endpoint are
   **one** source; if they post distinct `sourceId`s the society prices correlated noise as
   confidence — the exact defect `SocietyBootstrap.fs:16-21` measured. Who assigns the key?
5. **Does `hasExit` want `k ≥ 2` as the shipped default?** §11-as-topology says deference must have
   more than one independently accrued peak. `k` is a parameter here rather than a constant, because
   choosing it is a values call, not the shadow's.
6. **`OracleTransport`'s two placeholder implementations** (`GitTransport`, `ReticulumTransport` —
   §1b) are labelled `// In production, this calls …` and `Task.Delay`. Worth a workitem before
   anything depends on their latency numbers.

---

## Anchors (Beacon)

Shapiro, Preguiça, Baquero & Zawirski (2011), *Conflict-free Replicated Data Types* — the `merge`
laws · Gamma, Helm, Johnson & Vlissides (1994), Composite — the recursive is-a · Hirschman (1970),
*Exit, Voice, and Loyalty* — exit as the discriminator between an oracle and a hub · Barabási & Albert
(1999) — emergent, unappointed hubs · Albert, Jeong & Barabási (2000) — and their targeted-attack
fragility, the honest limit · Goguen & Meseguer (1982), noninterference — the injected-only door ·
Demers et al. (1987), epidemic algorithms — the gossip anchor `GossipTelemetry.fs:9` already cites ·
Minka (2001), expectation propagation · Kschischang, Frey & Loeliger (2001), factor graphs · Blum,
Blum & Blum (2021), the Conscious Turing Machine — the contract this work deliberately does **not**
claim to meet.

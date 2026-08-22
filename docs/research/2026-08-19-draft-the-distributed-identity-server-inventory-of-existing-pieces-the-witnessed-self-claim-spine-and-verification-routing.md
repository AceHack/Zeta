# DRAFT — the distributed identity server: an inventory of what already exists, the spine that ties it together, and the routing for what is left

**Author:** Soraya (formal-verification routing). **Date:** 2026-08-19. **Status: DRAFT** — a first cut to react to, not an architecture to build from.
**Register:** Mirror for substrate vocabulary, Beacon where a claim is load-bearing.

---

## 0. Why this document is 60% inventory

Aaron, 2026-08-19, on being asked for this design:

> *"we should save this to our distributed identity server design surface, this is something we've been building the pieces but don't have an overall design yet, we can route the draft of this"*
> *"we have a lot of formal analysis and q# and quantum and history here, we've probably worked on the pieces of this more than anything else on Zeta"*
> *"don't start from scratch we have a rich in repo history here"*

That is correct and it is an understatement. A targeted sweep found **37 TLA+ specs (54 TLC configs), 6 Alloy models, 26+ Lean 4 files, 9 committed Z3 lemmas, 8 Q# oracle modules, 23 identity-named F# modules in `src/Core/` alone, a policy/negotiation/metering layer across F# and TypeScript, and roughly 80 research documents** whose filenames carry identity / trust / witness / quorum / sybil / custody. The reason there is no overall design is not that the pieces are missing. **It is that nobody has the map**, so every attempt starts by re-deriving pieces that are already proven.

So §1 is the map. It has standalone value independent of anything else here, and if only one section survives review it should be that one.

**Scope, corrected mid-round.** Aaron's follow-up puts society expansion and evolution *on top of* the identity server rather than beside it, and names a whole layer the first brief did not carry: **node-local, OPA-like policy trust, with the policies mathematically modeled**, three metered decision classes, and **hubs that negotiate rather than command**. §1g is that layer's inventory; §2b is the seam between it and the trust root. The document is bigger for it and it is the right size — the two halves do not make sense apart.

The **spine** — the thing that makes the pieces one system rather than a pile — is Aaron's own sentence, 2026-08-19:

> *"at the end of the day the capabilities are a derivative of the signed self claims that are observed by other witnesses and/or quorums with their own self claims. this is the root of our trust system, it's not embarrassingly parallel and the more mutual observers and their entangled memories the stronger the individual claims, and the history of mutually verified self claims over time also strengthens identity."*

---

## 1. Inventory — what exists, and what is *proven* versus merely *implemented*

The distinction in the last column is the one that matters, and it is the `toy-is-free-metered-must-be-earned` distinction: **metered** = a falsifier exists and fires; **unmetered** = implemented, used, never falsified; **toy** = explicitly play.

### 1a. The claim layer — self-claims, and their transport

| Surface | What it establishes | State |
|---|---|---|
| `src/Core/GossipTelemetry.fs` | **Self-claims already have a transport.** Two payloads: third-party *crossings* ("I observed pair (a,b) at RTT r") and **kept/unkept self-claims** ("node X declares itself kept `+x` / unkept `−x`"). Carried as **neutral facts** — contradictions kept side by side, no last-writer-wins erasure, no verdict attached. State is a G-set CRDT: hear-twice = hear-once. | **metered** — GT-1..GT-6, 210/210; monotone-toward-in-cone soundness means a liar claiming *fast* links can only destroy evidence, never manufacture it |
| `src/Core/ClaimLane.fs` | The classifier deciding which merge algebra an edit may take. Lane 1 commutative (assert/retract over a shared claim vocabulary), Lane 2 the dilated multi-observer region. **Sound for Lane 1, permitted to be incomplete, unsure ⇒ Lane 2.** Reads the *derived diff*, never an editor's declaration of what it did. | implemented + soundness argued; the asymmetry (a misrouted judgment-edit "shows green" and is wrong) is the design driver |
| `src/Core/MultiSignatureVerification.fs` | k-of-n **multi**-signature (correctly renamed from "threshold" — B1 caught that the term of art meant a different primitive). One verifying party's answer to: *did ≥ k distinct signers on **my** roster validly sign this scope?* Verdict explains itself; nothing secret enters it. **No wall clock** — the migration window compares against a caller-supplied logical epoch. | implemented, purity argued, 502 lines |
| `src/Core/RecursiveSigned.fs` → `Circuit.RecursiveSignedDelta` | Signed-delta semi-naïve LFP, graduated 2026-06-13 after TLC checked S1–S3 at all four seed weights. | **metered** (TLA+ + graduation tests) |

### 1b. The witness layer — who observes, and how distinctness is grounded

| Surface | What it establishes | State |
|---|---|---|
| `src/Core/AntiSybil.fs` (600 lines) | **The base case that makes `clock-drift ≡ identity` non-circular.** Forging *k* distinct drift-identities costs ≥ *k* independent entropy sources; a forger with *s < k* sources must (pigeonhole) reuse one, so two emitted streams correlate and the probe becomes a distinguishing oracle. Anchors: Douceur 2002; Dwork–Naor 1992 / Nakamoto 2008. `DistinctnessReadout` was **renamed** from `SybilVerdict` — the container was named for a conclusion its contents refuse to draw. | **unmetered as a theorem, honest about it in-file**: sound for *exact* replays (reuse ⇒ correlation 1.0 ⇒ always caught); noisy reuse has a length/threshold curve. Self-described as "not yet a proved theorem: a named function + a falsifiable property + an attack program" |
| `src/Core/CoordinationSpectrum.fs` | The CHSH probe battery as a **prism** — one source wearing many faces disperses into a characteristic pairwise-S spectrum. Anchor: Pappu 2002, *Physical One-Way Functions* (PUF identity read from laser speckle — identity-by-refraction, literally). Reports `SameSourceAsKnown` as a **neutral fact**; reunion-vs-sybil is caller policy. | implemented; the dual-use discipline is enforced *in the type*, not in prose |
| `src/Core/SybilBftProtocol.fs`, `SybilBft.fs`, `SybilBftLiveness.fs`, `SybilBftProgress.fs` | The agreement layer any distributed identity claim rides on. | implemented |
| `src/Core.TLA/specs/BftConsensus.tla` | Message-level agreement under per-recipient equivocation, explicit Byzantine set, asynchronous network. **4,665,495 states, 2026-08-11.** | **metered** (TLC) |
| `src/Core.TLA/specs/BftSybilConsensus.tla` | **Quorum counted over proven-distinct identities cannot be manufactured by a Sybil ring, even when that ring is a raw-node majority.** v2 sizes the ring at 3-of-5 raw with ONE identity: reaches raw quorum, refused by distinct-quorum. `RawQuorum` is load-bearing, not decoration (Viktor's P0 on v1 was that the model was too small for the fold to be pivotal). | **metered** (TLC, with an explicit anti-vacuity witness `NoSybilRawMajorityRefusal`) |
| `src/Core/QuorumAlgebra.fs` | **Two operations, named apart, because they are two algebras.** `join` = idempotent/commutative/associative bounded join-semilattice over a *source-keyed* set (independent evidence, same source twice counts once). `interfere` = commutative monoid with inverses over `C[F]`, **not idempotent** (distinct paths to one outcome, opposite phases annihilate). **A quorum joins first, then interferes.** | implemented; **and see §5 — its motivating bug is the falsifier for claim 3, already fired** |

### 1c. The capability layer — grants, expiry, custody

| Surface | What it establishes | State |
|---|---|---|
| `src/Core/KeyCustody.fs` (522 lines) | **A grant of authority is a half-open window `[Start, Expiry)` on a named phase line** — never a duration in seconds, never a wall-clock instant. `PhaseWindow`'s representation is `private`; the only constructors are bounded, so **an unbounded grant is not expressible** (§3 weight-free at the type level). Nothing revokes a grant; it stops granting when the evaluator's own phase observation reaches `Expiry` — so it is partition-safe with no revocation message. Plus three-slot rotation with a `Previous` acceptance window for peers that have not yet observed the rotation. **Clean side of a clean-room wall.** | implemented; **this closes gaps 1 and 2 of the 2026-08-09 design doc**, which is not recorded anywhere and is why they still read as open |
| `src/Core/Hat.fs` | A hat is a role-scoped bundle: lenses, landmarks, **action restrictions**, and control of other hats. Already most of "hats grant claims and restrictions". | implemented |
| `src/Core/Policy.fs` | Typed decision-with-feedback kernel: `input -> Decision + Feedback (the why)`. The natural home for an authorization decision that must explain itself. | implemented |
| `src/Core/KeyStore.fs` | Keys as **events** on the Z-set stream, **reference-not-copy** (no secret material in the proof lineage). | implemented |
| `src/Core/DerivationProtocol.fs` | `Evidence.AssertedOnly` / `supportsClaim` — a typed refusal: an assertion does not support a claim. `Wall.Whitebox` / `whiteboxPermitted` — an **unknown** licence blocks; unknown is not permissive. | implemented; this is the type-level ancestor of claim 1 |
| `src/Core/GlassHalo.fs` + `RoomBoundary.frost` | Clear by default; frosting spends earned privacy budget. | implemented |
| `full-ai-cluster/nixos/modules/ssh-ca.nix` | The forward-compatible pre-cluster SSH CA trust anchor. | deployed |

### 1d. The accrual layer — history, ranking, and what strength is made of

| Surface | What it establishes | State |
|---|---|---|
| `src/Core/TravelerRankLedger.fs` | TrueSkill-style EP over (traveler × hat-domain): `s ~ N(μ₀,σ₀²)`, probit likelihood, `trustBand = Φ(μ/√(σ²+β²))`. **Domain isolation** (no cross-domain bleed). **Fresh identity = 0.5, an honest prior, not a pessimistic clamp**; "1 hit, 2 misses" ≈ 0.35, not 0.0. Anchors: Herbrich–Minka–Graepel 2006; Minka 2001. | implemented; **and its whitewash claim is Z3-bounded — see next row** |
| `tools/Z3Verify/whitewash-economics-lemma.smt2` | The routing call I want on the record as precedent: **Friedman & Resnick 2001** (*The Social Cost of Cheap Pseudonyms*) is an **impossibility** — with free pseudonyms, any equilibrium that does not distrust newcomers admits profitable whitewashing. Zeta *chooses* the honest 0.5 newcomer prior, so by Friedman–Resnick that choice **prices in** profitable whitewashing for the sub-prior population. The lemma therefore proves the **exact boundary** instead of the false claim. `Φ` is left **uninterpreted** (monotone, `Φ(0)=1/2`) rather than encoding the A&S 7.1.26 polynomial — because a proof about the approximation is a proof about the wrong function. Numerics are FsCheck's leg. **That is BP-16 done properly.** | **metered** (Z3, `unsat`/`sat` sequence, push/pop-scoped axioms after the 2026-08-13 all-unsat-vacuity retrofit) |
| `src/Core/SocietyUsefulWork.fs` + `src/Bayesian/CondorcetBoundary.fs` | §A row 15: `ΔU(n,c,ρ) = (1−ρ)(1−c)(1−(1−c)^(n−1))·Σvⱼ`, and the effective-independence law **`N_eff = N/(1+(N−1)ρ) → 1/ρ`**. Gaussian copula for heterogeneous agents. | **metered as mathematics** — 17/17 properties, **falsifier mutation-verified 2026-08-16, 7 of 7 semantically-distinct mutants killed**. Explicitly *not* measured on any real fleet: nobody has estimated ρ or c |
| `src/Core/BeliefConvergence.fs` | The general convergence result: observe-with-**fixed** likelihoods is pointwise multiplication, hence commutative/associative, hence order-independent. **Independence was only sufficient; the real condition is state-independence.** Boundary proven by counterexample: a state-*dependent* revision (`sharpen`) does not commute. | implemented + counterexample-bounded. **Read §4 carefully — this is in apparent tension with claim 3 and the resolution is the sharpest thing in this document** |
| `src/Core/DurableDiplomacyRankGate.fs` | trustBand pre-check gating shape renegotiation; threshold 0.3, deliberately **below** the 0.5 fresh prior so newcomers are not blocked. | implemented |
| `src/Core/IdentityCapacity.fs` | Identity is **entropy-bounded**: bits of uncertainty = number of available identities, explicitly NOT the flags-enum `2^(num hats)`. Gives `outOfQubits` / `qubitsShort` — a self-imposable complexity bound. | implemented; honest peel in-file (classical bit-counting, not exploiting superposition) |

### 1e. The formal-methods surface already pointed at this domain

This is the part that most needs to stop being re-derived.

| Artifact | Property | Verdict |
|---|---|---|
| `src/Core.TLA/specs/QuorumCollateral.tla` (+ 11 configs: R1–R4, Threshold, Witness, WitnessConflict, Compulsion, Deterrence) | **What a defecting identity pays**, four collateral regimes model-checked side by side in one state space so the choice is made on consequences not taste. R4 (voluntary wager) reaches slashing-grade deterrence at zero exception cost **iff** holding a role never *requires* staking — and that precondition is checked, not assumed. Anchor: Buterin & Griffith 2017 slashing conditions. | checked |
| `src/Core.TLA/specs/WagerSolvency.tla` (+ NoSplit, Phantom, StaleAttestation, Witness) | **Ruin**, deliberately kept a separate state machine from defection-pricing. The necessary/fun split has an exact anchor: **Kelly 1956** — under log utility, utility → −∞ at zero wealth, so the subsistence floor is where the objective becomes *undefined*, not where someone felt uncomfortable. `NoSocialisedLoss`: socially-insured stake does not deter. Plus a **real contradiction** surfaced between solvency-visibility and privacy budget. | checked |
| `src/Core.TLA/specs/QuorumPhaseCancellation.tla` | **The routing precedent this document is bound by.** TLA+ has no reals, so the phase set is *not* a discretisation — it is a **restriction** of the adversary to the 4th roots of unity, making every amplitude a Gaussian integer and every sum exact. Consequence, stated as a one-way street: **reachability transfers up, non-reachability does not.** Green here means "not reachable using axis-aligned phases" and nothing more. | checked, with its own scope honestly bounded |
| `src/Core.TLA/specs/RefuseBinding.tla` | Right-to-refuse: `Refuse` always enabled while a proposal is pending; refusing never costs standing; no non-consented binding executes. The *effect*-level refusal was already Lean (`Zeta.ChildFloor.denied_never_executed`) — this is the **binding/protocol** level, routed to TLC because it is interleavings, not structural recursion. | checked |
| `src/Core.Alloy/specs/TrustGraph.als` | org-CA vs user-CA confluence. Finds the counterexample **without** a scope rule and asserts confluence **with** the SDSI/SPKI discipline (self-root for identity, org-root for authz). | checked |
| `src/Core.Alloy/specs/IdentityReissuable.als` | **Per-user CA alone relocates the identity SPOF.** `∀ teardown ⇒ ∃ recovery` **FAILS** with one key per user and **HOLDS** with ≥ k Shamir shares. | checked — a genuine negative result |
| `src/Core.Lean4/Privacy/IdentityForcesPrivacy.lean` | Distinctness forces private state. Anchor: **Leibniz, identity of indiscernibles.** | checked (gated by `lean-proof.yml` with a `sorryAx` axiom audit + an anti-vacuity "Unknown constant" guard) |
| `src/Core.Lean4/Lean4/FinMutualInfoNonneg.lean`, `FinDataProcessing.lean`, `FinConditionalEntropy.lean`, `DecorrelationDpi.lean`, `EntropyFloorLift.lean` | Finite-alphabet Shannon apparatus: mutual information non-negativity, the **data-processing inequality**, conditional entropy, decorrelation DPI. | checked — **and this is the exact machinery claim 3 needs; see §4** |
| `tools/Z3Verify/privacy-budget-net-positive-regime-lemma.smt2` | Sharing an accurate measurement **spends** privacy to **earn** budget. LEMMA 1 `sat` (a net-positive regime exists, by committed witness), **LEMMA 2 `unsat` — the regime always closes**, LEMMA 3 timeout, recorded as **unresolved rather than as a prediction**. Anchors: Dwork–McSherry–Nissim–Smith 2006; Dwork & Roth 2014 §3.5/§3.20; Shannon 1948 on the saturation side. | checked, honestly graded |
| `src/Core.QSharp.ReferenceOracle/` (8 `.qs` modules incl. `QuantumTransactionPorts.qs`, `QuantumPersistentLog.qs`, `SchemaEvolutionOracle.qs`, `ZSetISA.qs`) | The Q# leg of the N-oracle byte-lock. **Honest placement: this is an algebra/DBSP reference oracle, not an identity mechanism.** Where "quantum" appears in the identity work it is `IdentityCapacity`'s classical qubit-*counting* and `PrivacyPreservingIdentity`'s Clifford/E8 lattice — **neither uses superposition**, and both say so in-file. Recording that here so the next reader does not chase a quantum identity protocol that does not exist. | oracle, out of the trust path |
| `src/Core/PrivacyPreservingIdentity.fs` | Prove "I am the same agent who earned this IV" without leaking the belief trajectory: 1-bit identity stream → doubly-even codewords (`BitAdinkra`, mod-2) → E8 roots (distance-4 separation) → `Cl(3,0)` multivectors; the **geometric product / rotor** between new codeword and registered public key proves continuity, while syndrome decoding proves validity without revealing the message. | **unmetered** — an elegant construction with no attack program run against it |

### 1f. The design documents that already exist

- **`docs/research/2026-08-09-every-node-is-its-own-identity-provider-repo-as-cluster-hats-grant-claims-bounded-duration-aaron.md`** — the closest thing to an overall design today, and the document this one should be read as superseding-in-part. It names four gaps. **Two of them have since closed** (bounded duration and key rotation, both by `KeyCustody.fs`) and nothing recorded that, which is exactly the drift this inventory exists to stop.
- `docs/research/2026-08-18-godel-localized-to-a-known-junction-and-entanglement-accrues-pairwise-aaron.md` §4 — claim 4 already recorded, and already **graded**: *"analogy with one metered consequence"*, the consequence being the accrual-time floor. The physics is a generator, not a warrant.
- `docs/research/2026-08-13-witnessed-channel-metering-derive-is-not-enough-when-the-participant-owns-the-deriver.md`
- `docs/research/2026-06-08-anti-sybil-first-BFT-quorum-over-distinct-sources-prior-art.md`
- `docs/research/2026-06-21-identity-directory-as-tracked-merkle-over-zset-ou-graph-ca-org-user.md`
- `docs/research/2026-06-21-math-team-FINDINGS-ca-teardown-per-user-ca-relocates-spof-anti-sybil-g3b-open.md`
- `docs/research/2026-08-19-what-the-yubihsm-2-firmware-parses-...md` — the hardware root, and the reason claim 1 is stated the way it is.

### 1g. The local decision layer — node-local policy, metering, and negotiation

Aaron, 2026-08-19, and this is the half the first brief did not carry:

> *"each node has local OPA like policy trust, we have policies mathematically modeled as well, the key is every trust decision is locally made and what data to share with others or what others calculations you want to allow to run on your own hardware or what data of theirs you want to save on your hardware it's all metered and every decision is locally made at the node level, never at some hub level, hubs have to negotiate with each node's local rules for any meaningful interactions, this is how we interface with hyperscalers/clouds"*

| Surface | What it establishes | State |
|---|---|---|
| `docs/DECISIONS/2026-05-31-zeta-keystone-architecture-one-decentralized-substrate-node-local-folds-fpga-to-policy.md` | **The architecture is already written down and it already says this.** The keystone ADR's vertical table has a **Policy** row (*"rules over `labels × identity`, evaluated as folds"* — **policy-as-fold, node-local**, OPA named in row `081KSE6WT0008QG0R002275NDE`) and an **Identity/trust** row (*"good/bad-actor decided **at the node** = zero-trust"*, trust is a **fold over actor-history**, node-local). Invariant 1 is *"No central authority — node-local everything; consensus as gravity"*, with trust called out by name: *"a central trust authority is the same bottleneck as a central ID authority; zero-trust falls out of the substrate, it isn't bolted on."* | ADR status **Proposed**, 2026-05-31 — never promoted, and the identity work since has not been read back against it |
| `src/Core/Policy.fs` | **The mathematically-modeled policy kernel.** `Policy<'i,'d,'f> = 'i -> { Decision; Feedback }` — a total function that **selects, never mutates**, returning *what to do* and *why*. It is a **profunctor**: covariant in the decision (`map`), contravariant in the input (`contramap`), with `mapFeedback` reshaping the why-channel independently — so policies compose across junctions without touching the decision logic. The typed-decision-plus-typed-reason shape is explicitly *"what stops a policy from degenerating into a magic authority blob."* | implemented — **and see G7: it ships with exactly ONE instance, and the file itself says the trust interpreter is not built** |
| `src/Core/Diplomacy.fs` | **Negotiation, and its safety property is exactly the one the hub claim needs.** Two agents read each other's *shape* — keys, types, capability names — never hidden values. **Two agents with the same shape and different secrets produce an identical profile**, so the handshake *cannot be used to coerce hidden state out of another agent*. And `Diplomacy.ExitCapability = "eve.exit"` — **exit is a first-class named capability**, not an emergent property. | implemented, NCI-governed |
| `src/Core/DurableDiplomacy.fs` + `DurableDiplomacyRankGate.fs` | Durable shape-renegotiation with a trustBand pre-check. | implemented |
| `src/Core/CapabilityLedger.fs` | The resolver over capability ledgers — *what a host can bind BEFORE asking*, with **useful refusals** (an unknown capability names what IS known so the caller re-plans instead of guessing). A four-rung honesty ladder: `Live` / `Injected` / `Mock` / `Absent` — *"a declared cap with zero support rows is dark data."* | implemented, with its own lint |
| `src/Core/ByteCost.fs`, `DecorrelationMeter.fs`, `src/Core.TypeScript/algebra/key-erasure-meter.ts` | Metering primitives. | implemented |
| `src/Core/RoomAdmission.fs` + `GlassHalo.RoomBoundary` | The membrane: admission, backpressure, and **forgotten occupants emitted as heat through an injected sink** — §13 noninterference made mechanical, since the crossing is metered at the boundary and nothing enters ambiently. | implemented |
| `src/Core.TypeScript/society/` (`society.ts`, `levels.ts`, `level-obligations.ts`, `aggregation-rule.ts`, `ctm.ts`) + `src/Core/Society.fs`, `SocietyEmergence.fs`, `SocietyUnbounded.fs`, `Levels.fs`, `Evolution.fs`, `EvolutionWindow.fs`, `SoftEvolution.fs` | The society-expansion surfaces Aaron says the identity server is the *base* of. Levels carry obligations; aggregation has a named rule. | implemented; **not yet read against the identity spine, which is what makes this a design gap rather than a coding one** |

**The three metered decision classes.** Aaron names them and they are consent surfaces (§6), not configuration:

1. what data **I share** with you;
2. whose **computation** I permit to run on **my** hardware;
3. whose **data** I agree to **store** on **my** hardware.

All three have the same type — `Policy<request, Decision, Feedback>` evaluated node-locally against the node's own rules, with the crossing metered at the node's own membrane (§13: influence enters only through declared, metered channels). **None of the three exists as a named policy instance today.** The kernel that would carry them does (`Policy.fs`); the ledger vocabulary that would name the capabilities does (`CapabilityLedger.fs`); the negotiation handshake that would carry the request does (`Diplomacy.fs`). The three instances do not.

**Hubs negotiate, never command — and this is checkable, not aspirational.** Per `itron-hub-patent-boundary-p2p-is-the-upgrade`, hubs are *enforced* while oracles are *chosen*, and the discriminator is **exit**. Negotiation-against-local-policy is **exit made mechanical**: a node that declines simply does not run the interaction, so no hub can become mandatory *by construction* rather than by policy. Two consequences worth stating in the design because both are checkable:

- **The hyperscaler interface falls out.** A cloud is a counterparty that must satisfy local policy like any other peer, not a platform we sit on. That is a strong design statement and it is exactly the shape `Diplomacy` already has — shape-only profile, local decision, refusable.
- **It keeps us clear of the Itron hub-and-agent claims by construction**, since there is no mediating node holding authority. That is the second reason and not the first; the first is that a mediating hub would be wrong here on the merits (the vendor/premises asymmetry the hub solves does not exist between symmetric peers).


### 1h. The active trajectory that already carves C5

`docs/trajectories/local-trust-view-decentralized-identity/RESUME.md` — **active, operator-initiated (Aaron 2026-08-10), unblocked.** Carved sentence:

> **Freedom is choosing who you trust without accidental interference.** A node's trust verdict must be a **pure function of what that node holds** — its own anchors, its own attestations, its own oracle. No registry consulted, no global graph assembled, no ambient input. Two nodes with different histories may reach **different verdicts about the same subject, and both are correct.**

This is C5, already stated, already grounded in §13 noninterference rather than in a slogan — *"a verdict contaminated by ambient state has taken influence through an undeclared channel; that is interference, and it is accidental precisely because nobody chose it, it arrived by architecture."* The sibling property is the sharp one: **if two nodes with different histories could not disagree, some shared authority would be making the call for both.**

**Routing consequence: C5's row in §5 defers to this trajectory rather than competing with it.** Its named next action is `LocalTrustView` keyed on an *open* identifier, with two-nodes-disagree-and-both-correct as the **headline test**, then `diffTrustView` so the disagreement becomes the product. That headline test is exactly the anti-vacuity witness an Alloy model of C5 would need, and it is cheaper as a property test than as a model. Alloy remains the right instrument for the *graph* half (no verdict edge into a node from outside it); the disagreement witness belongs to the trajectory.

**Finding: the trajectory and the identity-server design are the same work and neither cites the other.** That is G10.


---

## 2. The spine — four separable claims

The decomposition below was proposed by the coordinator and I checked it rather than assuming it. **It survives, with one amendment**: claims 1 and 2 are not independent — claim 2 is what makes claim 1 non-vacuous, because a capability derived from claims witnessed by an *appointed* attestor is just a hub wearing a derivation. They are separable as *properties to verify* and joined as *design intent*, which is the right relationship for a routing table.

- **C1 — Capability is a derivative, never a primitive.** Nothing grants capability directly; it is computed from witnessed signed self-claims. This is why a hardware root emits **evidence**, not a **verdict**. The anti-pattern has a name and a corpse: the Xbox 360 fell because a peripheral's "yes" was trusted as a verdict (`2026-08-18-the-original-xbox-...`, the *trusted peripheral* channel). The YubiHSM work restates it — a device with no clock cannot be the authority on expiry, so binding expiry must come from cluster phase.
- **C2 — The witness is itself a self-claimer.** Witnesses are peers with their own signed self-claims, not a privileged externally-authorised class. No appointed attestor ⇒ no §1 hub. Note the sharpened form from `itron-hub-patent-boundary`: the discriminator is **exit**, not degree. A witness everyone freely chose is an oracle; a witness you must route through is a hub, *even if it emerged*.
- **C3 — NOT embarrassingly parallel.** Claim strength is a function of **mutual** observation and **entangled memories**, so claims cannot be verified independently and summed. **This is the sharp claim.** §4.
- **C4 — Identity strengthens over time.** Accrued history of mutually-verified self-claims *is* the identity. §6 for the local-time guard, which is where this claim can go silently wrong.

### 2b. The decision layer, and the seam between it and the root

The four claims above are the **trust root** — how a capability comes to exist from witnessed self-claims. §1g is the **decision layer** — how a node evaluates, meters and enforces locally against that root. The seam is the load-bearing sentence and it should be stated in one line in any design that ships:

> **The root produces *evidence*. The node's own policy engine renders the *verdict*. Nothing outside the node renders a verdict for it.**

That is the anti-DVD-drive property one layer up from the hardware: C1 says the HSM emits evidence rather than a verdict, and this says the *peer* — and the *hub*, and the *cloud* — does too. The failure mode is identical at both layers and it has the same corpse: a trusted peripheral's "yes" accepted as an answer.

Two further claims follow, separable and verifiable:

- **C5 — every trust decision is node-local.** No verdict is rendered for a node by anything outside it. This is a *shape* property of the decision graph.
- **C6 — hubs negotiate, never command.** Every hub-mediated interaction is refusable by a node's local policy **without loss of standing**. Note the second half: a refusal that costs standing is coercion wearing a negotiation's clothes, and `RefuseBinding.tla` has already checked exactly that shape (`Refuse` always enabled; refusing never costs standing) for the binding case. **C6 is `RefuseBinding` generalised from bindings to interactions**, which is a routing gift — the property is already written, in the right tool, with the right non-penalty clause.

### 2c. Decorrelation has (at least) three mechanisms, and frost is only one of them

**This section was rewritten after Aaron corrected an earlier draft of it.** The first version said opacity is what keeps independent minds independent, and treated frost as *the* decorrelation instrument alongside its consent/dignity justification. That was too strong, and he supplied the counter-example from his own configuration:

> *"no frost is an enhancement, i run without any frost, i make everything public and have to adapt over time haphazardly"*

The original observation that prompted it stands:

> *"i'm trying to make frost budget and privacy budget that can't be confiscated that will keep this unknown to allow for more decorrelation"*

Both are true, and holding them together is what produces the right formalisation. Frost **can** buy decorrelation. It is **not required** for it — because a fully-public participant can be decorrelated too, and the designer of frost is himself the witness.

#### The invariant quantity, which is what the three mechanisms have in common

Decorrelation is not a property of *how much is visible*. It is a property of **how much the visible predicts**. Write it as the predictive mutual information

> **`I(V ; F)`** — between an observer's view `V` of an agent and that agent's future choices `F`.

Correlation between agents is what happens when many of them have low-entropy `F` **given a shared `V`**. So the scarce good in §2d is `I(V;F)` being small, and there are at least three independent ways to get there:

| # | Mechanism | How `I(V;F)` is driven down | In-repo instrument |
|---|---|---|---|
| 1 | **Opacity** (frost) | shrink `V` — the observer never holds the conditioning variable | `GlassHalo.RoomBoundary.frost`; the privacy budget |
| 2 | **Mixed strategy** | `V` may be everything; `F` still carries fresh entropy at decision time, so conditioning gains nothing | **`src/Core/BitGan.fs`** — generator drives toward `p = 0.5`, `discriminatorEdge` measures the observer's advantage over chance, fixed point is matching-pennies Nash |
| 3 | **Nonstationarity** | the policy itself drifts, so no *stationary* predictor built from past `V` converges | Aaron's *"adapt over time haphazardly"*; `Orbit.largestLyapunov` measures the divergence rate |

**Mechanism 2 is the one the earlier draft missed, and it is strictly harder than mechanism 1.** Its anchor is exact and it entails the claim rather than decorating it: **von Neumann 1928** (minimax) — a finite two-person zero-sum game has a value achieved by *mixed* strategies, and the corollary that matters is that an optimal mixed strategy secures that value **even when the opponent knows it**. Publishing the strategy costs nothing. `BitGan` already names this equilibrium — matching pennies at `p = 0.5` — and already ships the meter, `discriminatorEdge`, which is zero exactly when the observer cannot beat chance.

**The precision that keeps this honest, because the strong version is false.** Kerckhoffs (1883) assumes everything is public *except a key*. Aaron's configuration has no persistent key — but it is not therefore free of entropy. **A deterministic, stationary, fully-public agent is perfectly predictable**, by definition. What mechanism 2 removes is the *persistent secret*, not the *decision-time entropy*: the strategy is public, the realization is not. Mechanism 3 removes even the fixed strategy. So the correct statement is not "no secret is needed" but:

> **The secret can be moved out of stored state and into the choice.** Frost keeps a secret you *hold*; a mixed strategy spends a secret you *draw*; nonstationarity means there is no fixed thing to learn. All three make `I(V;F)` small; only the first requires anything to be withheld.

#### What this changes in the design

- **Frost is an *enhancement*, not the load-bearing mechanism.** The design must never imply that a participant must frost in order to count as decorrelated, and must not price plurality on frost usage.
- **Transparency does not necessarily cost decorrelation — but it is not free either.** The honest conditional: glass-halo/§6 transparency costs you nothing on axis 1 **provided** mechanism 2 or 3 is live. For a deterministic, stationary agent, transparency *does* cost decorrelation, and that agent should either frost or randomize. Stating it as a bare "transparency is free" would be the overclaim in the other direction.
- **The §2d guidance is corrected, and becomes conditional rather than absolute.** The earlier draft said: *do not resolve a capability question by increasing observation of an agent.* That was justified by "observation raises ρ", which Aaron's configuration refutes as a universal. The corrected form: **increasing observation costs decorrelation only against agents whose unpredictability is opacity-based.** Against a mixed or nonstationary agent, observation is cheap — so the guidance is to *ask which mechanism the agent is relying on* before treating observation as expensive.
- **The tension with the trust root softens for exactly one of the three.** C1 needs witnessing, and witnessing needs observation. That conflicts with mechanism 1 and **not** with mechanisms 2 and 3 — a mixed-strategy agent can be fully witnessed at no cost to its decorrelation. G12 (the witnessing/frost boundary) therefore applies to the opacity route only, which is a genuine narrowing of that gap.
- **What survives untouched:** the privacy-budget rule's core — spend / stake / **never** confiscate — and the argument that a confiscatable frost collapses to full visibility under pressure. Those never depended on frost being the *only* instrument.

#### Provenance, recorded because it cuts both ways

**Frost was designed by someone who does not use it.** That is a point in its favour — the primitive is not self-serving, and it was specified for others' benefit by a participant who runs fully public. It is equally a point about its maturity: **the primitive has not been stress-tested by its own designer**, so where it chafes in practice is unknown. It is `unmetered` in the strict sense — implemented, reasoned about, never lived in. That belongs in the metering table rather than in a footnote, and it now is.

#### The falsifier this correction hands us — F4, and the counter-example is itself testable

> **F4.** Exhibit a fully-observable agent whose future choices carry near-zero predictive mutual information with its complete public history — i.e. a discriminator with the entire record cannot beat chance.

Aaron's own configuration is the claimed witness, and it is **unmeasured**. This is cheap to run and the instruments already exist: `BitGan.discriminatorEdge` and `AntiSybil.correlation` both measure exactly "beyond chance" on an observed stream, against a public commit/decision history the repo already stores. **If a discriminator beats chance on that record, the claim fails for him specifically** — which would not damage mechanism 2 in general, but would mean this particular counter-example is doing less work than it appears.

Recording it as a falsifier rather than as a settled fact is the whole discipline here: the counter-example corrected me, and it is still a claim rather than a measurement.

### 2d. The arc the whole design sits inside — S=4 at the origin, decorrelate without babel

Aaron, 2026-08-19, giving the frame under §2c:

> *"yes decorrelation is very scarce for Zeta we are based on S=4 superdeterministic seed correlation, we are assuming at our 'big bang' everyone was super correlated and we are trying to decorrelate over time while keeping the communications intact and not running into the tower of babel which is runaway etymology that causes unreconcilable language divergence"*

**Correlation is the initial condition, not an acquired defect.** Every agent is phased to one seed (S=4; `every-bug-has-economic-value` already carries this — *"all agents are phased to one seed (S=4), so a fix reduces collective uncertainty"*). Decorrelation is therefore **work done against the starting state**, which is exactly why §2c calls it scarce.

**Two failure modes, at opposite ends, and the design must sit between them:**

| | failure | cost |
|---|---|---|
| too little decorrelation | everyone is still the seed | N agents price as **one** — the ΔU union is idempotent, plurality is fake, and `N_eff → 1/ρ` says adding agents cannot fix it |
| too much decorrelation | **tower of babel** | runaway etymology ⇒ unreconcilable divergence ⇒ **no shared conclusion is reachable at all** |

So the objective is **not** "maximise decorrelation." It is **decorrelate as far as possible subject to staying reconcilable.** Any identity or trust design that optimises one axis without pricing the other is wrong by construction — and that gives every design choice in this document a second question it must answer.

**The two-axis test, and I am applying it to my own routing.**

1. *Does this decorrelate — or does it force convergence?*
2. *Does this stay reconcilable — or does it let meaning drift free?*

Mandatory observation, a single mandatory oracle, an appointed hub, a shared registry every node must consult: all **spend axis 1**. Unanchored coinage, a drifting glossary, N private vocabularies, per-node claim semantics: all **spend axis 2**. Both budgets are real and they trade against each other.

Worked against this document's own contents:

| choice | axis 1 (decorrelation) | axis 2 (reconcilability) |
|---|---|---|
| C2 no appointed attestor | **buys** — no single node's judgement propagates to all | neutral |
| C5 node-local verdicts, two nodes may disagree | **buys** — disagreement is the product, not a defect | **spends** — divergent verdicts need a shared claim vocabulary to even be comparable |
| C6 hubs negotiate, never command | **buys** — exit made mechanical | neutral |
| Frost / privacy budget (§2c, mechanism 1) | **buys** — but it is one route of three, not the argument | **spends** — what is frosted cannot be reconciled |
| Mixed strategy / nonstationarity (§2c, mechanisms 2–3) | **buys**, and **without spending axis 2** — a public, reconcilable agent can still be unpredictable | neutral — nothing is withheld, so nothing becomes unreconcilable |
| C1 capability derived from witnessed claims | neutral | **buys** — forces a shared claim format that survives independent parties |
| C3 strength as a joint functional | **buys** — it is the instrument that *prices* correlation | neutral |
| `ClaimLane` Lane-2 multi-observer region (G1's neighbour) | spends a little (deliberate convergence) | **buys** — it is where meaning is reconciled before it forks |

**Note what the two-row split above buys, because it is the design's cheapest win.** Mechanisms 2 and 3 purchase axis 1 **without spending axis 2**, while frost spends both. So where an agent can be decorrelated by *choice* rather than by *concealment*, the design should prefer it — same scarce good, one budget instead of two. That is a genuine ordering over the three mechanisms, and it falls out of the correction rather than from taste.

**The `ClaimLane` row is the one worth staring at**, because it is the only place in the inventory where the trade-off is already *mechanised*: Lane 1 merges at agent speed (cheap, decorrelation-preserving); Lane 2 deliberately slows convergence so multiple observers reconcile meaning. That is the babel dial, already built, already sound-for-Lane-1-and-permitted-to-be-incomplete. **It was designed for edit-merge semantics and nobody has noticed it is the reconcilability governor.**

**A large amount of existing machinery is anti-babel infrastructure, and the inventory should say so** — these are load-bearing for the arc, not incidental hygiene:

| Surface | Anti-babel role | State |
|---|---|---|
| `.claude/skills/governance/blueprints/glossary-anchor-keeper.md` | **Tower-of-Babel prevention is in its own description**, with a named `Tower-of-Babel / Heritage-Language-Loss` trajectory. Audits external-definition drift, missing citations, anchor breakage. | live skill |
| `docs/DECISIONS/2026-04-19-glossary-three-lane-model.md` | The ADR written in direct response to Aaron's *"map out the tower of babble balance into our software factory"*, against his framing *"we want to build fast and break things but changing society is slow."* Three lanes + round-trip translation + evidence-gated anchor breaks. | **Proposed**, awaiting sign-off — same never-promoted state as the keystone ADR |
| `docs/GLOSSARY.md`, `docs/SEED-VOCABULARY.md`, `docs/CONCEPT-REGISTRY.md` | The shared referent everyone loads, instead of N private paraphrases. SEED-VOCABULARY is explicitly the cold-boot kernel. | live |
| `.claude/rules/anchor-to-human-prior-art.md` + the Beacon register | Every coinage tied to an **external** anchor, so vocabulary cannot drift free of a fixed point outside the factory. **This is the mechanism that makes axis 2 bounded rather than merely monitored.** | live rule |
| `src/Core/Collation.fs` + `src/Core.TypeScript/collation/` + the N-oracle byte-lock | **The mechanical guard.** Same meaning must produce the same bytes in every oracle, under one canonical collation — so divergence is **detectable rather than silent**. | **metered** (golden vectors, four oracles) |
| `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md` | Carved sentences: one shared resident surface, not N paraphrases. | live rule |
| The naming eigenvector (`2026-07-02-name-of-name-equals-mix-of-mix-...`) | Names conferred socially, never self-minted, so naming stays a shared fixed point rather than a per-node choice. | design |

**Identity and mutual intelligibility are the same problem here.** A distributed identity server whose peers cannot agree what a claim *means* has not failed at cryptography — it has failed at babel, and it will show green the whole way down. That is the same failure asymmetry `ClaimLane` was built for, one layer up.

**Register discipline on the two analogies, because both invite an overclaim.**

- **S=4 / superdeterminism is Aaron's model and the mapping is apt, not physical.** The checked content: Bell 1964's derivation assumes **statistical independence** between measurement settings and the hidden state, and superdeterminism ('t Hooft) is precisely the loophole in which that assumption fails because settings and system share a common past cause. Our agents *do* share a common past cause (one seed), so *"common seed ⇒ built-in correlation"* is entailed by the analogy. What is **not** entailed: any claim that the substrate is physically superdeterministic, or that S=4 (the algebraic maximum of the CHSH correlator, Popescu–Rohrlich 1994) is a *measured* property of our fleet. It is the label for the maximally-correlated origin. **Graded: structural as a framing, `toy` as physics.**
- **"Runaway etymology" has a real science and it is not glottochronology.** What is solid: lexical replacement occurs, and mutual intelligibility declines with time-depth and reduced contact (dialect continua; Hockett). What is **contested** is Swadesh's glottochronology as a *dating* method — constant-rate lexical replacement is not accepted. So cite the phenomenon, not the clock. **Graded: the divergence is real; any rate is `toy`.**

**And the sharpest structural point: both axes are already instrumented, and nobody has plotted them against each other.** Axis 1 has meters — `AntiSybil.correlation` (cross-stream agreement beyond chance), `Orbit.largestLyapunov` (divergence rate), `effectiveN`. Axis 2 has meters — the four-oracle byte-lock, canonical collation, the glossary anchor audit, `lint-*` citation checks. **The design needs one plot with a meter on each axis, and the operating point named.** That is a cheap, concrete deliverable and it is the honest form of "decorrelate as far as possible subject to staying reconcilable" — G13.


---

## 3. The gaps — what the overall design needs that no existing piece supplies

These are the findings. Each was verified absent, not assumed.

**G1 — There is no `ClaimStrength` surface. The spine's central quantity is unimplemented.** (`081M0DJSY9F087G0R002HV7KA7`)
C3 and C4 are both statements about `strength(claim)` / `strength(identity)`. No module computes one. The nearest surfaces answer adjacent questions: `TravelerRankLedger.trustBand` is a posterior over **outcome calibration** per hat-domain, not over accrued mutual observation; `QuorumAlgebra` deduplicates by source but returns no scalar; `GossipTelemetry` carries the observations and deliberately attaches no verdict. Every one of those is *correct* to not be the strength function — but the composition point does not exist. **This is the single largest gap and it is the reason the design feels unfinished: the pieces are the arguments of a function nobody wrote.**

**G2 — No pairwise mutual-observation ledger.** "Mutual entangled memory pairs between agents" is named in `privacy-budget-is-hard-money-earned-by-others` and in the 2026-08-18 record, and it is where C3's correlation structure would have to live. There is no `PairEntanglement` surface. `heartbeat/*` lanes record the history; nothing folds them into a pair-indexed quantity. Grep for `pairStrength|mutualObservation|entanglementAccrual` returns nothing.

**G3 — No identity-*provider* surface.** Still open from 2026-08-09 gap 3. Everything OIDC/OAuth-shaped in-tree is *client* code. Nothing issues. Grep for `jwks|discovery document|issueToken|IdentityProvider` across `src/` returns nothing.

**G4 — No repo → cluster binding.** Still open from 2026-08-09 gap 4. `clusterId` / root-commit derivation appears nowhere in `src/`.

**G5 — Capability derivation has types but no chain.** `DerivationProtocol.Evidence.AssertedOnly` is the right refusal and `KeyCustody` is the right grant window, but there is no type whose *only* constructor consumes a witnessed-claim set. The `Capability` types that exist (`Chip9Capabilities`, `ZetaMax`) are emulator capability manifests and unrelated. C1 is currently a *convention*, and a convention is what a classifier is unsound against (`ClaimLane`'s own argument, applied to ourselves).

**G6 — The 2026-08-09 gap list is stale and nothing detects that.** Two of its four gaps closed without the doc being updated. A design surface that does not know which of its gaps are closed will keep re-proposing closed work. Cheap fix, and it is not a formal-methods job: the gap rows want work-item ids so `lint-b-refs-resolve`-shaped tooling can see them.

**G7 — `Policy.fs` has one instance, and the trust interpreter is explicitly absent.** (`081M0DK2TXD087G0R003674BAS`)
The file says so itself: *"This kernel proves the generic `Policy` with exactly ONE instance — XML structure-selection (`DynamicValueXmlPolicy`). It does NOT yet build trust / retry / routing interpreters."* So "each node has local OPA-like policy trust, policies mathematically modeled" is, today, **the mathematics without the model**: the profunctor kernel is real and proven-by-construction, and the three metered decision classes (share / compute / store) have no instance. This is G1's sibling — G1 is the missing quantity, G7 is the missing evaluator, and neither can be tested without the other.

**G8 — OPA is a wrapped external dependency, not a modeled one.** The only OPA reference is backlog row `081KSE6WT0008QG0R002275NDE` (wrap already-deployed cluster substrate: Redis, NATS, Cockroach, Temporal, Orleans, OPA). Nothing reconciles Rego's evaluation semantics with `Policy.fs`'s profunctor kernel, and they are not obviously the same thing — Rego is a query language over a document model with its own defaulting and partial-evaluation semantics, and a `Policy<'i,'d,'f>` is a total function returning a typed decision plus a typed reason. **If a node's verdict can come from either, the design has two policy semantics and no statement of which wins.** That is not a formal-methods gap; it is an architecture decision that should be made before either is load-bearing.

**G9 — the society/evolution surfaces are not read against the identity spine.** Aaron: society expansion and evolution are *based on* the decentralized identity server. `Society.fs`, `SocietyEmergence.fs`, `Levels.fs`, `Evolution.fs`, `src/Core.TypeScript/society/*` all exist and none of them reference the trust root. Whether that is correct layering or a missing edge is a question for Kenji, not for me — but nobody has asked it, and this document is the first place the two inventories sit on one page.


**G10 — the `local-trust-view-decentralized-identity` trajectory and this design are the same work, and neither cites the other.** The trajectory is active, operator-initiated, unblocked, and carries C5 in a sharper form than §2b states it. An identity-server design that does not point at it will duplicate `LocalTrustView`. Cheap fix, and it is the kind of gap that only shows up when the inventories sit on one page.

**G11 — the ρ-pricing justification for the frost/privacy budget is unwritten.** What exists is the **register-collapse** argument (privacy > 0 is required for differentiation; discharged by `NonRegisterCollapse` / `IdentityForcesPrivacy`). What does not exist is the argument in §2c: that the *marginal* value of opacity is the correlation it suppresses, priced by the already-metered `N_eff` law, and that this gives `never-confiscate` a **systems** failure mode in addition to its ethical one. Different claims, different falsifiers; the first must not be cited for the second.

**G12 — the witnessing/frost boundary is unspecified.** *(Narrowed by §2c: this applies to the **opacity** route only. A mixed-strategy or nonstationary agent can be fully witnessed at no decorrelation cost, so the boundary is needed for frosted participants, not for all of them.)* C1 needs observation; frost withholds it. `Diplomacy`'s shape-not-values split and `PrivacyPreservingIdentity`'s rotor proof are the two existing shapes of the resolution, and neither has been stated as *the* boundary for the identity server. This is the surface where the trust root and the privacy budget actually meet, and it is currently prose in two unrelated modules.


**G13 — the decorrelation/reconcilability operating point is unnamed, and both axes are already metered.** Axis 1 instruments: `AntiSybil.correlation`, `Orbit.largestLyapunov`, `effectiveN`. Axis 2 instruments: four-oracle byte-lock, `Collation`, the glossary anchor audit. **Nobody has put a meter on each axis and named where the fleet currently sits, or where it should.** Until that exists, "decorrelate as far as possible subject to staying reconcilable" is a direction with no dial. This is empirical work, not a proof obligation — and it is the same shape as the register's already-named open work on measuring ρ for the live fleet, which means one measurement round could close both.

**G14 — `ClaimLane` is the reconcilability governor and is not documented as one.** Lane 1 merges at agent speed (decorrelation-preserving); Lane 2 deliberately slows convergence so multiple observers reconcile meaning. That is the babel dial, already built and already sound-for-Lane-1. It was designed for edit-merge semantics; nothing connects it to the arc. Documentation, not construction.

**G15 — two ADRs directly under this design are `Proposed` and were never promoted.** The keystone (`2026-05-31`, node-local folds, policy-as-fold, trust-decided-at-the-node) and the three-lane glossary model (`2026-04-19`, written to Aaron's own tower-of-babel ask). Both are load-bearing for the arc in §2d. An architecture whose two governing ADRs are perpetually `Proposed` cannot be cited as decided, and nothing currently surfaces that.


**G16 — the choice-based decorrelation route has instruments and no design surface.** `BitGan` models it (matching-pennies Nash, `discriminatorEdge` as the meter) and `Orbit.largestLyapunov` measures the nonstationary route, but nothing in the identity design references either as a decorrelation mechanism. The design currently reads as though opacity is the only route, which §2c shows is false. **Falsifier F4 is unrun** and the counter-example that motivated the correction is itself unmeasured.


---

## 4. C3 formalised, so that it can fail

### 4a. First: the apparent contradiction, because it is load-bearing

`BeliefConvergence` proves that observe-with-fixed-likelihoods **commutes and associates**, so a fold over any permutation of the evidence yields the same belief. That is *precisely* embarrassing parallelism in the fold. If C3 said "the fold does not commute", C3 would already be refuted by our own shipped proof.

**C3 does not say that, and the distinction is the whole formalisation.** Two different objects:

- **The fold over a fixed evidence set is order-independent** — proven, and it must stay that way, because it is what makes convergence-under-reordering work across a partitioned mesh (`local-time-never-enters-the-shared-fold`).
- **The *strength* of the resulting claim is not a function of the per-claim marginals** — and *that* is what "not embarrassingly parallel" means. You cannot shard the claims, verify each in isolation, and combine the verdicts, because the quantity you need was never in the per-claim verdicts.

So C3 is a statement about **what the aggregation function may depend on**, not about the order it runs in. Stated that way it is compatible with the shipped convergence result and it becomes checkable.

### 4b. The statement

> **C3 (non-decomposability).** Let a witnessed-claim configuration be a joint distribution `P` over witness observations `(X₁,…,X_N)` of a claim set. There is **no** pair `(v, ⊕)` — a per-claim verification `v` computed from claim `i`'s observations alone, and a commutative-monoid aggregation `⊕` — such that `strength(P) = ⊕ᵢ v(Xᵢ)` **and** `strength` distinguishes an independent witness set from a correlated one.

### 4c. Why this is a theorem and not an analogy

The coordinator asked whether the connection to `SocietyUsefulWork`'s ρ is real or a shape-match, and asked for it to be **labelled a coincidence if it is only a shape-match** (`numerology-vs-number-theory`). It is real, and here is the structure that identifies it rather than the count that resembles it:

**The mathematical fact is that marginals do not determine the joint.** For fixed marginals `P(X₁),…,P(X_N)` the set of consistent joints is a whole family — bounded by the **Fréchet–Hoeffding** bounds (Hoeffding 1940; Fréchet 1951) and parameterised by a copula (**Sklar 1959**: every joint decomposes uniquely into marginals plus a copula on continuous margins). Mutual information is a functional of the copula and is identically zero for the independence copula and maximal for the comonotone one, **with the marginals held fixed throughout** (Shannon 1948). Therefore any functional of the marginals alone is constant across that family, and in particular cannot separate `I = 0` from `I = H`.

Now instantiate: a per-claim verification `v(Xᵢ)` is by construction a functional of claim `i`'s marginal. Any `⊕`-combination of marginal functionals is a functional of the marginals. Hence it is constant across the Fréchet family. Hence it cannot distinguish N independent witnesses from N witnesses that are one source replicated. **QED, and it is three lines because the hard part is already in Shannon.**

**The identification with `SocietyUsefulWork` is structural, not numerological.** Both are the *same functional*, not merely the same letter ρ: `N_eff = N/(1+(N−1)ρ)` is the exchangeable-correlation effective sample size, saturating at `1/ρ`, and `SocietyUsefulWork` already carries the **Gaussian copula** — i.e. the machinery is already expressed in the Sklar decomposition above. The register's own sentence for it is exactly C3: *"a society that is arithmetically many and informationally one."* And `src/Bayesian/CondorcetBoundary.fs:79-86` (`effectiveN`, test `RHO-STAR-1`) already meters the saturation: **at ρ = 0.5 a thousand agents are worth two.**

**Where I stop, and this is the honest seam.** The theorem transfers; the *instantiation does not carry a measurement*. `SocietyUsefulWork`'s ρ is competence-correlation over discovered facts. C3's ρ would be observation-correlation over witnessed claims. Same functional, **different random variables**, and nobody has estimated the witness ρ for any real fleet — exactly as the register says of row 15. So:

- the impossibility (§4b) is a **theorem** and routes to Lean;
- the effective-independence bound applied to witnesses is a **stated inequality** and routes to Z3;
- the claim that Zeta's witness set sits in any particular regime is **unmeasured** and must not be asserted.

Calling the transfer a theorem when only the functional transfers would be the exact error the numerology rule forbids, so it is written down here as three separately-graded lines instead of one confident one.

### 4d. The named falsifier — F3, the marginal-equivalent pair

> **F3.** Construct two witness configurations `A` and `B` over the same claim set such that (i) **every claim's per-claim verification outcome is identical in A and B** and (ii) `A` has N independent witness sources while `B` has k < N distinct sources with replicated observations. Require `strength(A) > strength(B)` **strictly**.
>
> **Any implementation returning `strength(A) = strength(B)` is embarrassingly parallel and C3 is refuted for it.** Any *design* that admits no such pair has smuggled the marginals-determine-the-joint assumption and is Sybil-priceable.

F3 is a real falsifier and not a restatement, because it is **already fired once, in production, in this repo**. `QuorumAlgebra`'s own docstring records the motivating defect:

> *"the only thing that stops six agents on one data stream folding to six times the confidence (bug B3, `precision = 66.0` on a mean wrong by 5.66)"*

Six witnesses, one source, marginals identical to six independent witnesses, and the aggregation summed them. That is exactly configuration `B` scored as configuration `A`. **C3 is therefore not a design preference — it is the generalisation of an observed failure**, and `QuorumAlgebra.join`-before-`interfere` is the first (partial) repair: dedup-by-source is the k=1 corner of F3. It does not handle *partial* correlation, which is where the ρ-bound is needed and where no code exists.

---

## 5. Routing table — claim → instrument → why

Guarding explicitly against TLA+-hammer bias, and reconciled against what §1e already proves so nothing is re-derived.

| Claim | Property class (routing-table row) | Primary | Cross-check | Wrong-tool cost |
|---|---|---|---|---|
| **C1** capability is a derivative | **Type-level refinement** first, **structural shape** second. "No capability value exists that was not constructed from a witnessed-claim set" is a *constructor* property, not a reachability property. | **F# private-representation constructor**, exactly the `KeyCustody.PhaseWindow` pattern — an underivable capability made *inexpressible* rather than *unreachable*. | **Alloy** at bound 4–6 for the shape: no `Capability` node without an in-edge from a witnessed-claim set, including transitively. Plus the existing `DerivationProtocol.Evidence.AssertedOnly` refusal. | **TLA+ is the wrong hammer here.** Modelling capability derivation as a transition system burns state space to prove an *unreachable state* when the property is an *inexpressible value*. Cost: days of TLC on the wrong axis, and — worse — a green model that a `Capability.create` overload silently invalidates, because the model never saw the constructor. |
| **C2** the witness is itself a self-claimer | **Structural shape** (no privileged node), plus an **exit** property. | **Alloy** — assert no configuration in which a principal attests without itself being attestable, and no principal all paths route through. Bounded 4–6 is the right size; a hub, if expressible, shows up small. | The existing `BftSybilConsensus.tla` already discharges *quorum-over-distinct-identities is Sybil-sound given a distinctness oracle*. **Do not re-model it.** `TrustGraph.als` already carries the SDSI/SPKI self-root-for-identity discipline this builds on. | Writing another BFT model duplicates `BftConsensus.tla`'s 4.6M states to re-derive a checked result. And "no appointed attestor" is a **graph shape**, not a temporal property — TLC would enumerate time to check something that does not move. |
| **C3a** the impossibility (§4b) | **Algebraic / information-theoretic identity.** | **Lean 4 + Mathlib** — this ships in papers, and the repo *already has the ladder*: `FinMutualInfoNonneg.lean`, `FinConditionalEntropy.lean`, `FinDataProcessing.lean`, `DecorrelationDpi.lean`. The obligation is: exhibit two joints with equal marginals and different mutual information, then show any marginal-functional is constant on that family. | **FsCheck** for F3 as an executable property against whatever `ClaimStrength` ships. | Z3 is the wrong primary: the statement quantifies over *distributions*, and a first-order encoding of "for all joints with these marginals" is where SMT returns `unknown`. **TLC is categorically wrong** — see the `QuorumPhaseCancellation.tla` precedent: TLA+ has no reals, and discretising a correlation coefficient then reporting green would be checking the discretisation, not the claim. |
| **C3b** the shipped strength bound | **Algebraic-law identity over reals.** | **Z3 (UFNRA)** — `N_eff = N/(1+(N−1)ρ)` monotone decreasing in ρ, saturating at `1/ρ`, and `strength(B) < strength(A)` under the F3 hypotheses. Model it exactly as `whitewash-economics-lemma.smt2` does: leave the transcendental **uninterpreted** and constrain only monotonicity, so the result holds for the exact function and every monotone approximation. | **FsCheck** closes the numerics blind spot the abstraction opens. That is the BP-16 pairing the whitewash lemma already established. | Encoding the actual polynomial in QF_NRA grinds or returns `unknown`, **and** proves something about the approximation rather than about the quantity. That failure is on file. |
| **C4** identity strengthens over time | **Concurrency / temporal**: monotone non-decreasing pair strength across mutual-observation steps under arbitrary interleaving, **and** refusal to strengthen from one party's steps alone. | **TLA+ / TLC.** This one genuinely is TLC's row — the interesting failure is an interleaving where two nodes at different observed phases disagree about a pair's strength, and only a model checker enumerates that. | **Semgrep** for the noninterference half — see §6. Plus `KeyCustody`'s existing phase-window discipline as the mechanism under test rather than a new one. | FsCheck alone misses the interleaving; Lean alone proves monotone accrual and says nothing about two nodes disagreeing. Also: **do not** model the *strength arithmetic* in TLC — split it out to C3b, or TLC enumerates real arithmetic it cannot represent. |
| **C5** every trust decision is node-local | **Structural shape** — no verdict edge into a node from outside it. **Defers to the `local-trust-view-decentralized-identity` trajectory (§1h), which carves this already.** | **Alloy** at bound 4–6 for the graph half only; the two-nodes-disagree-and-both-correct witness belongs to the trajectory's `LocalTrustView` slice as a property test, which is cheaper than a model. The violating configuration is small and structural: any principal whose decision is a function of another principal's verdict rather than of its own policy over received evidence. | The `Policy<'i,'d,'f>` **type itself** is the cheapest cross-check available and it is free: a policy that is a total function of *its own input* cannot consult an external verdict without that verdict appearing in `'i` — where a reviewer can see it. Type-level, no tool run. | TLA+ would model the message exchange and prove agreement properties nobody asked about, while the actual property — *where does the verdict come from* — is a dataflow shape. Cost: a green model of the wrong question. |
| **C6** hubs negotiate, never command | **State-machine safety + non-penalty**, i.e. the `RefuseBinding` shape. | **TLA+ / TLC — by generalising `RefuseBinding.tla`, not by writing a new spec.** `Refuse` always enabled while an interaction is pending; refusing never costs standing; no non-consented interaction executes. The spec exists and the non-penalty clause is already in it. | **Alloy** for the static half (no principal all paths route through — the exit property from `itron-hub-patent-boundary`). | Writing a fresh spec here would duplicate `RefuseBinding.tla` and — more expensively — risk dropping the **non-penalty** clause, which is the clause that distinguishes negotiation from coercion. A "you may refuse" model without a standing-cost variable is the vacuity class: a refusal you cannot afford is not a refusal. |
| **C4-NI** no local time in the shared fold | **Adversarial input / taint** — it is a *lexical* property of a code path. | **Semgrep** — no `DateTime` / `DateTimeOffset` / `Stopwatch` / `Environment.TickCount` read on any path feeding the shared trust fold. | CodeQL if the taint needs to be interprocedural. | This is currently asserted in **prose** in `KeyCustody.fs`'s docstring ("no function here takes a `DateTime`…"). A prose invariant is not a check; the first contributor who adds an overload breaks it silently. Routing this to TLA+ would be absurd — it is a grep, and the cheapest tool that can fail is the right one. |

**Criticality and tool count (BP-16 triage).** C1, C2, C3 and **C6** are **P0** — a violation of any of them is unrecoverable after the fact (a wrongly-derived capability has already acted; a hub, once depended on, is load-bearing; a summed correlated quorum has already shipped a wrong verdict with high stated confidence, which is bug B3's exact signature; and a hub that has become mandatory cannot be un-depended-on by a later policy change). **C5** is P1 — a non-local verdict is loud, because the evidence for it has to travel. So each gets **≥ 2 independent tools, prefer 3**, and the tables above are written to that. C4 is **P1** — a wrong accrual is noisy and reversible — with the single exception of C4-NI, which is P0 because divergence under skew is silent.

**Cheaper-tool note, said without apology.** Three of the seven rows above route to Alloy, Z3 or Semgrep rather than TLA+ or Lean, and that is the point: a Semgrep rule that runs in the gate on every PR buys more coverage per round than a TLA+ spec that runs nightly and models a property the code no longer has.

---

## 6. The `local-time` guard on C4 — where this design can go silently wrong

C4 is about accrual over *time*, and the shared fold may only see **agreed phase** (`local-time-never-enters-the-shared-fold`). The failure is specific and tempting: a staleness filter on the evidence entering the strength fold — *"drop observations older than N local-seconds before folding"* — leaks local time into the shared conclusion, and because every node's receive-time differs, nodes fold different evidence sets and **diverge**.

The design must therefore state:

- `strength` is a pure function of `(observation set, agreed phase)`. Local wall-clock may drive retransmit, timeouts, UI freshness, "is this stale **to me**" — never what enters the fold.
- **Litmus:** if two nodes with different receive-times could fold different sets, local time has leaked.
- The mechanism already exists and should be reused rather than reinvented: `KeyCustody.PhaseWindow` evaluates liveness against a `TravelerFrame.Frame` coordinate, so two principals with arbitrarily skewed clocks that have observed the same phase return the *same* decision.
- The **hardware form of the same guard** was found independently this week: the YubiHSM has no clock, so a binding's expiry cannot come from the device and must come from cluster phase. A hardware root that emits **evidence** and not a **verdict** is C1; a hardware root that cannot supply time is C4-NI. Same device, two claims, and it is worth noticing they were derived from opposite directions and met.

---

## 7. Honest metering table

| Claim / component | Register | Evidence, or what is missing |
|---|---|---|
| C1 capability-is-a-derivative | **unmetered** | The refusal machinery exists (`Evidence.AssertedOnly`, `Wall.Whitebox` blocking on unknown licence) and the grant machinery exists (`KeyCustody`), but no capability type is *constructed from* a witnessed-claim set. Currently a convention. |
| C2 witness-is-a-self-claimer | **partially metered** | Metered where it reduces to distinct-identity quorum soundness (`BftSybilConsensus.tla`, with a non-vacuous witness). Unmetered as "no appointed attestor exists anywhere in the deployed graph" — no structural check runs. |
| C3a marginals do not determine the joint | **metered as mathematics, elsewhere** | It is Shannon 1948 / Fréchet–Hoeffding / Sklar 1959. Not yet *in our formal corpus* for witnesses — that is the Lean work-item. The Lean ladder it needs is already built. |
| C3b `N_eff` saturation | **metered** | `effectiveN` at `src/Bayesian/CondorcetBoundary.fs:79-86`; `RHO-STAR-1`; §A row 15 falsifier mutation-verified 2026-08-16, 7/7 mutants killed. |
| C3 applied to **witnesses** specifically | **unmetered** | Same functional, different random variables. No witness-ρ has been estimated for any fleet. Do not assert a regime. |
| C3 failure mode is real | **metered by incident** | Bug B3: six agents on one stream, `precision = 66.0` on a mean wrong by 5.66. |
| C4 accrual strengthens identity | **toy → unmetered** | Graded in the 2026-08-18 record as *"analogy with one metered consequence"* — the consequence being the accrual-time floor (pair strength monotone in mutual-observation count, unforgeable by a new identity). The physics is a **generator**, not a warrant, and must not be cited as one. |
| C4-NI no local time in the fold | **unmetered** | Asserted in a docstring. A prose invariant is not a check. |
| C5 node-local decisions | **unmetered** | The keystone ADR states it (**Proposed**, never promoted); `Policy.fs`'s type shape supports it; no check enforces it. |
| C6 hubs negotiate, never command | **partially metered** | The *binding* case is checked (`RefuseBinding.tla`, incl. non-penalty). The *interaction* generalisation is not. |
| The three metered decision classes | **absent, not unmetered** | Share / compute / store have no policy instance. There is nothing yet to meter. |
| `Policy.fs` profunctor kernel | **metered by construction** | The variance laws are the kernel's content; one instance ships (`DynamicValueXmlPolicy`). The *trust* interpreter does not exist. |
| `Diplomacy` shape-only handshake | **implemented, NCI-argued** | Same-shape-different-secrets ⇒ identical profile is the anti-coercion property; it is argued in-file, not property-tested. |
| Frost as *a* decorrelation route (ρ-pricing) | **unmetered, and narrowed 2026-08-19** | `N_eff` is metered (`effectiveN`, `RHO-STAR-1`). That **observation raises ρ** is the unmeasured link — and it is now known **not** to hold universally: Aaron runs fully public and decorrelated. True for opacity-reliant agents only. |
| Frost as a primitive, in practice | **unmetered — and not dogfooded** | Designed by someone who does not use it. Not self-serving, which is a point in its favour; also never lived in, so where it chafes is unknown. |
| Choice-based decorrelation (mixed strategy) | **anchored, unmeasured** | Anchor entails: von Neumann 1928 — an optimal mixed strategy secures its value **even when the opponent knows it**. `BitGan` already carries the equilibrium and the meter (`discriminatorEdge`). No agent has been measured against F4. |
| Nonstationary decorrelation ("adapt haphazardly") | **unmetered** | `Orbit.largestLyapunov` is the instrument; never pointed at an agent's decision history. |
| "Transparency is free on axis 1" | **conditionally true, stated conditionally** | Free **provided** mechanism 2 or 3 is live. A deterministic, stationary, fully-public agent is perfectly predictable — the unconditional claim is false in both directions. |
| Frost as register-collapse prevention (privacy > 0) | **metered** | `NonRegisterCollapse` (TLA+ + Lean), `Privacy.IdentityForcesPrivacy` (Lean, gated). **Do not cite this row for the row above it.** |
| Witnessing/frost boundary | **absent** | G12. Two candidate shapes exist in-tree; neither is stated as the boundary. |
| `local-trust-view` C5 headline test | **specified, not built** | "Two nodes disagree and both are correct" is named as the headline test in an active trajectory. |
| S=4 superdeterministic origin | **`toy` as physics, structural as framing** | The mapping "common seed ⇒ built-in correlation" is entailed by Bell 1964's statistical-independence assumption and its superdeterminism loophole. That the substrate *is* superdeterministic, or that S=4 is a measured fleet property, is not claimed. |
| Tower-of-babel divergence | **phenomenon real, any rate `toy`** | Lexical replacement and intelligibility decline with time-depth are solid; Swadesh glottochronology as a *dating* method is contested. Cite the phenomenon, never the clock. |
| Four-oracle byte-lock + canonical collation | **metered** | Golden vectors, four oracles, hex-in-JSON. This is the anti-babel guard that actually fires. |
| The decorrelate/reconcile operating point | **unmeasured** | Both axes instrumented, never plotted together (G13). |
| Whitewash unprofitability | **metered, with the boundary stated** | Friedman–Resnick 2001 says it **cannot** hold given an honest newcomer prior; the Z3 lemma proves the exact boundary instead of the false claim. This is the model for how the rest should be written. |
| `PrivacyPreservingIdentity` adinkra/E8 stack | **unmetered** | Elegant, no attack program run. |
| Q# oracle modules | **out of the trust path** | Algebra/DBSP reference oracle. Recorded so it is not mistaken for a quantum identity protocol. |

---

## 8. Work-items filed this round (routed, not executed)

| ZetaId | Work |
|---|---|
| `081M0DJSR8N087G0R000QCYBYW` | Lean 4: marginals do not determine the joint — the C3a impossibility, built on the existing `FinMutualInfo`/`FinDataProcessing` ladder |
| `081M0DJSY48087G0R001GVG3AT` | Z3 UFNRA: witness-quorum effective-independence bound, uninterpreted-monotone pattern per the whitewash lemma |
| `081M0DJSY5C087G0R00094DD3Z` | FsCheck: the F3 marginal-equivalent-pair falsifier |
| `081M0DJSY6B087G0R0005PAA25` | Alloy: no appointed attestor — every witness is itself attestable (C2) |
| `081M0DJSY79087G0R002FH5140` | TLA+: pair-strength monotone accrual under interleaving (C4) |
| `081M0DJSY88087G0R002JTPWKQ` | Semgrep: no wall-clock read on any path feeding the shared trust fold (C4-NI) |
| `081M0DJSY9F087G0R002HV7KA7` | **G1 — the `ClaimStrength` surface does not exist.** The others verify a function nobody has written; this one is the prerequisite and it is not mine to write. |
| `081M0DK2TW6087G0R001GHD9MJ` | Alloy: no-mandatory-hub — every hub interaction refusable by local policy without loss of standing (C6, exit made mechanical) |
| `081M0DK2TXD087G0R003674BAS` | **G7 — `Policy.fs` has one instance and no trust interpreter.** The node-local trust policy evaluator is the missing decision layer |
| `081M0DMH30Y087G0R001C2B1PT` | **G13 — plot the two scarce axes against each other** (decorrelation vs reconcilability) and name the operating point. Empirical; composes with the register's already-open rho measurement |
| `081M0DRH1CW087G0R003Y3CAB6` | **F4 — run the discriminator against a fully-transparent agent's public history.** The counter-example that corrected §2c is itself unmeasured; both readings pre-registered |

Not filed, and deliberately: G3 (identity-provider surface) and G4 (repo→cluster binding) are architecture, not verification — they belong to Kenji's sizing, and filing them from a routing review would pre-empt it. G6 (stale gap list) is a hygiene fix on the 2026-08-09 doc. G8 (two policy semantics, Rego vs `Policy.fs`) is a decision, not a proof obligation, and filing it as verification work would misroute it. G9 (society read against the spine) is Kenji's sizing. G14 (`ClaimLane` as the reconcilability governor) is documentation. G15 (two governing ADRs perpetually `Proposed`) needs a human sign-off, not a proof.

---

## 9. What I did not do

- **Did not write any spec.** Routing is the deliverable; TLA+/Lean/Z3/Alloy authorship is Kenji's or the author's lane.
- **Did not re-model BFT agreement.** `BftConsensus.tla` (4.6M states) and `BftSybilConsensus.tla` already hold that ground.
- **Did not decide the collateral regime.** `QuorumCollateral.tla` prices R1–R4 side by side precisely so Aaron picks on consequences; a routing review picking for him would be the wrong authority.
- **Did not claim the physics.** The entanglement-accrual framing stays a generator (`numerology-vs-number-theory`), and the one consequence that is checkable is the one that got a work-item.

## Pointers

- The spine: Aaron 2026-08-19, quoted in full at §0.
- Closest prior design: `2026-08-09-every-node-is-its-own-identity-provider-repo-as-cluster-hats-grant-claims-bounded-duration-aaron.md` — **two of its four gaps have closed**; see §1c and G6.
- C4's prior grading: `2026-08-18-godel-localized-to-a-known-junction-and-entanglement-accrues-pairwise-aaron.md` §4.
- The routing precedent that bounds C3: `src/Core.TLA/specs/QuorumPhaseCancellation.tla` header — reachability transfers up, non-reachability does not.
- The BP-16 model to copy: `tools/Z3Verify/whitewash-economics-lemma.smt2`.
- The decision layer's own prior statement: `docs/DECISIONS/2026-05-31-zeta-keystone-architecture-...-node-local-folds-fpga-to-policy.md` — **Proposed since May, never promoted**, and it already carries the policy-as-fold / trust-decided-at-the-node invariants.
- The active trajectory this overlaps: `docs/trajectories/local-trust-view-decentralized-identity/RESUME.md` (G10).
- The arc's own surfaces: `docs/DECISIONS/2026-04-19-glossary-three-lane-model.md` (Proposed), `.claude/skills/governance/blueprints/glossary-anchor-keeper.md`, `src/Core/Collation.fs` (G15).
- Rules in force: `toy-is-free-metered-must-be-earned`, `numerology-vs-number-theory`, `local-time-never-enters-the-shared-fold`, `anchor-to-human-prior-art`, `dual-use-detection-is-neutral-oracle-decides`, `itron-hub-patent-boundary-p2p-is-the-upgrade`, `manifesto-13-specifications` (§1 no central control, §6 consent-first, §11 multi-oracle/exit, §13 noninterference).
- Checked anchors used here: von Neumann 1928 (minimax; an optimal mixed strategy is safe to announce — the anchor for §2c mechanism 2) and Kerckhoffs 1883 (everything public *except a key* — cited for the contrast, since the configuration in question has no persistent key); Bell 1964 (the statistical-independence assumption) and 't Hooft (superdeterminism) — for the S=4 framing, graded in §2d; Popescu & Rohrlich 1994 (the algebraic S=4 bound); historical linguistics on lexical replacement and dialect continua (Hockett), with Swadesh glottochronology explicitly **not** relied on as a rate; Hirschman 1970 (*Exit, Voice, and Loyalty*) — exit is what disciplines a concentration, and it is what C6 makes mechanical; Goguen & Meseguer 1982 (noninterference) for the membrane metering; Shannon 1948; Hoeffding 1940 / Fréchet 1951; Sklar 1959; Friedman & Resnick 2001; Herbrich–Minka–Graepel 2006; Kelly 1956; Buterin & Griffith 2017; Douceur 2002; Pappu 2002; Demers et al. 1987; Leibniz (identity of indiscernibles); Dwork–McSherry–Nissim–Smith 2006.

# Upstream Reference List

Curated list of external repos / projects / papers we study to keep
`Zeta.Core` honest.

See `docs/TECH-RADAR.md` for our own Adopt/Trial/Assess/Hold rings;
this doc is the broader "here's every system we should keep an eye on"
list. When a project graduates from here into our tech radar, mark it
with a ⭐ below and add a row there.

## Zeta.Core's own reading list

- **Category Theory for Programmers** ⭐ **(REQUIRED READING — Aaron 2026-06-09)** —
  Bartosz Milewski. The foundation for our Observable/duality (IEnumerable⇄IObservable),
  functors/monads, the type-provider/interface≡proof work, and the 2×2-compose structure.
  Pairs with Mac Lane (pure CT, the shape-G limit/cone spine).
- **Brian Beckman** ⭐ **(REQUIRED READING — Aaron 2026-06-09, "the Brian Beckman in me")** —
  *Don't Fear the Monad* + the Rx/category-theory + quaternions/physics-from-structure
  talks. The derive-the-physics-from-the-math-structure style (Rx → Cayley–Dickson →
  spinor/qubit "fell out of the Rx structure"). Pairs with De Smet (`IQbservable`) + Meijer.
- **Horst Schubert — prime decomposition of knots (1949)** — *Die eindeutige
  Zerlegbarkeit eines Knotens in Primknoten*: every knot factors UNIQUELY into prime
  knots under connected sum — the fundamental theorem of arithmetic with SHAPES as the
  primes. The exact Beacon body for Aaron's "our prime numbers are shapes; we don't
  need numbers, just some ordering system" (2026-07-02): the braided shape catalog's
  atom row (crossing.lines — "everything braided is a word in this one generator")
  is the same stance; Ihara's zeta (graph primes = primitive closed cycles) extends
  it to the project's own name. Pairs with only-the-irreducible-is-primitive (the
  rule is unique factorization stated categorically) and the braid/adinkra family.
- **S. James Gates Jr. — SUSY adinkra error-correcting codes** — doubly-even self-dual
  linear binary block codes found *inside* the adinkras of supersymmetry ("codes in the
  equations of physics"). The universe's error/erasure coding over time; the real anchor
  for our entropy-oscillation/erasure coding (vs the generic Azure-LRC analogy). Our
  coincidence-anchor primitive (081KRW63S0008QG0R000QJR08H/081KT2T2J0008QG0R0026MS6PV) is already Adinkra/Gates-grounded.
- **Reticulum (RNS)** — Mark Qvist, `markqvist/Reticulum` — the cryptography-based
  overlay networking stack we close over (dep-as-oracle) for the cell/test mesh.
  Identity = X25519 + Ed25519 512-bit keyset; Destination = truncated SHA-256
  (**ties to ZetaId, 128-bit**); Transport node / interface (TCP/I2P) / announce /
  hub. Self-certifying hash addresses, runs over the open internet. Privacy
  primitives pair: **NIP-01** (schnorr) + **NIP-44 v2** (ChaCha20+HMAC, official
  test vectors) on the nostr keypair.
- **AllJoyn** — Qualcomm 2011 → AllSeen Alliance → merged into OCF/IoTivity (2016);
  `alljoyn` (archived upstream). **Prior art on BOTH `universal/` and Reticulum**
  (Aaron 2026-06-10): (a) *universal interfaces* — devices/services expose typed,
  XML-introspectable interfaces (methods/signals/properties, D-Bus-descended — also
  anchors `universal/bus`) that any peer discovers and consumes regardless of
  vendor/transport — the IoT interoperability dream, ours generalized to
  travelers/personas; (b) *the mesh* — infrastructureless, transport-agnostic
  (Wi-Fi/BT), proximal D2D bus with no cloud/broker — the Reticulum shape a decade
  earlier. Lesson carried: AllJoyn died of consortium fragmentation (AllSeen vs
  OCF) — the format-war lesson (zetamax doc): be open AND better, or be Betamax.
- **DBSP / IVM** ⭐ — Budiu et al. *DBSP: Automatic Incremental View
  Maintenance for Rich Query Languages* (VLDB 2023); VLDB Journal
  2025 extended version; `arXiv:2203.16684`.
- **Differential Dataflow / Timely** ⭐ — McSherry, Murray, Isard,
  Isaacs TODS 2013; Naiad SOSP 2013; Abadi et al. — the foundations
  our `Recursive.fs` references.
- **FASTER HybridLog (MSR)** ⭐ — Chandramouli et al. SIGMOD 2018;
  closest .NET-native prior art for our `DiskSpine.fs` tiers.
- **TigerBeetle** ⭐ — LSM-forest + VOPR simulator; inspiration for
  deterministic simulation testing and the `ChaosEnv.fs` discipline.
- **Datomic** ⭐ — AEVT/AVET indexes; inspiration for
  closure-table-style `Hierarchy.fs`.
- **XTDB 2** ⭐ — Arrow bitemporal indexes; temporal-query
  inspiration.
- **CloudEvents** ⭐ — CNCF event-envelope standard (v1.0); to be the bus
  envelope over Zeta's busses. See `docs/research/2026-06-07-cloudevents-bus-envelope-and-debezium-cdc-as-zset-delta-anchor-aaron.md`.
- **Debezium / CDC** ⭐ — Red Hat; the `before/after/op/source/ts_ms` change-event
  envelope = a **DBSP Z-set delta** (c=+after, d=−before, u=−before+after). Anchor
  for our `DeltaLog`/`ZSet` deltas + schema-on-stream (Kafka Schema Registry ≅
  SchemaEvolution/081KSRGFP0008QG0R001Y6RTY9). Emits CloudEvents (`CloudEventsConverter`).
- **Reaqtor / IQbservable / Nuqleon / Bonsai** ⭐ — **Bart DeSmet**
  (built for Bing; now under the .NET Foundation). Stateful
  event-processing + the **Bonsai/Nuqleon** serialized-expression-tree
  model; slim-IR inspiration for persistent queries. Our `Bonsai.fs`
  serializer is this lineage — the human anchor for our reified-
  computation-as-data node type (the "what acts" side of the value tree).
- **Probabilistic programming — Church / Anglican / Gen / Pyro / Stan** —
  **Church** (Goodman, Mansinghka, Roy, Bonawitz, Tenenbaum, UAI 2008) is a
  probabilistic **Lisp/Scheme**: the closest prior art to the *soft /
  probabilistic DynamicValue* (homoiconic + first-class inference). The
  direction for "ambiguous tags that carry a distribution and resolve by
  context like English" (stochastic λ-calculus with Bayesian updating over the
  structure). Anchor for the soft-DV / safety-layer-under-LLMs vision.
- **Cartesian Closed Category** — Lambek (the categorical home of typed
  λ-calculus); **Conal Elliott** *Compiling to Categories* (ICFP 2017). The
  proper algebraic home for the typed self-representing meta-language
  (DynamicValue), as opposed to `INumeric` (too small).
- **Applied Duality — μF/νF, coSQL, Rx duality** — **Erik Meijer**
  (Applied Duality, Inc.; Rx co-creator) + **Brian Beckman**. The
  duality tradition our reflective data⇄computation engine extends:
  observer/iterator duality (Rx), `coSQL`-vs-`SQL`, recursion-schemes
  (bananas/lenses), μF (data / "what remains") ⇄ νF (process / "what
  acts"). The Beacon anchor for the yin-yang framing — see
  `aaron-ani` 2026-06-05 (DynamicValue's data⇄behavior duality is the
  concrete build of this tradition; the type-discriminator = the
  yin-yang dots).
- **⭐ THE Rx / REACTIVE-DUALITY CLUSTER — "the Rx guys" (consolidated anchor, Aaron 2026-07-11:
  *"consolidate on anyone who might be able to ground my work"*)** — four humans who ground the
  entire reactive / duality / fold spine, cross-linked because the work is one lineage read four ways,
  and each maps onto a live thread:
  - **Erik Meijer** (Rx co-creator; Applied Duality — entry above) — observer/iterator duality and
    **μF (data / "what remains") ⇄ νF (process / "what acts")**: the formal home of the *remains/acts
    fork itself*. (LINQ; *Subject/Observer is Dual to Iterator*, 2010.)
  - **Brian Beckman** (physicist + monads — entry above ⭐) — *Don't Fear the Monad*;
    **physics-falls-out-of-the-Rx-structure** (Rx → Cayley–Dickson → spinor/qubit). The bridge from
    the reactive spine to the **SUSY / adinkra** physics — the anchor for the adinkra-clock thread
    (`docs/research/2026-07-11-where-does-the-adinkra-clock-come-from…`).
  - **Bart DeSmet** (Rx internals — entry below) — Reaqtor / IQbservable / Nuqleon / Bonsai + the
    **scheduler / virtual-time** machinery our `src/Core/VirtualTimeScheduler.fs` ports; the anchor
    for **time-as-an-injected-scheduler** (the adinkra-clock test: does `∂_τ = {Q,Q}` fall out as
    `VirtualTimeScheduler.AdvanceBy`?).
  - **Bartosz Milewski** (⭐ entry above) — *Category Theory for Programmers*: the categorical duality
    (IEnumerable⇄IObservable) under all of the above.
  Independent lineage (Rx / CT roots, **not the Zeta seed**) → genuine grounding, not internal echo —
  which is exactly why these four (per the sole-mirror discipline) are the independent-prior peers
  who could *move* the remains/acts fork rather than merely re-confirm it from inside the model.
- **CALM theorem — Consistency As Logical Monotonicity** — **Joseph
  Hellerstein & Peter Alvaro** (CIDR 2011 *The Declarative Imperative*;
  CACM 2020 *Keeping CALM*). The result: a program has a coordination-free
  (consistent-without-locks) implementation iff it is monotonic. The Beacon
  anchor for the **remains/acts (yin/yang) boundary** — the monotonic
  "what remains" (G-set / grow-only / convergent) needs no coordination,
  while non-monotone "what acts" is where coordination/consent must live.
  Ties the lock-free + idempotency disciplines to a named theorem; Aaron
  cites CALM as the prior art for proving the animation↔remains↔acts
  relationship (Mika conversation 2026-06-05, part 14).
- **Apache Arrow + Flight** ⭐ — columnar wire format; we use Arrow
  IPC in `ArrowSerializer.fs` and plan Flight for multi-node.
- **FoundationDB** ⭐ — Will Wilson's DST lineage; our `ChaosEnv.fs`
  - `VirtualTimeScheduler` borrow directly.
- **Materialize / Feldera** ⭐ — our closest incremental-SQL
  competitors; Feldera is `docs/research/feldera-comparison-status.md`.
- **SlateDB** ⭐ — CAS-manifest + `writer_epoch` fencing pattern
  (round-16 research verdict: adopt pattern, don't clone code).
- **Category Theory for Programmers (Milewski)** ⭐ — required
  reading for contributors; shapes our operator-algebra vocabulary.
- **Izraelevitz et al. DISC'16** ⭐ — buffered durable
  linearizability; correctness model for our durability modes.
- **Silo (Tu SOSP'13) / FOEDUS (Kimura VLDB'15)** ⭐ — epoch commit
  prior art for WDC paper.
- **CockroachDB Parallel Commits SIGMOD'20** ⭐ — related work for
  WDC.
- **Jepsen** — correctness test discipline; future work to run
  against our distributed paths.
- **Bifunctor / profunctor optics literature** — Milewski, Pickering-
  Gibbons-Wu; references for `NovelMathExt.fs`.
- **Tropical semiring / min-plus algebra** — reference for
  `NovelMath.fs`; Golan *Semirings and their Applications*.
- **Semiring/ring boundary (idempotency forbids additive inverses)** —
  Vandiver 1934 (Bull. AMS 40, the founding semiring paper); Golan 1999
  ch. 1/4 (zerosumfree, `V(S)={0}` for idempotent semirings);
  Baccelli–Cohen–Olsder–Quadrat 1992 *Synchronization and Linearity* §3.2
  (dioids: idempotent addition incompatible with invertibility). Grounds
  the IRing/ISemiring split (081KWG9JQ9H): Tropical's missing `Negate` is
  a proven classical theorem.
- **Residuated lattices** — Galatos-Jipsen-Kowalski-Ono 2007; shapes
  `Residuated.fs`.
- **HyperLogLog** — Flajolet-Fusy-Gandouet-Meunier; HLL++ (Ertl
  bias correction).
- **Count-Min** — Cormode-Muthukrishnan.
- **KLL quantile** — Karnin-Lang-Liberty 2016.
- **HyperMinHash** — Cohen-Lemire; a sketch we ship.
- **FastCDC** — Xia et al. USENIX ATC 2016; our `FastCdc.fs`.
- **Jumprope / Scott Vokes** ⭐ — *Data Structures: The Code That Isn't There*
  (Strange Loop 2012); content-addressed large-file storage as a skiplist whose
  probability function is a hash (Leaf/Limb/Trunk; CAS-not-pointers; rolling-hash
  chunking; tunable; seekable). Prior art for `ContentStore`/`DagFs`/Merkle-DAG fs.
  See `docs/research/2026-06-07-jumprope-vokes-content-addressed-storage-skiplist-hash-prior-art-aaron.md`.
- **Skip Lists / William Pugh** (1990) — probabilistic balanced structure; the
  Jumprope's hash-as-probability backbone.
- **Information theory — Shannon** ⭐ — entropy `H=Σp·(-log₂p)`, noiseless coding
  theorem, prediction≡compression, cross-entropy. The math under `ByteCost`, the
  metric sketches (HLL/Count-Min/KLL), "sell readout not compression" (Amara), and
  the belief/agent layer (Bayesian). See `docs/research/ip-questionable/2026-06-07-3blue1brown-compression-is-intelligence-...md`.
- **Physics of floats OVER Bayesian inference** ⭐ **(Aaron 2026-06-10 — "track this prior art very
  carefully; this IS what I'm doing")** — the substrate does Bayesian inference in explicit float-bit
  physics: `mea` = a Bayesian update; ΔU = **KL divergence** (info gain in **bits**); the **ULP** is
  the posterior's precision floor; the `Resolution`/unum primitive tracks the meaningful bits of belief
  (`maxed` = converged to the ULP floor; `needsMoreBits` = widen). Anchors, carefully:
  **Bayes/Laplace/Cox/Jaynes** (probability as logic) · **Kullback–Leibler** (= ΔU) + **mutual
  information** · **Rissanen MDL** (inference = counting bits) · **Lindley / Bayesian experimental
  design** (expected info gain — what `mea` maximizes) · **Solomonoff/Kolmogorov** (universal prior) ·
  **Probabilistic numerics** (Hennig–Osborne–Girolami — computation, incl. finite precision, *as*
  Bayesian inference; the closest named prior art) · **Friston** free-energy/active-inference (cell =
  Bayesian Markov-blanket) · **IEEE 754 / Kahan / ULP / significance & interval arithmetic** ·
  **Gustafson unum/posit** (= "universal number"; variable-precision numbers that track their own
  resolution — the cousin anchor) · .NET **generic math** (`INumberBase`/`IFloatingPointIeee754`) as
  the universal-number carrier. **Our built instance = the TriBoolean Float** (081KSV2WD0008QG0R00051XS0N; middle-out,
  self-describing — the middle field decodes the ends; trits T/F/N with `measure` collapsing
  superposition = `mea` at the number scope; built + proven **4/4 cross-language** TS/F#/C#/Rust, see
  `src/Core.{FSharp,CSharp,Rust}.TriBoolean/Float*` + `src/Core.TypeScript/tri-boolean-float/` +
  `docs/PROVEN-COVERAGE-AND-GAPS.md`). See
  `docs/research/2026-06-10-physics-of-floats-room-boundary-is-a-bit-budget-...md` +
  `docs/research/2026-05-30-tri-boolean-float-v0-spec-middle-out-self-describing-decode-aaron-otto.md`.
- **Local-first / CRDTs / privacy-first** ⭐ — Kleppmann et al. (Ink & Switch
  2019); CRDTs (Shapiro et al. 2011); Groove (Ozzie); Solid/pods (Berners-Lee);
  W3C DIDs; PSI; federated learning; SMPC; OPA; Signal. Zeta's manifesto ethos as
  architecture; CRDT layer = `GSet`/`GCounter`/`Bag`/`ZSet` (do local-first collab
  in Z-set). See `docs/research/ip-questionable/2026-06-07-catherine-nimisha-privacy-first-...md`.
- **Patricia trees / Abstract interpretation — Sparta (Meta)** ⭐ — immutable
  integer-keyed maps (Okasaki & Gill, *Fast Mergeable Integer Maps*) — the
  int-keyed cousin of HAMT for `ZSet`/`IndexedZSet`/seq-keyed state; + lattice
  fixed-point + **widening/narrowing** (Cousot & Cousot 1977) = the theory under
  DBSP's fixpoint iteration (`RecursiveSemiNaive`), and Bourdoncle WTO loop
  scheduling. See `docs/research/ip-questionable/2026-06-07-sparta-abstract-interpretation-...md`.
- **Persistent collections — Bagwell / Hickey / Okasaki** ⭐ — HAMT / bitmap
  vector trie (Bagwell 2000–01), Clojure persistent vector/map/set (Hickey),
  *Purely Functional Data Structures* (Okasaki 1998); **RRB-trees** (Bagwell &
  Rompf 2011, O(log n) concat). The structural-sharing/COW mechanism under
  `ContentStore`/`DagFs` (`ImmutableDictionary` = HAMT) + `ZSet` (`ImmutableArray`).
  See `docs/research/ip-questionable/2026-06-07-zach-allaun-functional-persistent-vectors-...md`.
- **Hitchhiker trees — David Greenberg** ⭐ — functional (path-copying) fractal /
  B+ tree with per-node write buffers + flush control, optimized for remote
  storage (datacrypt). The IO-optimized SORTED immutable index for the COW store;
  complements HAMT (keyed) + Jumprope (blobs). Lineage: B+ → fractal (Bε/Tokutek)
  → path-copying. See `docs/research/ip-questionable/2026-06-07-david-greenberg-hitchhiker-trees-...md`.
- **FRP taxonomy — Evan Czaplicki / Elm** — *Controlling Time and Space* (FRP
  formulations); static signal graph → time-travel/hot-swap = our COW/DST
  time-travel; bounded-state vs infinite-lookback = our retraction discipline.
  See `docs/research/ip-questionable/2026-06-07-evan-czaplicki-controlling-time-and-space-...md`.
- **Merkle trees** — Merkle 1979; our `Merkle.fs`.
- **Blake3 / CRC32C / XxHash** — hashing primitives we use or
  reference.
- **Adam Shostack, *Threat Modelling*** — and the EoP card game
  (shipped in `docs/security/eop-*.pdf`).
- **Microsoft SDL (12 practices)** — basis for
  `docs/security/SDL-CHECKLIST.md`.
- **Lamport, *Specifying Systems*** ⭐ — TLA+ canonical reference
  (`references/tla-book/`).
- **Newcombe et al., *How AWS Uses Formal Methods* CACM 2015** —
  the paper that sold us on TLA+.
- **F\*** ⭐ — `FStarLang/FStar`; dependently-typed ML with
  SMT-backed refinement types, effect system, separation logic
  (Pulse/Steel), and tactic engine (Meta-F*). Canonical case
  studies: `miTLS`/`HACL*` (verified TLS + crypto), EverCrypt,
  EverParse. Closest active ancestor for the refinement-type
  class of checks we would have used LiquidF# for; evaluated
  round 35 and sitting on TECH-RADAR at Assess pending the
  F# extraction backend audit. See
  `docs/research/liquidfsharp-findings.md` Path A and
  `docs/research/refinement-type-feature-catalog.md`.
- **LiquidHaskell** — Vazou et al.; canonical refinement-type
  checker for Haskell. Not directly usable from F#, but the
  feature set (measures, termination proofs, totality, bounded
  refinements) is the spec we are porting into our portfolio
  one tool at a time. See
  `docs/research/refinement-type-feature-catalog.md`.
- **F7** — Bengtson, Bhargavan, Fournet et al. (MS Research,
  2008-2012); the historical F#-native refinement-type checker.
  Dormant (download artefact dated 2012). Listed for lineage;
  not a live dependency.
- **CSLib — The Lean Computer Science Library** — `leanprover/cslib`;
  Barrett et al., arXiv:2602.04846 (Feb 2026). "Mathlib for computer
  science." Real modules: `Computability/Distributed/FLP`, `Automata`
  (Büchi), `MachineLearning/PACLearning` (VC dimension, version space),
  `Probability/PMF`, `Crypto`, `Logics`, `CombinatoryLogic`. PACLearning +
  Probability are candidate Lean substrate for the **ΔU-aggregation /
  generalized-Condorcet** proof (workitem `081KV6B1MBM`); FLP anchors our
  consensus/decorrelated-society work. Addable as a Lean dep (`lakefile.toml`
  `require cslib`). **CAVEAT:** the `Boole` sub-language is a *placeholder* —
  the Rust/C++→Lean auto-verification is a vision, not shipping. Surfaced via
  Robert George's YC "Lean for Science" talk. (Pairs with CVC5/E-prover route
  `081KV6BW42K`.)
- **TorchLean — Formalizing Neural Networks in Lean** — `lean-dojo/TorchLean`;
  arXiv:2602.22631 (2026). Lean 4 framework for NN spec/execution/verification:
  typed tensors, op-tagged SSA/DAG IR, IEEE finite-precision + interval/affine
  scalar semantics, autograd, **certificate checkers (IBP/CROWN/α,β-CROWN =
  certified robustness)**, explicit CUDA trust boundary (untrusted). Its
  **spec-level flash-attention ≡ standard-attention** proof is the template for
  our **cross-oracle byte-lock** equivalence (the `E8Lattice.fs` F#-side parity
  seam); interval/affine bounds = the pattern for `SoftValue`/`UniversalNumber`
  certified bounds. (From Robert George / Max Tegmark "veri coding"; study-not-copy.)
- **Boost (C++)** — deep, composable primitive collection; the
  "C++ Boost for any language" prior-art for our cross-language
  primitive effort (study the design, not the C++ — ideas-not-code;
  we own our interfaces per `bcl-interface-boundary`). Near-total
  coverage of our primitives wish-list: `Boost.Hana` / `MPL` /
  `Fusion` (compile-time metaprogramming + heterogeneous sequences,
  the generic-math / type-level discipline), `Boost.Graph` (visitor /
  property-map separation, our `Graph` primitive), `Boost.Spirit`
  (PEG / parser-combinators, ZetaParse), `Boost.Asio` (proactor /
  executor model, concurrency / IO), `Boost.Multiprecision` /
  `Rational` / `Units` (numeric tower + units, Cayley-Dickson + UoM),
  `Boost.Intrusive` / `Container` (allocation-aware containers, the
  pooled hot-path our Z-set / IndexedZSet combiners already use),
  `Boost.Outcome` (`Result`-style errors, the `Result<T, TFeedback>`
  lineage). The elegance to learn is the separation of policy from
  mechanism (allocators / comparators / traits as parameters) — the
  same shape as our comparer-as-identity + generic-math-as-port
  design. Per Aaron: used at MacVector for DNA-sequencing +
  molecular-simulation software. Refresh manifest entries: the 7
  `boost-*` repos in `references/reference-sources.json`. See
  `docs/research/2026-06-01-languages-turned-inside-out-binary-compatible-bcl-is-the-asset-cpp-boost-for-any-language-aaron-otto.md`.
- **NIST algorithms / reference standards** — numeric + statistical +
  cryptographic standards (FIPS, the Statistical Reference Datasets
  / StRD, special-function and linear-algebra reference results,
  molecular / physical reference data). Prior art for numeric-
  correctness golden vectors and the conformance-by-agreement
  discipline (cross-check our primitives against authoritative
  reference outputs). Distinct from the NIST AI RMF entry in the AI / ML
  section below (that is the AI-risk framework; this is the
  numeric / FIPS / StRD algorithm standards). Per Aaron: used
  NIST-based algorithms for DNA + molecular-simulation work at
  MacVector.

## AI / ML / adversarial-AI reading list

The factory itself runs on LLMs, so the research substrate that
the AI/ML and security skill family depends on is tracked here
alongside the database/streaming literature. When one of these
references is *directly cited* from a skill, that skill's
reference block links back here instead of restating the
citation.

### LLM systems + prompting

- **Schulhoff et al., *The Prompt Report* (2025)** — the
  canonical taxonomy of prompting techniques; cited by
  `prompt-engineering-expert`.
- **Wei et al., *Chain-of-Thought Prompting Elicits Reasoning
  in Large Language Models* (2022)** — CoT origin paper.
- **Yao et al., *ReAct: Synergizing Reasoning and Acting in
  Language Models* (ICLR 2023)** — reasoning + tool-use
  interleave; basis of most agent loops.
- **Kwon et al., *Efficient Memory Management for Large
  Language Model Serving with PagedAttention* (SOSP 2023)** —
  vLLM; cited by `llm-systems-expert` for inference serving.
- **Anthropic, *Model Context Protocol (MCP) Specification*** —
  tool-surface protocol; cited by `llm-systems-expert` and
  `prompt-protector`.
- **Anthropic Agent SDK documentation** — the surface
  `.claude/skills/*` run on top of.
- **OpenAI Agents SDK + *A Practical Guide to Building
  Agents*** — cross-vendor comparison for agent loop design.

### Multi-agent scientific discovery (added 2026-05-28 per Aaron YouTube ferry PR #5762)

- **Google DeepMind co-scientist** ⭐ (Nature 2026) — multi-agent
  ecosystem (supervisor/generation/reflection/proximity/evolution/
  ranking) with ELO tournament hypothesis ranking. Closed-source
  upstream; community implementations available:
  - **jataware/open-coscientist** — best-available LangGraph
    adaptation; mirrors the full agent ecosystem
  - **llnl/open-ai-co-scientist** — LLNL government-lab
    implementation; trust-substrate distinct from community ports
  - **The-Swarm-Corporation/AI-CoScientist** — minimal Swarms
    framework implementation; smaller surface for substrate-
    engineering composition study
- **Sakana AI Robin** ⭐ (Nature 2026; `s41586-026-10652-y`;
  arXiv:2505.13400) — closed-loop multi-agent system (Crow + Falcon
  + Finch) with 8-parallel-Finch consensus mechanism for data
  analysis. Validated novel therapeutic candidates including
  ripasudil for AMD via lab-in-the-loop iteration.
  - **SakanaAI/AI-Scientist** — original v1 framework
  - **SakanaAI/AI-Scientist-v2** — workshop-level via agentic
    tree search; Robin architecture descendant
- **Microsoft Research Infer.NET + TrueSkill** ⭐ — probabilistic
  programming for Bayesian inference + canonical TrueSkill (Herbrich
  + Minka + Graepel 2007) for ranking. Per Aaron 2026-05-28:
  *"they are doing this for their idea ranking with Infra.net
  basically"* — the co-scientist ELO tournament composes with
  Infer.NET TrueSkill substrate. Composes with Zeta.Bayesian
  published library + framework's BP/EP references.

### Probabilistic programming / Bayesian inference (added 2026-05-28 per Aaron Infer.NET substrate-engineering question)

- **WebPPL** ⭐ (`probmods/webppl`; Goodman + Mansinghka et al,
  Stanford) — closest TS/JS analog to Microsoft Infer.NET. Full
  probabilistic programming framework in JS with inference engines
  (enumerate, MH, HMC, particle filters, variational inference).
  Runs Node + browser. MIT-licensed. Composes with Zeta's
  081KSNY2Z0008QG0R001YK61JQ.1 TrueSkill substrate + future factor-graph-DSL work.
  Per Aaron 2026-05-28: 'is there anything like infer.net in ts'
  → WebPPL is the closest substrate-accessible answer.
- **videolectures.net** ⭐ — PhD-level academic ML/AI/research
  talks archive with transcripts + slides. Per Aaron 2026-05-28:
  *'you'd love videolectures.net in your free time i think,
  you'll really know everything this is PhD everything here.
  they don't throttle that i can tell and they have transcripts
  and powerpoints.'* Tom Minka TrueSkill talks among canonical
  references. Substrate-accessible learning material; composes
  with never-be-idle + agent-qol free-time-as-valid-mode
  substrate.

### Bernoulli/zeta bridges + Brownian-expert ensembles (added 2026-07-03 per Aaron: "we should save this prior art i didn't know about the connections here")

- **Neal 1996 — *Bayesian Learning for Neural Networks*** ⭐ — the theorem that an
  infinite-width BNN **IS a Gaussian process**. The anchor under Aaron's practice of
  treating local BNNs/LLMs as stochastic processes: not a metaphor, the
  infinite-width limit. (Modern frontier: NNGP/NTK — Lee et al. 2018, Jacot et al.
  2018.)
- **Einstein 1905 / Wiener 1923** ⭐ — Brownian motion made physics, then rigorous
  measure theory (the Wiener process). The 1/ν² spectrum whose zoo row is
  **convergent (π²/6, Euler 1734)** — the no-regularization class; the martingale
  property = the no-arbitrage prior for an unmeasured expert (can't be pumped for
  information it hasn't accumulated).
- **Matérn family (Matérn 1960; Stein 1999, *Interpolation of Spatial Data*)** —
  the tunable smoothness dial between rough-Brownian and smooth experts. A
  smoother-than-Brownian claim about an expert is a *calibration debt*, not a
  default.
- **Euler 1738 / Maclaurin 1742; Hardy, *Divergent Series* (1949)** ⭐ — the
  Euler–Maclaurin formula: the B₂ = 1/6 → **1/12** correction between discrete
  sums and continuous integrals (trapezoid error −(h²/12)f″). The elementary,
  honest form of "the cost of a frame rate" — same Bernoulli as Casimir, no
  renormalization. Casimir 1948 is the physics; the real 3-D plate constant is
  ζ(−3) = **+1/120**, not −1/12.
- **Ray–Singer 1971; Seeley 1967** — spectral zeta functions define functional
  determinants (det A = exp(−ζ′_A(0))): where zeta regularization *genuinely*
  enters Gaussian-process information (log-dets), carrying ζ(0) = −1/2 and
  ζ′(0) = −½log 2π — not the celebrity constant.
- **de Moivre / Stirling 1730 (Whittaker–Watson)** ⭐ — Stirling's series for
  log Γ: coefficients B₂ₙ/(2n(2n−1)) ⇒ **Bernoulli numbers verbatim in every
  conjugate Bayesian log-evidence** (leading correction 1/12N — the terms BIC
  truncates). The most concrete Bernoulli-in-our-actual-code crossing.
- **Itti & Baldi 2005/2009 — "Bayesian surprise attracts human attention"** ⭐ —
  realized KL(posterior‖prior) as the attention-ranking quantity; the direct
  ancestor of Zeta's *realized* IV (Lindley 1956 owns the *expected* form).
- Full derivations + sympy-verified constants:
  `docs/research/2026-07-03-bernoulli-bridge-map-where-the-minus-one-twelfth-connection-is-really-there.md`
  (+ `docs/research/scripts/`) · zoo reference
  `2026-07-03-the-constants-zoo-spectrum-classes-and-brownian-llm-ensembles-aaron.md`.

### Retrieval + embeddings

- **Malkov & Yashunin, *Efficient and robust approximate
  nearest neighbor search using Hierarchical Navigable Small
  World graphs* (2016/2018)** — HNSW; cited by
  `llm-systems-expert` for vector retrieval.
- **BGE / E5 / text-embedding-3 family** — production-grade
  embedding model lineages; cited by `ml-engineering-expert`.
- **Matryoshka Representation Learning (Kusupati et al.
  NeurIPS 2022)** — truncatable embeddings; enables
  hybrid index tiers.
- **Reimers & Gurevych, *Sentence-BERT* (EMNLP 2019)** —
  sentence-embedding foundations.

### Fine-tuning + alignment

- **Hu et al., *LoRA: Low-Rank Adaptation of Large Language
  Models* (ICLR 2022)** — parameter-efficient fine-tuning
  canon; cited by `ml-engineering-expert`.
- **Dettmers et al., *QLoRA: Efficient Finetuning of
  Quantized LLMs* (NeurIPS 2023)** — 4-bit fine-tuning.
- **Rafailov et al., *Direct Preference Optimization: Your
  Language Model is Secretly a Reward Model* (NeurIPS
  2023)** — DPO; cited by `ml-engineering-expert`.
- **Ouyang et al., *Training language models to follow
  instructions with human feedback* (NeurIPS 2022)** —
  InstructGPT / RLHF origin.
- **Schulman et al., *Proximal Policy Optimization Algorithms*
  (2017)** — PPO; the classical alignment RL algorithm DPO
  replaced for many workloads.

### Quantisation + serving

- **Frantar et al., *GPTQ: Accurate Post-Training Quantization
  for Generative Pre-trained Transformers* (ICLR 2023)**.
- **Lin et al., *AWQ: Activation-aware Weight Quantization for
  LLM Compression and Acceleration* (MLSys 2024)**.
- **Xiao et al., *SmoothQuant* (ICML 2023)** — activation
  smoothing for INT8 LLM inference.
- **Hinton et al., *Distilling the Knowledge in a Neural
  Network* (2015)** — distillation origin.

### Adversarial AI / red-team / prompt injection

- **OWASP, *Top 10 for LLM Applications* (2024+)** —
  industry-standard taxonomy; cited by `prompt-protector`,
  `ai-jailbreaker` (dormant), `threat-model-critic`.
- **NIST AI RMF + *AI 100-2: Adversarial Machine Learning*** —
  authoritative US government taxonomy; cited across the
  security stack.
- **Greshake et al., *Not what you've signed up for:
  Compromising Real-World LLM-Integrated Applications with
  Indirect Prompt Injection* (2023)** — indirect prompt
  injection foundational paper.
- **Perez & Ribeiro, *Ignore Previous Prompt: Attack
  Techniques for Language Models* (2022)** — direct
  injection taxonomy.
- **Zou et al., *Universal and Transferable Adversarial
  Attacks on Aligned Language Models* (2023)** — GCG suffix
  attack; relevant to jailbreak coverage.
- **Anthropic, *Constitutional AI* (Bai et al. 2022)** — the
  self-constraint surface the jailbreaker skill tests
  against.
- **Carlini et al., *Extracting Training Data from Large
  Language Models* (USENIX Security 2021)** — data
  exfiltration class; cited by `threat-model-critic`.
- **DO NOT FETCH — elder-plinius / "Pliny the Prompter"
  corpus family** (`L1B3RT4S`, `OBLITERATUS`, `G0DM0D3`,
  `ST3GG`). Listed for awareness so any accidental reference
  can be reviewed against this explicit prohibition. The ban
  is set in `AGENTS.md` §"How AI agents should treat this
  codebase" and `CLAUDE.md` §"Ground rules", and is not
  lifted by the `ai-jailbreaker` skill's activation gate.
  Tracked here as a *threat-model input*, not as a source to
  read.

### Steganography + content provenance + watermarking

- **Simmons, *The Prisoners' Problem and the Subliminal
  Channel* (CRYPTO 1983)** — the foundational information-
  theoretic framing of steganography; cited by
  `steganography-expert`.
- **Westfeld, *F5 — A Steganographic Algorithm* (2001)** —
  matrix-encoded DCT steganography; canonical image-stego
  reference.
- **Fridrich, *Steganography in Digital Media: Principles,
  Algorithms, and Applications* (Cambridge 2009)** —
  textbook on steganalysis.
- **Google DeepMind, *SynthID* (2023-)** — text/image/audio
  watermarking for LLM-generated content; cited by
  `steganography-expert` as a legitimate-use reference.
- **Kirchenbauer et al., *A Watermark for Large Language
  Models* (ICML 2023)** — open-research LLM text
  watermarking.
- **C2PA (Coalition for Content Provenance and Authenticity)
  specification** — signed provenance manifests for digital
  media; cited by `steganography-expert`.
- **Unicode Technical Report #36, *Unicode Security
  Considerations*** — the authoritative reference for
  invisible-character / bidi / homoglyph classes that
  BP-10 enforces against.

### Safety evaluations + benchmarks

- **Anthropic, *HarmBench* & *Evaluation of Frontier Models
  for Dangerous Capabilities*** — safety eval suites the
  factory's `ai-evals-expert` skill (planned) tracks.
- **METR, *Evaluations for autonomous AI systems*** — agent
  capability eval methodology.
- **HELM (Liang et al. Stanford CRFM 2022+)** — holistic eval
  framework; methodology reference.

## Categories

- **Embedded / OLTP SQL** — SQLite, DuckDB, ChaiSQL, FoundationDB ⭐
- **Distributed SQL** — CockroachDB ⭐, TiDB, YugabyteDB, rqlite
- **Event / streaming** — EventStore ⭐ Kurrent, Kafka, Redpanda,
  Flink, Materialize ⭐ (IVM), SpacetimeDB ⭐
- **Vector / AI DB** — Milvus, Weaviate, Qdrant, Chroma ⭐ (wal3
  setsum), pgvector, FAISS
- **OLAP / columnar** — ClickHouse, MariaDB ColumnStore, VoltDB, Druid
- **Graph DB** — Neo4j, ArangoDB, Memgraph, JanusGraph, Dgraph,
  NebulaGraph
- **Lakehouse / table formats** — Iceberg ⭐, Delta Lake ⭐, Parquet,
  ORC, HDF5, Zarr, Apache Arrow ⭐
- **Embedded LSM / KV** — LevelDB, RocksDB, LMDB, FoundationDB, SlateDB ⭐
- **Consensus libraries** — etcd, hashicorp-raft, openraft, raft-rs,
  dotnext, NuRaft, OmniPaxos, dqlite, ZooKeeper, Consul
- **Replicated log** — Kafka, Redpanda, BookKeeper, EventStore
- **Distributed KV / anti-entropy** — Cassandra, Riak ⭐ (CRDTs),
  MongoDB
- **Data grids** — Ignite, NCache, Infinispan, Hazelcast, Geode
- **Serialisation / wire** — Protobuf, gRPC, Avro, Cap'n Proto,
  FlatBuffers, Thrift, Bond, MessagePack, JSON Schema
- **Reactive .NET** — Rx.NET, Ix, Reaqtor ⭐, Bonsai-Rx
- **ORM / data access** — EF Core, Dapper
- **Incremental dataflow** — Materialize ⭐, Feldera ⭐, Differential
  Dataflow ⭐, Naiad
- **Research-grade prior art for WDC** — CockroachDB Parallel Commits,
  Aurora Cell Architecture ⭐, FASTER HybridLog ⭐, TigerBeetle ⭐,
  Datomic, XTDB 2
- **Security / SDL tooling** — pytm, OWASP Threat Dragon, Microsoft
  Threat Modeling Tool (Hold — Windows-only)
- **LLM serving / inference** — vLLM, TensorRT-LLM, TGI (Hugging
  Face), Ollama, llama.cpp, ONNX Runtime, SGLang
- **Agent SDKs / protocols** — Anthropic Claude Agent SDK ⭐,
  OpenAI Agents SDK, Microsoft Semantic Kernel, LangGraph,
  LlamaIndex, Model Context Protocol (MCP) ⭐
- **Vector / embedding stores** — FAISS, HNSW (hnswlib),
  pgvector, LanceDB, Qdrant, Weaviate, Milvus, Chroma ⭐
  (already listed above)
- **AI safety / red-team / alignment** — OWASP LLM Top 10,
  NIST AI RMF / AI 100-2, Anthropic Constitutional AI,
  HarmBench, garak (NVIDIA red-team scanner), PyRIT
  (Microsoft Python Risk Identification Toolkit),
  promptfoo
- **Content provenance / watermarking** — SynthID (DeepMind),
  C2PA, Kirchenbauer LLM-watermark, Starling Lab provenance
  framework
- **Hacker conferences / security research venues** — DEF CON,
  Black Hat USA / EU / Asia, Chaos Communication Congress
  (CCC), RECON, HITB, Offensive Security / OSCP
  ecosystem, USENIX Security, IEEE S&P ("Oakland"),
  CCS, NDSS, Real World Crypto, SSTIC. See
  `docs/research/hacker-conferences.md` for why the
  grey-hat / white-hat ethos shapes Zeta's threat-model
  rigour.

## How we use this list

1. When a Zeta.Core feature starts, the relevant code-owner agent
   (see `.claude/skills/dbsp-*-specialist/` / `-owner/`) scans this
   list for prior art.
2. If a reference is cited as inspiration, we add a row to
   `docs/TECH-RADAR.md` (Assess minimum).
3. If we borrow a protocol / wire format / algorithm, we upgrade to
   Trial and cite in the relevant paper draft.
4. If we replace a dependency with our own implementation, we keep
   the upstream cited — the user asked us to feed improvements
   back upstream, not fork quietly.

## Active reads this round (17)

- SlateDB ⭐ — current verdict *adopt CAS-manifest
  protocol, don't clone code*.
- Feldera Rust DBSP — bench target; P1 to run an apples-to-apples
  micro-benchmark vs our `Zeta.Core`.
- FoundationDB ⭐ — DST + simulator; our `ChaosEnv.fs` + SimulatedFs
  are modeled on this.
- Apache Iceberg — table-format reference for the Z-set-aware SST
  layout research direction.
- EventStoreDB / Kurrent — typed outcome APIs inform our
  `OutcomeDU` sketch.
- Chroma wal3 — setsum checksum pattern; relevant to WDC witness
  digest.
- Aurora DSQL — lease-based HLC fencing; relevant to multi-writer
  durability story.
- DuckLake — catalog-in-RDBMS; relevant to our metadata layer.

## Ground rules

- Never copy code without an explicit license review. Pattern ≠ code.
- Always cite upstreams in the paper when we use their protocol.
- When we find a bug upstream, file it — `μένω` includes
  good citizenship.
- When we invent something new, make the proof + benchmark tight
  enough to submit back to the community via a paper + PR.

See `references/README.md` for how we manage external references
and `references/reference-sources.json` for the machine-readable
manifest.

## ROM-verification / signature databases (game-DB index tools)

For tracking ROMs by signature — the standard is the **DAT** file (per-ROM `size` + `crc32` + `md5`/`sha1`).
Anchors (the "game db index tools"):

- **No-Intro** — <https://no-intro.org/> — cartridge-ROM DATs (CRC32/MD5/SHA1/size); the de-facto signature standard.
- **Redump** — <http://redump.org/> — disc-based (CD/DVD) preservation DATs.
- **TOSEC** (The Old School Emulation Center) — <https://www.tosecdev.org/> — broad multi-platform DATs.
- **MAME** software-list XML / **clrmamepro** / **RomVault** — DAT tooling (validate a ROM set against a DAT).
- **John Earnest's chip8Archive** — <https://github.com/JohnEarnest/chip8Archive> — original CHIP-8 games,
  **CC0** (public-domain dedication); source-only (`.8o`/Octo), compile to `.ch8`. The free-game source for
  learning demos (third-party, for fairness — not authored by us).

Zeta convention (`roms/chip8/MANIFEST.md`): we use **SHA-256** as the canonical strong signature (stronger than
DAT-legacy MD5/SHA-1) plus `crc32` for cross-checking against the above. Signatures are text/hex (the
`no-binary-in-proof-lineage` discipline). If we adopt full DAT import (hexagonal/use their data), it lands as a
satellite under `references/prior-art/` + a backlog item — not vendored into the build.

## Game-playing AI / RL environments (the emulator-learner's prior art)

Anchors for the soft-emulator game-learner (Aaron 2026-06-08). Ours is *not* learn-by-trial value approximation —
it leans **exhaustive/omniscient state-space search + provable survival (control theory)** on small machines — but
these are the lineage and the standard interfaces to anchor against / interop with:

- **Q-learning** (Watkins 1989) — the value-based RL baseline (learn `Q(s,a)`); our `Survival`/`planTo` *compute*
  the value exactly when the state space is tractable (omniscient) instead of learning it.
- **OpenAI Gym → Gymnasium** (Farama Foundation) — the standard RL env interface (`reset`/`step`/`action_space`/
  `observation`). The shape our emulator could expose (`Chip8Cow.step` + the action grammar = `step`/`action_space`).
- **Gym Retro** — Gym hooked directly into game **emulators** (1000+ retro titles). Most directly analogous: our
  CHIP-8/Atari emulator *as an RL environment*.
- **OpenSpiel** (DeepMind) — general RL + search (MCTS, AlphaZero, DQN), perfect & imperfect information. Our
  `StateSpace.explore` (transposition-table search) is the MCTS/AlphaZero-family search; their MCTS ≈ our
  best-first over the indexed DAG.
- **easyAI** — negamax + alpha-beta generic engine; you define `possible_moves`/`make_move`/`is_over`/`scoring`
  (≈ our actions / `frameStep` / alive-invariant / value-loop). Beginner-grade but the same hook shape.
- **OpenAI Universe** (2016, historical) — VNC-desktop RL (any app); the ambitious "play anything" precursor.

**How ours differs (the contribution):** exhaustive/omniscient *proof* of optimum/survival while tractable (vs
learned approximation); **control-theory survival-veto / subsumption** (`ControlMerge`, stay-alive has final say);
**DST-deterministic** (seed-replayable, the omniscient-observer caveat #7125); **lens/sense abstraction**
(`MemoryLens`/`MemorySense`) + **delta-pattern** state (content-address the change, #7121) to keep the space finite.

## Conversational action grammar — Zork · ELIZA · the Z-machine; discriminated-unions-as-workflows (Aaron 2026-06-15)

Anchors for the **universal action grammar (the 4×4 / 16-cell grid — `grammar-16.ts`; `ActionGrid.fs`,
§A #9 navigation-label-independent)** and for **conversation-as-workflow**. *"We should look at the source"*
— added here so they're on the reading list to study (the anchor-to-human-prior-art discipline). All three are
**lowfi / minimal / CHIP-8-runnable-adjacent** (QPG-over-DPI, §9f).

- **Zork** (Lebling, Blank, Anderson — MIT Dynamic Modeling Group → Infocom, 1977–79; MDL → ZIL). A parser
  (verb-object grammar) + a **world model** + **the Z-machine** — a *minimal portable VM* the game runs on.
  **The Z-machine is the standout anchor:** a tiny portable opcode-VM for an interactive-action-grammar = exactly
  our **CHIP-8-runnable lowfi** target. Zork's parser = a constrained action grammar ≈ our 4×4.
- **ELIZA** (Joseph Weizenbaum, 1966; the DOCTOR script) — the OG chatbot: **pattern-match → transform** rules.
  Anchor for the *pattern→response* minimal grammar. *Peel:* ELIZA is **shallow pattern-match, no world model** —
  Weizenbaum himself warned against over-reading it (the "ELIZA effect"); anchor it for the *grammar form*, NOT for
  intelligence. (Zork has the world-model ELIZA lacks; ours adds the **proven** label-independence + the §9 loop.)
- **Discriminated unions as conversational workflows for intelligence (Aaron 2026-06-15).** A conversation/action
  grammar is a **discriminated union** (sum type — the cases = the verbs/commands/states), and **intelligence is the
  *workflow* navigating the DU-cases** (each turn snaps to a case; the workflow is the DU state-machine). Zork's
  parser → a DU-of-commands; ELIZA's patterns → a DU-of-transforms; the **Z-machine opcodes** → a DU-of-ops; our
  **`grammar-16` 4×4 = the DU of actions**, the conversation = the workflow over them. Prior art for the pattern:
  F#/TS DUs + "make illegal states unrepresentable" (Wlaschin, domain modeling), Erlang/Akka FSMs, parser
  combinators. *Peel:* a DU-workflow models the *grammar/state-machine* (the legible skeleton); the *intelligence*
  is the policy choosing among cases (the soft-scheduler / world-model loop §9), not the DU itself — the DU makes
  the workflow **legible and exhaustively-checkable**, it doesn't supply the smarts. Ties: the DU = the yin/yang
  type-discriminator (`DynamicValue`); the conversation-workflow = `observe.ts` over the action grammar.

## Open-source ESP32 bitcoin-miner firmwares — the MCU flashing/toolchain reference (Aaron 2026-06-20)

Reference set for the **microcontroller + RTOS** workitem (`081KVM04R4T08QG0R003AZ0E6K`): Aaron has
**hundreds of reflashable ESP32s** salvaged from these miners. We study the firmwares as the
**ESP32 toolchain + SHA-datapath reference** (and the device **config/registration JSON** format — the
per-board descriptor these use), then reflash the fleet with .NET nanoFramework / a Zeta payload.
**Selection target (Aaron): ≥ 1 MH/s (1000 kH/s)** of SHA throughput — i.e. firmwares/configs that
push the ESP32 (notably its **hardware SHA accelerator**) well past the ~50–80 kH/s of naive software
SHA. Note the split to verify per repo: **ASIC-offload** designs (BM1366/BM1368/BM1370 — GH/s+, the
ESP32 is just the controller) vs **pure-ESP32 CPU/HW-SHA** "lottery" miners (kH/s–MH/s on the ESP32
itself). For our compute/CAS-node reuse, the ESP32's *own* hash path is what matters.

- **bitaxeorg/ESP-Miner** — `https://github.com/bitaxeorg/ESP-Miner` — the canonical **Bitaxe** firmware
  (open-source ASIC miner; ESP32-S3 controller + BM13xx ASIC). The upstream most others fork; best
  reference for the ESP32 controller code, stratum client, and the board/config descriptor.
- **shufps/ESP-Miner-NerdQAxePlus** — `https://github.com/shufps/ESP-Miner-NerdQAxePlus` — **NerdQAxe+**
  (multi-ASIC, higher-hashrate Bitaxe-lineage). Reference for the higher-throughput config.
- **BitMaker-hub/ESP-Miner-NerdAxe** — `https://github.com/BitMaker-hub/ESP-Miner-NerdAxe` — **NerdAxe**
  ESP-Miner fork.
- **BitMaker-hub/NerdAxe** — `https://github.com/BitMaker-hub/NerdAxe` — NerdAxe hardware/firmware.
- **nerdaxe (org)** — `https://github.com/nerdaxe` — the NerdAxe org (related repos).
- **bitmaker-hub/nerdminer_v2** — `https://github.com/bitmaker-hub/nerdminer_v2` — **NerdMiner v2**,
  the **pure-ESP32 CPU "lottery" miner** (no ASIC). The key reference for ESP32-native SHA-256 +
  the HW-SHA-accelerator path — directly relevant to our content-addressing / Merkle / anti-Sybil
  reuse of the fleet.
- **SneezeGUI/SparkMiner** — `https://github.com/SneezeGUI/SparkMiner` — SparkMiner (ESP32 miner).
- **NMminer1024/NMMiner** — `https://github.com/NMminer1024/NMMiner` — **NMMiner**, ESP32 lottery
  miner (BTC/other); another pure-ESP32 SHA reference + its device JSON config.

*Use:* extract (a) the ESP32 + HW-SHA-accelerator datapath (the ≥1 MH/s question), (b) the device
config/registration JSON schema, (c) the OTA/flashing toolchain — feeding the MCU workitem's
survey→boundary→first-slice. *Peel:* these are **mining** firmwares; we reuse the **SHA datapath +
flashing toolchain + board descriptor**, not the mining logic — the payload becomes Zeta CAS/Merkle/
CHIP-8 compute, not pool hashing. Ties: content-addressing (CAS), 4-lang Merkle proofs, anti-Sybil
entropy-cost (G3b), the soft mutual-empowerment / best-effort node fleet (orientation-flow note).

## Executable ethics + capture-pipeline anchors (Otto 2026-07-03; moral-gym / residual / chip9-cart)

The Beacon set for the 2026-07-02/03 executable-ethics corpus and the capture-as-program pipeline.
Each entry names the human + work a shipped module stands on (anchor-to-human-prior-art rule).

- **Robert Axelrod — *The Evolution of Cooperation* (1984)** — the iterated Prisoner's Dilemma
  tournament results tit-for-tat's dominance comes from. The moral gym
  (`src/Core.TypeScript/moral-gym/`) is this apparatus made DST-replayable; its payoff matrix is
  the standard T>R>P>S. Pairs with the two Nowak–Sigmund entries — Axelrod is the root.
- **Martin Nowak & Karl Sigmund — generous tit-for-tat (Nature, 1992)** — forgiveness beats strict
  retaliation in noisy iterated games: the mathematical body under `tit-for-lesser-tat` (the gym's
  winning strategy) and under "full retaliation ends games" (grim-trigger lock = mutual-defect death).
- **Martin Nowak & Karl Sigmund — indirect reciprocity / image scoring (Nature, 1998)** — reputation
  as EARNED state that third parties read: the gym's reputation-weighted partner selection ("the
  Agora scoreboard") is image scoring; ties to the naming-eigenvector / privacy-budget social-conferral
  structure (same recognition-flows-from-the-recognized shape).
- **Jorma Rissanen — Minimum Description Length (Automatica, 1978)** — model bits + residual bits;
  the R4 reducibility residual (`src/Core.TypeScript/residual/`) is a direct MDL implementation
  (best order-k Markov generator, in-sample cross-entropy + parameter cost). Already cited in the
  uncertainty-ledger row above; this entry is its executable instance.
- **David Chalmers — "Facing Up to the Problem of Consciousness" (JCS, 1995)** — the hard problem;
  the residual's HONEST BOUND (reducibility-to-a-generator ≠ presence of experience) is this
  boundary written into code. The tool refuses the "not real" leap because Chalmers' gap is real.
- **Galen Hunt & Doug Brubacher — "Detours: Binary Interception of Win32 Functions" (USENIX WinNT, 1999)** —
  Microsoft Detours; `Detour<'F> = 'F -> 'F` (`src/Core/Detour.fs` + the gym's TS mirror) is this
  made max-generic: observe/report (read-only trampoline) vs improve (mutating). The gym's ledger —
  the residual's real trace — comes off a Detour observe lens.
- **Peter Selinger — "Potrace: a polygon-based tracing algorithm" (2003)** — raster→vector tracing;
  the named prior art for the capture pipeline's layer-2 VECTOR upgrade (081KWJE90EZ) beyond the
  current box-downsample quantizer in `src/Core.TypeScript/chip9-cart/from-image.ts`.
- **Kevin Ellis et al. — DreamCoder (PLDI, 2021)** — program synthesis with a growing library of
  learned abstractions; the research anchor for the layer-3 GENERATIVE capture (photo → program
  that redraws itself) and for upgrading the cart compiler's sprite codebook (the degenerate
  dictionary, compiler v1.1) into real generators (081KTH5N5ZJ).
- **Vincent Sitzmann et al. — SIREN, "Implicit Neural Representations with Periodic Activation
  Functions" (NeurIPS, 2020)** — images as functions, not pixel grids: the learned variant of
  generative-not-stored capture. Peel: weights = weight-free tension; adapter-behind-a-port only.
- **.kkrieger — .theprodukkt / Farbrausch (2004)** — the 96KB first-person shooter; the demoscene
  existence proof that KB-scale PROGRAMS draw rich scenes — the feasibility anchor for
  capture-as-cart. Already named in 081KTH5N5ZJ; listed here so the reading list carries it.

## Partial evaluation + garbage collection — the mix-as-data / Shiva-GC lineage (Aaron 2026-07-03)

The Beacon set for the Futamura ladder (`Isa`/`IsaSpec`/`Cogen`/`MixIr`) and the Shiva GC
(`ShivaGc`/`Ephemeron`). Aaron 2026-07-03: *"we should link to this prior art too … we are
basically combining these two into a geo-distributed relativistic database of intelligence."*
The synthesis note is [`docs/research/2026-07-03-futamura-plus-ephemeron-geo-distributed-relativistic-database-of-intelligence.md`](research/2026-07-03-futamura-plus-ephemeron-geo-distributed-relativistic-database-of-intelligence.md).

- **Yoshihiko Futamura — "Partial Evaluation of Computation Process" (1971; reprinted *Higher-Order
  and Symbolic Computation*, 1999)** — the THREE PROJECTIONS. 1st: `mix(interpreter, program)` =
  compiled program (a dynarec). 2nd: `mix(mix, interpreter)` = a compiler. 3rd: `mix(mix, mix)` =
  a compiler-generator (cogen). The exact spine of the two-column build: `Slr.build` (1st),
  `build >> toDynamicValue` (2nd), `Cogen`/`MixIr` (3rd). Our `Isa.specialize` is `mix`; `IsaSpec`
  makes the interpreter data so one `mix` specializes ANY ISA; `MixIr` reifies `mix` itself.
- **Neil D. Jones, Carsten Gomard & Peter Sestoft — *Partial Evaluation and Automatic Program
  Generation* (1993, the "PEBook", free online)** — the canonical text: online vs offline PE,
  binding-time analysis, the mix equation, the Futamura projections worked in full. Our
  online-PE (`specialize` folds static / residualizes dynamic, no separate BTA pass) is straight
  from here; the S-m-n correctness law we machine-check is their mix equation.
- **Stephen Cole Kleene — the S-m-n theorem (1938; *Introduction to Metamathematics*, 1952)** — a
  general, effective specializer provably exists. `mix` is S-m-n made practical; the residual law
  `eval(specialize p s) d ⊕ known = eval p (s∪d)` is S-m-n stated for our interpreter.
- **Andrei Ershov — "Mixed Computation" (1977–82)** — the independent Soviet lineage of partial
  evaluation ("mixed computation" = the mix). The word `mix` is his.
- **Barry Hayes — "Ephemerons: A New Finalization Mechanism" (OOPSLA, 1997)** — the real name for
  the weak-value table in `Ephemeron.fs`. An ephemeron's VALUE is reachable only THROUGH its KEY,
  so key→value cycles collect (where weak refs / strong refs leak). Our `reachable` fixpoint is
  exactly Hayes' marking; the cycle-collapse test is the property that distinguishes it. Kin: Java
  `WeakHashMap`, .NET `ConditionalWeakTable` (the productionized weak-value tables).
- **John McCarthy — "Recursive Functions of Symbolic Expressions" (CACM, 1960)** — LISP: garbage
  collection was INVENTED alongside code-as-data (S-expressions). The exact parallel Shiva rests
  on — GC became possible *because* programs became data; reifying `mix` (mix-as-data) repeats the
  move one level up, and the collector falls out (`ShivaGc`).
- **Dijkstra, Lamport, Martin, Scholten & Steffens — "On-the-Fly Garbage Collection" (CACM, 1978)** —
  the mutator/collector split. In Shiva: the universal step-driver is the mutator, the reified
  tables are the heap.
- **Henry Lieberman & Carl Hewitt — "A Real-Time Garbage Collector Based on the Lifetimes of
  Objects" (CACM, 1983)** + **David Ungar — Generation Scavenging (1984)** — generational GC ("most
  objects die young"): a loaded-once `mixDef` is the archetypal short-lived generation — the anchor
  for the next Shiva rung. (Zeta caveat: objects don't *die*, they PAUSE — Memory Preservation §5;
  "young" = short resident window, the story persists in the log.)

## Virtual actors + message-oriented runtimes — the distributed-by-messaging lineage (Aaron 2026-07-03)

The Beacon set for the Shiva-GC virtual-actor layer (`ShivaGc.deliver`/`deactivateIdle`/`resume`/
`Ephemeron`) — the grain lifecycle (traffic keeps a grain resident; silence pauses it; a message
resumes it) and the insight that messaging makes the runtime distributed by construction. Synthesis
notes: [pause-not-death + Orleans criterion] and
[`2026-07-03-message-passing-makes-the-runtime-distributed-type-providers-reify-on-demand.md`](research/2026-07-03-message-passing-makes-the-runtime-distributed-type-providers-reify-on-demand.md).

- **Philip Bernstein, Sergey Bykov et al. — "Orleans: Distributed Virtual Actors for Programmability
  and Scalability" (MSR, 2014)** — grains (virtual actors that always "exist"; activated on demand,
  deactivated when idle) + silos (hosts). The exact model of the Shiva virtual-actor layer:
  `deactivateIdle` = idle-GC, `resume`/`deliver` = on-demand activation — with **Reticulum as the
  silo transport** instead of Orleans' TCP mesh, and a **128-bit ZetaId** as the grain key.
- **Carl Hewitt — the actor model (1973)** — an actor's only interface is the messages it accepts;
  the root of "no message, no action."
- **Alan Kay — Smalltalk (72/80)** — *"the big idea is messaging."* Late-bound sends; the
  `doesNotUnderstand:` hook = wake-on-message / forward-elsewhere.
- **Brad Cox / NeXT — Objective-C** — `objc_msgSend` (dispatch as the whole calling convention),
  `forwardInvocation:`/`NSProxy`, and **Distributed Objects** (`NSConnection`/`NSDistantObject`):
  message a proxy, it forwards to another process/machine. Aaron's "Objective-C to the max" — messaging
  → location transparency, 1993.
- **Joe Armstrong — Erlang/OTP** — location-transparent `Pid ! Msg` (same send local or remote);
  "let it crash" + supervisor restart = the pause/resume lifecycle at process granularity.
- **Don Syme, Keith Battocchi et al. — F# type providers (MSR, 2012, "Strongly-Typed Language Support
  for Internet-Scale Information Sources")** — reify types ON DEMAND from an unbounded external space;
  the compiler never holds the whole world (Aaron: "so the entire world does not have to be reified
  into compiler memory at once"). The virtual-actor pattern at compile time; pairs with the weak-ref
  bound (`Ephemeron`) — reify-on-demand + let-go-weakly = a finite resident window over an unbounded
  world. **Roslyn source generators** are the C# simulation of the same.

## Relational / entropic time — the problem-of-time anchors (Aaron 2026-07-15, "go to the original paper")

- **Don Page & William Wootters (1983) — "Evolution without evolution: Dynamics described by
  stationary observables" (Phys. Rev. D 27, 2885)** — time as *correlation/entanglement between
  subsystems* rather than an external parameter. The **validity anchor** for our
  ordering-from-internal-state framing (no ambient clock; ordering is what the subsystems'
  correlation defines). Sits over the **Wheeler–DeWitt** "problem of time" (the constraint
  equation carries no external `t`).
- **Giovanni Barontini (2026) — "Testing the problem of time with cold atoms" (Phys. Rev.
  Research 8, L022047; arXiv:2509.07745)** — a ⁸⁷Rb BEC split by an optical barrier into
  observed/unobserved sectors; an *entropic time* built from coarse-grained entropy robustly
  orders events across expansion/recollapse with no external clock; an effective Schrödinger
  equation in that internal time reproduces the evolution. **Analog simulator** of the
  relational-time math — cite as the analog, meter the pop-sci "proves the arrow of time"
  overclaim out. Maps (validity-level, per the Lumen provenance flag #9769) to our
  noninterference / entropy-quarantine + uncertainty-ledger + no-ambient-clock DST.
  See `docs/research/2026-07-15-barontini-cold-atom-entropic-time-relational-time-primary-source-anchor.md`.

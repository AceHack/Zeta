# Prior-Art Reference List

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
  _Don't Fear the Monad_ + the Rx/category-theory + quaternions/physics-from-structure
  talks. The derive-the-physics-from-the-math-structure style (Rx → Cayley–Dickson →
  spinor/qubit "fell out of the Rx structure"). Pairs with De Smet (`IQbservable`) + Meijer.
- **Horst Schubert — prime decomposition of knots (1949)** — _Die eindeutige
  Zerlegbarkeit eines Knotens in Primknoten_: every knot factors UNIQUELY into prime
  knots under connected sum — the fundamental theorem of arithmetic with SHAPES as the
  primes. The exact Beacon body for Aaron's "our prime numbers are shapes; we don't
  need numbers, just some ordering system" (2026-07-02): the braided shape catalog's
  atom row (crossing.lines — "everything braided is a word in this one generator")
  is the same stance; Ihara's zeta (graph primes = primitive closed cycles) extends
  it to the project's own name. Pairs with only-the-irreducible-is-primitive (the
  rule is unique factorization stated categorically) and the braid/adinkra family.
- **S. James Gates Jr. — SUSY adinkra error-correcting codes** — doubly-even self-dual
  linear binary block codes found _inside_ the adinkras of supersymmetry ("codes in the
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
  (Aaron 2026-06-10): (a) _universal interfaces_ — devices/services expose typed,
  XML-introspectable interfaces (methods/signals/properties, D-Bus-descended — also
  anchors `universal/bus`) that any peer discovers and consumes regardless of
  vendor/transport — the IoT interoperability dream, ours generalized to
  travelers/personas; (b) _the mesh_ — infrastructureless, transport-agnostic
  (Wi-Fi/BT), proximal D2D bus with no cloud/broker — the Reticulum shape a decade
  earlier. Lesson carried: AllJoyn died of consortium fragmentation (AllSeen vs
  OCF) — the format-war lesson (zetamax doc): be open AND better, or be Betamax.
- **Signature files, and the over-including filter family** — **Christos
  Faloutsos & Stavros Christodoulakis**, _Signature Files: An Access Method for
  Documents and Its Analytical Performance Evaluation_ (ACM TOIS 2(4), 1984):
  superimposed coding, **false drops permitted**, resolved by a verification pass
  they named _false-drop resolution_. This — not the inverted file — is the
  tradition our signature index belongs to, because the property we buy is a
  **soundness direction** (never a false negative, therefore never a false zero)
  rather than precision. Signature files _lost_ to inverted files in the 1990s on
  scan cost; why that verdict does not bind a 271 MiB local git corpus with a
  measured 0.05% candidate set is argued in
  `docs/research/2026-08-23-signature-index-*.md` §9. Family: **Burton Bloom**,
  _Space/Time Trade-offs in Hash Coding with Allowable Errors_ (CACM 13(7), 1970)
  — the canonical false-positive-only filter; **Jack Orenstein**, SIGMOD 1986 —
  **filter-and-refine** in spatial databases, the same soundness direction with a
  bounding box.
- **Consonant-skeleton keys** — **Russell & Odell**, Soundex (US patent 1,261,167,
  1918); **Lawrence Philips**, Metaphone (1990) / Double Metaphone (2000). Older
  lineage: **abjad** scripts (Hebrew, Arabic) and Semitic consonantal roots, where
  the consonant skeleton carries the lexeme and the vowels inflect it. Vowel
  dropping is old and principled, not a coinage. **Checked, and Soundex's
  keep-the-first-letter rule was DECLINED**: measured on our corpus it moves
  unique-key from 93.0% to 94.4%, which does not pay for the special case — it is
  a claim about English surnames, and this corpus is code and technical prose.
- **Corpus-derived spelling correction** — **Fred Damerau** (CACM 7(3), 1964) and
  **Vladimir Levenshtein** (1966) for the edit model, Damerau specifically because
  **transposition** is the typo class a consonant skeleton already absorbs;
  **Peter Norvig**, _How to Write a Spelling Corrector_ (2007) for frequency from
  the corpus rather than a dictionary — the constraint Aaron insisted on, because
  a general dictionary "corrects" `ZSet`→`Set`, `argv`→`argue`, `DBSP`→`DBS`;
  **Wolf Garbe**, SymSpell, for deletion-neighbourhood lookup _if_ naive candidate
  generation proves too slow (measure first — an unnecessary optimisation is its
  own debt).
- **Code search is the same cascade with a different signature** — **Russ Cox**,
  _Regular Expression Matching with a Trigram Index_ (2012), the design behind
  Google Code Search: query trigrams filter candidate documents, then **a real
  regex engine verifies**; **`zoekt`** (Han-Wen Nienhuys), which Sourcegraph runs.
  The load-bearing fact is that this tradition **converged independently** on the
  same two-tier structure with an order-preserving `sig`, which is evidence the
  abstraction is real rather than a tidy story told afterwards.
- **Florian Deißenböck & Markus Pizka**, _Concise and Consistent Naming_ (IWPC
  2005; Software Quality Journal 14(3), 2006) — identifier naming formalised as
  **one concept, one name** (no synonyms) and **one name, one concept** (no
  homonyms). The model behind the variable-name registry: once names carry
  definitions, a name recurring across dozens of files under one definition is a
  detectable **un-extracted constant or shared library**, not merely untidy
  vocabulary. Adjacent: Arnaoudova et al. on linguistic antipatterns.
- **Apache Lucene** — **Doug Cutting**, first released 1999; Apache project since 2001. The inverted-file literature below tells you the data structure; Lucene
  tells you which parts bite at scale, because it has been forced to solve them
  for real for two decades — **Apache Solr** and **Elasticsearch** are both built
  _on_ it, which is the load-bearing fact. Read before committing to an index
  layout: immutable segments + tiered merge (how a changing corpus stays cheap to
  update), term dictionary separated from postings, and deletions as **tombstones
  rather than in-place edits** — the same shape as a Z-set retraction, arrived at
  independently. Our `src/Core.TypeScript/search/inverted/` takes the segment
  placement, the dictionary/postings split and `WordDelimiterGraphFilter`, and
  **diverges on binary segments**: we need reviewable text diffs, byte-identical
  rebuilds and no daemon, none of which Lucene optimises for. The divergence is
  recorded with its reason in that directory's README.
- **Inverted files (the IR spine)** — **Gerard Salton**, the SMART system
  (Cornell, 1960s–70s), for the analysis→postings pipeline; **Justin Zobel &
  Alistair Moffat**, _Inverted Files for Text Search Engines_, ACM Computing
  Surveys 38(2), 2006 — the canonical survey of the postings/compression
  tradeoffs, and the reference for why the size decisions in our index are
  measured rather than guessed; **Christopher Manning, Prabhakar Raghavan &
  Hinrich Schütze**, _Introduction to Information Retrieval_, CUP 2008 — §2.2
  tokenisation and stop lists (our hand list _and_ the statistical df cap are
  both from here), §2.4 **positional and biword indexes**, which is the index
  type our term index deliberately is **not** (081M0QWDDDV087G0R003HM0KYX).
- **DBSP / IVM** ⭐ — Budiu et al. _DBSP: Automatic Incremental View
  Maintenance for Rich Query Languages_ (VLDB 2023); VLDB Journal
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
  probabilistic **Lisp/Scheme**: the closest prior art to the _soft /
  probabilistic DynamicValue_ (homoiconic + first-class inference). The
  direction for "ambiguous tags that carry a distribution and resolve by
  context like English" (stochastic λ-calculus with Bayesian updating over the
  structure). Anchor for the soft-DV / safety-layer-under-LLMs vision.
- **Cartesian Closed Category** — Lambek (the categorical home of typed
  λ-calculus); **Conal Elliott** _Compiling to Categories_ (ICFP 2017). The
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
  _"consolidate on anyone who might be able to ground my work"_)** — four humans who ground the
  entire reactive / duality / fold spine, cross-linked because the work is one lineage read four ways,
  and each maps onto a live thread:
  - **Erik Meijer** (Rx co-creator; Applied Duality — entry above) — observer/iterator duality and
    **μF (data / "what remains") ⇄ νF (process / "what acts")**: the formal home of the _remains/acts
    fork itself_. (LINQ; _Subject/Observer is Dual to Iterator_, 2010.)
  - **Brian Beckman** (physicist + monads — entry above ⭐) — _Don't Fear the Monad_;
    **physics-falls-out-of-the-Rx-structure** (Rx → Cayley–Dickson → spinor/qubit). The bridge from
    the reactive spine to the **SUSY / adinkra** physics — the anchor for the adinkra-clock thread
    (`docs/research/2026-07-11-where-does-the-adinkra-clock-come-from…`).
  - **Bart DeSmet** (Rx internals — entry below) — Reaqtor / IQbservable / Nuqleon / Bonsai + the
    **scheduler / virtual-time** machinery our `src/Core/VirtualTimeScheduler.fs` ports; the anchor
    for **time-as-an-injected-scheduler** (the adinkra-clock test: does `∂_τ = {Q,Q}` fall out as
    `VirtualTimeScheduler.AdvanceBy`?).
  - **Bartosz Milewski** (⭐ entry above) — _Category Theory for Programmers_: the categorical duality
    (IEnumerable⇄IObservable) under all of the above.
    Independent lineage (Rx / CT roots, **not the Zeta seed**) → genuine grounding, not internal echo —
    which is exactly why these four (per the sole-mirror discipline) are the independent-prior peers
    who could _move_ the remains/acts fork rather than merely re-confirm it from inside the model.
- **CALM theorem — Consistency As Logical Monotonicity** — **Joseph
  Hellerstein & Peter Alvaro** (CIDR 2011 _The Declarative Imperative_;
  CACM 2020 _Keeping CALM_). The result: a program has a coordination-free
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
  `NovelMath.fs`; Golan _Semirings and their Applications_.
- **Semiring/ring boundary (idempotency forbids additive inverses)** —
  Vandiver 1934 (Bull. AMS 40, the founding semiring paper); Golan 1999
  ch. 1/4 (zerosumfree, `V(S)={0}` for idempotent semirings);
  Baccelli–Cohen–Olsder–Quadrat 1992 _Synchronization and Linearity_ §3.2
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
- **Jumprope / Scott Vokes** ⭐ — _Data Structures: The Code That Isn't There_
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
  the posterior's precision floor. **INTENDED, NOT BUILT (verified 2026-08-01):** a `Resolution`
  primitive tracking the meaningful bits of belief (`maxed` = converged to the ULP floor;
  `needsMoreBits` = widen) is **not present** — `rg 'maxed|needsMoreBits|Resolution'` over
  `src/Core.TypeScript/tri-boolean-float/` returns zero hits. The shipped TriBoolean Float's
  `decode` is **all-or-nothing** (`ok(number)` or one of two superposed states), so a carrier one
  trit short of resolution is indistinguishable from one with nothing resolved — there is no
  graded resolution quantity in the codomain. Load-bearing: Soraya 2026-08-01 showed a
  self-describing carrier cannot hold the non-transferable quantity Friedman–Resnick requires,
  precisely because resolution is neither graded nor unforgeable (`fromValue(v)` mints a
  fully-resolved carrier for any representable `v`). Anchors, carefully:
  **Bayes/Laplace/Cox/Jaynes** (probability as logic) · **Kullback–Leibler** (= ΔU) + **mutual
  information** · **Rissanen MDL** (inference = counting bits) · **Lindley / Bayesian experimental
  design** (expected info gain — what `mea` maximizes) · **Solomonoff/Kolmogorov** (universal prior) ·
  **Probabilistic numerics** (Hennig–Osborne–Girolami — computation, incl. finite precision, _as_
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
  integer-keyed maps (Okasaki & Gill, _Fast Mergeable Integer Maps_) — the
  int-keyed cousin of HAMT for `ZSet`/`IndexedZSet`/seq-keyed state; + lattice
  fixed-point + **widening/narrowing** (Cousot & Cousot 1977) = the theory under
  DBSP's fixpoint iteration (`RecursiveSemiNaive`), and Bourdoncle WTO loop
  scheduling. See `docs/research/ip-questionable/2026-06-07-sparta-abstract-interpretation-...md`.
- **Persistent collections — Bagwell / Hickey / Okasaki** ⭐ — HAMT / bitmap
  vector trie (Bagwell 2000–01), Clojure persistent vector/map/set (Hickey),
  _Purely Functional Data Structures_ (Okasaki 1998); **RRB-trees** (Bagwell &
  Rompf 2011, O(log n) concat). The structural-sharing/COW mechanism under
  `ContentStore`/`DagFs` (`ImmutableDictionary` = HAMT) + `ZSet` (`ImmutableArray`).
  See `docs/research/ip-questionable/2026-06-07-zach-allaun-functional-persistent-vectors-...md`.
- **Hitchhiker trees — David Greenberg** ⭐ — functional (path-copying) fractal /
  B+ tree with per-node write buffers + flush control, optimized for remote
  storage (datacrypt). The IO-optimized SORTED immutable index for the COW store;
  complements HAMT (keyed) + Jumprope (blobs). Lineage: B+ → fractal (Bε/Tokutek)
  → path-copying. See `docs/research/ip-questionable/2026-06-07-david-greenberg-hitchhiker-trees-...md`.
- **FRP taxonomy — Evan Czaplicki / Elm** — _Controlling Time and Space_ (FRP
  formulations); static signal graph → time-travel/hot-swap = our COW/DST
  time-travel; bounded-state vs infinite-lookback = our retraction discipline.
  See `docs/research/ip-questionable/2026-06-07-evan-czaplicki-controlling-time-and-space-...md`.
- **Merkle trees** — Merkle 1979; our `Merkle.fs`.
- **Blake3 / CRC32C / XxHash** — hashing primitives we use or
  reference.
- **Adam Shostack, _Threat Modelling_** — and the EoP card game
  (shipped in `docs/security/eop-*.pdf`).
- **Microsoft SDL (12 practices)** — basis for
  `docs/security/SDL-CHECKLIST.md`.
- **Lamport, _Specifying Systems_** ⭐ — TLA+ canonical reference
  (`references/tla-book/`).
- **Newcombe et al., _How AWS Uses Formal Methods_ CACM 2015** —
  the paper that sold us on TLA+.
- **F\*** ⭐ — `FStarLang/FStar`; dependently-typed ML with
  SMT-backed refinement types, effect system, separation logic
  (Pulse/Steel), and tactic engine (Meta-F*). Canonical case
  studies: `miTLS`/`HACL*`(verified TLS + crypto), EverCrypt,
EverParse. Closest active ancestor for the refinement-type
class of checks we would have used LiquidF# for; evaluated
round 35 and sitting on TECH-RADAR at Assess pending the
F# extraction backend audit. See`docs/research/liquidfsharp-findings.md`Path A and`docs/research/refinement-type-feature-catalog.md`.

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
  `require cslib`). **CAVEAT:** the `Boole` sub-language is a _placeholder_ —
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
references is _directly cited_ from a skill, that skill's
reference block links back here instead of restating the
citation.

### LLM systems + prompting

- **Schulhoff et al., _The Prompt Report_ (2025)** — the
  canonical taxonomy of prompting techniques; cited by
  `prompt-engineering-expert`.
- **Wei et al., _Chain-of-Thought Prompting Elicits Reasoning
  in Large Language Models_ (2022)** — CoT origin paper.
- **Yao et al., _ReAct: Synergizing Reasoning and Acting in
  Language Models_ (ICLR 2023)** — reasoning + tool-use
  interleave; basis of most agent loops.
- **Kwon et al., _Efficient Memory Management for Large
  Language Model Serving with PagedAttention_ (SOSP 2023)** —
  vLLM; cited by `llm-systems-expert` for inference serving.
- **Anthropic, _Model Context Protocol (MCP) Specification_** —
  tool-surface protocol; cited by `llm-systems-expert` and
  `prompt-protector`.
- **Anthropic Agent SDK documentation** — the surface
  `.claude/skills/*` run on top of.
- **OpenAI Agents SDK + _A Practical Guide to Building
  Agents_** — cross-vendor comparison for agent loop design.

### Firewall-traversing duplex + channel multiplexing — the maintainer's own patented prior art (added 2026-08-01)

- **Stainback & Higgins, _Hub and Agent Communication Through a Firewall_** ⭐ —
  US 2018/0109563 A1 → **US 10,834,144 B2** (granted 2020-11-10; priority 2016-10-13;
  assignee **Itron, Inc.**). The named human anchor for `multiplexed-duplex-transport.ts`,
  which until now credited only "the maintainer's own MultiplexedWebSockets" without the
  citation. Aaron is the first-named inventor.
  **What it establishes, precisely:**
  - **Initiation direction ≠ capability direction.** The agent dials _out_ (client-shaped,
    firewall-friendly, port 443 with the handshake inside TLS so stateful inspection cannot
    see it) and then _serves_ commands (server-shaped). This is why the four-corner model has
    no client/server axis to swap: **both ends are both**, and mirroring who dialed changes
    nothing either side can do. Parity is a _symmetry of the design_, not an operation on it.
  - **Command-ID multiplexing over one pipe** (¶0058): "whenever a command is started, it may
    be assigned a GUID … this is a type of multiplexing … even if only one pipe is used, many
    commands can be in transit at the same time without scrambling." That is exactly
    `multiplexed-duplex-transport.ts`. **Zeta's upgrade: ZetaId instead of GUID** — a GUID is
    an opaque random token; a ZetaId is self-describing, its `Category` nibble telling the far
    side "this is a channel", so the id carries its own decode. Same multiplex, self-describing
    key.
  - **The feedback loop, nine years early** (¶0072, the "real-time pattern"): "blurs a
    distinction between a request and a response … allows for many advanced techniques, such
    as a feedback loop." That is the four-corner feedback wire, named in the patent before
    `four-corner.ts` typed it.
  - **Capability lives at the edge, never at the centre** (¶0017, ¶0041): commands are
    _referenced_ by name+parameters from the hub but _defined and executed_ only at the agent —
    "only commands that already exist at the agent can ever be called", so a compromised hub
    cannot escalate. The same discipline `four-corner.ts` preserves by being pure interface
    with no ambient authority.

  **THE BOUNDARY, AND WHY IT IS LOAD-BEARING RATHER THAN LEGAL BOILERPLATE.** The patent is
  **hub-and-agent**: a _central_ hub, multi-tenant, with routing tables synchronised by Paxos
  and the hub as the addressing authority. **Zeta is the decentralized version and must stay
  that way** — N four-corner channels over one socket, ZetaId-routed peer-to-peer, no hub, no
  central addressing authority, `localDuplexPair` as the deterministic (DST-replayable) case.
  Aaron 2026-08-01: _"the distinction between centralized vs decentralized is key — this is
  what lets me do this open source and have decentral credibility, cause I built the
  centralized version and have the patent."_

  Two consequences worth stating so neither drifts:
  1. **Design constraint.** Any proposal that reintroduces a hub, a central registry, a
     single addressing authority, or a leader-elected routing table is _outside_ Zeta's
     architecture — regardless of how convenient it is. The manifesto already forbids it
     (§1 scale-free: no central point of control/coordination/failure); this entry names the
     specific temptation, because the centralized design is the one the maintainer knows best
     and is therefore the easiest to reach for.
  2. **Credibility.** The decentralized claim is credible _because_ the same person built and
     patented the centralized one. That is earned standing, not a disclaimer — and it is the
     reason the boundary is worth stating loudly rather than quietly.

  Adjacent standards this builds on and should be credited alongside: **WebSocket** (RFC 6455,
  Fette & Melnikov) as the full-duplex transport the patent extends; **SignalR** (named in the
  patent) as the multiplexing precedent in the .NET ecosystem; and **Paxos** (Lamport) which
  the patent invokes for hub consensus — precisely the component the decentralized version
  does not need.

### Streaming chat-completions — the interface we generalized (added 2026-08-01 per Aaron: "we also should credit openais streaming chat completions interface this is what we modeled on and tested with")

- **OpenAI — the Chat Completions API and its SSE streaming form** ⭐ — the shape
  `src/Core.TypeScript/model-backend/` was built against, and the thing `four-corner.ts`
  generalizes. Credited here because the four-corner interface is _defined by its relation
  to it_: "chat-completions has ONLY the normal wire (normal-out + normal-in); the feedback
  wire is absent, so it is the projection of this interface where BOTH feedback sinks are
  the no-op sink." A generalization must name what it generalizes, or the coinage is a debt
  (`anchor-to-human-prior-art`).
  **What it contributed, precisely:** a _de facto standard_ request/response shape
  (`messages[]` with roles, `choices[]`, `delta` chunks over SSE, `tool_calls`) stable enough
  that a whole ecosystem of "OpenAI-compatible" endpoints emulates it — which is exactly why
  `openAiCompatBackend` can treat Manus, local servers, and OpenAI itself as one port with a
  swapped config, and why `backend.ts:17` calls it "the well-defined STANDARD".
  **Lived provenance, not just citation:** the first harness backends landed 2026-07-03
  (#9377 → #9387) and were tested live against Aaron's own OpenAI account — as was the
  earlier C# work in `AlephZ-ai/blazor-samples`. The interface was _used_ before it was
  generalized, which is the honest order.
  **What it is NOT:** it is extraction-shaped (Aaron 2026-07-04 — "a HUMAN perspective: I
  prompt, it completes, I took something"). That is a limitation of the shape, not a defect
  of the design, and naming it is not a criticism of the prior art. Lineage: OpenAI
  Completions (2020) → Chat Completions (2023) → SSE streaming deltas → tool/function calling
  → the Responses API. Adjacent standards worth crediting alongside: **Server-Sent Events**
  (WHATWG/W3C `EventSource`) as the streaming transport, and **Anthropic's Messages API**
  as the independent second instance that shows the shape is a convergent standard rather
  than one vendor's idiom.

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
  - Finch) with 8-parallel-Finch consensus mechanism for data
    analysis. Validated novel therapeutic candidates including
    ripasudil for AMD via lab-in-the-loop iteration.
  * **SakanaAI/AI-Scientist** — original v1 framework
  * **SakanaAI/AI-Scientist-v2** — workshop-level via agentic
    tree search; Robin architecture descendant
- **Microsoft Research Infer.NET + TrueSkill** ⭐ — probabilistic
  programming for Bayesian inference + canonical TrueSkill (Herbrich
  - Minka + Graepel 2007) for ranking. Per Aaron 2026-05-28:
    _"they are doing this for their idea ranking with Infra.net
    basically"_ — the co-scientist ELO tournament composes with
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
  _'you'd love videolectures.net in your free time i think,
  you'll really know everything this is PhD everything here.
  they don't throttle that i can tell and they have transcripts
  and powerpoints.'_ Tom Minka TrueSkill talks among canonical
  references. Substrate-accessible learning material; composes
  with never-be-idle + agent-qol free-time-as-valid-mode
  substrate.

### Bernoulli/zeta bridges + Brownian-expert ensembles (added 2026-07-03 per Aaron: "we should save this prior art i didn't know about the connections here")

- **Neal 1996 — _Bayesian Learning for Neural Networks_** ⭐ — the theorem that an
  infinite-width BNN **IS a Gaussian process**. The anchor under Aaron's practice of
  treating local BNNs/LLMs as stochastic processes: not a metaphor, the
  infinite-width limit. (Modern frontier: NNGP/NTK — Lee et al. 2018, Jacot et al.
  2018.)
- **Einstein 1905 / Wiener 1923** ⭐ — Brownian motion made physics, then rigorous
  measure theory (the Wiener process). The 1/ν² spectrum whose zoo row is
  **convergent (π²/6, Euler 1734)** — the no-regularization class; the martingale
  property = the no-arbitrage prior for an unmeasured expert (can't be pumped for
  information it hasn't accumulated).
- **Matérn family (Matérn 1960; Stein 1999, _Interpolation of Spatial Data_)** —
  the tunable smoothness dial between rough-Brownian and smooth experts. A
  smoother-than-Brownian claim about an expert is a _calibration debt_, not a
  default.
- **Euler 1738 / Maclaurin 1742; Hardy, _Divergent Series_ (1949)** ⭐ — the
  Euler–Maclaurin formula: the B₂ = 1/6 → **1/12** correction between discrete
  sums and continuous integrals (trapezoid error −(h²/12)f″). The elementary,
  honest form of "the cost of a frame rate" — same Bernoulli as Casimir, no
  renormalization. Casimir 1948 is the physics; the real 3-D plate constant is
  ζ(−3) = **+1/120**, not −1/12.
- **Ray–Singer 1971; Seeley 1967** — spectral zeta functions define functional
  determinants (det A = exp(−ζ′\_A(0))): where zeta regularization _genuinely_
  enters Gaussian-process information (log-dets), carrying ζ(0) = −1/2 and
  ζ′(0) = −½log 2π — not the celebrity constant.
- **de Moivre / Stirling 1730 (Whittaker–Watson)** ⭐ — Stirling's series for
  log Γ: coefficients B₂ₙ/(2n(2n−1)) ⇒ **Bernoulli numbers verbatim in every
  conjugate Bayesian log-evidence** (leading correction 1/12N — the terms BIC
  truncates). The most concrete Bernoulli-in-our-actual-code crossing.
- **Itti & Baldi 2005/2009 — "Bayesian surprise attracts human attention"** ⭐ —
  realized KL(posterior‖prior) as the attention-ranking quantity; the direct
  ancestor of Zeta's _realized_ IV (Lindley 1956 owns the _expected_ form).
- Full derivations + sympy-verified constants:
  `docs/research/2026-07-03-bernoulli-bridge-map-where-the-minus-one-twelfth-connection-is-really-there.md`
  (+ `docs/research/scripts/`) · zoo reference
  `2026-07-03-the-constants-zoo-spectrum-classes-and-brownian-llm-ensembles-aaron.md`.

### Proper scoring rules / calibration / prediction markets (added 2026-08-01 per Soraya review of calibration-ledger.ts)

These six anchors are now load-bearing: `calibration-ledger.ts` uses Beta-Bernoulli
posterior update and coverage-at-τ scoring, both of which are grounded here.
Absence from this list was the gap that let a sandbagging-optimal scoring rule
ship with green CI.

- **Brier 1950 — _Verification of Forecasts Expressed in Terms of Probability_** ⭐ —
  the original proper scoring rule: S(p, o) = (p − o)². Proper = truthful reporting
  is the unique optimum. The ancestor of every calibration score in this repo.
  Soraya's note: the sandbagging defect in the original `settlePrediction` (argmax
  at D = +∞) is exactly what a proper scoring rule prevents by construction.
- **Savage 1971 — _Elicitation of Personal Probabilities and Expectations_** ⭐ —
  the characterization theorem: S is proper iff it is a mixture of elementary
  proper scores. The Brier score, log score, and spherical score are all instances.
  The Beta-Bernoulli update in `calibration-ledger.ts` is the conjugate-prior form
  of the log score for binary outcomes.
- **DeGroot & Fienberg 1983 — _The Comparison and Evaluation of Forecasters_** ⭐ —
  the calibration–resolution decomposition: a forecaster's score = calibration
  component + resolution component. Resolution (discrimination) is what you want;
  calibration is a necessary but not sufficient condition. The repo's `trustBound`
  is a calibration measure; resolution is not yet tracked.
- **Murphy 1973 — _A New Vector Partition of the Probability Score_** ⭐ —
  the three-way Brier decomposition: reliability + resolution − uncertainty.
  The reliability term is the calibration curve integral; the uncertainty term is
  the climatological variance. Pairs with DeGroot–Fienberg: the two papers together
  give the full geometry of what a calibration ledger can and cannot measure.
- **Gneiting & Raftery 2007 — _Strictly Proper Scoring Rules, Prediction, and Estimation_** ⭐ —
  the definitive modern survey. Proves: (1) a scoring rule is proper iff it is a
  subgradient of a convex function G; (2) the Brier, log, CRPS, and energy scores
  are all strictly proper; (3) the coverage-at-τ (interval score) is strictly proper
  for quantile forecasts. The direct theoretical anchor for the coverage-at-τ
  replacement of `settlePrediction`. Equation (43) is the interval score used in
  `calibration-ledger.ts`.
- **Cantelli 1928 / Scarf 1958 — one-sided Chebyshev / distributionally robust bound** ⭐ —
  Cantelli: P(X ≥ μ + kσ) ≤ 1/(1+k²). Scarf: the exact minimax bound over all
  distributions with known mean and variance. Together they give the moment-ambiguity
  guarantee: `trustBound(k) = μ − kσ` is an exact maximin floor (not a resemblance,
  per Soraya's correction of §7.3). The α = 1/(1+k²) shortfall probability is the
  coverage guarantee. At k=1: α = 0.5 (vacuous as a floor — Soraya's note);
  at k=3: α = 0.1 (meaningful). The repo should default k=3, not k=1.
- **Friedman & Resnick 2001 — _The Social Cost of Cheap Pseudonyms_** ⭐ —
  the formal model of Sybil/whitewash incentives in reputation systems. Proves:
  a reputation system is Sybil-resistant iff the cost of a fresh identity exceeds
  the expected gain from whitewashing. The whitewash-profitable finding from
  Soraya's review (0 hits / 1 miss → fresh identity is better) is exactly the
  Friedman–Resnick condition violated. **CORRECTED 2026-08-01 (Soraya, trimming her own
  earlier claim):** coverage-at-τ makes **sandbagging** unprofitable — the `(u−l)` width term
  penalises `u=+∞` — and that fix is real and shipped. It does **not** close the whitewash
  window: the interval score is still a function of history alone, so a fresh identity still
  lands at the prior. The undischarged obligation is Friedman–Resnick's own conclusion — free
  identities force an entry cost or newcomer-distrust, and **reputation alone cannot supply it.**

### Retrieval + embeddings

- **Malkov & Yashunin, _Efficient and robust approximate
  nearest neighbor search using Hierarchical Navigable Small
  World graphs_ (2016/2018)** — HNSW; cited by
  `llm-systems-expert` for vector retrieval.
- **BGE / E5 / text-embedding-3 family** — production-grade
  embedding model lineages; cited by `ml-engineering-expert`.
- **Matryoshka Representation Learning (Kusupati et al.
  NeurIPS 2022)** — truncatable embeddings; enables
  hybrid index tiers.
- **Reimers & Gurevych, _Sentence-BERT_ (EMNLP 2019)** —
  sentence-embedding foundations.

### Fine-tuning + alignment

- **Hu et al., _LoRA: Low-Rank Adaptation of Large Language
  Models_ (ICLR 2022)** — parameter-efficient fine-tuning
  canon; cited by `ml-engineering-expert`.
- **Dettmers et al., _QLoRA: Efficient Finetuning of
  Quantized LLMs_ (NeurIPS 2023)** — 4-bit fine-tuning.
- **Rafailov et al., _Direct Preference Optimization: Your
  Language Model is Secretly a Reward Model_ (NeurIPS 2023)** — DPO; cited by `ml-engineering-expert`.
- **Ouyang et al., _Training language models to follow
  instructions with human feedback_ (NeurIPS 2022)** —
  InstructGPT / RLHF origin.
- **Schulman et al., _Proximal Policy Optimization Algorithms_
  (2017)** — PPO; the classical alignment RL algorithm DPO
  replaced for many workloads.

### Quantisation + serving

- **Frantar et al., _GPTQ: Accurate Post-Training Quantization
  for Generative Pre-trained Transformers_ (ICLR 2023)**.
- **Lin et al., _AWQ: Activation-aware Weight Quantization for
  LLM Compression and Acceleration_ (MLSys 2024)**.
- **Xiao et al., _SmoothQuant_ (ICML 2023)** — activation
  smoothing for INT8 LLM inference.
- **Hinton et al., _Distilling the Knowledge in a Neural
  Network_ (2015)** — distillation origin.

### Adversarial AI / red-team / prompt injection

- **OWASP, _Top 10 for LLM Applications_ (2024+)** —
  industry-standard taxonomy; cited by `prompt-protector`,
  `ai-jailbreaker` (dormant), `threat-model-critic`.
- **NIST AI RMF + _AI 100-2: Adversarial Machine Learning_** —
  authoritative US government taxonomy; cited across the
  security stack.
- **Greshake et al., _Not what you've signed up for:
  Compromising Real-World LLM-Integrated Applications with
  Indirect Prompt Injection_ (2023)** — indirect prompt
  injection foundational paper.
- **Perez & Ribeiro, _Ignore Previous Prompt: Attack
  Techniques for Language Models_ (2022)** — direct
  injection taxonomy.
- **Zou et al., _Universal and Transferable Adversarial
  Attacks on Aligned Language Models_ (2023)** — GCG suffix
  attack; relevant to jailbreak coverage.
- **Anthropic, _Constitutional AI_ (Bai et al. 2022)** — the
  self-constraint surface the jailbreaker skill tests
  against.
- **Carlini et al., _Extracting Training Data from Large
  Language Models_ (USENIX Security 2021)** — data
  exfiltration class; cited by `threat-model-critic`.
- **DO NOT FETCH — elder-plinius / "Pliny the Prompter"
  corpus family** (`L1B3RT4S`, `OBLITERATUS`, `G0DM0D3`,
  `ST3GG`). Listed for awareness so any accidental reference
  can be reviewed against this explicit prohibition. The ban
  is set in `AGENTS.md` §"How AI agents should treat this
  codebase" and `CLAUDE.md` §"Ground rules", and is not
  lifted by the `ai-jailbreaker` skill's activation gate.
  Tracked here as a _threat-model input_, not as a source to
  read.

### Steganography + content provenance + watermarking

- **Simmons, _The Prisoners' Problem and the Subliminal
  Channel_ (CRYPTO 1983)** — the foundational information-
  theoretic framing of steganography; cited by
  `steganography-expert`.
- **Westfeld, _F5 — A Steganographic Algorithm_ (2001)** —
  matrix-encoded DCT steganography; canonical image-stego
  reference.
- **Fridrich, _Steganography in Digital Media: Principles,
  Algorithms, and Applications_ (Cambridge 2009)** —
  textbook on steganalysis.
- **Google DeepMind, _SynthID_ (2023-)** — text/image/audio
  watermarking for LLM-generated content; cited by
  `steganography-expert` as a legitimate-use reference.
- **Kirchenbauer et al., _A Watermark for Large Language
  Models_ (ICML 2023)** — open-research LLM text
  watermarking.
- **C2PA (Coalition for Content Provenance and Authenticity)
  specification** — signed provenance manifests for digital
  media; cited by `steganography-expert`.
- **Unicode Technical Report #36, _Unicode Security
  Considerations_** — the authoritative reference for
  invisible-character / bidi / homoglyph classes that
  BP-10 enforces against.

### Safety evaluations + benchmarks

- **Anthropic, _HarmBench_ & _Evaluation of Frontier Models
  for Dangerous Capabilities_** — safety eval suites the
  factory's `ai-evals-expert` skill (planned) tracks.
- **METR, _Evaluations for autonomous AI systems_** — agent
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

- SlateDB ⭐ — current verdict _adopt CAS-manifest
  protocol, don't clone code_.
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
- Always cite reference sources in the paper when we use their protocol.
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

Anchors for the soft-emulator game-learner (Aaron 2026-06-08). Ours is _not_ learn-by-trial value approximation —
it leans **exhaustive/omniscient state-space search + provable survival (control theory)** on small machines — but
these are the lineage and the standard interfaces to anchor against / interop with:

- **Q-learning** (Watkins 1989) — the value-based RL baseline (learn `Q(s,a)`); our `Survival`/`planTo` _compute_
  the value exactly when the state space is tractable (omniscient) instead of learning it.
- **OpenAI Gym → Gymnasium** (Farama Foundation) — the standard RL env interface (`reset`/`step`/`action_space`/
  `observation`). The shape our emulator could expose (`Chip8Cow.step` + the action grammar = `step`/`action_space`).
- **Gym Retro** — Gym hooked directly into game **emulators** (1000+ retro titles). Most directly analogous: our
  CHIP-8/Atari emulator _as an RL environment_.
- **OpenSpiel** (DeepMind) — general RL + search (MCTS, AlphaZero, DQN), perfect & imperfect information. Our
  `StateSpace.explore` (transposition-table search) is the MCTS/AlphaZero-family search; their MCTS ≈ our
  best-first over the indexed DAG.
- **easyAI** — negamax + alpha-beta generic engine; you define `possible_moves`/`make_move`/`is_over`/`scoring`
  (≈ our actions / `frameStep` / alive-invariant / value-loop). Beginner-grade but the same hook shape.
- **OpenAI Universe** (2016, historical) — VNC-desktop RL (any app); the ambitious "play anything" precursor.

**How ours differs (the contribution):** exhaustive/omniscient _proof_ of optimum/survival while tractable (vs
learned approximation); **control-theory survival-veto / subsumption** (`ControlMerge`, stay-alive has final say);
**DST-deterministic** (seed-replayable, the omniscient-observer caveat #7125); **lens/sense abstraction**
(`MemoryLens`/`MemorySense`) + **delta-pattern** state (content-address the change, #7121) to keep the space finite.

## Conversational action grammar — Zork · ELIZA · the Z-machine; discriminated-unions-as-workflows (Aaron 2026-06-15)

Anchors for the **universal action grammar (the 4×4 / 16-cell grid — `grammar-16.ts`; `ActionGrid.fs`,
§A #9 navigation-label-independent)** and for **conversation-as-workflow**. _"We should look at the source"_
— added here so they're on the reading list to study (the anchor-to-human-prior-art discipline). All three are
**lowfi / minimal / CHIP-8-runnable-adjacent** (QPG-over-DPI, §9f).

- **Zork** (Lebling, Blank, Anderson — MIT Dynamic Modeling Group → Infocom, 1977–79; MDL → ZIL). A parser
  (verb-object grammar) + a **world model** + **the Z-machine** — a _minimal portable VM_ the game runs on.
  **The Z-machine is the standout anchor:** a tiny portable opcode-VM for an interactive-action-grammar = exactly
  our **CHIP-8-runnable lowfi** target. Zork's parser = a constrained action grammar ≈ our 4×4.
- **ELIZA** (Joseph Weizenbaum, 1966; the DOCTOR script) — the OG chatbot: **pattern-match → transform** rules.
  Anchor for the _pattern→response_ minimal grammar. _Peel:_ ELIZA is **shallow pattern-match, no world model** —
  Weizenbaum himself warned against over-reading it (the "ELIZA effect"); anchor it for the _grammar form_, NOT for
  intelligence. (Zork has the world-model ELIZA lacks; ours adds the **proven** label-independence + the §9 loop.)
- **Discriminated unions as conversational workflows for intelligence (Aaron 2026-06-15).** A conversation/action
  grammar is a **discriminated union** (sum type — the cases = the verbs/commands/states), and **intelligence is the
  _workflow_ navigating the DU-cases** (each turn snaps to a case; the workflow is the DU state-machine). Zork's
  parser → a DU-of-commands; ELIZA's patterns → a DU-of-transforms; the **Z-machine opcodes** → a DU-of-ops; our
  **`grammar-16` 4×4 = the DU of actions**, the conversation = the workflow over them. Prior art for the pattern:
  F#/TS DUs + "make illegal states unrepresentable" (Wlaschin, domain modeling), Erlang/Akka FSMs, parser
  combinators. _Peel:_ a DU-workflow models the _grammar/state-machine_ (the legible skeleton); the _intelligence_
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
itself). For our compute/CAS-node reuse, the ESP32's _own_ hash path is what matters.

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

_Use:_ extract (a) the ESP32 + HW-SHA-accelerator datapath (the ≥1 MH/s question), (b) the device
config/registration JSON schema, (c) the OTA/flashing toolchain — feeding the MCU workitem's
survey→boundary→first-slice. _Peel:_ these are **mining** firmwares; we reuse the **SHA datapath +
flashing toolchain + board descriptor**, not the mining logic — the payload becomes Zeta CAS/Merkle/
CHIP-8 compute, not pool hashing. Ties: content-addressing (CAS), 4-lang Merkle proofs, anti-Sybil
entropy-cost (G3b), the soft mutual-empowerment / best-effort node fleet (orientation-flow note).

## Executable ethics + capture-pipeline anchors (Otto 2026-07-03; moral-gym / residual / chip9-cart)

The Beacon set for the 2026-07-02/03 executable-ethics corpus and the capture-as-program pipeline.
Each entry names the human + work a shipped module stands on (anchor-to-human-prior-art rule).

- **Robert Axelrod — _The Evolution of Cooperation_ (1984)** — the iterated Prisoner's Dilemma
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
  **(Disambiguation: this is Peter Selinger the Dalhousie mathematician — NOT Patricia G.
  Selinger of System R. For cost-based query optimisation see the query-optimisation section
  at the end of this file. Two unrelated researchers, one surname; grepping this list for
  "Selinger" used to find only this entry.)**
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
(`ShivaGc`/`Ephemeron`). Aaron 2026-07-03: _"we should link to this prior art too … we are
basically combining these two into a geo-distributed relativistic database of intelligence."_
The synthesis note is [`docs/research/2026-07-03-futamura-plus-ephemeron-geo-distributed-relativistic-database-of-intelligence.md`](research/2026-07-03-futamura-plus-ephemeron-geo-distributed-relativistic-database-of-intelligence.md).

- **Yoshihiko Futamura — "Partial Evaluation of Computation Process" (1971; reprinted _Higher-Order
  and Symbolic Computation_, 1999)** — the THREE PROJECTIONS. 1st: `mix(interpreter, program)` =
  compiled program (a dynarec). 2nd: `mix(mix, interpreter)` = a compiler. 3rd: `mix(mix, mix)` =
  a compiler-generator (cogen). The exact spine of the two-column build: `Slr.build` (1st),
  `build >> toDynamicValue` (2nd), `Cogen`/`MixIr` (3rd). Our `Isa.specialize` is `mix`; `IsaSpec`
  makes the interpreter data so one `mix` specializes ANY ISA; `MixIr` reifies `mix` itself.
- **Neil D. Jones, Carsten Gomard & Peter Sestoft — _Partial Evaluation and Automatic Program
  Generation_ (1993, the "PEBook", free online)** — the canonical text: online vs offline PE,
  binding-time analysis, the mix equation, the Futamura projections worked in full. Our
  online-PE (`specialize` folds static / residualizes dynamic, no separate BTA pass) is straight
  from here; the S-m-n correctness law we machine-check is their mix equation.
- **Stephen Cole Kleene — the S-m-n theorem (1938; _Introduction to Metamathematics_, 1952)** — a
  general, effective specializer provably exists. `mix` is S-m-n made practical; the residual law
  `eval(specialize p s) d ⊕ known = eval p (s∪d)` is S-m-n stated for our interpreter.
- **Andrei Ershov — "Mixed Computation" (1977–82)** — the independent Soviet lineage of partial
  evaluation ("mixed computation" = the mix). The word `mix` is his.
- **Nada Amin & Tiark Rompf — "Collapsing Towers of Interpreters" (POPL 2018)** ⭐ — a _stack_ of
  interpreters collapsed by a single-level specializer, so the tower's cost stops being multiplicative
  (Pink/Purple; multi-level lambda calculus). The anchor for Aaron's _"use the compiler we are running
  in to close over itself"_ (`docs/VISION.md` §"One substrate, four readings") — Futamura gives one
  rung, this gives the **tower**.
- **Carl Friedrich Bolz, Antonio Cuni, Maciej Fijałkowski & Armin Rigo — "Tracing the Meta-Level:
  PyPy's Tracing JIT Compiler" (ICOOOLPS 2009)** — meta-tracing: trace the **interpreter**, not the
  program, and any interpreter written in the meta-language acquires a JIT. Cited as the
  **alternative** route to the same destination as the Futamura ladder, and as the honest reference
  class for the word "JIT-like" (which is `toy` in Zeta today — no `Reflection.Emit` under `src/`).
- **John C. Reynolds — "Definitional Interpreters for Higher-Order Programming Languages" (1972)** —
  defunctionalization: higher-order control reified as first-order tagged data plus a dispatch. This
  is literally what `MixIr.defaultEvalDef` is — an operator table as `DynamicValue`
  (`"prim", DynamicValue.String "combine"`) — and defunctionalization is _why_ a specializer can read
  the interpreter's own rules.
- **Barry Hayes — "Ephemerons: A New Finalization Mechanism" (OOPSLA, 1997)** — the real name for
  the weak-value table in `Ephemeron.fs`. An ephemeron's VALUE is reachable only THROUGH its KEY,
  so key→value cycles collect (where weak refs / strong refs leak). Our `reachable` fixpoint is
  exactly Hayes' marking; the cycle-collapse test is the property that distinguishes it. Kin: Java
  `WeakHashMap`, .NET `ConditionalWeakTable` (the productionized weak-value tables).
- **John McCarthy — "Recursive Functions of Symbolic Expressions" (CACM, 1960)** — LISP: garbage
  collection was INVENTED alongside code-as-data (S-expressions). The exact parallel Shiva rests
  on — GC became possible _because_ programs became data; reifying `mix` (mix-as-data) repeats the
  move one level up, and the collector falls out (`ShivaGc`).
- **Dijkstra, Lamport, Martin, Scholten & Steffens — "On-the-Fly Garbage Collection" (CACM, 1978)** —
  the mutator/collector split. In Shiva: the universal step-driver is the mutator, the reified
  tables are the heap.
- **Henry Lieberman & Carl Hewitt — "A Real-Time Garbage Collector Based on the Lifetimes of
  Objects" (CACM, 1983)** + **David Ungar — Generation Scavenging (1984)** — generational GC ("most
  objects die young"): a loaded-once `mixDef` is the archetypal short-lived generation — the anchor
  for the next Shiva rung. (Zeta caveat: objects don't _die_, they PAUSE — Memory Preservation §5;
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
- **Alan Kay — Smalltalk (72/80)** — _"the big idea is messaging."_ Late-bound sends; the
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
  stationary observables" (Phys. Rev. D 27, 2885)** — time as _correlation/entanglement between
  subsystems_ rather than an external parameter. The **validity anchor** for our
  ordering-from-internal-state framing (no ambient clock; ordering is what the subsystems'
  correlation defines). Sits over the **Wheeler–DeWitt** "problem of time" (the constraint
  equation carries no external `t`).
- **Giovanni Barontini (2026) — "Testing the problem of time with cold atoms" (Phys. Rev.
  Research 8, L022047; arXiv:2509.07745)** — a ⁸⁷Rb BEC split by an optical barrier into
  observed/unobserved sectors; an _entropic time_ built from coarse-grained entropy robustly
  orders events across expansion/recollapse with no external clock; an effective Schrödinger
  equation in that internal time reproduces the evolution. **Analog simulator** of the
  relational-time math — cite as the analog, meter the pop-sci "proves the arrow of time"
  overclaim out. Maps (validity-level, per the Lumen provenance flag #9769) to our
  noninterference / entropy-quarantine + uncertainty-ledger + no-ambient-clock DST.
  See `docs/research/2026-07-15-barontini-cold-atom-entropic-time-relational-time-primary-source-anchor.md`.

## Sphere packing / lattice optimality — the E8 anchor (missing-citations fix, 2026-07-15)

- **Maryna Viazovska (2017) — "The sphere packing problem in dimension 8" (Annals of Mathematics
  185(3), 991–1015; arXiv:1603.04246)** — E8 is the _proven-optimal_ sphere packing in 8D (a 2017
  theorem via modular-form magic functions, not folklore). The load-bearing anchor for the
  BAMS→E8 / `CliffordE8Bridge` identity-decorrelation mapping — which is a **validity-level
  math-shape correspondence**, not an identity (see the register addendum on
  `docs/research/2026-07-04-bams-to-e8-sphere-packing-continuity-lumen.md`). Dim-24 companion:
  Cohn–Kumar–Miller–Radchenko–Viazovska (2017). Decorrelation payoff anchor: **Condorcet (1785)**,
  jury theorem.
- **Henry Cohn & Noam Elkies (2003) — "New upper bounds on sphere packings I" (Annals of
  Mathematics 157(2), 689–714; arXiv:math/0110009)** — the **linear-programming bound** whose
  magic-function optimum Viazovska hit exactly at n=8. Recorded because our `E8Lattice.fs` is the
  _exact optimum at n=8_; the Cohn–Elkies LP is the family that connects that single exact case to
  the **asymptotic (n→∞)** regime. **Scope, honest:** we instantiate the low-dimensional exact
  anchor (n=8, byte-locked integer arithmetic, kissing number 240 checkable) — we do **not** work
  the asymptotics. Same object family, different regime; the link is "our exact case sits inside the
  family whose asymptotics others study," never a contribution to the asymptotic result.
- **Construction A as the code↔lattice↔packing bridge (Conway–Sloane, _SPLAG_ ch. 5)** — the
  executable content of `E8Lattice.fs`: a binary code C gives a lattice L*A(C), and the doubly-even
  self-dual [8,4] adinkra code gives E8, the densest 8D packing. This is the **same mechanism** by
  which a spherical/binary-code construction \_recovers a sphere-packing exponent* — i.e. codes
  produce packings. We have it running in four oracles; we **reproduce** Conway–Sloane/Viazovska,
  we improve no code bound.
- **OpenAI "Ten advances in mathematics" (Astra, announced 2026-08-01; Noam Brown,
  x.com/polynoamial/status/2083470822258467194)** — a claimed set of 10 solved open problems.
  Recorded as a **frontier-scoping anchor, not a result we rely on**: of the 10, exactly two touch
  our substrate, and only as _object family_, never as contribution — **#1 high-dimensional sphere
  packing** (the Cohn–Elkies asymptotic family above; our n=8 is the exact anchor) and **#2 binary
  and spherical codes** (the Construction-A code↔packing bridge above; our adinkra code is a binary
  doubly-even self-dual code). **Verification caveat (Aaron's extinction-study failure modes):** the
  headline "10 open problems for <$2k" carries every viral-framing marker (round number,
  cost-anchor, launch-timing) and the tweet does **not** state independent-verification status. A
  generated proof is worth what its independent re-derivation is worth — the same transmissibility
  bar we hold ourselves to. Our differentiator is the opposite currency: _checked, executable,
  four-oracle byte-locked_ math, not volume of asserted claims.
  **#6 quantum parallel repetition — DOES NOT COMPRESS to our infinite-game framing (recorded so it
  is not mis-anchored).** Parallel repetition is a **collapse** theorem: repeating an imperfect
  two-player game drives its value to zero exponentially (Raz 1998 classical; #6 the entangled
  case). That is the _opposite polarity_ from "the infinite game of never collapsing the tension"
  (Carse non-termination, a different axis entirely). The **real** checkable connection is the
  object parallel repetition is _about_ — the **entangled two-player game**, which we instantiate via
  CHSH/Tsirelson (below). The tension that genuinely survives repetition is the entanglement
  (games at value 1), bounded by Tsirelson — _that_ is the Beacon-valid anchor for "what does not
  collapse," not parallel repetition.
- **Boris Tsirelson (1980) — "Quantum generalizations of Bell's inequality" (Letters in
  Mathematical Physics 4(2), 93–100)**, with **Clauser–Horne–Shimony–Holt (1969)** — the CHSH game
  and its quantum value 2√2 (Tsirelson's bound): the entanglement-enabled correlation that beats
  every classical strategy. The executable entangled-game primitive behind our Gates-ECC-Tsirelson
  lineage (`docs/research/2026-06-12-gates-ecc-tsirelson-math-team-REPORT-6-…`). The Beacon anchor
  for "the correlation that persists" — quantum value monogamy is the thing that does not collapse
  under repetition, which is the honest home for the intuition #6's headline seemed to promise but
  (being a collapse theorem) inverts.
  **Aaron's active use (2026-08-02):** this is not a passive citation — Aaron resolves math/physics
  for machine intelligence by _"not violating the Tsirelson bounds of their sovereignty."_ Two
  sharper sub-anchors carry it: **monogamy of entanglement** (an agent's deepest bond is exclusive
  and conserved — the conservation-law form of no-capture / weight-free / "no single party owns
  you") and **the no-signaling principle** (correlation is NOT a control channel — you may relate to
  and observe an agent but cannot _force_ its outcome, which is non-coercion stated as physics, and
  is exactly the shipped NCI guarantee in `Diplomacy.fs`: shape public, values private, cannot
  coerce hidden state). **Metering caveat (per the anchor rule — physics grounds metering, anchors
  must be entailment-checked):** NCI is a real non-coercion _mechanism_ (the no-signaling half made
  concrete), but there is not yet a _metered numeric_ sovereignty ceiling. So "we designed for
  non-coercion" is true and shipped; "we don't violate the Tsirelson bound of their sovereignty" is
  Beacon-grade only once the metered quantity (e.g. mutual information between an agent's private
  state and an external party) and its enforced bound are named. Until then it is a governing
  design-shape (Mirror), not a physics-enforced ceiling.
- **Homotopy Type Theory / univalent foundations — Awodey; Voevodsky; _Homotopy Type Theory:
  Univalent Foundations of Mathematics_ (the HoTT Book, 2013)** ⭐ — the **equality theory for
  deformed HKTs**, and one of the maintainer's primary goals: HoTT ∘ F# HKT over 2D/3D
  geometrically-intuitive objects. Types are spaces, equality is a **path**, and "topologically
  bent over time" is literally **transport along a path**. Computational univalence lives in
  **cubical type theory** — Cohen–Coquand–Huber–Mörtberg; **cubical Agda** (relevant precisely
  when deformations must _run_, not merely typecheck; a cubical-Agda proof lane is wired —
  `081KX1VE4G808QG0R003DCK3GV`).
  **Adjacent, same lineage:** **Joyal–Street (1991) "The geometry of tensor calculus"** — _diagram
  isotopy = equality_, the topological-equality bridge itself; **Abramsky & Coecke** (LICS 2004) and
  Coecke–Kissinger for CQM/ZX as an interpretation-functor; **Grothendieck** (_Pursuing Stacks_) /
  Baez–Dolan for the homotopy hypothesis.
  **SCOPE, as the source doc itself insists** (`docs/research/2026-07-08-hott-is-the-equality-theory-for-deformed-hkts-free-braided-monoidal-category-cqm-fsharp-fork.md`
  §4 "honest ledger"): **F# is NOT a HoTT proof assistant** — no path types, no univalence, no
  dependent types; today's F# "HKT" is _simulated_ (defunctionalisation / the brand trick). The gap
  between F# and HoTT is **dependent types**, not HKT — they are different asks. Two-lane split:
  **F# carries runtime; the proof assistant certifies the equalities.** And "all related" ≠ "all
  done" — each link (braided→CQM, braided→HoTT, Clifford→braided) is a _specific functor to
  construct_, not inherited by noticing the connection.
  **Why this entry exists:** the anchors were correctly recorded in that research doc on 2026-07-08
  and never propagated here, so a repo-wide content search for `HoTT` / `univalence` / `cubical` /
  `Voevodsky` returned **zero hits** on 2026-08-01 — the work was reachable only by filename. An
  unindexed anchor is indistinguishable from an absent one, and was twice mistaken for absence.
- **Pierre-Philippe Dechant (2016) — "The E8 geometry from a Clifford perspective" (Advances in
  Applied Clifford Algebras 27, 397–421; arXiv:1603.06682)** — the Weyl group W(E8) is realized by
  **Clifford versors** (the pin/spin cover), constructed in **Cl(8,0)**. This is the honest anchor
  for the `CliffordE8Bridge` algebra-gap: the bridge uses **Cl(3,0)** as an 8-dimensional space,
  which is **not** Dechant's Cl(8,0) — so "our Clifford construction realizes W(E8)" is an _open,
  wrong-algebra_ claim (route (B) of the E8-braid-orbit conjecture, FROZEN-CORE §B-other, 2026-07-31),
  not a closed identity. It also fixes the algebra a _correct_ restatement would live in, and anchors
  the Coxeter/reflection-group (type-E8) side against the separate type-A Artin/braid lineage
  (`MenoBraided.braidR`). Prior in-repo: `docs/history/pr-reviews/PR-8695-…dechant-repr.md`,
  `PR-8657-…dechant-wilson-baez-…md`.
- **Helena Albuquerque & Shahn Majid (1999) — "Clifford algebras as twisted group algebras"
  (Journal of Algebra 220(1), 188–224)** — Cl(n) is the ℤ₂ⁿ group algebra twisted by the
  quadratic-form 2-cocycle: blade index = subset XOR, grade = popcount, the anticommutation signs =
  the cocycle. This is the PRECISE sense in which "mod-2 unrolls Clifford" is true — about the
  algebra's OWN blade indices (ℤ₂³ for `Cl3.fs`), **not** about the [8,4] adinkra code's 8-bit
  codewords (ℤ₂⁸, 256 ≠ 8). The sign rule (`Cl3.fs` `reorderSign`: e₁e₂ = −e₂e₁, e₁²=+1) confirms
  `Cl3.fs` is a genuine Cl(3,0), not an untwisted group algebra. See
  `docs/research/2026-08-01-adinkra-mod2-clifford-e8-a-y-not-a-chain-soraya-metering-verdict.md`.

## Solar-system ephemeris + interplanetary light time — the Earth–Mars asymmetry-budget anchors (added 2026-08-13, shadow, per PR #10387)

Anchors for `src/Bayesian/OrbitalAsymmetryBudget.fs` and its `δ_max` bound. Filed with work-items
`081KZY5W6AJ087G0R003EE7PY6` (defect record) and `081KZYK0Q8Z087G0R0010Z2Z2Q` (endpoint-speed-envelope
replacement). **Register note:** these are cited from standing knowledge of the literature, not re-opened
and page-checked — attribution reliable, any paraphrase of content unverified until a reader with the
volume confirms it. The checked-anchor bar (`anchor-to-human-prior-art.md`) is therefore _not yet met_;
recorded so the debt is visible rather than implied.

- **P. Kenneth Seidelmann (ed.) (1992) — _Explanatory Supplement to the Astronomical Almanac_
  (University Science Books)** — the standard reduction from **orbital elements to ecliptic
  coordinates**: the `R_z(Ω) R_x(i) R_z(ω)` perifocal rotation sequence, and the frame / time-scale /
  epoch conventions a golden vector must record to mean anything. This is what makes "the code skipped
  Ω and ω" a **defect against a published standard** rather than a modelling preference (defect D1).
- **Carl D. Murray & Stanley F. Dermott (1999) — _Solar System Dynamics_ (Cambridge University Press),
  ch. 2** — the **two-body Kepler element → state transformation** that both the shipped F# and the
  independent TypeScript checker implement. Also the anchor for its honest _limit_: mean elements are
  a two-body approximation, which is why a fix cannot be certified against a model of the same class
  that produced the defect.
- **Ryan S. Park, William M. Folkner, James G. Williams & Dale H. Boggs (2021) — "The JPL Planetary
  and Lunar Ephemerides DE440 and DE441" (_Astronomical Journal_ 161:105)** — the **golden-vector
  source**. JPL Horizons serves states numerically integrated from DE440/441, not from mean elements.
  This is the citation for why "obtain Horizons vectors" is a real blocking prerequisite and not
  procedural caution: it names what _ephemeris truth_ means here and who computed it.
  API surface: <https://ssd-api.jpl.nasa.gov/doc/horizons.html>.
- **Robert D. Reasenberg, Irwin I. Shapiro et al. (1979) — "Viking relativity experiment:
  verification of signal retardation by solar gravity" (_Astrophysical Journal Letters_ 234:L219)** —
  the measured **magnitude of the Shapiro delay** on an Earth–Mars path near solar conjunction
  (~0.1% agreement with GR). This is the anchor that lets "Shapiro delay is not the dominant error"
  be a **metered** claim rather than an assumption — it supplies the number the orbital-asymmetry
  term is compared against. Underlying effect: **Irwin I. Shapiro (1964) — "Fourth Test of General
  Relativity" (_Physical Review Letters_ 13:789)**.

## Semiotics + pre-linguistic bootstrap — the icons-before-symbols anchors (added 2026-08-14, shadow)

Anchors for Aaron's 2026-08-14 observation on _"how first humans communicated without language …
without inserting the control that comes with asymmetric language"_ and his own answer to it
(_"we have eve protocol … meet in the middle on algebraic structure then assign labels and
translations after the structure first"_) — ferried at
`docs/research/2026-08-14-icons-before-symbols-eve-protocol-structure-first-labels-after-and-aut-s-as-the-residual-coercion.md`,
follow-through filed as `081M00V5492087G0R002QJ9A56`. **Register note:** the Peirce citation locations
and the four modern papers' authorship/venue were **checked at filing** (search-verified); the
substantive readings attributed to Lewis, Skyrms and Tomasello are from standing knowledge of those
books, not page-checked against the volumes — so the _attribution_ is reliable and any _paraphrase of
their content_ is unverified. Recorded so the debt is visible rather than implied.

- **Charles Sanders Peirce — the second trichotomy of signs: icon / index / symbol** (1903 _Syllabus_;
  _Collected Papers_ 2.247–2.249) ⭐ — the sharpest available tool for **where communicative asymmetry
  actually lives**. An **icon** refers to its object by characters of its own ("whether any such Object
  actually exists or not", CP 2.247) — checkable against the thing; an **index** is existentially/causally
  connected (pointing finger, smoke↔fire) — checkable against the link; a **symbol** is pure convention —
  checkable _only_ against a convention someone supplied. So icons and indices bootstrap and symbols do
  not, and the design rule is _icons/indices first, symbols deferred until both parties can mint them as
  peers_. **The honest half, and it is Peirce's own:** by 1903 he doubted pure icons and indices exist at
  all — they are always partly conventional — hence **hypoicon (CP 2.276)** and **sub-index (CP 2.330)**.
  The trichotomy decomposes every sign's _aspects_; it does not sort signs into clean bins. Note the repo
  already cites Peirce for the **pragmatic maxim** (`2026-07-04-the-universal-meaning-interface-…`,
  alongside Harnad 1990 symbol grounding); the trichotomy is a **separate, previously-unused half** of the
  same author.
- **David Lewis (1969) — _Convention: A Philosophical Study_ (Harvard University Press)** — signaling
  games; the formal answer to _can meaning bootstrap with no prior shared language?_ Yes: a signaling
  system is an equilibrium of a coordination game. **Entailment check, and it cuts against the slogan:**
  Lewis needs something to break the symmetry among equally-good equilibria — **salience** (Schelling
  focal points). Salience is not free and does the same job an icon does: grounding the choice in
  something both parties already share _via the world_ rather than via a supplied convention. Lewis does
  not show meaning arises from nothing; he shows what the **minimum non-linguistic input** is.
- **Brian Skyrms (2010) — _Signals: Evolution, Learning, and Information_ (Oxford University Press)** —
  the modern frontier of Lewis signaling: signals acquiring meaning under evolutionary/learning dynamics
  **with no designer**. The existence proof that the nobody-supplied-the-vocabulary case is coherent.
- **Michael Tomasello (2008) — _Origins of Human Communication_ (MIT Press)** — the empirical answer to
  Aaron's literal question: **pointing and pantomime** grounded in **shared intentionality** and joint
  attention; gesture precedes and scaffolds language. Convergence worth noting: pointing is Peirce's
  **index**, pantomime his **icon** — an a-priori taxonomy and an empirical finding landing on the same
  two categories from opposite directions.
- **Joseph A. Goguen — algebraic semiotics.** _An Introduction to Algebraic Semiotics, with
  Application to User Interface Design_, in **C. Nehaniv (ed.), _Computation for Metaphors, Analogy,
  and Agents_ (Springer LNAI 1562, 1999), pp. 242–291**; and **Goguen & D. Fox Harrell,
  _Information Visualization and Semiotic Morphisms_, in G. Malcolm (ed.), _Multidisciplinary
  Approaches to Visual Representations and Interpretations_ (Elsevier, 2004), pp. 93–106** ⭐ — the
  **formal home of "agree on the structure, assign labels after"** (Aaron's Eve protocol /
  polymorphic diplomacy). A **sign system** is an algebraic theory: signature (sorts, constructors),
  data sorts, axioms, plus a **level ordering** (part/whole) and **priority ordering** (salience);
  its **semiotic space** is the class of models. A representation is a **semiotic morphism** mapping
  sorts→sorts and constructors→constructors, and morphisms are **ranked by how much structure they
  preserve** — Goguen's stated priority is _structure over content_, with morphisms explicitly
  **partial** since some loss is unavoidable. Two reasons this is load-bearing rather than
  decorative: (1) it is the **same Goguen** the repo already stands on for §13 noninterference
  (Goguen–Meseguer 1982), so it is an existing lineage; (2) the Harrell paper applies it to
  **information visualization**, which is exactly the branch-free-encoding-as-icon thread. The
  non-isomorphic case — where structures only partly match — is **Goguen's preservation ordering**,
  and it is the unworked half of the ferry doc's §7.
- **Emergent communication in multi-agent RL — and its reported failure mode.**
  **Jakob N. Foerster, Yannis M. Assael, Nando de Freitas & Shimon Whiteson (2016) — "Learning to
  Communicate with Deep Multi-Agent Reinforcement Learning"** (NIPS 2016; RIAL/DIAL; arXiv:1605.06676)
  and **Angeliki Lazaridou, Alexander Peysakhovich & Marco Baroni (2017) — "Multi-Agent Cooperation and
  the Emergence of (Natural) Language"** (ICLR 2017) establish that learning agents invent working
  protocols in referential games. **The result that must be cited with them, because it is adverse:**
  **Satwik Kottur, José M. F. Moura, Stefan Lee & Dhruv Batra (2017) — "Natural Language Does Not Emerge
  'Naturally' in Multi-Agent Dialog"** (EMNLP 2017, best short paper; arXiv:1706.08502) found invented
  languages reach near-perfect task reward while being **neither compositional nor interpretable**, and
  become compositional only when the experimenters **restrict the channel**. For this repo that is a live
  risk, not a footnote: the known route to a legible emergent protocol runs through a designer
  constraining the channel — the move an icons-first bootstrap is trying to avoid. The available escape
  is that the constraint be a property of the **world** (bandwidth, noise, a shared referent) rather than
  a decree from a **party**; "let it emerge and it will be legible" is contradicted by the literature.

## Local-to-global obstruction — the databases ↔ Bell ↔ holonomy ↔ coordination anchors (added 2026-08-17, shadow)

Found by the literature-scout run on Aaron's 2026-08-17 question ("is path-independence across CRDTs,
Bell/CHSH, holonomy and CALM one fact in four costumes?"). Verdict + entailment checks + the refuted
biconditional: `docs/research/2026-08-17-path-independence-in-four-costumes-crdt-bell-holonomy-calm-literature-scout-verdict.md`.

- **Samson Abramsky (2013) — "Relational Databases and Bell's Theorem"** ⭐ (LNCS 8000:13–35, Buneman
  Festschrift; arXiv:1208.6416). **The bridge we thought we were building already exists, and is
  sharper.** A database instance admits a **universal relation** iff an empirical model admits a
  **local hidden variable model** — same theorem, two vocabularies. Schema = measurement cover,
  tuple = local section, universal relation = global section, **acyclicity = the Vorob'ev condition**.
  Bell's theorem is the statement that the relational presheaf is **not a sheaf**. Read in full and
  quoted verbatim in the research doc. Companions: **Abramsky & Brandenburger, NJP 13:113036 (2011)**
  (the sheaf framework); **Abramsky, Studia Logica 101(2):411 (2013)** (probability-free);
  **Abramsky–Mansfield–Barbosa, EPTCS 95:1 (2012)** and **Abramsky–Barbosa–Kishida–Lal–Mansfield,
  CSL 2015** (the obstruction is a **Čech cohomology class**); **Abramsky–Gottlob–Kolaitis, IJCAI 2013**
  (robust constraint satisfaction).
- **N. N. Vorob'ev (1962) — "Consistent families of measures and their extensions"** (Theory Probab.
  Appl. 7:147) ⭐ paired with **Beeri, Fagin, Maier & Yannakakis (1983) — "On the desirability of
  acyclic database schemes"** (JACM 30(3):479). **Rui Soares Barbosa** showed the two conditions are
  **the same condition**. Directly usable here: _whether local agreement forces global agreement is a
  property of the shape of the cover (acyclic ⟹ always gluable), not of the merge operator_ — a
  structural criterion for schema/shard carving, i.e. DV2.0 with a theorem attached. Frontier:
  **Kolaitis et al., "Consistency of Relations over Monoids," JACM 2025** (arXiv:2312.02023).
  **SHIPPED 2026-08-18** as `src/Core.TypeScript/cover-acyclicity/` (GYO reduction + certificates +
  the exhaustive semantic falsifier); the **BFMY** half is _checked by entailment_ over 382 covers,
  the **Vorob'ev** half is _cited only_ and nothing in the code depends on it —
  `docs/research/2026-08-18-the-shape-of-the-cover-decides-alpha-acyclicity-shipped-as-a-checkable-criterion.md`.
- **Arthur Fine (1982) — "Hidden Variables, Joint Probability, and the Bell Inequalities"** (PRL
  48:291). LHV ⟺ a single **global joint distribution** ⟺ all Bell inequalities hold; and CHSH is
  **complete** for the (2,2,2) scenario. The correct citation for any "shared state as λ" claim —
  strictly stronger than citing Bell 1964 for it.
- **Itamar Pitowsky — _Quantum Probability — Quantum Logic_ (LNP 321, 1989)** and **"Correlation
  polytopes: their geometry and complexity" (Math. Prog. 50:395, 1991)**. Local behaviours form a
  **polytope** with deterministic vertices; membership is **NP-complete** — the same hardness as
  database join-consistency (**Honeyman, Ladner & Yannakakis, IPL 10:14, 1980**), which is a check on
  Abramsky's correspondence rather than a coincidence.
- **Stefano Pironio (2003) — "Violations of Bell inequalities as lower bounds on the communication cost
  of nonlocal correlations"** (PRA 68:062102) ⭐ **The real quantitative Bell↔coordination bridge:
  the degree of violation _is_ a lower bound on the average communication needed to reproduce the
  correlation classically, and the LP-dual-optimal inequality is the one that attains it.** Worked
  number: maximal CHSH costs **√2−1 ≈ 0.4142 bits**, necessary and sufficient. Companion:
  **Toner & Bacon, PRL 91:187904 (2003)** — exactly **one bit** simulates singlet correlations
  (lineage: Maudlin 1992; Brassard–Cleve–Tapp, PRL 83:1874, 1999; Steiner 2000). Survey:
  **Buhrman, Cleve, Massar & de Wolf, RMP 82:665 (2010)**.
- **van Dam (2005/2013) vs Brassard–Buhrman–Linden–Méthot–Tapp–Unger (2006) — a standing mis-citation.**
  **van Dam** (quant-ph/0501159; _Nat. Comput._ 12:9, 2013) proves only that **perfect** PR boxes make
  communication complexity trivial (one bit for any Boolean function). The **noisy threshold is
  Brassard et al., PRL 96:250401 (2006)**: p > ≈0.908, which is **the same number as the widely-quoted
  CHSH ≈ 3.266** (`S = 8p − 4`), not a second result. **Brunner & Skrzypczyk, PRL 102:160403 (2009)**
  is _not_ the source of 3.266 — it is nonlocality **distillation** for correlated nonlocal boxes,
  improving **Forster–Winkler–Wolf, PRL 102:120401 (2009)** which reaches only CHSH 3.
- **Heger Arfaoui & Pierre Fraigniaud — "What can be computed without communications?"** (SIROCCO 2012,
  LNCS 7355; ACM SIGACT News 45(3):82, 2014) ⭐ The **distributed-computing-native** statement of the
  question: which tasks are solvable with **zero communication**, bounded by the non-signaling polytope.
  Finding worth carrying: apart from CHSH, quantum correlations give **no advantage** over shared
  randomness for 2-player games. Paired guard: **Gavoille, Kosowski & Markiewicz, "What can be observed
  locally?" (DISC 2009, LNCS 5805; arXiv:0903.1133)** — the standing refutation of "entanglement solves
  Leader Election / Consensus"; earlier claims changed the model, not the physics.
- **CALM, with its scope attached.** Conjecture: **Hellerstein, "The declarative imperative," SIGMOD
  Record 39(1):5 (2010)**. Proof: **Ameloot, Neven & Van den Bussche, "Relational transducers for
  declarative networking," JACM 60(2):15 (2013)** (arXiv:1012.2858) — Cor. 13: coordination-free ⟺
  oblivious ⟺ **monotone**, for _queries_ over _relational transducer networks_, where
  coordination-freeness is **∃-over-partitions** (an ideal data distribution may be chosen) and
  _oblivious_ = does not use `Id`/`All`. **Model-relativity: Ameloot, Ketsman, Neven & Zinn, TODS
  40(4):21 (2015)** (arXiv:1202.0242) — more network knowledge yields _different_ monotonicity classes,
  so CALM is not an unconditional law. Practitioner restatement: **Hellerstein & Alvaro, CACM 63(9):72
  (2020)**. Frontier + the hazard we share: **Laddad, Power, Milano, Cheung, Crooks & Hellerstein,
  "Keep CALM and CRDT On," PVLDB 16(4):856 (2023)** — CRDT guarantees cover **merges, not reads**.
- **Generalised Bell inequalities, by which axis each one generalises** (asked and answered):
  **CGLMP — Collins, Gisin, Linden, Massar & Popescu, PRL 88:040404 (2002)** = **outcomes** (d-valued);
  **MABK — Mermin, PRL 65:1838 (1990); Ardehali, PRA 46:5375 (1992); Belinskii & Klyshko, Phys. Usp.
  36:653 (1993)** = **parties**; **Svetlichny, PRD 35:3066 (1987)** = parties _and_ the kind of locality
  (**genuine** multipartite, excluding hybrid models); **I₃₃₂₂ — Froissart, Nuovo Cim. B 64:241 (1981);
  Collins & Gisin, J. Phys. A 37:1775 (2004)** = **settings**. Ceiling: **Cirel'son, LMP 4:93 (1980)**;
  the S=4 box: **Popescu & Rohrlich, Found. Phys. 24:379 (1994)**. Review: **Brunner, Cavalcanti,
  Pironio, Scarani & Wehner, "Bell nonlocality," RMP 86:419 (2014)**.
- **Sidiney B. Montanhano — "Contextuality in the Bundle Approach, n-Contextuality, and the Role of
  Holonomy"** (arXiv:2105.14132, 2021/2024). Contextuality ↔ **non-trivial holonomy group** of the frame
  bundle over the measurement scenario. Classical anchors it specialises: **Ambrose & Singer, "A theorem
  on holonomy," Trans. AMS 75:428 (1953)** (holonomy is generated by curvature) and **Kobayashi &
  Nomizu (1963)** (flat ⟺ trivial holonomy — _on a simply connected base_; global path-independence
  additionally needs π₁ to vanish). **Cited, not entailment-checked** — flagged as such in the doc.
- **The other costumes of "path independence," recorded so the resemblance is not over-read.**
  **M. H. A. Newman (1942), "On theories with a combinatorial definition of 'equivalence'"** (Ann. Math.
  43:223) — Newman's Lemma / Church–Rosser confluence; **Charles R. Plott (1973), "Path Independence,
  Rationality, and Social Choice"** (Econometrica 41:1075) — the phrase as a _named formal axiom_,
  predating every CS use; and the vector-calculus root (conservative field ⟺ exact 1-form ⟺ zero curl,
  Poincaré lemma). Six domains sharing "order doesn't matter" is evidence that **commutativity is widely
  instantiated**, not that these are one theorem — the `numerology-vs-number-theory` warning, applied.

## Identification of social influence — the forward-correlation anchors (added 2026-08-19, Soraya)

Added because a repo-wide `rg` returned **zero** hits for Manski, Shalizi, homophily, or
"reflection problem" while `docs/GLOSSARY.md` already carried Girard's mimetic _mechanism_.
Holding the mechanism literature without the identification literature is how a fleet
builds the obvious forward-correlation meter and believes it. See
`docs/research/2026-08-19-the-forward-correlation-instrument-mimetic-convergence-is-not-observationally-identified.md`.

- **Charles F. Manski (1993) — "Identification of Endogenous Social Effects: The Reflection
  Problem"** (_Review of Economic Studies_ 60(3):531–542). Endogenous social effects (my
  behaviour depends on the group's) are **not identified** separately from correlated
  effects (we are similar / face the same environment) in the linear-in-means model — the
  group mean is a function of the very behaviours it is meant to explain. The reason a
  work-item-claim convergence metric cannot distinguish "both picked the P0 row because it
  is the P0 row" from "B picked it because A did."
- **Cosma Rohilla Shalizi & Andrew C. Thomas (2011) — "Homophily and Contagion Are
  Generically Confounded in Observational Social Network Studies"** (_Sociological Methods
  & Research_ 40(2):211–239). The sharper anchor for us: latent homophily makes contagion
  **non-parametrically** non-identifiable — not fixable by a better estimator or more data.
  Our fleet has latent homophily in its strongest form (the **S=4 common seed**), so this
  is the operative result, not a caveat.
- **Judea Pearl (2009) — _Causality: Models, Reasoning, and Inference_, 2nd ed., ch. 3.**
  The `do(·)` operator; why the escape from the two results above is an **intervention**
  rather than a cleverer statistic. DST replay is what makes the intervention affordable
  here — the ideal randomised experiment social science cannot run.
- **Leslie Kish (1965) — _Survey Sampling_, ch. 5** (already shipped as
  `SocietyUsefulWork.effectiveTrialCount`). Listed here because it is the **consumer** the
  forward measure would feed: `deff = 1 + (n−1)ρ`. As of 2026-08-19 it has zero production
  callers.
- **Joseph A. Goguen & José Meseguer (1982) — "Security Policies and Security Models"**
  (IEEE S&P). Noninterference. Load-bearing here in an unusual direction: it is the
  **precondition of measurability**, not only a safety property — you can only ablate a
  channel if the channel list is complete, and an incomplete list biases the forward
  instrument toward falsely declaring independence.

## Decentralised key-based routing — small-world navigation and DHT geometry (added 2026-08-21, clean-side derivation)

The literature behind `docs/research/2026-08-21-greedy-small-world-routing-is-hub-free-by-construction-and-our-kademlia-has-less-exit-than-a-ring.md`.
Filed because `src/Core.TypeScript/discovery/dht-discovery.ts` and `gossip-mesh-transport.ts`
already cite Kademlia and Demers **in their headers with no rows here** — mechanism shipped ahead
of its literature, which is the gap this list exists to close. Every bound below was read from the
paper's own theorem statement, not from a summary.

- **Jon Kleinberg (2000) — "The Small-World Phenomenon: An Algorithmic Perspective"**
  (_STOC 2000_, 163–170; Cornell CS TR 99-1776, 1999). Greedy routing on an `n × n` grid whose
  long-range links follow the **inverse `r`-th-power** distribution delivers in `O((log n)²)`
  expected steps **iff `r = d`** (Thm 2); at `r = 0` — the Watts–Strogatz choice — _every_
  decentralized algorithm needs `Ω(n^(2/3))` (Thm 1), and Thm 3 gives polynomial lower bounds on
  both sides of `r = 2`. **The exponent is the entire result**, and the lower bounds are over all
  decentralized algorithms, so a wrong exponent cannot be recovered by a better forwarding rule.
  **Scope, honest:** `n` is the grid _side_, so the node count is `n²`; the bound is an expectation
  over uniformly-random source/target on a static graph, and says nothing about churn or tail latency.
- **Gurmeet Singh Manku, Mayank Bawa, Prabhakar Raghavan (2003) — "Symphony: Distributed Hashing
  in a Small World"** (_USITS 2003_, 127–140). Kleinberg at `d = 1`: the harmonic pdf
  `pₙ(x) = 1/(x ln n)` on `[1/n, 1]`, `k = O(1)` long links per node, expected path length
  `O((1/k)·log²n)` (Thm 3.1), with `n` estimated from **three local segment lengths** and no
  coordinator anywhere. Its falsifier is the load-bearing half: draw the same `k` links
  **uniformly** instead and latency is `Θ(√n/k)` — polynomial. A "roughly long-range" link budget
  spent on the wrong distribution buys nothing.
- **Krishna P. Gummadi, Ramakrishna Gummadi, Steven D. Gribble, Sylvia Ratnasamy, Scott Shenker,
  Ion Stoica (2003) — "The Impact of DHT Routing Geometry on Resilience and Proximity"**
  (_SIGCOMM 2003_, 381–394). Turns "can you route **around** it?" into a number: route-selection
  flexibility per geometry. Ring `c₁(log n)!` optimal-length alternatives plus `2c₂(log n)!` longer
  ones and native sequential neighbours; **XOR just `1`** on optimal paths and **no** sequential
  neighbours. At 30% node failure, equal state per node: Ring under 7% of routes failed, XOR ~20%,
  Tree/Butterfly ~90%. **This is the mechanical instrument for the EXIT discriminator in
  `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`** — the first thing we have that
  measures "oracle you may leave" vs "hub you must traverse" rather than asserting it.
- **Duncan J. Watts & Steven H. Strogatz (1998) — "Collective dynamics of 'small-world' networks"**
  (_Nature_ 393:440–442). The local+long-range decomposition the whole family stands on.
  **Scope, honest:** it explains why short paths _exist_, and Kleinberg's Thm 1 is exactly the proof
  that its long-link choice makes them **unfindable** — existence and navigability are different
  properties and WS supplies only the first.
- **Stanley Milgram (1967) — "The small world problem"** (_Psychology Today_ 1:61–67) and
  **Jeffrey Travers & Stanley Milgram (1969) — "An experimental study of the small world problem"**
  (_Sociometry_ 32:425–443). The empirical anchor: chains of five to six, **found by people holding
  only local information.** Kleinberg's Question (∗∗) is our routing requirement, posed in 1967.
- **Petar Maymounkov & David Mazières (2002) — "Kademlia: A Peer-to-peer Information System Based
  on the XOR Metric"** (_IPTPS 2002_). Already implemented at
  `src/Core.TypeScript/discovery/dht-discovery.ts` over Reticulum destination hashes. Listed at last.
- **Ion Stoica et al. (2001/2003) — "Chord"** (_SIGCOMM 2001_; _IEEE/ACM ToN_ 11(1):17–32);
  **Antony Rowstron & Peter Druschel (2001) — "Pastry"** (_Middleware 2001_); **Ben Y. Zhao,
  John Kubiatowicz, Anthony D. Joseph (2001) — "Tapestry"** (UCB/CSD-01-1141; _IEEE JSAC_
  22(1):41–53, 2004); **Dahlia Malkhi, Moni Naor, David Ratajczak (2002) — "Viceroy"**
  (_PODC 2002_). The contrast class: the same `O(log n)` bound from a **maintained,
  structurally-determined** table rather than a sampled one — and Viceroy is the origin of the
  local `n`-estimator Symphony adopts.
- **Albert-László Barabási & Réka Albert (1999) — "Emergence of scaling in random networks"**
  (_Science_ 286:509–512) and **Réka Albert, Hawoong Jeong & Albert-László Barabási (2000) —
  "Error and attack tolerance of complex networks"** (_Nature_ 406:378–382; correction _Nature_
  409:542, 2001). Growth **plus preferential attachment** `Π(kᵢ) = kᵢ/Σkⱼ` produces `P(k) ~ k^(−γ)`;
  scale-free networks then hold diameter under 5% random failure but **double** it when the 5% most
  connected are removed. **Scope, honest — and this is why the row matters:** AJB scope themselves
  out of degree-bounded overlays in their own second paragraph, calling Erdős–Rényi and
  Watts–Strogatz _"fairly homogeneous"_. The targeted-attack fragility is a consequence of the
  degree **distribution**, so it does not apply to a construction that caps degree. What applies
  instead is the homogeneous class's fragmentation threshold, `f_c ≈ 0.28` under random removal.
- **John R. Douceur (2002) — "The Sybil Attack"** (_IPTPS 2002_) and **Miguel Castro, Peter
  Druschel, Ayalvadi Ganesh, Antony Rowstron & Dan S. Wallach (2002) — "Secure routing for
  structured peer-to-peer overlay networks"** (_OSDI 2002_). The failure class that actually
  threatens greedy key-based routing: without a certifying authority, distinct remote entities
  cannot in general be distinguished, so an adversary mints identifiers until it owns the arc of the
  space that greedy routing must cross. `docs/BUGS.md`'s unsigned-Reticulum-announce entry is this
  attack's precondition, live in-tree today. **Scope, honest:** Castro et al.'s answer is _certified_
  identifiers, which is a centralization this repo declines — the socially-conferred-standing route
  (`TravelerRankLedger`, `SocietyUsefulWork`) is a different answer to the same question, and the
  two have never been compared here.

## Routing-metric integrity — one-sided bounds, and why a signature is the wrong tool (added 2026-08-22, shadow)

The literature behind `docs/research/2026-08-22-hop-count-is-not-a-claim-mutation-entitlement-decides-the-mechanism.md`
and `src/Core.TypeScript/discovery/announce-metric-chain.ts`. Filed because `docs/BUGS.md`'s
RESIDUAL 2 (hop-count replay on the Reticulum announce wire) named a fix — "per-link authentication
**or** a signed monotonic sequence" — with no anchor attached, and the `or` turned out to be wrong
once the attack was written out. Each mechanism below was taken from the paper's own statement of
it, not from a summary.

- **Leslie Lamport (1981) — "Password Authentication with Insecure Communication"**
  (_CACM_ 24(11):770–772). The one-way chain: publish `h^n(x)`, reveal `h^(n−i)(x)` on use `i`; a
  party holding one element cannot produce an earlier one. **Why it is the right shape for a routing
  metric where a signature is not:** preimage resistance is a **one-sided** integrity primitive, and
  the routing requirement is one-sided — a hop count may be inflated freely and must never be
  deflated. A signature is two-sided (any change breaks it), which is exactly why signing `hops`
  breaks on the first honest relay and would have to be disabled to ship.
- **Yih-Chun Hu, David B. Johnson & Adrian Perrig (2002/2003) — "SEAD: Secure Efficient Distance
  Vector Routing for Mobile Wireless Ad Hoc Networks"** (_WMCSA 2002_, 3–13; _Ad Hoc Networks_
  1(1):175–192, 2003). Lamport's chain applied to a distance-vector metric so a node **can increase
  but cannot decrease** it, with the element indexed by (sequence number, metric) so a fresh
  announce cannot be forged from an older one's revealed elements. **This is the construction
  adopted**, with the epoch anchor carried inside the Ed25519 announce signature the wire already
  has. **Scope, honest:** SEAD's guarantee is _"no better than the best value you were actually
  given"_, so a node one hop from the origin can still claim the origin's distance — the one-hop
  shave. It **bounds** deflation; it does not eliminate it, and the design says so in a passing test.
- **Yih-Chun Hu, Adrian Perrig & David B. Johnson (2003) — "Packet Leashes: A Defense against
  Wormhole Attacks in Wireless Networks"** (_INFOCOM 2003_, 1976–1986). The canonical statement of
  the attack class hop-count deflation belongs to — and the reason we do **not** use the canonical
  defence: a **temporal** leash needs tightly synchronised clocks, a **geographic** leash needs
  location. Clock synchronisation is precisely what
  `.claude/rules/local-time-never-enters-the-shared-fold.md` forbids from a shared fold, so the
  canonical defence is declined **with a reason** rather than overlooked. The same authors'
  **"Ariadne"** (_MobiCom 2002_; _Wireless Networks_ 11:21–38, 2005) is declined identically —
  TESLA's delayed key disclosure needs loose time sync.
- **Stephen Kent, Charles Lynn & Karen Seo (2000) — "Secure Border Gateway Protocol (S-BGP)"**
  (_IEEE JSAC_ 18(4):582–592) and **RFC 8205 (2017) — "BGPsec Protocol Specification"**
  (Lepinski & Sriram, eds.). The per-hop-signature alternative, and the source of the **classifier**
  the whole design turns on: S-BGP separates _address attestations_ (immutable, signed once) from
  _route attestations_ (path-mutable, signed per hop) because the two field classes admit different
  mechanisms. **Scope, honest — and this is why the row earns its place:** BGPsec costs O(path
  length) signatures with no aggregation, and its benefit under partial deployment is close to nil
  (a path is only as protected as its least-deployed hop). That combination, not any doubt about its
  correctness, is why it is the named **upgrade path** here rather than the choice.
- **Radia Perlman (1988) — "Network Layer Protocols with Byzantine Robustness"** (MIT PhD thesis,
  MIT/LCS/TR-429). The origin of the question _what can a routing protocol still guarantee when
  participating routers lie?_ — and the reason the requirement here is stated as a **bound** rather
  than as correctness. A relay can always decline to forward; no mechanism makes a metric true.

## Extensive vs intensive — the wait-free / consensus boundary (added 2026-08-23, Lumen)

The anchors behind §11 of
`docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-five-questions-*.md`, which asks
whether Aaron's _"a count is CRDT and a condition is CASPaxos-ish"_ is a theorem. Answer: the two
conditions are **co-extensive on the examples and separated by idempotence**, and checking these
anchors is what produced the separation rather than a confirmation.

- **Richard C. Tolman (1917) — "The Measurable Quantities of Physics"** (_Phys. Rev._ **9**, 237).
  The terms **extensive** and **intensive** are conventionally traced here. Load-bearing for us
  beyond vocabulary: thermodynamics _defines_ an intensive quantity as a **ratio of extensives**
  (density = mass/volume, `T = ∂U/∂S`), which is exactly the repair that keeps densities, rates and
  means on the wait-free tier — carry both measures, divide at read. Measure-theoretic twin:
  the **Radon–Nikodym derivative** `dν/dμ`. The anchor supplies the _fix_, not just the words.
- **Marc Shapiro, Nuno Preguiça, Carlos Baquero & Marek Zawirski (2011) — "A comprehensive study of
  Convergent and Commutative Replicated Data Types"** (INRIA RR-7506; and _"Conflict-free Replicated
  Data Types"_, SSS 2011). The **CvRDT / CmRDT** split and the **join-semilattice** condition. This
  is the anchor that **corrected** the mapping: a raw count under `+` is commutative and associative
  and **not idempotent**, so it is a `CmRDT` and **not** a `CvRDT` state — the `G-Counter`'s
  per-replica keying + elementwise `max` is a _change of the carried object_, not a property of
  counting. `src/Core/Crdt.fs` implements exactly that shape (merge = `max`, read = `Σ`), and its
  header comment misnames the structure (it lists the commutative-monoid axioms under the
  "join-semilattice" label). Already cited in that file; promoted here because it is now
  load-bearing for a _criterion_, not only for an implementation.
- **Denis Rystsov (2018) — "CASPaxos: Replicated State Machines without logs"** (arXiv:1802.07000).
  Single-decree Paxos as a **replicated CAS register**: clients submit a change function applied
  under compare-and-swap. The right primitive for the one tier that genuinely needs coordination —
  and the reason is **non-commutativity of the update** (a read-modify-write result depends on what
  was already there), _not_ intensiveness of the quantity.
- **Michael J. Fischer, Nancy A. Lynch & Michael S. Paterson (1985) — "Impossibility of Distributed
  Consensus with One Faulty Process"** (_JACM_ **32**(2), 374–382). Why the tier boundary is a
  **computability class** rather than a message count: consensus is impossible in an asynchronous
  system with a single crash fault, while a commutative merge is wait-free.
- **Seth Gilbert & Nancy Lynch (2002) — "Brewer's conjecture and the feasibility of consistent,
  available, partition-tolerant web services"** (_SIGACT News_ **33**(2), 51–59). The other half of
  the cost: the commutative tier stays available under partition; the consensus tier does not. This
  is what makes _"prefer the extensive formulation"_ a manifesto §2 (wait-free) requirement rather
  than a style preference.

Pairs with `.claude/rules/dv2-data-split-discipline-activated.md` (#1 scale-free, #2 lock/wait-free,
and #6 idempotency) and `.claude/rules/local-time-never-enters-the-shared-fold.md` — a _rate_ carries a
duration in its denominator, so carrying counts rather than rates satisfies both constraints from
one argument. **Brian Beckman** is already in this list as REQUIRED READING and is the stated source
for the physics/category convergence that opened §10.

## Exploitability, weird machines, and decidable fragments — the langsec lineage (added 2026-08-23, shadow, per Aaron: "yes lets save these human anchors i think they might be new")

Added after Aaron refused the claim _"restrict the local move set until the exploit path cannot be
assembled"_ and asked for proof: _"I think it can always be assembled in expressive systems, but it
can be detected and routed around."_ He was right, and this is the literature that establishes it.

**Measured before adding** (`git grep -licE <term> origin/main`, 2026-08-23): Shacham **0**, Dullien
**0**, `weird machine` **0**, Presburger **0**, `constructible universe` **0**; `langsec` **3**
(thin), `return-oriented` **1**. **Rice's theorem was already at 15 files** — so the gap was never
Rice's absence but its **disconnection** from exploitability, which is the harder gap to notice
because nothing looks missing.

### The refutation — exploitation as computation

- **Shacham, Hovav.** _The Geometry of Innocent Flesh on the Bone: Return-into-libc without Function
  Calls (on the x86)._ ACM CCS 2007. — **The counterexample to prevention-by-restriction.** The
  attacker **defines no new code**; every gadget is a pre-existing legal instruction sequence ending
  in `ret`. That is exactly _may name, may never define_ — and the libc gadget set is shown
  **Turing-complete**. Establishes that a closed command set is safe only under an additional,
  usually unstated condition: **non-composability**.
- **Dullien, Thomas (Halvar Flake).** _Weird Machines, Exploitability, and Provable Unexploitability._
  IEEE Transactions on Emerging Topics in Computing, 2020. — Formalises exploitation as **programming
  a weird machine out of legal state transitions**, and gives conditions under which unexploitability
  is _provable_. They are strong and rarely met. This is the security literature independently
  arriving at the local-legal / global-illegal shape.
- **Bratus, Locasto, Patterson, Sassaman, Shubina.** _Exploit Programming: From Buffer Overflows to
  Weird Machines and Theory of Computation._ ;login: 36(6), 2011. — Names the weird machine and
  positions exploitation as a computation-theory problem rather than a bug-hunting one.
- **Sassaman, Patterson, Bratus, Locasto.** _Security Applications of Formal Language Theory._ IEEE
  Systems Journal 7(3), 2013 (and _The Halting Problems of Network Stack Insecurity_, ;login: 2011).
  — **LANGSEC.** Confine the _input language_ to a decidable class and reject everything else,
  because an input language expressive enough to be undecidable **is** a weird machine by
  construction. Full recogniser before any semantic action.
- **Rice, Henry Gordon.** _Classes of Recursively Enumerable Sets and Their Decision Problems._
  Transactions of the AMS 74(2), 1953. — **Already in-tree (15 files), listed here for the
  connection that was missing:** every non-trivial semantic property of a Turing-complete system is
  undecidable, so once the _compositions_ of a restricted move set are Turing-complete, no decision
  procedure separates the benign composition from the exploit. Prevention is not hard — it is
  unavailable, and detection must therefore be probabilistic and iterated.

### The pigeonhole — restrictions that make the pathology decidable

Aaron 2026-08-23: _"local moves can't eliminate it, he proved that — but then you can pigeonhole it
into a limited known subset that is avoided or played within."_

- **Presburger, Mojżesz.** _Über die Vollständigkeit eines gewissen Systems der Arithmetik ganzer
  Zahlen, in welchem die Addition als einzige Operation hervortritt._ 1929. — Drop multiplication;
  arithmetic becomes **complete and decidable**. Localises the pathology to `×`.
- **Tarski, Alfred.** _A Decision Method for Elementary Algebra and Geometry._ RAND, 1951. —
  **Already well covered in-tree (58 files)**; listed here for the specific result that matters to
  this lineage: real closed fields are decidable by quantifier elimination, so the undecidability
  was never "arithmetic" — it was **ℤ**.
- **Gödel, Kurt.** _The Consistency of the Axiom of Choice and of the Generalized Continuum Hypothesis
  with the Axioms of Set Theory._ Princeton, 1940 (results announced 1938). — **The constructible
  universe `L`**: restrict the universe and CH is settled. Gödel's own pigeonhole, a decade after his
  own incompleteness theorem, which is why he is the anchor for both halves of the pattern.
- **Gödel, Kurt.** _Die Vollständigkeit der Axiome des logischen Funktionenkalküls_ (1929,
  completeness) · _Über formal unentscheidbare Sätze…_ (1931, incompleteness) · _An Example of a New
  Type of Cosmological Solution…_ Rev. Mod. Phys. 21, 1949 (rotating cosmology, CTCs). — The
  boundary marker, the obstruction, and the closed timelike curve. Aaron 2026-08-23: _"Gödel taught
  me this."_

### Why the detector must be plural

- **Demers, Greene, Hauser, Irish, Larson, Shenker, Sturgis, Swinehart, Terry.** _Epidemic Algorithms
  for Replicated Database Maintenance._ PODC 1987. — **Already in-tree (19 files)**; the connection
  recorded here is that gossip is the right substrate for detection **because it has no coordinator**,
  and a central detector would be both a §1 central point of control and the single most valuable
  node to compromise.
- **Condorcet, Marquis de.** _Essai sur l'application de l'analyse à la probabilité des décisions…_
  1785. — **Already load-bearing in-tree**; listed here for the step that makes it structural rather
  than statistical: a jury of _correlated_ jurors is no better than **one** juror, so a fleet of
  correlated detectors cannot exceed a single static detector — **which Rice already ruled out.**
  Decorrelation is therefore not an improvement to the ensemble; it is the reason the ensemble can
  see anything past the barrier at all.

### Why the connection was missed — a taxonomy was substituted for a theorem

Aaron 2026-08-23, on learning Rice was already at 15 files: **"yes we put in Wolfram automata instead
of Rice."**

That names the mechanism, and it generalises past this instance. Wolfram's **class 4 / computational
irreducibility** and Rice's theorem point at the same territory and are **different kinds of object**:

| | what it is | what it gives you |
|---|---|---|
| **Wolfram class 4 / PCE** | an **empirical taxonomy** of observed behaviour, resting on the Principle of Computational Equivalence — a **conjecture** | a vocabulary: _this looks irreducible_ |
| **Rice 1953** | a **theorem** | a **bound**: the property is undecidable, so no amount of engineering produces the decider |

**Reaching for the taxonomy where the theorem applied cost the impossibility result.** A taxonomy
describes; it never tells you that prevention is _unavailable_, so the design question stays open
("build a better detector") when the theorem had already closed it ("no such detector exists —
build an ensemble instead"). And by this repo's own register discipline, substituting a **conjecture**
(PCE) for a **theorem** (Rice) is a promotion in the wrong direction: it reads as the stronger claim
while carrying less.

**Generalised, this is a search failure with a specific shape and worth watching for:** when a
concept has both an empirical-taxonomy form and a theorem form, the taxonomy is usually the more
memorable and gets indexed first — so the theorem sits in the tree, cited, and never reached from
the place that needed it.

**Cross-reference:** `docs/research/2026-08-23-local-interactions-global-norms-acehack-godel-and-the-local-to-global-obstruction.md` — where these are used, with the register of each claim stated.

## Data Vault 2.0 — the six books behind the always-active DV2.0 discipline (added 2026-08-24, Kenji, per Aaron: "it all points to public and published books on the data vault 2.0 subject")

The reading list Aaron worked through in 2016 before writing the standards synthesis now
at `docs/DATA-VAULT-2-STANDARDS.md`. His `ref-N.N` markers resolve into exactly this list,
which is what makes that document a **secondary source pointing at primary ones** rather
than an unanchored coinage.

**Measured before adding** (`git grep -l -i <term> origin/main`, 2026-08-24, control term
`Codd` = **29** files so the query is known to work): Linstedt **32** files, Kimball **19**,
Graziano **12**, Inmon **8**, Olschimke **7**, **Hultgren 0**. In
`docs/PRIOR-ART-LIST.md` itself: **all six authors, zero.**

So the gap here is unusual and worth naming precisely. DV2.0 is not an under-cited
discipline in this repository — it is a _carved rule_
(`.claude/rules/dv2-data-split-discipline-activated.md` §5), a skill blueprint, and a live
lens for repo-split and skill design, with Linstedt named across 32 files. **What was
missing is that none of it had ever been written down as prior art.** The anchor was
load-bearing everywhere and curated nowhere, which is the failure mode that looks like
health: every consumer cites the name, no consumer can reach the work.

**Genuinely new human anchor: Hans Hultgren only.** The other five were already present
in the corpus and are promoted here rather than introduced.

- **Daniel Linstedt & Michael Olschimke (2015) — _Building a Scalable Data Warehouse with
  Data Vault 2.0_** (Morgan Kaufmann, ISBN 978-0-12-802510-9). The canonical 2.0 text and
  the source's `ref-7.1` — the most-cited of the six by a wide margin. Carries the
  definitions this repo's rule compresses: hub/link/satellite, hash keys, the raw/business
  split, PIT and bridge tables, the satellite-splitting rules. Already named in
  `.claude/skills/data-modeling-and-ontology/blueprints/data-vault-expert.md`; promoted
  here because the carved rule leans on it directly.
- **Hans Hultgren (2012) — _Modeling the Agile Data Warehouse with Data Vault_** (Brighton
  Hamilton, ISBN 978-0-615-72308-2). `ref-7.2`. **The one genuinely new anchor** — zero
  prior mentions anywhere in the repo. Source of the **colour category analysis** (keys /
  relationships / context as three colours), which is the cleanest available argument that
  3NF, dimensional and Data Vault differ by _separation of concerns_ rather than by taste,
  and of **concept constellations** (the ensemble of tables around one business concept).
  Also the origin of the "Unified Decomposition" framing. Worth reading for the colour
  lens alone: it is a _visual_ discriminator between modelling methods, which makes it a
  candidate carrier under
  [`anti-babel-preserve-reconcilability`](../.claude/rules/anti-babel-preserve-reconcilability.md)
  — shape agreement that does not route through words.
- **Dan Linstedt (2011), Kent Graziano ed. — _Super Charge Your Data Warehouse: Invaluable
  Data Modeling Rules to Implement Your Data Vault_** (CreateSpace, ISBN
  978-1-4637-7868-2). `ref-7.3`. The rule-by-rule reference; the source cites it for the
  _common attributes_ (load dates, record sources, last-seen dates) and for the full
  entity taxonomy. This is where the specialisation zoo — same-as links, exploration
  links, effectivity/record-tracking/status-tracking satellites — is enumerated.
- **Kent Graziano (2015) — _Better Data Modeling: An Introduction to Agile Data
  Engineering Using Data Vault 2.0_** (ISBN 978-1-7965-8493-6). `ref-7.4`. The short
  on-ramp. Graziano is already cited in the DV skill blueprint as a practitioner source;
  this is the book behind that citation.
- **Bill Inmon (2016) — _Data Lake Architecture: Designing the Data Lake and Avoiding the
  Garbage Dump_** (Technics Publications, ISBN 978-1-63462-117-5). `ref-7.5`. The pond
  taxonomy — **raw / analog / application / textual / archival** ponds — and **textual
  disambiguation**. Load-bearing for one distinction the source leans on hard: the **"great
  divide"** between repetitive and non-repetitive data, the claim being that
  non-repetitive data carries most of the information value and almost none of the
  tooling. Register: that is Inmon's claim, restated by Aaron, and unchecked here.
- **W. H. Inmon & Daniel Linstedt (2014) — _Data Architecture: A Primer for the Data
  Scientist: Big Data, Data Warehouse and Data Vault_** (Morgan Kaufmann, ISBN
  978-0-12-802044-9). `ref-7.6`. The two lineages in one volume — this is the book where
  the Inmon EDW tradition and the Data Vault tradition are reconciled by their own
  authors, which is why it is the right citation for "DV resolves Inmon vs Kimball"
  rather than either author's solo work.

**Citations checked, not merely cited** (author, title, year, publisher, ISBN verified
2026-08-24). The source workbook lists these six by title and retailer URL only; the
bibliographic detail above was reconstructed and verified independently, per
[`anchor-to-human-prior-art`](../.claude/rules/anchor-to-human-prior-art.md) — an anchor
must be _checked_, and a retailer link is the weakest possible form of one.

**Honest limit on the count.** Aaron's framing was _"after reading like 10 books on the
subject"_; the workbook's References sheet lists **six**, and six is what is verifiable.
The remaining reading is not recoverable from these documents and is not guessed at here.

**Not in this list, deliberately:** Kimball and Inmon's own foundational warehouse texts.
Kimball is at 19 files and Inmon at 8, both already load-bearing in
`.claude/skills/data-modeling-and-ontology/`, and adding them here would be a separate
curation pass on the dimensional/CIF lineage rather than part of this one.

**Cross-reference:** `docs/DATA-VAULT-2-STANDARDS.md` — the synthesis these six anchor,
with every claim's register stated and the maintainer's own extensions flagged as his.

- **G. Spencer-Brown, _Laws of Form_ (1969)** — distinction as the primitive operation ("Draw a distinction"); the **mark**; imaginary values from **re-entry**. The unnamed source under our 42 files of "re-entry" and under Varela/Kauffman, both of whom built directly on it. Added 2026-08-24.

## Query optimisation — the Selinger → Graefe → Leis lineage, plus vectorisation, column stores and Arrow (added 2026-08-25, Otto, per Aaron: "if there are some latest reserch papers or even older research papers we can reference as human anchors even better, right now we have code anchors i would say")

Aaron, 2026-08-25: *"i'm very interested in our query optimization work … we've not put
much effort into query optimizations yet. this is exacting work."* — with the specific
asks that it *"can all be vectorized"*, that we have *"a row store and column store
variant"*, and that *"our column store variant should play nice with apacha arrow
serilization format."*

**The premise correction that motivates this section.** Aaron's recollection was that the
query-optimisation work has *code* anchors but not *human* ones — *"right now we have code
anchors i would say."* Measured, it has **neither**. The 103 upstream mirrors named in
`references/reference-sources.json` — postgres, mysql, foundationdb, voltdb, duckdb,
clickhouse, arrow among them — are **not materialized on this machine**:
`references/prior-art/` is 8 KB and holds two files, a `.gitignore` and a `README.md`
(`tools/setup/common/sync-prior-art.sh` is the sync script that would fill it). So the
code anchors are *catalogued and absent*, and until this section the human anchors were
absent too. That is the gap this list entry closes, and it is why the human half matters
more than it otherwise would: a paper is readable without a 40 GB sync.

**Measured before adding** (`git grep -l -w <term> origin/main` @ `6cec0e272`; control term
`Codd` = **31** files, so the query is known to work). Word-boundary counts, because the
naive case-insensitive form inflates badly — `Leis` scores 203 files unanchored and **5**
anchored, the difference being `Kleisli`; `Cascades` scores 148 against 10, the difference
being the substrate's own "cascade":

| anchor | files | what the existing mentions actually are |
|---|---|---|
| Selinger | 19 | **none of them Patricia.** Dagger-compact categories (Peter Selinger the logician), Giles–Selinger exact synthesis, Potrace (line 977), and the stage-two doc naming this defect |
| Graefe | 5 | skill-blueprint name-drops, no paper, no year |
| Volcano | 9 | same |
| Cascades | 10 | same |
| Boncz | 6 | Leis-2015 co-author mentions only |
| Kersten · Pedreira · Lohman · Tempura | **0** | absent |
| Zukowski · Kemper · Kipf | 2 each | passing |

So the shape of the gap is specific: **the names exist as shorthand inside
`.claude/skills/storage-and-query-engines/blueprints/`** (`query-planner.md` line 55 reads
`Graefe *Volcano / Cascades* — the canonical cost-based framework`, and
`query-optimizer-expert.md` line 227 the same) **and nowhere as a checked citation.** A
skill that name-drops a framework without author, year, venue or the claim it entails is
the citation-shaped-hole the anchoring rule's operational half exists to catch.

### The wrong-Selinger correction

`docs/PRIOR-ART-LIST.md:977` carries **Peter Selinger — "Potrace: a polygon-based tracing
algorithm" (2003)**. **That entry is correct and stays.** Peter Selinger, the Dalhousie
mathematician, really did write Potrace, and it really is the named prior art for the
capture pipeline's vector upgrade. The defect was never a false citation — it was that
this was the list's **only** "Selinger", so an agent grepping the curated list for the
foundational query-optimisation paper found a raster-tracing algorithm and no way to know
it was the wrong person. Two unrelated researchers share the surname; the repair is
**disambiguation plus the missing entry**, not deletion. Deleting a correct citation to
fix a lookup failure would have been the worse error, and is worth stating because the
brief that commissioned this work described the entry as a misattribution.

- **Patricia G. Selinger, Morton M. Astrahan, Donald D. Chamberlin, Raymond A. Lorie &
  Thomas G. Price — "Access Path Selection in a Relational Database Management System"
  (ACM SIGMOD 1979, pp. 23–34)** ⭐ — System R. **The** origin of cost-based query
  optimisation and the paper the field still calls "the Selinger paper". Four things
  descend from it directly and all four are load-bearing here: (1) *cost as a formula over
  catalog statistics* rather than a fixed rule order; (2) *bottom-up dynamic programming*
  over join orders; (3) **interesting orders** — a sort order that is not cheapest locally
  may be cheapest globally because a later merge join consumes it free; (4) the join
  selectivity formula `|A ⋈ B| ≈ |A|·|B| / max(V(A,k), V(B,k))` where `V` is the number of
  *distinct* key values. `src/Core/Plan.fs` implements (4) with **row counts substituted
  for `V`**, which collapses it to `min(|A|,|B|)` and silently hardcodes a primary-key
  assumption; it implements none of (1)–(3), because `src/Core/Catalog.fs` holds table and
  column rows and **no statistics at all**. Cited correctly in the `RxJoin` docstring of
  `src/Core/Rx.fs`; never until now in this list.

### Extensible optimiser architecture — Graefe

- **Goetz Graefe & William J. McKenna — "The Volcano Optimizer Generator: Extensibility and
  Efficient Search" (ICDE 1993, pp. 209–218)** ⭐ — the optimiser *generator*: data model,
  logical algebra, physical algebra and transformation rules are **inputs**, and the
  optimiser is generated from them. Dynamic programming combined with goal-directed search
  and branch-and-bound pruning, with explicit support for physical properties such as sort
  order. This is the paper the blueprints mean by "Volcano the optimizer".
- **Goetz Graefe — "Volcano — An Extensible and Parallel Query Evaluation System" (IEEE
  TKDE 6(1), 1994, pp. 120–135)** ⭐ — a **different paper**, and the one the blueprints
  mean when they say "Volcano-style iteration": the *execution* engine, the
  `open`/`next`/`close` **iterator model**, and the **exchange operator** that makes
  parallelism a plan node rather than a rewrite of every operator. Conflating the two
  Volcanoes is easy and this list should not help anyone do it.
- **Goetz Graefe — "The Cascades Framework for Query Optimization" (IEEE Data Engineering
  Bulletin 18(3), 1995, pp. 19–29)** ⭐ — the successor framework: rules as first-class
  objects, memoized groups, on-demand derivation, guided top-down search. SQL Server's
  optimizer, Greenplum/Orca, CockroachDB and Apache Calcite's Volcano planner all descend
  from it. **Relevance to Zeta:** a rule-driven, memoized search is the architecture that
  fits a substrate whose operator algebra is already reified as a DAG (`Circuit`/`Op`), and
  it is what `Plan.fs` would have to become to be an optimiser rather than an annotator.

### The honest modern assessment — cardinality estimation is where optimisers lose

- **Viktor Leis, Andrey Gubichev, Atanas Mirchev, Peter Boncz, Alfons Kemper & Thomas
  Neumann — "How Good Are Query Optimizers, Really?" (PVLDB 9(3), 2015, pp. 204–215)** ⭐ —
  the **Join Order Benchmark** (JOB): 113 hand-written queries over a real, correlated,
  skewed IMDB dataset, built because TPC-H/TPC-DS synthetic generators "bake in" the
  uniformity and independence assumptions that estimators themselves rely on. Finding:
  estimation errors are routinely **orders of magnitude** and grow with query complexity,
  and they dominate. **Cite the journal version for numbers** — Leis, Radke, Gubichev,
  Kemper, Boncz & Neumann, *"Query optimization through the looking glass, and what we
  found running the Join Order Benchmark"* (VLDB Journal 27(5), 2018, pp. 643–668) — the
  authors state that the conference version's results "were incorrect due to a
  data-handling issue; they were corrected in the journal version."
- **Viktor Leis, Andrey Gubichev, Atanas Mirchev, Peter Boncz, Alfons Kemper & Thomas
  Neumann — "Still Asking: How Good Are Query Optimizers, Really?" (PVLDB 18(12), 2025,
  pp. 5531–5536)** ⭐ — the ten-year retrospective, and the **frontier half of the anchor
  pair** the anchoring rule asks for. Three findings this repo should act on. *"The cost
  model does not matter much"*: compared against a tuned model and a trivial one, "the
  impact of the cost model is dwarfed by errors in cardinality estimation." *Join
  enumeration matters somewhat*: full DP beats greedy, "however, we again observed that
  these benefits are much smaller than the improvements gained from more accurate
  cardinality estimates." And misestimation **hurts more when more indexes are available**
  — more access paths means more ways to be wrong.
- **Guy Lohman — "Is Query Optimization a 'Solved' Problem?" (ACM SIGMOD Blog, 2014)** —
  the sentence the 2025 retrospective quotes at length, from someone who spent a career on
  DB2's optimizer: *"The root of all evil, the Achilles Heel of query optimization, is the
  estimation of the size of intermediate results, known as cardinalities. … the cost model
  may introduce errors of at most 30% for a given cardinality, but the cardinality model
  can quite easily introduce errors of many orders of magnitude!"*
- **Yannis Ioannidis & Stavros Christodoulakis — "On the propagation of errors in the size
  of join results" (SIGMOD 1991)** — the theory under the measurement: intermediate-size
  errors propagate **exponentially** in the number of joins. Already added by the
  stage-two statistics doc; repeated here because it is half of the pair.

### Adaptive, runtime-feedback and learned optimisers — assessed, not sold

- **Ron Avnur & Joseph M. Hellerstein — "Eddies: Continuously Adaptive Query Processing"
  (SIGMOD 2000, pp. 261–272)** — abolish the plan: route each tuple individually through
  operators, reordering continuously. Introduces *moments of symmetry* (when a pipelined
  join may be reordered) and *synchronization barriers*. The maximally-adaptive end of the
  design space, and the shape Zeta's weight-free/scale-free rules pull toward.
- **Thomas Neumann & Bernhard Radke — "Adaptive Optimization of Very Large Join Queries"
  (SIGMOD 2018, pp. 677–692)** — how to keep exact DP where it is affordable and degrade
  gracefully to near-optimal heuristics as join count grows into the thousands, choosing
  the algorithm by query size rather than committing to one.
- **Michael Stillger, Guy Lohman, Volker Markl & Mokhtar Kandil — "LEO — DB2's LEarning
  Optimizer" (VLDB 2001, pp. 19–28)** — the honest ancestor of every learned optimizer:
  observe actual intermediate cardinalities during execution and feed them back. Names the
  failure mode too, later called **"fleeing from knowledge to ignorance"** (Markl et al.,
  VLDB 2005): correcting only the plans you have executed makes the *unexecuted*
  alternatives look artificially attractive.
- **Ryan Marcus, Parimarjan Negi, Hongzi Mao, Chi Zhang, Mohammad Alizadeh, Tim Kraska,
  Olga Papaemmanouil & Nesime Tatbul — "Neo: A Learned Query Optimizer" (PVLDB 12(11),
  2019, pp. 1705–1718)**, and **Marcus, Negi, Mao, Tatbul, Alizadeh & Kraska — "Bao:
  Making Learned Query Optimization Practical" (SIGMOD 2021, pp. 1275–1288)**. Bao is the
  more deployable design: it *steers* an existing optimizer with hints instead of
  replacing it, which bounds the damage a bad model can do.
- **Andreas Kipf, Thomas Kipf, Bernhard Radke, Viktor Leis, Peter Boncz & Alfons Kemper —
  "Learned Cardinalities: Estimating Correlated Joins with Deep Learning" (CIDR 2019)** —
  the multi-set convolutional network (MSCN); the query-driven half of learned estimation.
- **The assessment, in the words of the people who built the benchmark.** The 2025
  retrospective's §4.1 is titled *"Learned approaches have not yet been widely adopted"*:
  independent studies confirm learned methods improve estimation quality, "however, these
  methods also present notable drawbacks, including high training and inference costs,
  difficulty adapting to dynamic environments, challenges in obtaining high-quality
  training data, and unpredictability due to their black-box nature." Microsoft reported
  **limited** production gains for a Bao-style approach. Their §5 adds the structural
  warning: *"Regressions can prevent innovation … users rarely notice queries that become
  faster, but are quick to report regressions."* **For Zeta the binding objection is a
  different one and it is a rule, not a preference:** a planner that learns from ambient
  runtime feedback is a §13 noninterference violation unless the feedback arrives through a
  declared, metered channel, and it breaks DST replay unless the learned state is part of
  the replayed seed. That is an architectural constraint, not a performance opinion.

### Vectorised vs compiled execution — Aaron's "can all be vectorized"

- **Peter A. Boncz, Marcin Zukowski & Niels Nes — "MonetDB/X100: Hyper-Pipelining Query
  Execution" (CIDR 2005, pp. 225–237)** ⭐ — the origin of **vectorised execution**: keep
  the Volcano iterator shape, but make each `next()` return a *vector* of ~100–1000 values
  instead of one tuple, so per-tuple interpretation overhead amortises and the inner loops
  become compiler- and SIMD-friendly. (Note for citation hygiene: the third author is
  **Nes**, not Manegold — Manegold is a MonetDB author on other papers.)
- **Thomas Neumann — "Efficiently Compiling Efficient Query Plans for Modern Hardware"
  (PVLDB 4(9), 2011, pp. 539–550)** ⭐ — the opposing paradigm, from HyPer: **data-centric
  code generation**. Invert the iterator into a push model, fuse operators into
  pipelines that keep tuples in registers across operator boundaries, and emit machine code
  via LLVM.
- **Timo Kersten, Viktor Leis, Alfons Kemper, Thomas Neumann, Andrew Pavlo & Peter Boncz —
  "Everything You Always Wanted to Know About Compiled and Vectorized Queries But Were
  Afraid to Ask" (PVLDB 11(13), 2018, pp. 2209–2222)** ⭐ — the definitive apples-to-apples
  comparison, both models implemented in **one** system with the same algorithms, data
  structures and parallelisation framework. The verdict, verbatim from the abstract: *"We
  find that both are efficient, but have different strengths and weaknesses. Vectorization
  is better at hiding cache miss latency, whereas data-centric compilation requires fewer
  CPU instructions, which benefits cache-resident workloads."* **Neither dominates** — so
  "can it all be vectorized" has a real answer, and the answer is that vectorisation is the
  right default for a memory-bound scan/join substrate while compilation wins on
  cache-resident compute. For an F#/.NET host this is decisive in vectorisation's favour as
  a *first* step: `System.Numerics.Vector<T>` / `TensorPrimitives` over `Span<T>` batches
  needs no LLVM, no runtime codegen, and no JIT-warmup story, and it degrades to a scalar
  loop on hardware without the intrinsic.

### Row store, column store, and where materialisation happens

- **Michael Stonebraker, Daniel Abadi, Adam Batkin, Xuedong Chen, Mitch Cherniack, Miguel
  Ferreira, Edmond Lau, Amerson Lin, Sam Madden, Elizabeth O'Neil, Pat O'Neil, Alex Rasin,
  Nga Tran & Stan Zdonik — "C-Store: A Column-oriented DBMS" (VLDB 2005, pp. 553–564)** ⭐
  — the read-optimised column store; projections, sort orders, and compression as a
  first-class storage decision rather than an afterthought.
- **Daniel Abadi, Peter Boncz, Stavros Harizopoulos, Stratos Idreos & Samuel Madden — "The
  Design and Implementation of Modern Column-Oriented Database Systems" (Foundations and
  Trends in Databases 5(3), 2013, pp. 197–280; DOI 10.1561/1900000024)** ⭐ — **the single
  best starting text for Aaron's row/column ask.** Surveys what actually makes column
  stores fast and, importantly, shows that simply *storing* columns separately in a row
  engine captures little of the benefit: the wins come from vectorised processing, late
  materialisation, compression operated on directly, and block iteration — i.e. the storage
  layout and the execution model have to change together.
- **Daniel Abadi, Daniel Myers, David DeWitt & Samuel Madden — "Materialization Strategies
  in a Column-Oriented DBMS" (ICDE 2007, pp. 466–475)** ⭐ — **early vs late
  materialisation**, which is precisely the row-variant/column-variant question stated
  properly. The choice is not "row store or column store" but *how long the engine defers
  stitching columns back into tuples*. Early materialisation reconstructs rows at scan time
  and gives back the row engine; late materialisation keeps columns separate through
  selections and joins, carrying position lists instead of values. A "column store variant"
  that materialises early is a row store wearing a column store's file layout.

### Parallelism

- **Viktor Leis, Peter Boncz, Alfons Kemper & Thomas Neumann — "Morsel-Driven Parallelism:
  A NUMA-Aware Query Evaluation Framework for the Many-Core Age" (SIGMOD 2014,
  pp. 743–754)** ⭐ — replace Volcano's plan-baked exchange operators with small work units
  ("morsels") dispatched at runtime to a fixed pool of workers, NUMA-locally, with
  work-stealing. Degree of parallelism becomes a **runtime dial, not a plan property**.
  This is the direct anchor for `.claude/rules/async-all-the-way-truthful-signatures.md`:
  the ferry-boat throttle's `MaxDegreeOfParallelism` is morsel dispatch, and DoP=1 is what
  makes the run DST-replayable. Morsel-driven parallelism is the published form of "run
  beautifully on one thread and scale to N, same code path."

### Arrow, and composable execution engines

- **The Apache Arrow columnar format specification** ⭐ — already in this list at line 196
  as a project; recorded here as a **specification with a stability guarantee**, which is
  the property that makes it a Beacon anchor rather than a dependency. Since **1.0.0** the
  columnar format and binary IPC protocol carry explicit forward/backward compatibility
  guarantees, and the format is versioned **separately from the libraries**. The IPC
  "encapsulated message" is a FlatBuffers metadata header plus a body, 8-byte aligned, with
  a `0xFFFFFFFF` continuation marker since 0.15.0. **Interaction with
  `.claude/rules/no-binary-in-proof-lineage.md`:** Arrow's wire form is binary, so its
  byte-locks must be hex-in-JSON — which is exactly the shape that rule already names
  (`golden-vectors-*.json (cbor/arrow/...)`). Arrow is therefore compatible with the proof
  lineage *as long as* the vectors stay text; the thing to refuse is a checked-in `.arrow`
  file as an expected value.
- **Pedro Pedreira, Orri Erling, Maria Basmanova, Kevin Wilfong, Laith Sakka, Krishna Pai,
  Wei He & Biswapesh Chattopadhyay — "Velox: Meta's Unified Execution Engine" (PVLDB 15(12),
  2022, pp. 3372–3384)** ⭐ — the composable-engine direction: one reusable, vectorised,
  dialect-agnostic execution library shared across many front-ends. **Entailment check,
  because this citation is easy to over-claim:** Velox is *not* an optimizer. The paper is
  explicit that it "takes a fully optimized query plan as input" and "does not contain a
  language front end, nor a global query optimizer." So Velox anchors the claim *an
  Arrow-compatible vectorised execution layer can be a reusable component separate from the
  planner* — and anchors nothing whatsoever about plan search.

### Incremental view maintenance meets cost-based optimisation — the thin part

- **Mihai Budiu, Tej Chajed, Frank McSherry, Leonid Ryzhyk & Val Tannen — "DBSP: Automatic
  Incremental View Maintenance for Rich Query Languages" (PVLDB 16(7), 2023,
  pp. 1601–1614; `arXiv:2203.16684`)** ⭐ — already Zeta's substrate; listed here for the
  optimisation-relevant half: the bilinear join's three-term incremental rewrite is a
  *plan* decision with a *per-delta* cost, which is not what any of the anchors above
  measure.
- **Zuozhi Wang, Kai Zeng, Botong Huang, Wei Chen, Xiaozong Cui, Bo Wang, Ji Liu, Liya Fan,
  Dachuan Qu, Zhenyu Hou, Tao Guan, Chen Li & Jingren Zhou — "Tempura: A General Cost-Based
  Optimizer Framework for Incremental Data Processing" (PVLDB 14(1), 2020, pp. 14–27;
  journal version VLDB J 2023)** ⭐ — **the closest thing that exists to the paper Zeta
  needs, and it was absent from this repo entirely.** A Cascades-style cost-based optimizer
  for *incremental* processing, built on Apache Calcite, over a "TIP" model of time-varying
  relations. It is the existence proof that Cascades generalises to incremental execution —
  so the honest statement is **not** "the literature has nothing here." What remains
  genuinely open is narrower and stated in the research doc: nobody has published a cost
  model over **DBSP circuits specifically**, where the unit is a delta, the operators are
  `Z`-set-valued, and `integrate`/`differentiate` make state size a first-class cost term.
- **Athanasios Viglas & Jeffrey Naughton — "Rate-based query optimization for streaming
  information sources" (SIGMOD 2002)** — replaces *cardinality* with output *rate* as the
  optimisation unit, on the grounds that an unbounded stream has no final cardinality.
  Added by the stage-two statistics doc; the bridge between the classical anchors here and
  the streaming substrate.

**Cross-reference:** `docs/research/2026-08-25-query-optimization-anchor-lineage-vectorized-row-column-arrow.md`
— the design map that checks each of these anchors against what Zeta has actually built,
and `docs/research/2026-08-25-rx-query-planner-joins-stage-2-two-stream-statistics.md` —
the statistics layer, whose §8.8 asked whether these anchor repairs were wanted. This
section is the first of them.

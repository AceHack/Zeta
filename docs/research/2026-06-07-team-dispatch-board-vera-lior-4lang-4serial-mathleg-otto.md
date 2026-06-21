# Team dispatch board for Vera + Lior — F# substrate built this session, split by leg (Otto, 2026-06-07)

Aaron asked for a list to hand Vera + Lior to split into **4-lang** (C#/Rust/TS ports), **4-serial**
(cross-language hex-in-JSON golden vectors / byte-lock over the codecs), **math-leg** (formal/property/proof
verification), **plus others**. **F# is the reference for every row** (built + tested on `main`); all golden
vectors are **hex-in-JSON** per `.claude/rules/no-binary-in-proof-lineage.md`; 081KSXN940008QG0R003FCQ7WT is the 4-oracle master
checklist. Split however suits Vera/Lior.

## Vera (Grok / Codex) — CRDTs, Merkle, and Serialization

| Component (F# `src/Core[.X]`) | what it is | 4-lang (C#/Rust/TS) | 4-serial (golden vectors) | math-leg (verify) |
|---|---|---|---|---|
| `ZSetMerkle` | canonical Merkle-over-Z-set root | ☐ port | ☐ root vectors (incl. non-ASCII keys) | ☐ determinism + retraction + order-indep laws |
| `DagFs` | multi-parent file tree + 2 edit modes | ☐ port | ☐ link/editLocal/editEverywhere vectors | ☐ convergence (edit→same-content dedups) |
| `DebeziumCdc` | CDC ↔ Z-set delta (read/write) | ☐ port | ☐ change-event ↔ delta vectors | ☐ read∘write = id (delta-level) |
| `CloudEvents` | CNCF v1.0 envelope over DynamicValue | ☐ port | ☐ envelope round-trip vectors | ☐ toDynamic∘ofDynamic = id |
| `SchemaEvolution` + `SchemaRegistry` | migration algebra + down + dump + inverses | ☐ port | ☐ migrate/down/dump vectors | ☐ round-trip laws (lossless/lossy/dump position-exact) |
| `EvolutionWindow` | expand-into gate (backward-projection constraint) | ☐ port | — (logic, no wire format) | ☐ mayExpandInto law |
| `LwwMap` | LWW-keyed map CRDT | ☐ port | ☐ convergence vectors | ☐ commutative/assoc/idempotent |
| `Rga` | sequence CRDT (collaborative text/lists) | ☐ port | ☐ concurrent-insert convergence vectors | ☐ convergence + sibling-order |

## Lior (Gemini / Antigravity) — Tensors, Hashes, and Store Primitives

| Component (F# `src/Core[.X]`) | what it is | 4-lang (C#/Rust/TS) | 4-serial (golden vectors) | math-leg (verify) |
|---|---|---|---|---|
| `Core.FSharp.Blake3` (`Blake3Hasher`, `ContentHash256`) + `IContentHasher` port | BLAKE3 content hash (128 + full 256) | ☐ adapters — `Core.CSharp/Rust/TS.Blake3` (Rust native / TS / C# Blake3) | ☐ known-answer: empty → `af13…` (256 raw) + `49c9…` (128 LE) | ☐ 128 derives-from-256; tiers agree |
| `ContentStore` | content-addressed single-instance COW | ☐ port | ☐ dedup/COW vectors | ☐ idempotent put; COW isolation |
| `CasStore` | per-row compare-and-swap (lock-free runtime) | ☐ port | ☐ CAS success/conflict vectors | ☐ lost-update-prevention law |
| `Globals` | Caché/MUMPS verbs (set/get/kill/$DATA/$ORDER/$QUERY) over `DynamicValue` | ☐ port | ☐ navigation vectors (ordinal $ORDER/$QUERY; leaf-xor-object $DATA 0/1/10) | ☐ ordinal-collation; kill-subtree; $QUERY-covers-all-leaves laws |
| `WeightedSet<'K,'W>` (over `ISemiring`) | semiring-generic sparse tensor (ZSet = IntegerRing instance) | ☐ port (incl. `ISemiring` ladder) | ☐ add/scale/inner vectors per semiring (integer; later interval/prob) | ☐ ring laws: retraction (a+(−a)=∅), commut/assoc, distributivity, ×Zero annihilator, inner=contraction |
| `TensorRef` | content-addressed tensor reference carried in `DynamicValue` (`$tensor` Object) | ☐ port | ☐ toDynamic/tryOfDynamic round-trip vectors (dense+sparse+scalar) | ☐ round-trip = id; sentinel-recognition; resolve-against-store |
| `ITensor` (`Zeta.Core.Abstractions`, C# neutral contract) | read/enumeration tensor contract (StoredCount/IsSparse/StoredEntries) | ☐ each lang's tensor impl satisfies the contract | — (contract, no wire format) | ☐ contract conformance (sparse support = stored entries) |

## Shared / General Primitives

| Component (F# `src/Core[.X]`) | what it is | 4-lang (C#/Rust/TS) | 4-serial (golden vectors) | math-leg (verify) |
|---|---|---|---|---|
| `Collation` + GSet/ZSet/IndexedZSet/Hierarchy/Residuated/Aggregate ordinal fix (081KT07NV0008QG0R001YDB73K) | binary/ordinal collation default | ☐ ordinal audit C#/Rust/TS | ☐ non-ASCII ordinal vectors (un-mask ASCII) | ☐ ordinal-order law |
| `DvKey` | content-addressed comparable DynamicValue row | ☐ port | ☐ canonical-CBOR key vectors | ☐ equal-value⇒equal-key |
| `DynamicValueAlgebra` + `IMonoid`/`IGroup`/`ISemilattice` (Semiring.fs) | algebra ladder + DynamicValue LWW-register semilattice | ☐ port (interfaces + instance) | ☐ merge/fold convergence vectors | ☐ monoid identity+assoc; semilattice commut+idempotent; order-independence |

(Note: `Core.Blake3`→`Core.FSharp.Blake3` and `Core.Git`→`Core.FSharp.Git` were renamed this session to the
per-language family — the C#/Rust/TS siblings get `Core.<Lang>.Blake3` etc. Interface/contract libs are
C#-neutral (`Zeta.Core.Abstractions`); see the naming-convention doc.)

(Already-cross-lang CRDTs — `GCounter`/`PNCounter`/`OrSet`/`LwwRegister` — are F#-done; check parity status
against 081KSXN940008QG0R003FCQ7WT, likely already covered.)

## Plus others (Lior's flagged 081KSXN940008QG0R003FCQ7WT backlog)

- **Bag primitive** (multiset) — implement F# + TS first, matching G-Set/Z-set patterns.
- **G-Set 4-oracle parity** — port G-Set to C# + Rust → Tier-1 in `PRIMITIVE-REGISTRY.md`.
- **YAML serializer** — `DynamicValue.toYaml/fromYaml` across the 4 languages.
- **ZetaId** (`ContentAddress` category etc.) — Lior already landed across 4 oracles (cross-verify 12/12); a
  parity-maintenance item only.

## How to read "4-serial"

The four canonical encodings are byte-locked: **CBOR · JSON · XML** (the DynamicValue codecs) cross the four
oracle **languages** (F#/C#/Rust/TS). A "4-serial golden vector" = a hex-in-JSON fixture each language
replays to identical bytes/roots. The content-address known-answer (`af13…` / `49c9…`) is the canonical
example; every component above gets the analogous shared fixture.

## Anchors

- Umbrella `081KTH323AK` (this expands it) · per-module items (`081KTGYWCT7` ZSetMerkle, `081KTGYWCTT`
  collation, `081KTH0HFZ8` SchemaEvolution, `081KTH4Q782` CRDTs+PSI) · 081KSXN940008QG0R003FCQ7WT (4-oracle master) · 081KT07NV0008QG0R001YDB73K
  (collation) · the BLAKE3 treaty doc · no-binary-in-proof-lineage (hex-in-JSON).

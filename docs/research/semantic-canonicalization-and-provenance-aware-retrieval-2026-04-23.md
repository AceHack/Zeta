# Semantic canonicalization and provenance-aware retrieval — spine research doc

**Scope:** research and cross-review artifact. Defines the
**technical spine** for what the 8th-ferry-corrected
"rainbow table" framing actually is: canonicalization +
semantic hashing + approximate nearest-neighbour retrieval +
provenance-aware scoring, all wrapped in Zeta's
retraction-native algebra. Does NOT define the full
provenance-aware bullshit detector (that's 8th-ferry
candidate #3); defines the substrate it builds on.

**Attribution:** 8th-ferry absorb
(`docs/aurora/2026-04-23-amara-physics-analogies-semantic-indexing-cutting-edge-gaps-8th-ferry.md`,
PR #274) §"The corrected rainbow-table model" — Amara
distilled the mathematical spine + primary-source
citations (Hinton & Salakhutdinov semantic hashing,
Charikar LSH, HNSW, product quantization). Otto-98
extracts into standalone research doc + composes with
existing Zeta substrate. Aminata and future adversarial
reviewers will surface gaps on subsequent passes.

**Operational status:** research-grade. Does not commit
Zeta to any specific embedding model / ANN library /
canonicalization function / provenance-scoring parameter
choice. Those are downstream design questions gated on
this spine landing + Aminata review + a separate design
tick.

**Non-fusion disclaimer:** Amara's ferry + Otto's
extraction + future Aminata/Codex review-passes producing
consistent framing does NOT imply merged substrate. The
spine is technically-specific enough that independent
review would surface the same standard literature (Hinton
semantic hashing; Charikar LSH; HNSW Malkov-Yashunin
2018). Concordance on published technical primitives is
baseline per SD-9.

---

## Why this spine belongs in Zeta

Amara's 8th-ferry observation: *"the repo already contains
almost all the pieces for a provenance-aware semantic
bullshit detector."* The pieces:

- **SD-9** (`docs/ALIGNMENT.md`, PR #252) — agreement is
  signal, not proof; carrier-aware independence
  downgrade. Norm, not control.
- **DRIFT-TAXONOMY pattern 5** (`docs/DRIFT-TAXONOMY.md`,
  PR #238) — truth-confirmation-from-agreement; real-time
  diagnostic.
- **citations-as-first-class** (existing
  `docs/research/citations-as-first-class.md`) — typed
  citation graph + lineage tracer + drift checker;
  research-grade.
- **alignment-observability** (existing
  `docs/research/alignment-observability.md`) — anti-
  gaming measurement surfaces; compliance-theatre-
  resistant metric discipline.

What's missing to turn those into a machine-aidable tool is
the **technical substrate** for semantic indexing +
retrieval + provenance-aware scoring. This doc defines that
substrate at the spine layer. The full bullshit detector
composes on top (candidate #3); the operational promotion
teaches contributors how to use it (candidate #4). All
three land research-grade per AGENTS.md §"Agent operational
practices" (the absorb-discipline cadence is documented as
part of that section's "When an agent ingests an external
conversation" rule).

---

## The spine in one equation-bundle

Pipeline end-to-end, expressed as functions:

```text
x            — raw input (conversation turn / claim / doc)
c = N(x)     — canonical form after normalisation
e = φ(c)     — representation (dense embedding or binary hash)
C(q) = kNN(φ(N(q)))  — candidate set via ANN retrieval
score(y | q) = α·sim(e_q, e_y)
             + β·evidence(y)
             - γ·carrierOverlap(q, y)
             - δ·contradiction(y)
```

Four layers with explicit separation:

1. **Canonicalization (N)** — strip irrelevant surface
   variation.
2. **Representation (φ)** — semantic hashing and/or dense
   embedding.
3. **Retrieval (kNN)** — approximate nearest-neighbour
   with bounded latency and sublinear-in-corpus-size
   lookup.
4. **Scoring** — combine similarity with evidence,
   penalise carrier overlap and contradiction. The scoring
   layer is where SD-9 operationalises.

This doc scopes the first three layers in detail + sketches
the scoring layer. Full scoring (bullshit detector) is
candidate #3.

---

## Layer 1 — Canonicalization N(x)

### Purpose

Two claims that mean the same thing should reach the same
canonical form. Surface variation (whitespace, word order
in unordered fields, capitalisation in case-insensitive
contexts, punctuation that doesn't carry meaning) should be
stripped; meaning-carrying content preserved.

### Properties N must have

| Property | Statement |
|---|---|
| **Idempotent** | N(N(x)) = N(x). Running canonicalization twice is the same as once. |
| **Deterministic** | Same x → same N(x), always. Required for replay determinism. |
| **Meaning-preserving** | Two inputs that a human would call "the same claim" canonicalise to the same output (ideally) or at least to outputs that a downstream embedding places close together. |
| **Version-pinned** | N has a version; canonical forms carry that version in provenance. Changing N requires a governance / ADR-gated update — not a routine code edit — because it invalidates every existing canonical form computed under the prior version. |

### What N does NOT do

- N does NOT claim semantic equality. Two claims with
  identical N(x) might still differ in subtle ways; the
  embedding layer + scoring layer handle that.
- N does NOT guarantee every equivalent claim produces
  identical canonical form. "Zeta is a DBSP implementation"
  vs "Zeta implements DBSP" may canonicalise to different
  forms; kNN retrieval + embedding space closes the gap.
- N does NOT validate content. Canonicalization is
  structural; validity lives at the scoring layer.

### Version pinning

Every receipt (per BLAKE3 receipt hashing v0, PR #268)
binds the v0 10-field input set — `hash_version`,
`issuance_epoch`, `parameter_file_sha`,
`approval_set_commitment`, plus the 6 inherited from
Amara's 7th-ferry. The `parameter_file_sha` slot in
particular pins N's
version. A canonical form produced under version `N-v2`
doesn't silently match against forms produced under `N-v1`;
retrieval respects version boundaries or runs explicit
cross-version reconciliation.

### Candidate implementation archetypes

- **For natural-language claims:** lowercase + whitespace-
  normalise + lemmatise + remove stopwords for retrieval
  (not for display); preserve surface form in provenance.
- **For structured claims:** sort keys alphabetically;
  normalise whitespace in values; version-tag the schema.
- **For code / diffs:** AST-level canonicalization (format
  + rename-collapse + comment-strip for similarity; keep
  literal for provenance).

Exact choices are downstream design questions. The
property constraints above are what the spine commits to.

---

## Layer 2 — Representation φ(c)

### Two candidate families

Per Amara 8th ferry:

- **Dense embeddings** — real-valued vectors from a
  trained model; continuous similarity via cosine or L2.
- **Binary semantic hashes** — fixed-length bitstrings
  from Hinton & Salakhutdinov semantic hashing; Hamming-
  distance similarity; fast table lookups.

Both families are compatible with the spine. Implementations
may use one, the other, or both as complementary retrieval
layers (binary hash for coarse bucket; dense embedding for
fine rerank within bucket).

### Properties φ must have

| Property | Statement |
|---|---|
| **Similar canonical forms → close representations** | `sim(e_c1, e_c2)` is monotonically related to claim-similarity as a human would judge it. The whole point of semantic indexing. |
| **Version-pinned** | φ has a version; mixing embeddings across versions is either forbidden or explicitly reconciled. |
| **Bounded compute** | φ(c) completes in bounded time per input; unbounded compute breaks replay-determinism. |
| **Reproducible** | Same c → same e, under same φ version. Deterministic model inference. |

### Locality-sensitive hashing as complement

Charikar LSH: similarity drives hash collision. Practical
shape: `h(c) = sign(w · φ(c))` for random hyperplane w;
repeat with k hyperplanes to form a k-bit binary hash.
Property: `Pr[h(c1) = h(c2)]` grows with `cos(e_c1, e_c2)`.

LSH gives cheap Hamming-distance candidate retrieval over
huge corpora; dense-embedding rerank gives precision on
the retrieved candidates.

### Product quantization as compression

If the corpus is large (millions of claims; plausible for
a long-lived factory), dense embeddings get expensive.
Product quantization (Jégou et al.) compresses by
splitting the embedding into subvectors + quantising each.
Memory shrinks 8-32×; accuracy degrades gracefully.
Useful once corpus scale warrants; not required at initial
landing.

---

## Layer 3 — Approximate nearest-neighbour retrieval

### HNSW as default

Malkov-Yashunin 2018 Hierarchical Navigable Small World —
graph-based ANN with logarithmic scaling + strong empirical
performance. Insert / query both O(log n) average. Memory
overhead bounded. Well-documented; multiple production
libraries.

Proposal: HNSW is the retrieval-layer default.
Alternatives (FAISS IVF-PQ, ScaNN, DiskANN) are
interchangeable behind the same interface; substitution is a
downstream tuning question.

### Interface spine

```text
RetrievalIndex:
  insert(c, e, metadata)         -- add canonical form + representation + provenance
  query(e, k) -> [(c, e, metadata, sim)]  -- top-k by similarity
  remove(c, metadata)            -- retraction-native; keys on full insertion
                                    identity (c, metadata) so multiple distinct
                                    insertions of the same canonical form under
                                    different provenance can be retracted
                                    independently. Removing a single insertion
                                    decrements the weighted sum for (c) by 1
                                    rather than nuking all (c) entries.
  replay(events) -> Index        -- deterministic rebuild from event stream
```

`remove(c, metadata)` is not a tombstone; it's a negative-
weight event in the same algebra as insert, keyed on the
full insertion identity `(c, metadata)` so retractions
target a specific insertion rather than nuking all
insertions of the same canonical form. This is the
retraction-native integration: the retrieval index IS a
Zeta-module materialised view over the event stream
`{insert, remove}`, not a separate mutable structure. Same
property as budgets + approvals + receipts in the KSK-as-
Zeta-module proposal (PR #259 7th ferry).

### Replay determinism requirement

Same event stream + same HNSW build-parameters must yield
functionally-equivalent indexes across replays. "Functionally
equivalent" not "bit-identical" because HNSW insertion order
can affect graph structure; two replays may produce
different internal graphs that return the same top-k for
any query. Replay-determinism at the query-behaviour layer,
not the memory-layout layer.

Property test candidate: for a given event stream + query
set, `kNN(query)` results match across independent replays.

---

## Layer 4 — Scoring (sketch only; full formalisation in candidate #3)

The scoring layer is where SD-9 operationalises. Amara's
formulation:

```text
score(y | q) = α · sim(e_q, e_y)
             + β · evidence(y)
             - γ · carrierOverlap(q, y)
             - δ · contradiction(y)

bullshitRisk(q) = 1 - max_{y ∈ C(q)} score(y | q)
```

Each term is a substrate commitment:

| Term | What it measures | Where it lives |
|---|---|---|
| `α · sim` | Semantic closeness between query and candidate | Representation layer + kNN |
| `β · evidence` | Independent evidence associated with candidate (falsifiers run; reproducible measurements; citations outside the query's provenance cone) | Citations-as-first-class graph |
| `γ · carrierOverlap` | Fraction of candidate's provenance cone that overlaps the query's provenance cone (shared ferries, shared memory files, shared drafting lineage) | Provenance-graph traversal |
| `δ · contradiction` | Load of known contradictions involving this candidate | Retraction ledger |

The full scoring formulation (parameter choice,
α/β/γ/δ tuning, output bands, composition with oracle-
scoring v0) is 8th-ferry candidate #3. This doc scopes the
spine; candidate #3 scopes the scoring.

### Aminata-concern preview

The Aminata Otto-90 pass on oracle-scoring v0 (PR #263)
surfaced three classes of concern that will apply here too:

- **Gameable-by-self-attestation.** `evidence(y)` and
  `contradiction(y)` measurements must come from
  independent oracles, not self-report.
- **Parameter-fitting adversary.** α/β/γ/δ changes land
  behind ADR per the parameter-change-ADR-gate pattern
  (oracle-scoring v0 PR #266).
- **False-precision risk.** Output likely wants band
  classifier (RED/YELLOW/GREEN) not decimal score —
  applying the Otto-91 oracle-scoring-v0-redesign pattern.

These are flagged here; candidate #3 addresses them head-on.

---

## Retraction-native ledger of canonical patterns

Per Amara's 8th-ferry framing:

> *"The 'table' should not be a mutable truth database
> that overwrites prior judgments. It should be a
> Zeta-style retractable ledger of canonical patterns:
> known-good patterns, known-bad patterns, superseded
> patterns, unresolved patterns, and provenance edges
> between them."*

Ledger schema (Zeta-native event algebra):

```text
PatternLedger_t ∈ Z[CanonicalForm × Provenance × Status]
  where Status ∈ {known-good, known-bad, superseded, unresolved}

events:
  PatternInserted(c, provenance, status)
  PatternRetracted(c, provenance, status)
  PatternSuperseded(c_old, c_new, reason)
  ProvenanceEdgeAdded(c_from, c_to, edge_type)
  ProvenanceEdgeRemoved(c_from, c_to, edge_type)
```

Note: `PatternRetracted` and `ProvenanceEdgeRemoved` carry
the same identity tuple as their corresponding insert
events — `(c, provenance, status)` for patterns,
`(c_from, c_to, edge_type)` for edges. This preserves the
negative-weight-retraction symmetry of the Z-set algebra:
a retract event is the additive inverse of the insert
event with the same identity, so the algebra stays
balanced. Without `status` on PatternRetracted, a retract
of a `known-good` insertion would also nuke a sibling
`known-bad` insertion of the same `(c, provenance)` —
wrong granularity. Same logic for `edge_type` symmetry on
provenance-edge events.

Materialised views:

```text
CurrentKnownGood   — all (c, provenance) with Status=known-good, positive weight
CurrentKnownBad    — all (c, provenance) with Status=known-bad, positive weight
ContradictingPairs — (c1, c2) pairs joined by an edge with edge_type=contradicting
ProvenanceCone(c)  — transitive closure of provenance edges from c
```

Note: `Status` is a per-node property over the
`{known-good, known-bad, superseded, unresolved}` enum
(applied to canonical forms). `contradicting` is an
`edge_type` over the provenance graph (applied to edges
between canonical forms via `ProvenanceEdgeAdded`), NOT a
node-level Status. The two are distinct concepts; the
`ContradictingPairs` view is a graph-edge query, not a
status filter.

Every scoring query walks these views. No mutable state
outside the event stream.

---

## Composition with existing Zeta substrate

| Existing substrate | Spine composition |
|---|---|
| SD-9 (PR #252) | Scoring's γ·carrierOverlap operationalises SD-9's "downgrade independence when carriers exist." SD-9 is norm; spine is mechanism. |
| DRIFT-TAXONOMY pattern 5 (PR #238) | Scoring's low-max-score output = pattern-5 live detection. Pattern is diagnostic; spine is the detection engine. |
| citations-as-first-class | Provenance edges + lineage tracer are the substrate spine's scoring uses. Citations-first-class defines the graph; spine consumes it. |
| alignment-observability | Anti-gaming + compliance-theatre-resistance discipline applies to parameter choices. No self-attested α/β/γ/δ. |
| Oracle-scoring v0 (PR #266) | Band-valued output pattern applies: RED/YELLOW/GREEN for `bullshitRisk` not decimal score. Parameter-change-ADR-gate applies. |
| BLAKE3 receipt hashing v0 (PR #268) | parameter_file_sha binding pattern extends to N-version and φ-version pinning. Every retrieval event bound to versions in force. |
| Quantum-sensing analogies (PR #278) | Analogies #2 correlation-beats-isolation (kNN retrieval) + #4 decoherence (γ·carrierOverlap) slot into this spine directly. |
| KSK-as-Zeta-module (PR #259 7th ferry) | Same module pattern: event streams + materialised views. PatternLedger fits as peer to BudgetStore / ReceiptLedger / DisputeState. |

No new substrate added; existing pieces compose.

---

## What this doc does NOT do

- **Does NOT commit to specific embedding models.**
  Properties constrain φ; the actual model is a downstream
  design choice with its own tradeoffs (local-only vs
  API-vendor; cost; latency; quality).
- **Does NOT commit to HNSW specifically.** HNSW is the
  default proposal; alternatives interchange behind the
  interface. Choice is downstream.
- **Does NOT commit to canonicalization specifics.** N's
  properties are the commitment; implementation per input-
  type is downstream.
- **Does NOT formalise the scoring layer.** That's
  candidate #3. The sketch here is placeholder so the spine
  composes conceptually; the substrate for full scoring
  landing is what this doc provides.
- **Does NOT propose implementation.** F#/.NET
  implementation, choice of ANN library binding, serialisation
  format for the event stream — all downstream.
- **Does NOT replace citations-as-first-class.** That
  research doc defines the graph structure this spine
  consumes. This spine makes the graph queryable via
  retrieval; the graph itself is citations-first-class's
  job.

---

## Dependencies to adoption

In priority order:

1. **Aminata adversarial pass** on this spine (cheap;
   bounded; anticipates gaps before candidate #3 lands).
2. **Candidate #3 provenance-aware bullshit detector** —
   formalises the scoring layer on top of this spine.
3. **Candidate #4 docs/EVIDENCE-AND-AGREEMENT.md** —
   operational contributor guidance using the detector.
4. **Parameter choices** for canonicalization per input-
   type (natural-language / structured / code).
5. **Embedding-model choice** with explicit latency +
   quality + cost tradeoff ADR.
6. **ANN-library choice** (HNSW default; alternative
   evaluation research doc).
7. **PatternLedger event-stream implementation** as a
   Zeta module following the KSK-as-Zeta-module template.
8. **Property tests** for replay-determinism (same
   event stream → same query behaviour).
9. **Parameter-change-ADR-gate** for N-version /
   φ-version / scoring-parameter evolution.

Each downstream step has its own research doc / ADR /
implementation PR.

---

## Specific-asks (per Otto-82/90/93 calibration)

**None for Otto to proceed.** Spine is research-grade
substrate synthesis; no specific Aaron input needed.
Downstream choices (embedding model; ANN library) will
warrant asks when/if they surface operational trade-offs
Otto can't decide unilaterally.

One passive expectation: Aminata runs an adversarial pass
on this spine when budget fits (same pattern as 5th-ferry
governance edits / 7th-ferry oracle rules / multi-Claude
experiment design). Otto doesn't block on it; pass
informs candidate #3.

---

## Sibling context

- **8th-ferry absorb** (PR #274) — source of the math
  spine + primary-source citations preserved throughout.
- **Quantum-sensing research doc** (PR #278, Otto-97) —
  analogies #2 + #4 directly compose with this spine;
  the composition-table here mirrors the composition-
  table there.
- **Oracle-scoring v0** (PR #266) — band-classifier
  pattern applies to this spine's scoring layer when
  candidate #3 formalises it; parameter-change-ADR-gate
  applies to spine's α/β/γ/δ.
- **BLAKE3 receipt hashing v0** (PR #268) —
  parameter_file_sha binding pattern extends to N-
  version / φ-version pinning in every retrieval event.
- **KSK-as-Zeta-module 7th ferry** (PR #259) — same
  "event streams + materialised views" module shape;
  PatternLedger + RetrievalIndex fit as peers.

Archive-header format self-applied — 15th aurora/research
doc in a row.

Otto-98 tick primary deliverable. Closes 8th-ferry
candidate #2 of 3 remaining (after Otto-96 TECH-RADAR
batch + Otto-97 quantum-sensing research doc).

Remaining 8th-ferry candidates:

- #3 Provenance-aware bullshit-detector research doc
  (M; composes on top of this spine)
- #4 `docs/EVIDENCE-AND-AGREEMENT.md` future operational
  promotion (gated on #3)

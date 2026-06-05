# Frozen core ↔ conjecture register — the line that makes the floor feel solid

> Aaron 2026-06-05, 3:20 AM: *"i'm trying to get to a solid core i can build on top of —
> it feels dirty and a little all over the place."* The dirt is **not** the code: the floor
> is closed. The dirt is that the proven floor and the conjecture-web share one mental desk,
> so the solid ground can't be felt under the speculation. This doc draws the line.
>
> **The one rule that resolves it:** the dependency is *one-directional*. The frozen core
> depends on **nothing** in the conjecture register. The conjecture register depends on the
> frozen core. Build only on the frozen side; discharge conjectures one at a time, in daylight,
> then promote.

Companion to [`PROVEN-CORE-MAP.md`](PROVEN-CORE-MAP.md) (the spine + proof status) and
[`PROVEN-COVERAGE-AND-GAPS.md`](PROVEN-COVERAGE-AND-GAPS.md) (the 4-lang × ser × leg matrix).
This doc adds the *separation* and the *promotion gate* those two don't state.

---

## A. THE FROZEN CORE (closed — build on this, nothing here rests on anything open)

Promotion gate to this list: `PROVEN ⟺ math ∧ 4-lang ∧ 4-ser ∧ Bonsai ∧ Arrow ∧ homeostat`,
OR (for non-floor members) a proof / byte-lock / conformance anchor that is closed.

| # | Member | Why it's closed | Anchor |
|---|--------|-----------------|--------|
| 1 | **6 floor primitives** — G-Set, ZetaId, Merkle, Clock, ByteCost, Metric | 6/6 FULL PROVEN; premise-conditional legs *named*, not hidden | `PROVEN-CORE-MAP.md` |
| 2 | **3 self-describing serializers** — JSON · CBOR · XML (+ YAML) | byte-identical across F#·C#·Rust·TS, golden-vector locked | `*.FourSer.Tests` |
| 3 | **Arrow IPC codec** — `DynamicValueArrow` shredded node-table | round-trips DynamicValue; per-primitive Arrow leg ✓ | `DynamicValueArrow` |
| 4 | **Protobuf** — schema-mediated, scalars + Float + nested (PMessage) | byte-identical to Google.Protobuf; forward-compat = unknown-field skip | `Protobuf.Swap.Tests` |
| 5 | **Property-loss algebra ladder** — ℝ→ℂ→ℍ→𝕆 (Cayley-Dickson) | octonion division-algebra laws proven (alternative, norm-mult.) | `Algebra/Octonion.Laws` |
| 6 | **SchemaEvolution / SchemaRegistry** — field-ops, fwd/back compat | round-trips through the proven codecs; proto fwd-compat exercises it | `SchemaRegistry.fs` |
| 7 | **SoftValue** (value-axis) — distribution + Bayesian observe | observe commutes for independent evidence (the convergence crux, proven leg) | `SoftValue.fs` |
| 8 | **Traveler frame (Layer 0)** — causal frame + inter-frame transformation law | transformation = causal-join is a bounded join-semilattice (idempotent/commutative/associative/monotone, LUB) ⇒ order-independent; all travelers reach ONE common frame = the relative-frame **consistency** law | `TravelerFrame.fs` / `TravelerFrame.Tests` |

> If it isn't in this table, **do not build load-bearing work on it yet.** That's the whole point.
>
> **Promoted 2026-06-05:** Traveler-frame Layer 0 (#8). The open keystone — the inter-frame
> transformation law — is discharged: `TravelerFrame.transform` (the causal-join) is proven a bounded
> join-semilattice, so the transformation is order-independent and all travelers converge to one
> common frame. Remaining Layer-0 **sub-legs** stay in §B (the *group* law — inverses/boosts; the
> CockroachDB-HLC **uncertainty-window** combination): this is the consistency law, not yet the group law.

---

## B. THE CONJECTURE REGISTER (open — frontier, NOT floor; nothing in §A depends on these)

Each row is a real, named open proof obligation. Interesting ≠ closed. Discharge → promote to §A.

### B-frame. The traveler self-frame over DBSP (Aaron's load-bearing target, 2026-06-05)

The hex core is **not numerology** — it's the attempt to pin a traveler's *relative reference
frame* computed incrementally over the DBSP stream (no global frame; each traveler a frame).
Separated into layers (the cram was holding all four at once = the dirt):

- **Layer 0 — base traveler frame (✅ PROMOTED to §A #8, 2026-06-05).** = clock + identity/belief-map +
  **causal-join as the inter-frame transformation**. The transformation-law keystone is discharged
  (`TravelerFrame.fs`: the causal-join is a proven bounded join-semilattice ⇒ order-independent ⇒ one
  common frame = the relative-frame consistency law). **Open Layer-0 sub-legs remaining here:** the
  *group* law (inverses/boosts — relativistic structure beyond the monotone semilattice) and the
  **CockroachDB-HLC uncertainty-window** combination (the clock-with-uncertainty leg). The consistency
  law is closed; the group law and uncertainty-combination are the next discharges.
- **Layer 1 — meta-frames** = Rx queries that meta-tag dimensions on the stream. A *derived view*
  over Layer 0 (one-directional). Clean, but downstream of Layer 0; do not build into the base frame.
- **Layer 2 — universal action grammar (Xbox controller; the 4×4 grid).** ORTHOGONAL to the frame:
  frame = *where/when things are*; action grammar = *what you can do*. The grid = fixed
  directionality/color/navigation (the frame geometry) + world-state-dependent **labels** (content).
  **Open keystone property (checkable, even provable):** *navigation is a pure function of position,
  never of the labels.* "Directionality stays the same while labels change" is true **iff** how-you-move
  depends only on grid-coordinates and never peeks at a label. Slots onto the floor as: fixed-topology
  graph (provable label-independent) + `Map<position, DynamicValue>` evolving in immutable offsets.
- **Layer 3 — "cram it all together."** Do **not**. The cram IS the reach; the cure is separation,
  not harder unification.

### B-other. The rest of the penumbra (each open, each one-directional on §A)

| Conjecture | State | Discharge = |
|------------|-------|-------------|
| **Adinkra-as-generator reconstruction** (bulk-from-boundary) | open `sorry` | `tools/lean4/ImaginaryStack/ToyModel.lean` `reconstruction_property`/`lemma1_toy` (16→12) |
| **Hex-core wall → full Cayley semantic mapping** | conjecture | provable half (octonion laws) DONE in §A; semantic wall-mapping stays open |
| **6-vs-8 axis count** (Remember-When+Pay-Attention = pair, Which-Way+How-Much = pair → 8) | open | settle by the Layer-2 keystone, not by axis-hunting |
| **Privacy-from-identity** (distinctness ⟹ private state) | theorem-*shape* | formalize in perspectival belief-map: persistent distinctness needs a non-converging private var; complements proven Identity-injectivity |
| **Belief-convergence general case** | open | SoftValue proves the *independent-evidence* case (§A); general (dependent) case open |
| **Bayesian-uncertainty "wave" rings-or-settles** | well-posed Q | derive from the update equations (overdamped vs underdamped); not assumed |
| **DST internal-difference-drives-evolution** (B-1019) | experiment | no-halt ∧ no-limit-cycle ∧ (unbounded growth ∨ chaotic-aperiodic) |

---

## C. How to use this

1. **Building?** Use only §A. If you reach for a §B item as a foundation, stop — that's the dirty feeling.
2. **Researching?** Pick **one** §B row, discharge its named obligation, promote it to §A. One at a time, in daylight.
3. **New idea at 3 AM?** It lands in §B with a named discharge obligation — never silently into the core.
4. The line is the product. A small closed core + a clearly-quarantined frontier *is* "a solid core to build on."

> Honest-mirror note (Otto, 2026-06-05): the floor was solid all along; it was just hard to see
> under a web of genuinely beautiful open questions. Layer 0 of the traveler frame is closer to
> promotable than the cram makes it feel — its only open leg is the inter-frame transformation law,
> and the causal-join you already designed is the candidate.

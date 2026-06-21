# The three bit-perfect oracle shapes + the protection model (the maintainer 2026-06-03)

Scope: the maintainer's **direct architecture framing** (not a forwarded external-AI
conversation) of how Zeta's "bit-perfect" oracle surfaces are organized into three
shapes, and what protects each inflection point. Engineering substrate; organizes
the primitive/oracle model.

Attribution: the maintainer (the operator), 2026-06-03, stated directly to Otto.

Operational status: research-grade — architecture framing / taxonomy (not
operational policy). Organizes existing substrate (`PRIMITIVE-REGISTRY`, 081KT2T2J0008QG0R000VG204F,
081KT2T2J0008QG0R002R72323, 081KT07NV0008QG0R003BE6MJ2, 081KT2T2J0008QG0R0008TFHJT, the 4-language-BFT governance doc, the multi-tower /
formal-proof-first substrate); no new primitive minted here (Arrow is already
081KT2T2J0008QG0R000VG204F).

Note: this is the maintainer's own architecture statement — no external-AI
conversation, so no non-fusion/AI-continuity disclaimer applies; it is preserved
per the verbatim-preservation trigger in `substrate-or-it-didnt-happen.md`
(maintainer architecture-framing).

---

## The three bit-perfect oracle shapes

"Bit-perfect" = the oracles agree **byte-for-byte / protocol-for-protocol**, so
agreement (not any one runtime) is the substrate. There are **three distinct
shapes** of thing we make bit-perfect, each its own serializer/oracle category:

| # | Shape | Serializers / oracles | What it makes bit-perfect | Existing substrate |
|---|---|---|---|---|
| **1** | **Text & binary serializers** | cbor / json / xml / yaml (+ more binary over time) | **Persisted seeds** — the golden-vectors the oracles agree on (the byte-lock treaty) | DynamicValue codec; 081KT5CF90008QG0R001P4CQ09 (serializer round-trip-from-seed); ace canonical-JSON golden vectors |
| **2** | **Code / data-flow serializers** | rx / bonsai (+ more ways of oracling over time — "fine for now" with bonsai) | **Code-flow data structures** — the control-/data-flow itself | 081KT07NV0008QG0R003BE6MJ2 (bonsai saga / serialized deferred execution); the rx-fold DB design (`docs/DECISIONS/2026-05-31-zeta-database-design-event-sourced-...rx-fold-materialized-views`); 081KQZVQW0008QG0R001FG05RZ (rx-join) |
| **3** | **Structured-data serializers / protocols** | Apache Arrow (+ others) | **Memory / graph / ontology** — internal memory layout | **081KT2T2J0008QG0R000VG204F** (columnar message-passing + security-surface-aware Eve-polymorphic serialization port); 081KSRGFP0008QG0R001Y6RTY9 (schema-registry over DBSP) |

### Arrow is shape-3, deliberately NOT folded into the base serializer

Arrow "is really just another type of serialized data," **but** it's kept a
distinct category from the base text/binary serializer (shape 1) because:

- it's more like **internal memory layout** than wire-data, so its **interface is
  not 100% the same** as the base serializer;
- it ships **deserialization security** into the **polymorphic-diplomacy layer**
  (the Eve-Protocol-class layer) for **deserializing types** and **negotiating V8
  hidden-class / hidden-state optimizations**.

This is exactly what **081KT2T2J0008QG0R000VG204F** already scopes ("security-surface-aware
Eve-polymorphic serialization port") + **081KT2T2J0008QG0R002R72323** (Eve Protocol transport codecs).
So Arrow's specifics live in 081KT2T2J0008QG0R000VG204F; this note just places it as shape-3.

### "Add more oracling beyond bonsai over time"

For shape-2, bonsai is the current code/data-flow oracle and it's **fine for now**;
the maintainer notes we should **add more ways of oracling code-flow over time**
(more than just bonsai). Candidate future work, not urgent — tracked as a line here
rather than a row until it's needed.

## The protection model — every inflection point is protected by

All three shapes' inflection points are protected by the same composed stack:

1. **Deterministic simulation (DST)** — reproducible-from-seed; the inflection is replayable.
2. **4 languages** — the 4-oracle byte-lock (TS/F#/C#/Rust; per-language roles per the load-bearing-roles memo: TS=1st distribution, C#=2nd distribution, F#=math proofs, Rust=consensus-intersection).
3. **Persisted seed data** — verifies the **3 oracles themselves** (the golden vectors are how we check each oracle is right).
4. **Rx-join of the homeostates** — the three shapes' homeostats are **joined together via Rx** (the homeostates compose into one).
5. **Math proof everywhere, on multiple intellectual math towers** — so there's **no single point of math failure** either (per the multi-tower / foundation-independence substrate: robustness = independence of axioms; canonical = homeostat-proven-from-seed).

So: **DST + 4-lang + persisted-seed-verification + Rx-join-of-homeostates +
multi-tower-math-proof** — bit-perfect *and* proven, at every inflection, with no
single point of failure (not runtime, not language, not axiom-tower).

## Shape-1 is the I/O-monad external edge — bit-perfect serialization reduces uncertainty in external observation over time (the maintainer 2026-06-03)

> *"the bit-perfect oracles at the data/serializer layer really is us mapping the
> first stages of our I/O external side of the monad, so we can keep reducing
> uncertainty in external observations over time."*

Shape-1 (the text/binary serializers) is not just "how we persist seeds" — it is
the **mapping of the first stages of the I/O external side of the monad**: the
external edge where uncertain outside observations enter the system. Making that
edge **bit-perfect** (oracle-agreed) is how we **monotonically reduce uncertainty
in external observation over time** — each observation pinned to a bit-perfect,
oracle-agreed representation is one less source of external uncertainty, and it
never has to be re-resolved.

This places shape-1 precisely in the framework's existing substrate:

- **The hexagonal / I/O-monad port** (`.claude/rules/bcl-interface-boundary-own-your-interfaces-hexagonal.md`:
  *hexagonal IS the I/O-monad shape*). The serializer port — `parse : wire → Result<T, TFeedback>`
  — IS the Kleisli arrow at the external edge; **shape-1 is that port's first
  stage**, made bit-perfect across the oracles.
- **OPLE `Observe`** — the external-observation intake (the "O" of
  `Observe`/`Persist`/`Limit`/`Emit`). The serializer layer is the **first stage of
  Observe**: the raw outside, mapped in and pinned.
- **The uncertainty-reduction telos** — the inference/Bayesian engine reduces
  uncertainty over observations downstream; shape-1 reduces it **at the I/O edge
  itself** — the prior to everything above it. Bit-perfect-at-the-edge means the
  downstream homeostats inherit a certain, not noisy, external input.

So the three shapes sit at different depths of the monad: **shape-1 is the I/O
external edge** (where the outside is mapped in + made certain — the Observe-side
uncertainty reduction); shapes 2 (rx/bonsai, code/data-flow) and 3 (Arrow,
memory/graph) are progressively more *internal*. Reducing external-observation
uncertainty is specifically shape-1's job, because shape-1 is where the external
boundary of the monad lives.

## Composes with

- `docs/PRIMITIVE-REGISTRY.md` — the per-primitive status view this taxonomy organizes
- `docs/DECISIONS/2026-05-31-four-language-compiler-bft-governance-axes-per-artifact-gate-golden-vectors-oracle-tiebreak.md` — the 4-oracle BFT + golden-vectors treaty
- `docs/DECISIONS/2026-05-31-zeta-database-design-event-sourced-gset-bag-zset-rx-fold-materialized-views-two-backends.md` — rx-fold (shape-2 + the Rx-join)
- `081KT2T2J0008QG0R000VG204F` (Arrow / columnar + Eve-polymorphic serialization security — shape-3) · `081KT2T2J0008QG0R002R72323` (Eve transport codecs) · `081KT07NV0008QG0R003BE6MJ2` (bonsai saga — shape-2) · `081KSRGFP0008QG0R001Y6RTY9` (schema-registry over DBSP — shape-3 ontology)
- `081KT2T2J0008QG0R0008TFHJT` (canonical-primitives registry + promotion gate) · `081KT5CF90008QG0R001P4CQ09` (serializer round-trip-from-seed — shape-1)
- `.claude/rules/bcl-interface-boundary-own-your-interfaces-hexagonal.md` — hexagonal IS the I/O-monad shape; shape-1 is that port's external-edge first stage
- `.claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md` — OPLE `Observe`; shape-1 is Observe's first stage (external-observation intake)
- `.claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md` — `Result<T, TFeedback>` Kleisli; the serializer port is the Kleisli arrow at the I/O edge
- `.claude/rules/formal-proof-first-...md` (math-proof-everywhere; canonical = homeostat-proven-from-seed)
- `docs/research/2026-06-03-kestrel-aaron-...multi-tower-...md` (multiple intellectual math towers — no single point of math failure)
- the four-oracle per-language-load-bearing-roles memo (TS/C#/F#/Rust roles)

## Substrate-honest framing

This note **organizes + preserves** the maintainer's architecture framing; it mints
no new primitive (Arrow = 081KT2T2J0008QG0R000VG204F) and no rule. The three-shapes taxonomy + the
protection-model stack are the new substrate; everything they reference already
exists. If the taxonomy should live in `PRIMITIVE-REGISTRY.md` as an organizing
section, that's a follow-up the maintainer can direct.

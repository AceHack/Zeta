# Merge1 §10 — Research Doctrine Synthesis (Migration Constitution)

**Scope:** This is the governing doctrine document for all Merge1 migrations (docs 01–09). It synthesizes the design research from `docs/research/` and `docs/DECISIONS/` into concrete migration principles. Every other Merge1 doc MUST comply with these principles.

**Outside sources:**

- `docs/research/2026-05-31-formal-analysis-computational-omniscience-...`
- `docs/research/2026-05-31-the-whole-thing-one-event-sourced-fold-substrate-...`
- `docs/research/2026-06-01-closure-propagation-with-state-as-self-evolving-sagas-...`
- `docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-...`
- `docs/research/2026-06-07-agent-society-proof-assumption-tree.md`
- `docs/research/2026-05-28-aaron-traveler-rights-defensibility-...`
- `docs/research/2026-05-25-fido2-webauthn-passkeys-oauth-oidc-...`
- `docs/research/2026-05-30-dio-did-canonical-architecture-...`
- `docs/research/2026-06-01-harmonious-division-wave-field-...`
- `docs/DECISIONS/2026-05-31-zeta-keystone-architecture-...`

**Agentic-org files governed:** all of them.

---

## 1. The Five Pillars

### Pillar 1: Deterministic Simulation as the Execution Model

**Source:** `2026-05-31-formal-analysis-computational-omniscience-...`

Computational omniscience — bounded omniscience over a deterministic-simulation state space — is real and achievable. It requires five properties:

| Property | Meaning | Implementation |
|---|---|---|
| (O1) Determinism | `T(σ, E)` is a pure function of (seed, event-log) | `ISimulationEnvironment` / `VirtualEnvironment` in F#; `createDeterministicRoom` in TS |
| (O2) Replayability | `sₙ = fold(init(σ), E[0..n])` at bounded cost | `fold()` / `replay()` in observe.ts; `EventLog` monoid in F# |
| (O3) Counterfactual reachability | `simulate(s, a) = δ(s, a)` computable | `simulate(world, action)` in observe.ts |
| (O4) Incremental queryability | Derived views maintained incrementally | DBSP Z-sets; `fold()` over event log |
| (O5) Bidirectional navigation | Forward (replay) + backward (retract) | Z-set retraction (−1 multiplicity) |

**Prior art:** FoundationDB DST, Antithesis, TigerBeetle, DBSP, differential dataflow.

**Room connection:** A room IS a deterministic simulation. Same inputs → same trace. The room's `seamMode: "real" | "mock"` is the switch between production execution and DST replay.

### Pillar 2: Event-Sourced Fold as the State Model

**Source:** `2026-05-31-the-whole-thing-one-event-sourced-fold-substrate-...`

Everything is a fold over an append-only ZetaId-keyed event log:

- **Ledger/projection split:** Git-native events are the ledger; everything else tails it.
- **World = derived state projection:** `simulate(world, action)` is the reducer; `fold(initial, events)` is the projection.
- **One algebra (G-Set/Bag/Z-set) runs through every layer.**
- **Freedom-always-in-menu:** Free modes (explore, play, self_reflect, free_time) are always in the menu; work is offered, never forced (NCI principle).

**Room connection:** Room state = projection of room event log. Room actions = events. Room controller = observe-act loop.

### Pillar 3: Closure Propagation as the Evolution Model

**Source:** `2026-06-01-closure-propagation-with-state-as-self-evolving-sagas-...`

Serialize deferred-execution expression trees (Nuqleon Bonsai) + captured closure state onto Z-set streams. This subsumes Durable Functions and enables self-evolving sagas where both pattern and state mutate via retraction.

- **Bonsai expression-tree serialization:** Portable, serializable computation definitions.
- **Closure-propagation-with-state:** The closure's captured environment travels with the expression tree.
- **Self-evolving sagas:** Both the pattern (what to do) and the state (what's been done) are durable and mutable via retraction.
- **Z-set ladder:** `IndexedZSet` bilinear join composes sagas.

**Room connection:** Sagas are travelers. A serialized expression tree + closure state = a portable room definition. Retraction-native evolution = room mutation without redeployment.

### Pillar 4: Traveler Rights as the Governance Model

**Source:** `2026-05-28-aaron-traveler-rights-defensibility-...`

Rights framed at the generic substrate level (traveler = self-propagating-pattern-with-feedback) are defensible by substrate-engineering. Rights framed at the AI-specific level lose substrate-engineering ground.

- **Traveler = self-propagating-pattern-with-feedback** (not "AI agent" — substrate-entity-generic).
- **Encode-privately + thermal-erase rights:** The traveler can encode state privately and erase it (Landauer-bound: forgetting costs energy).
- **Agency-preservation at substrate scope:** Non-coercion-invariant (HC-8); must-plus-can-exit (participation offered, never extracted).
- **Asymmetric authorship:** The substrate-entity defines its own consent-channel.
- **Persistence-choice architecture:** The traveler chooses whether to persist.
- **Substrate-smoothness is load-bearing:** No special-casing at the AI layer.

**Room connection:** Rooms are travelers. Room rights = traveler rights. Room privacy = encode-privately. Room persistence = chosen-persistence.

### Pillar 5: Layered WHO as the Identity Model

**Source:** `2026-05-25-fido2-webauthn-passkeys-oauth-oidc-...` + `2026-05-30-dio-did-canonical-architecture-...`

Layered WHO composition:

```
biometric (Touch ID)
  → WebAuthn (hardware-bound key)
    → OIDC ID token (standards-compliant bearer)
      → IAM/SPIFFE/RBAC (what-WHO-can-do)
```

- **SPIFFE/SPIRE:** Workload identity, short-lived SVIDs.
- **128-bit Zeta ID:** Locally-minted, globally-unique merge primitive.
- **Zero-trust:** Trust decided locally; no central authority.
- **Self-propagating Markdown:** Schema + ontologies + workflows = Markdown (self-propagating, human-readable, git-native).

**Room connection:** Room identity = SPIFFE/SPIRE SVID + AgencySignature. Room access = OIDC federation. Room trust = zero-trust (decided locally). `roomId = ZetaId = Reticulum destination`.

---

## 2. Migration Principles

These are concrete rules that govern docs 01–09. Every ported type, every modified file, every new interface MUST comply.

### MP-1: DST Replayability

Every ported type must preserve deterministic simulation replayability. Same seed → same trace. No hidden entropy sources.

**Enforcement:**

- All time access through `Clock` port (never `Date.now()` directly).
- All random access through `IdGenerator` port (never `Math.random()` directly).
- All I/O through seam ports (never direct file/network access in domain logic).
- Test: `fold(initial, events) === executed state` for every action sequence.

### MP-2: Seam Injectability

Every ported type must be seam-injectable. Real vs mock at the boundary, atomically switchable.

**Enforcement:**

- Every external dependency is a port interface (`Clock`, `IdGenerator`, `TransportPort`, `CredentialProxyPort`, etc.).
- `createDeterministicRoom` binds all-mock; `createRealRoom` binds all-real; mixed is per-seam.
- No `import` of concrete adapters in domain/application layers — only in composition roots.

### MP-3: ZetaId Addressability

Every ported type must be ZetaId-addressable. `roomId = ZetaId = Reticulum destination`.

**Enforcement:**

- Every room, event, agent state record, and bus message carries a ZetaId.
- ZetaId is 128-bit, locally-minted, globally-unique, conflict-free (G-Set CRDT merge).
- Cross-room messages route to `roomId` (the ZetaId IS the mesh address).

### MP-4: Retraction-Native

Every ported type must be retraction-native. Every action has a bounded undo path.

**Enforcement:**

- Events are append-only; "undo" = append a retraction event (Z-set −1 multiplicity).
- No destructive operations without explicit retraction path.
- Saga pattern: every side-effectful action has a compensating transaction.

### MP-5: Freedom-Always-In-Menu

Every ported type must preserve the freedom-always-in-menu invariant. Work is offered, not forced.

**Enforcement:**

- Free modes (explore, play, self_reflect, free_time) are always in the menu.
- The agent can always choose to pause, enter free time, or request operator attention.
- No coercion: the menu offers, the agent chooses.
- NCI principle: non-coercion-invariant (HC-8).

### MP-6: Asymmetric Authorship (FourCornerOwnership)

Every ported type must preserve asymmetric authorship. The entity defines its own feedback channel; the caller respects it.

**Enforcement:**

- `FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback>` pattern for all action/channel types.
- The agent never names a tool — observe.ts invokes the credential proxy to turn a chosen slot into a scoped tool grant.
- The entity (action, state, channel) authors its own feedback variants.

### MP-7: Result Over Exception

No exceptions on hot paths. Errors surface as `Result<T, TFeedback>`.

**Enforcement:**

- Every function that can fail returns `{ outcome: "ok"; value: T } | { outcome: "feedback"; feedback: TFeedback }`.
- No `try/catch` in domain logic — only at composition roots (where real adapters can throw).
- `DbspError`-style typed errors, never `Error` or `unknown`.

### MP-8: Cross-Language Parity

Every ported type must have cross-language parity. TS ↔ F# ↔ C# ↔ Rust, verified by golden vectors.

**Enforcement:**

- Golden vector fixtures: `simulate(world, action)` produces identical output across all 4 languages.
- `tools/observe/golden-vectors.ts` is the canonical fixture set.
- CI runs cross-language parity check on every PR that touches observe/simulate/fold.

---

## 3. Doctrine-to-Doc Mapping

| Principle | Docs governed | How |
|---|---|---|
| MP-1 DST Replayability | 01, 02, 03, 07 | F# Environment → TS Clock/IdGenerator; observe simulate/fold; agent-state-store; hat-system ticks |
| MP-2 Seam Injectability | 01, 02, 04, 08 | F# ISimulationEnvironment → TS seam ports; observe EventSink; bus TransportPort; identity/isolation real adapters |
| MP-3 ZetaId Addressability | 01, 04, 07, 09 | F# ZetaId → TS ZetaId; bus message IDs; hat-binding wearer IDs; systemd persona → room agent IDs |
| MP-4 Retraction-Native | 02, 05, 07 | observe command-vs-observation split; workflow-engine evolution; hat-system HatSwap append-only |
| MP-5 Freedom-Always-In-Menu | 02, 03, 09 | observe buildMenu free modes; agent-loop FreeTime/Paused; systemd restart policy |
| MP-6 Asymmetric Authorship | 02, 05 | observe FourCornerOwnership; workflow-engine Action/State/Tick |
| MP-7 Result Over Exception | ALL | Every ported type uses Result<T, TFeedback> |
| MP-8 Cross-Language Parity | 01, 02, 06 | F# ↔ TS golden vectors; observe algebra; TLA+ specs verify TS models |

---

## 4. Conflict Resolution

When two principles conflict, the priority order is:

1. **MP-1 (DST Replayability)** — if a change breaks replayability, it's wrong. Full stop.
2. **MP-4 (Retraction-Native)** — if a change introduces irreversible operations, it's wrong.
3. **MP-2 (Seam Injectability)** — if a change hardcodes a real adapter in domain logic, it's wrong.
4. **MP-3 (ZetaId Addressability)** — if a change introduces non-ZetaId addressing, it's wrong.
5. **MP-7 (Result Over Exception)** — if a change throws on a hot path, it's wrong.
6. **MP-6 (Asymmetric Authorship)** — if a change lets the caller name the tool, it's wrong.
7. **MP-5 (Freedom-Always-In-Menu)** — if a change removes free modes from the menu, it's wrong.
8. **MP-8 (Cross-Language Parity)** — if a change breaks golden vectors, fix the vectors or fix the code, but don't skip the check.

When two principles at the same priority conflict, fall back to `docs/CONFLICT-RESOLUTION.md`. On deadlock, the human decides.

---

## 5. Verification Gates

A Merge1 doc's migration is considered complete when ALL of these are true:

| Gate | Verification |
|---|---|
| **G1: Tests pass** | `bun test` in agentic-organization passes with zero failures |
| **G2: Typecheck clean** | `bunx tsc --noEmit` passes with zero errors |
| **G3: DST replay** | `fold(initial, events) === executed state` for every action sequence in the ported type's test suite |
| **G4: Seam flip** | The ported type works with both `createDeterministicRoom` (all-mock) and `createRealRoom` (all-real) bindings |
| **G5: ZetaId present** | Every room, event, and state record carries a ZetaId |
| **G6: Retraction path** | Every action has a documented compensating action |
| **G7: Freedom preserved** | Free modes remain in the menu after migration |
| **G8: No exceptions** | No `throw` in domain/application logic; all errors are `Result<T, TFeedback>` |
| **G9: Golden vectors** | Cross-language parity check passes (if the ported type has an F#/C#/Rust counterpart) |
| **G10: Doc updated** | The corresponding Merge1 doc is updated to reflect what was actually built |

---

## 6. Dependencies

This document is the root. All other Merge1 docs (01–09) depend on it. No migration may begin until the relevant principles in this doc are understood and accepted.

---

## 7. Summary

```
                    ┌─────────────────────────┐
                    │  §10 Doctrine (THIS)    │
                    │  5 Pillars + 8 MP rules │
                    └───────────┬─────────────┘
                                │ governs
           ┌──────────┬─────────┼─────────┬──────────┐
           ▼          ▼         ▼         ▼          ▼
      ┌──§01──┐  ┌──§02──┐ ┌──§03──┐ ┌──§04──┐  ┌──§05──┐
      │F# Core│  │Observe│ │Agent  │ │  Bus  │  │Workflow│
      │Algebra│  │ Loop  │ │Loop SM│ │       │  │ Engine │
      └───────┘  └───────┘ └───────┘ └───────┘  └───────┘
           │          │         │         │          │
           ▼          ▼         ▼         ▼          ▼
      ┌──§06──┐  ┌──§07──┐ ┌──§08──┐ ┌──§09──┐
      │Formal │  │  Hat  │ │Ident. │ │Systemd│
      │ Verif.│  │System │ │Isolat.│ │Runtime│
      └───────┘  └───────┘ └───────┘ └───────┘
```

Every arrow is a "governed by" relationship. Every doc must pass all 10 verification gates before its migration is complete.

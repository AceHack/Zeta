# OpenSpec Catch-up: Phase 1 Audit & Sequencing

This document contains the audit and sequencing for Phase 1 of the OpenSpec catch-up project (081KQNJ500008QG0R001N94412). The goal of this phase is to identify the most critical, unspecced capabilities in the Zeta codebase and prioritize them for spec authoring.

> **Correction (2026-05-28):** the initial draft of this audit concluded that
> `openspec/specs/` was "effectively empty." That conclusion was inaccurate —
> the directory already contains seven substantive specs (see §1). The audit
> below has been re-grounded against the actual tree; three of the four
> capabilities originally flagged as "prime candidates for spec authoring" are
> in fact already specced, leaving the tick-history schema as the only genuinely
> unspecced load-bearing capability in this audit set. Preserved per the
> verify-existing-substrate discipline.

## 1. Audit of Existing Specs (`openspec/specs/`)

An audit of the `openspec/specs/` directory on 2026-05-28 found **seven authored, substantive specs**, each a `spec.md` under its own slug directory following the OpenSpec `openspec/specs/<slug>/spec.md` convention:

| Spec | Path | Lines | Scope (from `## Purpose`) |
|---|---|---|---|
| operator-algebra | `openspec/specs/operator-algebra/spec.md` | 678 | Z-set abelian group, signed-weight retraction, the four stream operators `z^-1` / `I` / `D` / incremental-distinct |
| agentic-organization | `openspec/specs/agentic-organization/spec.md` | 612 | Agentic-organization capability |
| lsm-spine-family | `openspec/specs/lsm-spine-family/spec.md` | 412 | LSM spine integrating a Z-set delta stream into a queryable trace; four spine variants |
| circuit-recursion | `openspec/specs/circuit-recursion/spec.md` | 264 | Nested-circuit semantics for the DBSP §5-6 recursive-query pattern; inner clock, scope-boundary lifecycle, iteration cap |
| repo-automation | `openspec/specs/repo-automation/spec.md` | 230 | Repo-automation capability |
| durability-modes | `openspec/specs/durability-modes/spec.md` | 189 | Declarative backing-store correctness/throughput knob; mode→implementation factory; feature-flag gating |
| retraction-safe-recursion | `openspec/specs/retraction-safe-recursion/spec.md` | 180 | Three least-fixed-point combinators for Datalog-style recursive queries over Z-set streams |

The `DbspSpec.tla` file (`tools/tla/specs/DbspSpec.tla`) and the Lean proof (`tools/lean4/Lean4/DbspChainRule.lean`) are formal artifacts that live outside the `openspec/` tree but provide overlapping coverage of the DBSP operators.

**Conclusion:** The `openspec/specs/` directory is **substantially populated**, not empty. The OpenSpec framework already covers the operator algebra, recursion semantics, LSM spine, and durability modes. The remaining Phase 2 gap is narrower than the initial draft assumed.

## 2. Audit of Core Capabilities

The following core capabilities were identified as load-bearing and were audited for existing implementations and specifications.

### Z-Set Algebra
- **Implementations:** `src/Core/ZSet.fs`, `src/Core/IndexedZSet.fs`
- **Specs:** **Already specced** — `openspec/specs/operator-algebra/spec.md` defines the Z-set abelian group, its signed-weight retraction semantics, and the four stream operators.
- **Notes:** No new top-level spec needed. Any Phase 2 work here is refinement of the existing `operator-algebra` spec (e.g., `IndexedZSet`-specific operations if not yet covered), not greenfield authoring.

### Tick-History Schema
- **Implementations:** A suite of tools under `tools/hygiene/` (e.g., `append-tick-history-row.ts`, `check-tick-history-order.ts`) operate on the tick history shards.
- **Specs:** **None found** in `openspec/specs/` (verified — no existing spec references the tick-history schema).
- **Notes:** The structure of the tick-history shards is a critical, cross-cutting concern. A formal spec would document the schema, frontmatter fields, and the invariants that the hygiene tools enforce. **This is the genuinely unspecced capability in this audit set.**

### DBSP Operators
- **Implementations:** `src/Core/` operator surface; a Lean proof at `tools/lean4/Lean4/DbspChainRule.lean` proves the chain rule; multiple research documents reference DBSP.
- **Specs:** **Already specced** — `openspec/specs/operator-algebra/spec.md` covers `z^-1` / `I` / `D` / distinct, and `openspec/specs/circuit-recursion/spec.md` pins the nested-circuit semantics for the DBSP §5-6 recursive-query pattern. A TLA+ spec also exists at `tools/tla/specs/DbspSpec.tla`.
- **Notes:** No new OpenSpec authoring required. Phase 2 work here is reconciliation: confirm the `operator-algebra` + `circuit-recursion` specs, the TLA+ spec, and the Lean proof agree on the operator semantics; close any drift between them.

### Retraction-Native Semantics
- **Implementations:** This concept is diffuse and appears in many places. The ADR `docs/DECISIONS/2026-04-24-graph-substrate-zset-backed-retraction-native.md` is a key document.
- **Specs:** **Already specced** — the signed-weight retraction semantics are part of `openspec/specs/operator-algebra/spec.md`, and `openspec/specs/retraction-safe-recursion/spec.md` defines the retraction-safe least-fixed-point combinators.
- **Notes:** The foundational principle is captured across `operator-algebra` and `retraction-safe-recursion`. Phase 2 work, if any, is consolidating a cross-cutting statement that references both, not authoring a new spec from the ADR alone.

## 3. Phase 1 Sequencing

Based on the corrected audit, three of the four originally-flagged capabilities are already specced. The prioritized Phase 2 sequence is therefore much shorter:

1.  **`openspec/specs/tick-history/spec.md`:** Define the canonical schema for tick-history shards — frontmatter fields, body format, and the invariants enforced by the `tools/hygiene/` suite. **This is the only greenfield spec from this audit set and is the highest priority.**
2.  **DBSP reconciliation (no new spec):** Audit `operator-algebra` + `circuit-recursion` + `tools/tla/specs/DbspSpec.tla` + `tools/lean4/Lean4/DbspChainRule.lean` for mutual agreement; record any drift as follow-up rows rather than re-authoring.
3.  **Retraction-native consolidation (optional):** If a single cross-cutting reference is desired, add a short pointer in/near `operator-algebra` linking the signed-weight semantics, `retraction-safe-recursion`, and the ADR. Not greenfield authoring.

This concludes the corrected Phase 1 audit. The next step is to author the tick-history spec, the only genuinely unspecced capability surfaced here.

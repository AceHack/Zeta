# `ensure`/declarative nouns protect a resource — a yin/yang stored proc (DynamicValue/SoftValue)

**Aaron, 2026-06-08 (#7046):**

> "ensure-like declarative nouns are almost always protecting a resource and need a file to save the
> resource and a DU to wrap the imperative commands — unless there are clever merge/CAS techniques for
> idempotency to avoid the DU. ensures should be able to be represented as DynamicValue or SoftValue
> yin/yang stored proc."

This generalizes the no-DDL `ensure` model (#7039/#7040, realized in `Catalog` #7010): every `ensure`-like
declarative noun has the same anatomy.

## Anatomy of an `ensure`

A declarative `ensure` **protects a resource** (the thing it keeps in the desired state) and needs:

1. **A file to save the resource** — the resource's persisted state (the current value `ensure` diffs
   against). For `Catalog` this is the catalog table; in general it's a `file`/`table`/`db` row (#7002/
   #7029) — the homoiconic store of the protected resource.
2. **A DU to wrap the imperative commands** — the lowering (#6998): `ensure(desired)` diffs vs the saved
   state and emits a **DU of imperative deltas** (the `Upsert`/`Retract` meta-DML in `Catalog.ensure`).
   This is the "automatic schema evolution as a DU over DML" (#7040), generalized to any resource.
   - **Exception (no DU needed): clever merge/CAS.** When the resource's writes are **idempotent by
     construction** — CRDT merge, content-address/CAS, compare-and-swap — there's no need to *compute* an
     imperative DU: convergence is free (the "clever declarative" path, #6998/#7029). `ensure` then just
     merges/CASes the desired value; the DU is only needed when the operations aren't natively idempotent.

## `ensure` is itself a homoiconic value — a yin/yang stored proc

An `ensure` is **representable as a `DynamicValue` or `SoftValue`** (homoiconic, #7041): it's data, not a
special construct. Aaron calls it a **yin/yang stored proc**:

- **yin/yang** (the engine of change — what-acts / what-remains): `ensure` carries both the **desired
  target** (what remains / the invariant it protects) and the **imperative DU** it derives (what acts /
  the change) — the yin/yang pair as one value.
- **stored proc**: the imperative DU is a *stored, replayable program* (a saga of deltas) attached to the
  declarative target — like a database stored procedure, but **as data** (a `DynamicValue`/`SoftValue`
  tree), so it serializes, diffs, merges, and replays (DST §7) like everything else.
- **SoftValue** when the resolution is criteria-ranked (the dep-policy cut #7044: security/stability/
  recency Pareto) — `ensure` over multiple eligible variants is a *soft* choice, so it's a `SoftValue`.

So: `ensure = { protects: resource-ref; target: DynamicValue (desired); evolution: DU-of-deltas | merge/CAS }`
— a homoiconic yin/yang stored proc.

## Honest scope (peel)

Design capture generalizing #7040; the concrete instance exists (`Catalog.ensure` — resource = catalog
table, DU = DML deltas, idempotent). NOT built: a generic `Ensure` value type carrying
`{resource, target, evolution}` as a `DynamicValue`/`SoftValue`; the CAS/merge-vs-DU auto-selection; an
`ensure` verb in the grammar routing to a resource's protector (the executor wires the *data-plane* verbs
today, #7045 — `ensure` is the declarative follow-on). Records the anatomy + the yin/yang-stored-proc
representation as the target shape.

## Anchors (Beacon)

- **Declarative reconcile protecting a resource** — Kubernetes controllers (a controller protects a
  resource toward `spec`), Terraform (state file + plan/DU), `ensure` (Ace #6964).
- **Stored procedures as data / sagas** — `DurableSaga` (#6996); event-sourced stored procedures.
- **Idempotent-by-construction (no DU)** — CRDTs (Shapiro 2011), CAS, content-addressing (#7029 clever
  declarative).
- **yin/yang** — the engine-of-change primitive (`YinYang.fs`); **SoftValue** (`SoftValue.fs`, Pareto/
  criteria #7044); **DynamicValue** (#7041 homoiconic).
- Internal: #7039/#7040 (no DDL, ensure→DU), #7010 (Catalog), #6998 (declarative→DU-over-imperative + CAS
  exception), #7041 (homoiconic values), #7044 (policy/SoftValue), #7045 (grammar wiring).

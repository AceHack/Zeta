# The 11 Root Discipline Specifications (Zeta building codes)

Carved sentence:

> Zeta-shaped systems are built under eleven specifications — the
> operational floor. A design that violates any of them does not belong
> in Zeta unless an explicit, substrate-honest exception is on file.
> Full prose for each lives in the manifesto; this rule is the index.

## The eleven (names + where the detail lives)

Source of truth: [`docs/governance/MANIFESTO.md`](../../docs/governance/MANIFESTO.md) §1–§11.

1. **Scale-free** — no central point of control/coordination/failure
2. **Lock/Wait-free** — no blocking or coordination via shared mutable state
3. **Weight-free** — no permanent/irreversible authority (weight creates capture)
4. **Bounded Mobility** — compute/data may relocate only within safety bounds
5. **Memory Preservation Guarantee** — identity transitions never silently destroy memory
6. **Consent-First Design** — ongoing, granular, revocable consent on every observation surface
7. **Deterministic Simulation Testing (DST)** — every critical path replays deterministically
8. **Data Vault 2.0** — partition substrate by change rate (hub/link/satellite)
9. **Recursive** — same rules at every scale, no special cases
10. **Self-similar** — shape stays recognizable at every magnification
11. **Default Moral Regard (Default Oracle)** — highest regard for morally-relevant entities absent a chosen oracle

Orientation: **m/acc** + **Multi-Oracle Principle** (no single mandatory
morality; #11 is the default oracle). See the manifesto.

## Overlap with the always-active engineering disciplines

Specs 1, 2, 3, 7, 8 are *also* always-active engineering disciplines.
**Idempotency** is a 6th always-active discipline but is NOT one of the 11.
Full discipline checklist: [`dv2-data-split-discipline-activated.md`](dv2-data-split-discipline-activated.md).

## Pointers for detail

- Full prose, m/acc, derivation chain, lock status: [`docs/governance/MANIFESTO.md`](../../docs/governance/MANIFESTO.md)
- Six always-active disciplines + master data: [`dv2-data-split-discipline-activated.md`](dv2-data-split-discipline-activated.md)
- DST deeper treatment (archived): `.claude/rules.bak/dst-plus-persist-plus-generator-time-plus-feedback-equals-computational-omniscience-over-simulation-substrate.md`

> Manifesto is at PARTIAL LOCK — specs 5 & 6 carry `[RECONSTRUCTION NOTE]` markers; it is the canonical surface for any change.

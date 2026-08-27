# DUs expand to DynamicValue and SoftValue; granular DV2 repo splits; local → global

*2026-08-26. Operational status: research-grade absorb of a current-state
plan; live pointer
[`docs/trajectories/own-ai-harness/RESUME.md`](../trajectories/own-ai-harness/RESUME.md).
GOVERNANCE.md §33.*

Aaron 2026-08-26: use discriminated unions to expand into DynamicValue
and SoftValue — the bridge to Bayesian stuff over **our own
interpretation**. Dogfooding while splitting into reusable chunks that
live in their own repo is the theme; more granular repo splits are
expected (dozens), using Data Vault-like splitting on **repo and
toolchain**. The overarching concert is **local actions that lead to
global effects**.

## DU expand (checked)

`src/Core/DuExpand.fs`:

| Register | Shape |
|---|---|
| Collapsed | `DynamicValue.Object` with `"k"` = case tag (same wire as `ObserveBridge.nextActionToDv`) |
| Soft | `SoftValue` over those objects — calibrated distribution, `snap` is the only collapse |
| Local action | `DuExpand.localAction` — one case, the +1 |
| Global effect | `DuExpand.globalEffect` — `SoftValue.observe`; independent locals **commute** |

Likelihood boosts the matching tag and keeps other tagged cases
positive. A 0/1 likelihood on mutually exclusive DU cases is a
contradiction, not a vote.

This is the Bayesian reading of the same verbs `zeta-bnn` / factor
graphs already fold. SoftValue never invents certainty
(`observe` returns `None` on empty support).

## Granular splits (not executed here)

Already decided, not relitigated:

- Peer repos, **never submodules** — ADR 2026-04-22
- Ordered cutover — ADR 2026-08-26 (gated; no repo created from this absorb)
- Two split axes, both real (round 3): **change rate (CCP)** vs
  **toolchain closure (CRP)**. 87% of the union footprint is
  single-owner. Strong CRP cuts the change-rate axis could not see:
  `zeta-formal`, `zeta-wasm`.
- Dogfood in the monorepo, then extract the thing we are already
  running (Harny first). Expect **dozens**, not a three-repo ceiling.
- DV2: hub (stable code) / link (pins, manifests) / satellite
  (docs, memory) — *and* toolchain (dotnet vs bun vs Lean vs wasm vs
  k8s).

Clone-at-tag stays sufficient. Ace never becomes the only path.

## Local actions → global effects

One agent's DU pick, one repo's commit, one `DbCommand.Emit` is a
**local +1**. The global fold is commutative: SoftValue observe,
Z-set add, Ace version-pin + dispatch. That is the same concert as
`ZSetRx.connectQuery` and `local-command.backgroundSync`.

Workitem `081M10AAVAT087G0R0027M0GV5`.

## Anchors

- F# discriminated unions (sum types)
- Pearl (1988) *Probabilistic Reasoning in Intelligent Systems*
- Linstedt Data Vault 2.0; Martin CCP/CRP
- ADR 2026-04-22; ADR 2026-08-26; repo-split round 3

# Rx query between +1 and −1; own BNN; local commands + remote DU sync

*2026-08-26. Operational status: research-grade absorb of a current-state
plan; live pointer
[`docs/trajectories/own-ai-harness/RESUME.md`](../trajectories/own-ai-harness/RESUME.md).
GOVERNANCE.md §33.*

Aaron 2026-08-26: the connection between the two DBSP folds is likely an
**Rx query between +1 and −1**, generalising to any Z-set; serialize Rx
with **Bonsai** tree serialization. The +1/−1 connection already has a
lot of formal analysis (FourCornerTrace, Clifford, BNNs / factor graphs).
This is **another model we support on top of vendor ones** — our own
from-scratch model with **online learning**. Commands must **work locally**,
with **background checks** that sync them with remote based on
**preexisting DUs**.

## The query (checked)

`src/Core/ZSetRx.fs` is the standing query:

| Query | Bonsai | Algebra |
|---|---|---|
| `integrateQuery` | `acc + delta` | DBSP `I` (+1 fold) |
| `retractQuery` | `neg delta` | unary minus, appended later |
| `connectQuery` | `plus1 + minus1` | ping-return; net view |

The tree never mentions `'K`. Same bytes over `ZSet<int>` and
`ZSet<string>`. Persist via `Bonsai.serialize`; unfold via `ZSetRx.eval`.
Meijer 1991 μ ⇄ ν; DeSmet Reaqtor/Bonsai; Budiu et al. VLDB 2023.

This is the first persistable IQbservable-shaped query (ROADMAP P2
IQbservable item). It is not the full queryable Rx surface.

## Formal siblings — consistent with, not identified by count

- **`FourCornerTrace`** — generator re-reads immutable `H`;
  `−gen(before)+gen(after)` is `connectQuery` at the WSet layer.
  `−1 = i²` on ℂ is a ring identity (C₄), not a physics claim.
- **Clifford** — generators square to ±1; the reflection sandwich uses
  −1. Same *shape* as ping-return. Not an identification of E₈ / D₄.
- **`MinimalBnn` + `FactorGraph`** — online +1 absorb of a likelihood
  message; IV is the objective. Retracting an observation reinterprets
  the evidence *set*. EP/ADF re-normalisation is **not** Z-set minus
  (inverse-free corners do not instantiate the trace).
- **Student-t ADF** (`student-t-bnn.ts`) — sequential +1; the 2026-08-14
  one-slot bug was a fold that discarded all but the last observation.

## Own model (not a vendor login)

`src/Core.TypeScript/model-backend/own-model.ts` (`zeta-bnn`):
local, `kind: "online-learner"`, `chatCompletions: false`. It is **not**
a `PROVIDER_ROSTER` row (those are paid accounts). Harny supports it
*beside* grok/claude/openai as a DU chooser (ActionGrid / NextAction),
not as a chat-completions drop-in. Remaining: wire it as
`observeWithBnn`.

## Local commands, background remote DU sync

`src/Core.TypeScript/observe/local-command.ts`:

- `runLocal` / `observeLocal` — no network (μ / `simulate`)
- `backgroundSync(world, door)` — injected ν door only
- `observeAfterRemote` — merge remote `ForgeState`, then the
  **preexisting** `NextAction` DU (e.g. `do_item` with `merge-pr-N`)

`DbCommand.Emit` / `Retract` on `IDeltaLog` is the same pair on the
data plane (`InMemoryDeltaLog` is the local backend).

Workitem `081M109WG5S087G0R0021E5MPT`.

## Anchors

- Meijer, Fokkinga & Paterson (1991) *Bananas, Lenses, Envelopes and Barbed Wire*
- Bart DeSmet — Reaqtor / IQbservable / Nuqleon Bonsai
- Budiu et al. (2023) DBSP
- Minka (2001) Expectation Propagation; `MinimalBnn` / Student-t ADF
- Joyal–Street–Verity (1996) traced monoidal categories

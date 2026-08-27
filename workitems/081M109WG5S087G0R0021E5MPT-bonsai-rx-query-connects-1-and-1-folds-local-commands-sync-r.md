---
id: 081M109WG5S087G0R0021E5MPT
type: task
state: in-progress
priority: P1
slug: bonsai-rx-query-connects-1-and-1-folds-local-commands-sync-r
title: "Bonsai Rx query connects +1 and -1 folds; local commands sync remote DUs; own BNN model"
created: 2026-08-27T00:28:28.218Z
depends_on: []
composes_with:
  - 081M107N9P4087G0R0002G5SR0
  - 081M100RB97087G0R0008EAAY7
---

# Bonsai Rx query connects +1 and −1 folds; local commands; own BNN

Aaron 2026-08-26: the two folds connect by an **Rx query** (generic Z-set,
Bonsai-serialized). Formal analysis already covers +1/−1 (FourCornerTrace,
Clifford, BNNs / factor graphs). Own from-scratch **online-learning** model
sits beside vendor chat backends. Commands **work locally**; background
checks sync remote using **preexisting DUs**.

## This increment

1. `src/Core/ZSetRx.fs` — `integrateQuery` / `retractQuery` / `connectQuery`
2. `src/Core.TypeScript/observe/local-command.ts` — `runLocal`, `backgroundSync`
3. `src/Core.TypeScript/model-backend/own-model.ts` — `zeta-bnn` roster card
   (not a login provider, not chat-completions)

## Remaining

- Full IQbservable over Bonsai (this is one query, not the surface)
- `observeWithBnn` as a NextAction chooser
- Observation retract on the BNN that is honest about EP vs Z-set minus
- Wire `backgroundSync` into `run-loop-real.ts` so forge GraphQL is ν not a
  blocking command

## Honesty

EP/ADF re-normalisation ≠ Z-set −1. Clifford C₄ is consistent-with, not
an identification. `zeta-bnn` does not complete chat.

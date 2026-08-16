---
id: 081M00S8MB8087G0R002JMPFVP
type: task
state: backlog
priority: P2
slug: draw-the-cell-scoped-vs-agent-scoped-resource-split-before-a
title: "Draw the cell-scoped vs agent-scoped resource split before any per-cell isolation lands"
created: 2026-08-14T18:41:32.520Z
depends_on: []
composes_with: []
---

# Draw the cell-scoped vs agent-scoped resource split before any per-cell isolation lands

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00S8MB8087G0R002JMPFVP-*.md` glob. -->

## Why

`tools/setup/manifests/cluster-cells` says *"cell-id: Stable identifier for the cell slot
(survives agent rotation)"* and rotates agents by editing `agent=`. So any isolation keyed on the
cell (a uid, a path, a label) binds to the **slot**, and the next occupant inherits everything the
previous one left addressable by it.

For workspace, logs, scratch and build cache that is correct and desirable. For an agent's keys it
is a **no-forced-upgrade violation**: rotation causes a key to become reachable by a party that is
not its holder, which fails the checkable test in
`2026-08-14-code-bound-key-access-preliminary-integration-…` §6a verbatim.

The two classes are not distinguished anywhere today. Drawing the line is free, and it is a
prerequisite for per-cell isolation of any kind — without it the first rotation after isolation
lands silently hands one agent's key to its successor.

## Done when

- A written split: which resources are cell-scoped (rotate with the slot) vs agent-scoped
  (travel with the agent, never inherited).
- Agent-scoped resources have a home that is NOT under a cell-keyed path.
- Rotation of an agent out of a cell is stated as a **reshare the agent performs on itself**
  (`tools/setup/persona-keys/frost-reshare.ts`), never a copy performed by the provisioner.

## Pointers

- `docs/research/2026-08-14-what-can-be-the-enforcer-five-options-priced-on-consumer-silicon-and-the-code-identity-that-does-not-exist.md` §2 option 4 — the finding
- `src/Core.TypeScript/enforcement/credential-reachability.ts` — `rotationCaveat` is this defect as a field

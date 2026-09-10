---
id: 081M24JX66S087G0R001PY3MKB
type: task
state: backlog
priority: P2
slug: break-the-named-meta-harness-back-edges-by-inverting-to-weig
title: "break the named meta-harness back-edges by inverting to weight-free contracts (repo-split round 4, recommendation 3)"
created: 2026-09-10T02:38:47.513Z
depends_on: []
composes_with: []
---

# break the named meta-harness back-edges by inverting to weight-free contracts (repo-split round 4, recommendation 3)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M24JX66S087G0R001PY3MKB-*.md` glob. -->
## What this is

Round 4 of the repo-split research measured the agent meta-harness — Aaron's
top-named split candidate — at a **cut cost of 105** with **38 back-edges**, and
its own recommendation was *"break edges, don't move yet"*
(`docs/research/2026-09-09-repo-split-round-4-aarons-named-candidates-measured-and-the-ace-coupling-that-already-exists.md`
§3.1, §9). This is that edge-breaking. **Nothing moved to a new repo and no repo
was created**; the meta-harness is still exactly where it was.

## The measurement, before and after

Both numbers come from the committed tool, over the narrow variant-A boundary
the 105 figure was computed for (the 14 directories in §3.1: `model-backend`,
`agent-loops`, `harny`, `orchestrator`, `orchestrator-checks`, `swarm`,
`swarm-society`, `workflow-engine`, `bg`, `lanes`, `peer-call`, `agent-bus`,
`routines`, `src/SwarmRunner`):

```bash
bun src/Core.TypeScript/research/repo-split-cut-cost.ts --cycles
```

| | files | internal | OUT | IN | **cut** | back-edges |
|---|---:|---:|---:|---:|---:|---:|
| before (`4c03fbd24`) | 205 | 265 | 67 | 38 | **105** | 38 |
| after | 207 | 273 | 73 | 18 | **91** | **18** |

**20 back-edges broken. The cut falls 105 → 91.**

### Two corrections to the doc's own figures, measured live

The document reports the named clusters as **22** edges (`corporate/` 13,
`observe/udp-lossy-loop.test.ts` 7, `tools/setup/manus-smoke-test.ts` 2). Live at
`4c03fbd24` they are **24**: `corporate/` is **15**, not 13. The 38 total is
unchanged, so the difference is an attribution slip inside the clusters, not
drift in the graph. A measurement quoted from a document is a dated claim; this
row is what the tool prints today.

The doc also projects **105 → 83** for those 22. That projection prices the
breaks at zero, and inversion is never free: a contract module the harness
itself must import costs one forward edge per importing harness file. Six such
edges were added (below), which is why the floor is 91 rather than 83. **83 was
not reachable by inversion**, and reaching it would have required moving
consumers inside the boundary — which §3.1 already priced as net worse
(variant B: 105 → 122).

## What was broken, and how

Every break is the same move, and it is the one
`.claude/rules/interfaces-free-classes-earned-under-rules.md` already carves:
**the interface half is free and goes where anyone may depend on it; the
behaviour half is earned and stays with its weight.** In each case a module held
both, so a consumer that wanted only the vocabulary had to import the
implementation to get it.

| # | seam | edges | how |
|---:|---|---:|---|
| 1 | `protocol/agent-loop-contract.ts` | **8** | The agent loop's DU/record types (`AgentState`, `MenuOption`, `WorkResult`, `AgentPersona`, `DoraMetrics`, `StatusSnapshot`, `WorkCandidate`, `Lane`, `AgentContext`, `TrajectoryPhase`) left `workflow-engine/agent-loop/state-machine.ts`, which imports them back and re-exports them. Seven `corporate/` files and `observe/merge-receipt.ts` now import the contract. |
| 2 | split `observe/udp-lossy-loop.test.ts` | **7** | One file asserted a transport claim and a participant claim at once, and stood up six `model-backend/` modules to do it. Split into `model-backend/udp-lossy-persona-interrupt.test.ts` (the interrupt-over-a-lossy-wire claim, with its subject) and `observe/cloud-persona-participant.test.ts` (the fallback claim, against an `ISummon` object literal — no wire). |
| 3 | move `manus-smoke-test.ts` | **2** | Into `model-backend/`. It is that backend's live smoke test; nothing in the install path calls it; a bootstrap surface must not need the harness present. |
| 4 | `four-corner/ownership.ts` | **2** | The generic `FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback>` left `workflow-engine/types.ts` for the directory whose subject it is. `observe/observe.ts` and `algebra/wset-four-corner-trace.ts` follow it. |
| 5 | `protocol/summon-contract.ts` | **1** | `ISummon` / `SummonOptions` / `SummonResult` left `peer-call/summon.ts`, which also holds `PersonaSummoner` — a class that resolves a persona registry, runs the peer firewall, shells out to vendor CLIs and opens WebSockets. `observe/participant.ts` never constructs one; it only needed the port. |

Seams 4 and 5 also account for one edge each inside seam 2's file, which is why
the rows sum to 20 rather than 21.

### The six forward edges this cost

`state-machine.ts` → `protocol/agent-loop-contract`; `workflow-engine/types.ts` →
`four-corner/ownership`; `peer-call/summon.ts` → `protocol/summon-contract`;
`model-backend/manus-smoke-test.ts` → `secrets/keychain-macos`;
`model-backend/udp-lossy-persona-interrupt.test.ts` → `zeta-id/types` and →
`discovery/lossy-broadcast-mesh`.

The first three are the price of the inversion and are the shape a split wants:
they say a `zeta-harness` repo would consume a small, named, type-only contract
tier alongside the `zeta-id` + `bus` kernel §3.1 already identified. The last
three are pre-existing coupling that was invisible while the two files sat
outside the boundary.

## What was NOT broken, and why

**Eight `corporate/` → `workflow-engine/agent-loop/` edges remain, and they
should.** Every one of them is a **value** import — `transition`, `cycleClose`,
`postResultTransition`, `generateMenu`, `isNonCoercive`, `applyTransition`,
`isTerminal`, `currentState`, `readHistory`, `mainAsync`. `corporate/` calls the
loop; it does not merely name its shapes.

That direction is deliberate and already enforced in this repo.
`corporate/agent-loop-bridge.ts` says so in its own header — *"corporate imports
the core, the core never imports corporate (`register-boundary.test.ts`). An
organization is one thing that can supply a status surface and a candidate list;
the loop does not know it exists."* **A consumer calling a library is not a
cycle; it is a dependency, and a split turns it into a published one.** Inverting
it would mean `corporate` declaring ports and something injecting the loop into
them at runtime — indirection bought for a graph number, paid for in weight,
against a boundary that is drawn correctly. So the answer to "is this boundary in
the wrong place" is **no**: the layering is right, and what was wrong was only
that the *vocabulary* travelled with the *behaviour*. Seam 1 fixed that half, and
`agent-loop-bridge.ts` now carries two imports on purpose — one on the contract,
one on the loop — so the residual coupling is countable rather than hidden inside
a mixed import.

Two pure predicates (`isNonCoercive`, `isTerminal`) were considered for the
contract tier and **left where they are**. The contract modules admit types only.
A pure function is still behaviour that a second language must reproduce
identically, and `isNonCoercive` expresses an invariant of the generator it
lives beside; moving it would separate a claim from the thing it is a claim
about.

The remaining 10 back-edges are outside the named clusters and were not in
scope: `forge-host/github/gh-cli.ts` → `model-backend` (2, token resolution —
the doc's own "published interface" candidate), `tick-dial.test.ts` (2),
`ferry-throttler` (1), `arc-solver` (1), `apps/twitch-ai` (1),
`docs/books/.../translate_book.ts` (1), `observe/run-loop-real.ts` (1),
`observe/merge-receipt.ts` → `work-lifecycle-state-machine` (1). The last two
and `translate_book.ts` construct `PersonaSummoner` or call `applyTransition`
directly — composition roots and value calls, the same class as the eight above.

## Unknown

- **Whether the harness is worth splitting at all.** §8 marks the reuse claim
  `toy` and names its falsifier (stand up one consumer outside this repository).
  Nothing here runs it, and nothing here should be read as evidence for it. This
  change is justified on its own terms — a free interface and an earned class
  were sharing a module — and would be worth making if the split never happened.
- **What the cut cost of the *other* boundary variants is now.** Only variant A
  was re-measured.
- **Runtime coupling.** The tool reads three edge kinds; anything travelling by
  `Bun.spawn`, shell-out, file path or HTTP is invisible to it and to this
  change (§1 limit 1).

## Checks

- `bun src/Core.TypeScript/research/repo-split-cut-cost.ts` — the falsifier; if
  the cut had not fallen, the edges were not broken.
- `node node_modules/typescript/bin/tsc --noEmit` — clean.
- `bun test` — full suite green; every touched directory re-run individually.
- The new transport test is mutation-checked: deleting `interruptPersona(ch)`
  turns it red (`reply.kind` becomes `"answer"`), so it is a falsifier and not a
  test that cannot fail.

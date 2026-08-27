# Cheap forge verbs — observe a DU, do not ad-hoc poll

*2026-08-26. Operational status: research-grade absorb of a current-state
plan; live pointer
[`docs/trajectories/own-ai-harness/RESUME.md`](../trajectories/own-ai-harness/RESUME.md).
GOVERNANCE.md §33.*

Aaron 2026-08-26: forge-host verbs for **minimal resource usage** on
anything that can fail a merge (status, comments, threads, checks).
Naive GraphQL/REST polling is expensive. Callbacks may exist.
Eventually **git goes through ZetaFS/DB** — we are our own source
control; that is another bootstrap. Harny should be tightly bound to
**discriminated-union workflows** and the **Xbox universal controller
grammar**. Ad-hoc commands exist, but the load-bearing ones are
context/DU-aware so the agent has latest state **because the verb
refreshed**, not because the model chose to.

## The cost bug

`gh pr view` + `gh pr checks --required` + `gh api` comments is N
metered calls, and an LLM tool-chooser will call a random subset.
Agreement between those calls is not evidence (they share a clock and
a quota). A merge process is a **discriminated union** (`wait-ci` |
`fix-failed-checks` | `resolve-threads` | `rebase` | `clean`). Observe
**that**. One round-trip.

Shipped this change: `observeMerge` (`github-merge-observe.ts`) —
one `POST /graphql`. Tests pin `calls.length === 1`. Open-PR list
for the observe World snapshot is also one GraphQL (`observeOpenPullRequests`)
so `World.forgeState.cleanPrCount` is not stuck at 0 (REST list does
not carry `mergeStateStatus`).

## Observe.ts is the controller; Harny is a scheme / executor

We already have the DU harness. Do not invent a second one.

`src/Core.TypeScript/observe/observe.ts` is a **pure** `World → NextAction`
controller (Xbox 16-slot grammar in `grammar-16.ts`). Vendor CLIs
(claude, kiro, …) plug in as **executors** (`kiro-executor.ts`,
`subscription-executor.ts`) — Observe is the external harness around
any vendor harness, not the other way around. Harny's job is to become
that executor (summon + closed tools) and to **wire World channels**
so refresh is the snapshot, not a tool the model picks.

Same architectural shape as the corporate `agentic-organization/.../observe.ts`
(ADR 2026-05-31): one keystone, 16-slot rendering on top, no parallel
action language.

### Meijer μF / νF (checked)

Erik Meijer, Fokkinga & Paterson (1991) *Bananas, Lenses, Envelopes and
Barbed Wire*: for a functor F, **μF** is the initial algebra (finite
data, fold / catamorphism) and **νF** is the terminal coalgebra
(process, unfold / anamorphism). Rx is that duality as
`IEnumerable ⇄ IObservable`. In-tree: `DynamicValue` is μF (data at
rest); Bonsai is a **finite μ description of a ν standing query**
(`docs/research/2026-08-11-rename-as-rolling-migration-*`).

The forge World snapshot is μ (a fold of one GraphQL observe). The
subscription/webhook is ν (the standing query). You cannot store ν;
you store its μ generator and unfold on arrival. Cheap verbs are μ
snapshots; callbacks are ν. Ad-hoc `gh pr checks` is neither — it is
an unmetered peek that pretends to be an observation.

### Reservoir computing (checked)

Jaeger 2001 echo-state networks; Maass 2002 liquid state machines:
**do not train the reservoir, train the readout.** Workflows / DU
grammar / ActionGrid are the **walls** (spectral constraints). Observe
is the **readout**. Harny closed tools should not teach the model a
bag of polls; they constrain the reservoir so the readout
(`observe(world)`) sees a current World. Detail:
`docs/research/2026-05-28-aaron-workflow-as-reservoir-computing-*`.

## Callbacks (optional, not a hub)

GitHub can push `check_suite` / `check_run` / `pull_request_review` /
`pull_request`. That is a **listen**, not an appointed broker
(`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`).
Observe stays correct without webhooks; webhooks only mean we do not
have to ask. Workitem `081M107N9P4087G0R0002G5SR0`.

## ZetaFS as the git bootstrap

ROADMAP item 1 (NO GIT CLI) is the same sentence as "we are our own
source control." The destination is **not** LibGit2Sharp forever: dual
DBSP Z-set folds over our Merkle DAG (`ZetaFsDualFold` — forward `I`,
generator-reinterpret `−1` as a new append, `ZSetMerkle` snapshot,
`DagFs` trees). `ZetaFsDeltaLog` is the own-format log; `GitDeltaLog`
is the hexagonal v1 adapter. Factory still execs `git`. Closing that
is a bootstrap: clone-at-tag still builds
(`.claude/rules/clone-at-tag-stays-sufficient.md`); Ace never becomes
the only path; ZetaFS becomes the *good* path for Harny's sc/fs tools.
Closed-tools workitem `081M100RH3Q087G0R0018X4RSJ`; dual-fold
`081M108RYNT087G0R001JSRNZE`.

## Harny × ActionGrid

The Xbox 4×4 (`ActionGrid.fs`) is the fixed grammar; labels change
with world state. Harny closed tools should be **cells on that grid**,
not a bag of bash. Refresh is the move, not a side quest. Workitem
`081M107N9PZ087G0R0006X16SJ`.

## Anchors

- ActionGrid / UAG: `src/Core/ActionGrid.fs`; Xbox-controller rule;
  `docs/research/2026-06-07-universal-action-grammar-xbox-controller-*`
- Cost of polling: GitHub REST/GraphQL secondary rate limits
- Webhooks: GitHub Checks API (`check_suite`, `check_run`)
- Source control without git(1): `ZetaFsDualFold` / `ZetaFsDeltaLog` / `DagFs`; LibGit2Sharp `zeta` is v1; ROADMAP item 1

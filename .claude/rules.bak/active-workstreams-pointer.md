# Active work-streams pointer — the single cross-lane index is `docs/ACTIVE-WORKSTREAMS.md`

Carved sentence:

> `docs/ACTIVE-WORKSTREAMS.md` is the ONE doc that indexes every active lane and its
> master row + driving surface. Current lanes (operator-confirmed 2026-06-01):
> workflow→sovereign-DB · encryption · zflash · git-accelerator · Ace-distribution.
> It is a **map, not a queue**: `claim acquire` before working any item, respect
> surface lanes, and check the claim-coordinator + open PRs for live claims (the
> git-native bus once 081KSXN940008QG0R00171YAZW populates `docs/agent-bus/`). A bridge
> until observe.ts coordinates lanes automatically.

## Why this rule exists

The operator needs **one doc to remember all active work** across surfaces, and
multiple surfaces (otto-cli / otto-desktop / otto-vscode / otto-windows + Vera)
cold-boot the same repo. This short auto-loaded pointer names that doc and carries
the multi-surface collision-guard in the same breath, so a shared boot does not
make every surface pile onto the same items.

## The single doc

**[`docs/ACTIVE-WORKSTREAMS.md`](../../docs/ACTIVE-WORKSTREAMS.md)** — the cross-lane
index: each active lane → its master row(s) + the surface working it, plus the
coordination discipline. Distinct from `ROADMAP.md` (shipped features) and
`CURRENT-ROUND.md` (round status); this is _who is building what, per lane._ Update
it there when lanes shift; the claim-coordinator + open PRs are the live,
always-current truth (the git-native bus joins once 081KSXN940008QG0R00171YAZW populates it).

## Map, not a queue — the collision-guard

1. **`claim acquire` first** — per [`claim-acquire-before-worktree-work.md`](claim-acquire-before-worktree-work.md);
   a second surface that tries a claimed item gets exit-1 and picks another.
2. **Respect lanes** — per [`agent-roster-reference-card.md`](agent-roster-reference-card.md);
   don't cross into another surface's active lane.
3. **Check the live registry** — **today** the claim-coordinator
   (`bun tools/bus/claim.ts check`) + open PRs (authoritative now). The git-native
   cross-machine bus (`docs/agent-bus/`, 081KSXN940008QG0R00171YAZW) becomes the registry **once 081KSXN940008QG0R00171YAZW
   populates that folder** — it is absent on main today, so don't rely on it yet.
   The doc's lane snapshot is only a cold-boot hint.

This is the 081KSXN940008QG0R003FCQ7WT §0 agent-partition recognition applied to the agents themselves:
each surface is a shard, `claim acquire` is the join-point, lanes are the partition,
the bus carries claims across machines.

## Temporary by design

Per the operator (2026-06-01): _"until we get observe.ts all working then it won't
be an issue."_ Once the observe.ts loop coordinates lanes automatically (bus +
claims + dashboard), this manual pointer + index are redundant — retire them then.

## Composes with

- [`docs/ACTIVE-WORKSTREAMS.md`](../../docs/ACTIVE-WORKSTREAMS.md) — the single cross-lane doc this points at
- [`claim-acquire-before-worktree-work.md`](claim-acquire-before-worktree-work.md) — the split-brain guard
- [`agent-roster-reference-card.md`](agent-roster-reference-card.md) — the surface / lane registry
- [`wake-time-substrate.md`](wake-time-substrate.md) — why a cold-boot pointer (so active lanes are never re-forgotten)
- 081KSXN940008QG0R00171YAZW (git-native bus) — the live cross-machine claim registry
- 081KSNY2Z0008QG0R002QA720J (three-lanes-concurrent operating discipline) — the coordination-discipline lineage
- 081KSXN940008QG0R001A4WWX4 (observe-loop sub-tracker) — the loop whose completion retires this pointer

## Full reasoning

The operator 2026-06-01: _"i just really need a single doc somewhere for me to
remember all of it"_ + _"with the other two lanes too — Vera and Windows-Otto"_ +
_"we can save it however makes sense for your guys until we get observe.ts all
working."_ `docs/ACTIVE-WORKSTREAMS.md` is that single cross-lane doc; this pointer
makes it the stable handle every surface lands on, with the collision-guard inline,
retired when observe.ts automates the coordination.

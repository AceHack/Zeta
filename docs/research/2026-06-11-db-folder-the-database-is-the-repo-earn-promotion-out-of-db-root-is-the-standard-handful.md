# /db — the repo *is* the database; root is the standard handful; everything earns promotion out of /db

Aaron 2026-06-11 (expanding [081KTQD8A0008QG0R0030HWMZV](../backlog/P2/081KTQD8A0008QG0R0030HWMZV-root-declutter-for-dx-max-db-folder-grouping-plus-max-adopts-interfaces-rx-verbs-2026-06-10.md)):

> "We need a plan to make Max happy — push this into a `/db` folder or something over time and clean up
> root. **Everything at root has to earn its promotion out of `/db`** other than `/src`, `/tests`,
> `/docs` — whatever the handful is for standard projects. **Everything else is part of our
> multi-OS multi-language database** that runs 24 hours a day on GitHub Actions and tests itself on every
> OS with every language and serializer constantly, and makes treaties and rooms, and the intercom system
> is Reticulum… and it knows its boundaries because our Markov boundaries and network knowledge are super
> tight."

This reframes 081KTQD8A0008QG0R0030HWMZV from "tidy the root for Max" to a **first principle**: the repo is not a project with
a database in it — **the repo IS the database**. So the topology should say so.

## The principle: default-deny at root, earn promotion out of /db

Invert the default. Today a folder lands at root by being created. The new rule:

> **Root is default-DENY.** A top-level entry must *earn* its place by being part of the **standard
> project handful** every contributor expects. Everything else lives in **`/db`** — because everything
> else IS the database (the rooms, treaties, lenses, saves, futures, registries, the greek/letter
> scratch trees, the oracles' goldens…). A folder leaves `/db` for root only when it earns promotion.

This is **DV2.0 on the repo topology itself** (the same lens that drives repo-split smells): root = the
stable, universally-expected **hub**; `/db` = the fast-growing, factory-specific **satellite** where the
database's substrate accretes. It's also **least-privilege for attention**: a fresh `ls` shows a new
contributor (Max) only the handful they need, not the 80-entry wall.

## What earns root (the standard handful — promotion criterion)

A folder earns root **iff a contributor cloning *any* standard project would expect it there** — i.e. it
is an audience-universal, tooling-anchored concern, not factory substrate:

| Earns root | Why (the criterion) |
|---|---|
| `src/` `tests/` `docs/` | the universal source/test/doc handful |
| `tools/` | the host-bootstrap shield (install.sh closes over deps *before* our source — 081KTQD8A0008QG0R0005EFYPV); pre-source by definition |
| `.github/` `.claude/` `*.sln` `*.json` (build/lock) `README` `LICENSE` `.gitignore` `CLAUDE.md` `AGENTS.md` `GOVERNANCE.md` | tooling/CI/governance anchors the toolchain or a fresh reader hits first |

**Everything else → `/db`.** The current root has ~80 entries — the single letters `a`…`z`, the greek
`alpha`…`omega`, plus `rooms/ boards/ bus/ clis/ registry/ saves/ futures/ lens/ hooks/ universal/
uncertainty/ shapes/ sets/ …`. Under this rule the root drops to the handful; the rest becomes
`db/rooms/`, `db/boards/`, `db/a/`, `db/alpha/`, … — addressable exactly as before, one segment deeper.

A `/db` entry **earns promotion to root** only by *becoming* a standard-project concern (e.g. if `tools/`
hadn't existed, the install shield would earn it). Promotion is the rare exception; the default is "stays
in the database."

## Why this is GATED, not autonomous (the caution that doesn't change)

Folders are **load-bearing** here — the startup MerkleDAG, CI workflows, install scripts, skills, and
rules all reference root paths by name. Moving ~75 trees one segment deeper is a **mechanical
path-rewrite sweep across the whole repo + CI-green proof**, and it's semi-reversible. So this plan is the
*design*; execution stays gated on **Aaron + Max sign-off and a Bodhi DX audit** (081KTQD8A0008QG0R0030HWMZV's acceptance
gate is unchanged). Nothing moves in this PR.

## The staged migration (when signed off)

Do it **incrementally** ("over time" — Aaron), lowest-risk first, each stage its own green PR:

1. **Audit + freeze the criterion** (Bodhi): inventory every root entry; tag `earns-root` | `→db`; list
   every load-bearing reference to each `→db` path (grep CI/skills/rules/loaders). The impact table.
2. **Move the scratch trees first** (lowest references): the single letters `a…z` and greek
   `alpha…omega` → `db/` — these are scratch/experiment space, fewest inbound paths.
3. **Move the substrate trees** in dependency order, leaf-first: `db/rooms/`, `db/boards/`, `db/saves/`,
   `db/futures/`, `db/lens/`, `db/registry/`, … — each with its path-rewrite sweep + full gate green.
4. **Leave a tombstone** for any path external tools hardcode (a symlink or a `db/README.md` map) until
   the references are all chased — no silent breakage.
5. **Max-test the result**: a fresh clone's first `ls` reads as "a normal project + one `db/`," which is
   exactly the friction 081KTQD8A0008QG0R0030HWMZV opened on.

## Pointers

- [081KTQD8A0008QG0R0030HWMZV](../backlog/P2/081KTQD8A0008QG0R0030HWMZV-root-declutter-for-dx-max-db-folder-grouping-plus-max-adopts-interfaces-rx-verbs-2026-06-10.md) — the DX finding this plan operationalizes (acceptance gate unchanged: Bodhi audit + Aaron/Max sign-off).
- `.claude/rules/dv2-data-split-discipline-activated.md` — DV2.0 (root=hub, /db=satellite) is the lens.
- 081KTQD8A0008QG0R0005EFYPV — `tools/` is the pre-source host shield (why it earns root, not /db).
- 081KRFA460008QG0R001H98EXJ..0427 — repo-split / DV2.0 topology lineage.
- the folders-are-load-bearing convention (the startup MerkleDAG) — why this is gated.

---
id: 081M0370143087G0R003H36RDE
type: task
state: backlog
priority: P2
slug: markdown-execution-is-a-port-not-a-runme-dependency-define-t
title: "Markdown execution is a PORT, not a Runme dependency: define the executor interface (block in, result plus effect-record out) with Runme v3.17.4 as the first adapter and a native adapter as the second, so the choice of execution engine is an adapter swap and DoP=1 replay stays possible"
created: 2026-08-15T17:20:07.011Z
depends_on: []
composes_with:
  - 081KSE6WT0008QG0R003AJYMD3
  - 081KSGS9H0008QG0R001K8VPV4
---

# Markdown execution is a port

## Why this is a change from the 2026-05-25 design

The rows minted in May name Runme as the engine, in the singular:
081KSE6WT0008QG0R003AJYMD3 ("Runme base for right-now execution"),
081KSGS9H0008QG0R001K8VPV4 ("Extend Runme core BCL"). Aaron 2026-08-15 names
it differently: *"execute via runme or whatever that markdown execution
language is — we can also have our own."* That sentence is a port declaration.
The engine becomes a choice, and a choice belongs behind an interface.

## Runme's status, checked rather than assumed

Checked 2026-08-15 against the GitHub API, not against the marketing page:

| fact | value |
|---|---|
| canonical repo | runmedev/runme (moved from stateful/runme) |
| archived | no |
| last push | 2026-08-14 |
| latest release | v3.17.4, 2026-08-13 |
| licence | Apache-2.0 |
| open issues | 153 |

So Runme is alive, actively released, and permissively licensed. It remains a
sound first adapter. The correction to the May rows is not "drop Runme"; it is
"stop depending on it directly."

Note the org move: any May-era reference to stateful/runme is now a redirect,
and a pinned dependency on the old path is a latent break.

## Why a port and not just a wrapper

Three reasons, in decreasing order of how much they cost if ignored:

1. **DST.** `.claude/rules/dv2-data-split-discipline-activated.md` #4 requires
   deterministic replay. An external binary executing shell in a real terminal
   is ambient entropy in the sense of #7 noninterference. A port lets a
   record/replay adapter be the DoP=1 path while a Runme adapter is the
   production path — the pattern
   `.claude/rules/async-all-the-way-truthful-signatures.md` already prescribes.
2. **Interfaces are free, classes are earned**
   (`.claude/rules/interfaces-free-classes-earned-under-rules.md`). The port is
   the free shape; every adapter is an earned concrete.
3. **Exit.** Per `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`,
   a dependency you cannot route around is a hub whether or not anyone
   appointed it. A second adapter is what makes the first one a choice.

## Where it plugs in — the ports that already exist

Checked on `main`, so this is not a greenfield claim:

- `src/Core/UniversalNumber.fs` carries the repo's explicit hexagonal anchor
  (Cockburn, ports and adapters) — the idiom is already house style.
- `src/Core.TypeScript/file-type-plugin/codecs.ts` already registers a
  `markdown-frontmatter` codec that parses a markdown document into a Z-set of
  tagged fields. That is a real markdown *parse* port with one adapter.
- `src/Core.TypeScript/ace/cell-injection.ts` registers codecs by file
  extension against an injected cell — a plug point for an executable-markdown
  codec that already exists and is small enough to read in one sitting.
- `src/Core.TypeScript/ferry-throttler/mux-transport-bridge.ts` is the
  transport composition, relevant only when execution goes cross-node; not on
  the critical path for the thin slice.

The honest read: the *parse* side has a port and an adapter. The *execute*
side has neither. That is the gap this item closes.

## Shape

```
executeBlock : Block -> Context -> Result<BlockOutcome, ExecError>
```

with `BlockOutcome` carrying both the result and an **effect record** — what
was run, by whom, under which authority, what it touched — because
081KSE6WT0008QG0R002YBWBB1 Layer 1 (provenance chain) needs that record and
because 081M0370573087G0R001EB507J folds it into per-file metrics. An executor
that returns only stdout cannot feed either.

## Acceptance

- [ ] Port interface defined; no caller imports a Runme symbol.
- [ ] Adapter 1: Runme, pinned to the runmedev path.
- [ ] Adapter 2: an in-process record/replay adapter that runs at DoP=1 and
      replays byte-identically from a seed.
- [ ] A test that runs the same block through both adapters and asserts the
      effect record is identical modulo timestamps.

## Toy / metered

`toy` until adapter 2 replays. A port with one adapter is a wrapper wearing an
interface, and it has no falsifier — nothing about it can be wrong yet.

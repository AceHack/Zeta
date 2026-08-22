# Cross-harness bootstrap template

This document is the **template** for harness-specific bootstrap
files. A harness bootstrap file (`CLAUDE.md`, `GEMINI.md`,
`.codex/AGENTS.md`, `.github/copilot-instructions.md`, a future
`CURSOR.md` / `.cursor/rules/`, etc.) is the **first thing a fresh
instance of that harness reads**. Its job is not to carry doctrine —
doctrine lives in [`AGENTS.md`](../AGENTS.md) and
[`GOVERNANCE.md`](../GOVERNANCE.md). Its job is to point the fresh
instance into the **universal six-step process** with the
**harness-specific tooling references** filled in.

The pattern this generalizes was established by **081KR50HA0008QG0R001DBKS6T** ("CLAUDE.md
as process"): a fresh instance that *walks* the six steps discovers the
rules through friction rather than memorizing harness-specific doctrine.
A Codex instance and a Claude instance running the same process produce
equivalent behavior. This template (**081KR50HA0008QG0R003G7DR8Z**) lifts that pattern off
CLAUDE.md so any harness can instantiate it.

## The non-negotiable invariant

`AGENTS.md` is the single source of truth. Every harness bootstrap file
is **optional**, **additive**, and **may not contradict** `AGENTS.md`
or `GOVERNANCE.md`. If a harness file contradicts either, the harness
file is wrong and must be reconciled — not the other way around.

A harness bootstrap file's content is therefore mostly *pointers* and
*harness-specific mechanics*, never a re-statement of repo-wide rules.

One floor every harness inherits and must not break: the operator's
shared checkout is a **read-only view** — every writer/loop works in its
**own clone** (`GOVERNANCE.md §35`; `AGENTS.md` §"Shared checkout is
VIEW-ONLY"). A new harness's worktree/isolation mechanics (step 5) fill
in *how* it gets its own clone, never *whether* it needs one.

## Universal vs harness-specific

The six-step process is **universal** — identical across every harness.
What changes per harness is the **tooling reference** inside each step:
the command runner, the skill-loading mechanism, the worktree
discipline, the commit-attribution trailer.

| Step | Universal (same everywhere) | Harness-specific (fill in) |
|------|-----------------------------|----------------------------|
| 1. Orient | Read `AGENTS.md` → `docs/ALIGNMENT.md` → `docs/SEED-VOCABULARY.md` → `GOVERNANCE.md` (scan on §N cite). Read the harness persona/state file. | *Which* persona/state file (`memory/<persona>/<name>/CURRENT-*.md`, `.codex/CURRENT-codex.md`, etc.) and any harness read-order addendum. |
| 2. Refresh | Run the worldview refresh; read active `docs/trajectories/*/RESUME.md`. | The exact refresh command + how this harness runs TypeScript / shell (`bun src/Core.TypeScript/forge-host/github/refresh-worldview.ts`, etc.). |
| 3. Pick work | Open `docs/BACKLOG.md` / `docs/backlog/P*/`; complete the backlog-item start gate (prior-art search + dependency check); acquire a claim before worktree work. | The claim mechanism this harness uses (`src/Core.TypeScript/bus/claim.ts` surface-tagged sender ID, claim-branch convention). |
| 4. Build | `dotnet build -c Release` (0 warnings, 0 errors — `TreatWarningsAsErrors`) then `dotnet test Zeta.sln -c Release`. Before opening a PR, `bun run preflight` runs every gate dimension locally and reports all failures at once (vs CI's per-language short-circuit). | Nothing — the build gate is identical for all harnesses. |
| 5. Ship | Open a PR against `main`; arm auto-merge if green. | The commit-attribution trailer (`Co-Authored-By: <Harness> <...>`) and worktree-isolation discipline for this harness. |
| 6. When stuck | See `docs/CONFLICT-RESOLUTION.md`; on deadlock, the human decides. | Any harness-specific escalation channel. |

Rule of thumb: if a line would be **identical** in every harness file,
it belongs in `AGENTS.md`, not in the harness file. The harness file
keeps only the lines that *differ* by harness plus the pointers that
direct the read.

## Skeleton

Copy this skeleton into a new harness bootstrap file and replace each
`<…>` placeholder. Keep it short — a pointer tree, not a manual.

```markdown
# <HARNESS>.md — <Harness> session bootstrap for Zeta

<One line: this is the <Harness> addendum; AGENTS.md + GOVERNANCE.md
remain authoritative; this file is additive and may not contradict
them.>

## 1. Orient

Read: AGENTS.md → docs/ALIGNMENT.md → docs/SEED-VOCABULARY.md →
GOVERNANCE.md (scan when §N cited). Read docs/GLOSSARY.md only on demand.
Then read the <Harness> persona/state file: <path>.

## 2. Refresh

Run: <harness-specific worldview-refresh command>
Read active trajectories: docs/trajectories/*/RESUME.md

## 3. Pick work

Open docs/BACKLOG.md. Complete the backlog-item start gate.
Claim before worktree work: <harness-specific claim mechanism>.

## 4. Build

dotnet build -c Release   # 0 warnings, 0 errors
dotnet test Zeta.sln -c Release
bun run preflight         # before a PR: all gate dimensions, all failures at once

## 5. Ship

Open a PR against main. Arm auto-merge if green.
Commit trailer: Co-Authored-By: <Harness> <noreply@…>

## 6. When stuck

See docs/CONFLICT-RESOLUTION.md. On deadlock, the human decides.

## Conventions

<Only harness-specific ground rules: skill/instruction loading,
worktree discipline, ownership boundary. Everything repo-wide
stays in AGENTS.md / GOVERNANCE.md.>
```

## Existing instances

These files already instantiate the template (in varying degrees of
process-ification). New harness files should match their shape.

| File | Harness | Status |
|------|---------|--------|
| [`CLAUDE.md`](../CLAUDE.md) | Claude Code | Canonical six-step process + Conventions pointer tree (081KR50HA0008QG0R001DBKS6T). |
| [`GEMINI.md`](../GEMINI.md) | Gemini CLI / Antigravity (Lior) | Boot sequence pointing into shared factory physics + persona file (081KRMEXM0008QG0R002347RJY). |
| [`CODEX.md`](../CODEX.md) | OpenAI Codex (Vera) | Six-step pointer tree at repo root (081KSRGFP0008QG0R000G8VJGV); points into `.codex/AGENTS.md` for deep host-loop mechanics. |
| [`.codex/AGENTS.md`](../.codex/AGENTS.md) | OpenAI Codex (Vera) | Codex-owned deep addendum: read-order, worktree discipline, commit/origin trailers, background-agent discipline. |
| [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) | GitHub Copilot | Factory-managed instructions, audited on the skill-file cadence (GOVERNANCE.md §31). |
| [`CURSOR.md`](../CURSOR.md) | Cursor IDE (Riven) | Six-step pointer tree at repo root (081KR50HA0008QG0R003G7DR8Z.2). Native `.cursor/rules/` still absent. |
| [`KIRO.md`](../KIRO.md) | Amazon Kiro (Alexa) | Six-step pointer tree at repo root (081KSRGFP0008QG0R000EWSMKV, per 081KR2E4K0008QG0R0005E727X). Native `.kiro/steering/` still absent. |

## How to add a new harness

1. Copy the skeleton above into the harness's canonical bootstrap
   location (root `<HARNESS>.md`, or the harness's native
   instruction-file path).
2. Fill the harness-specific cells from the universal-vs-harness-specific
   table: persona/state file, refresh command, claim mechanism, commit
   trailer, skill-loading mechanism.
3. Register the file in `AGENTS.md` §"Harness-specific files" so the
   single-source-of-truth document knows it exists.
4. Add the harness's commit trailer to `AGENTS.md` §"Commit
   attribution — harness-specific trailers".
5. Run a fresh-instance validation per the 081KR50HA0008QG0R001CNS20T pattern: a clean
   instance of that harness should be able to walk the six steps and
   produce a correct first action with no extra priming.

## Lineage

- **081KR2E4K0008QG0R001F0YB5S** — parent (bootstrap-process cluster).
- **081KR50HA0008QG0R001DBKS6T** — CLAUDE.md as process (the pattern this generalizes).
- **081KR50HA0008QG0R001CNS20T** — fresh-instance validation of the bootstrap process.
- **081KR50HA0008QG0R003G7DR8Z** — this template + cross-harness generalization.

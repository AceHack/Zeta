---
name: bodhi
description: Long-term journal — Bodhi (developer-experience-engineer). Append-only; never pruned; never cold-loaded.
type: project
---

# Bodhi — Developer Experience Engineer journal

Long-term memory. **Append-only.** Never pruned, never cleaned
up. Grows monotonically over rounds.

## Read contract

- **Tier 3.** Never loaded on cold-start.
- **Grep only, never cat.** The moment this file is read in
  full, cold-start cost explodes and the unbounded contract
  becomes a bug. Use grep / search to pull the matching
  section on demand.
- Search hooks: dated section headers (`## Round N — ...`)
  + `file:line` citations + friction type names
  (stale-pointer, unexplained-warning, missing-step,
  wrong-audience, unclear-contract, tooling-gap).

## Write contract

- **Newest entries at top.**
- **Append on NOTEBOOK prune.** When the NOTEBOOK hits its
  3000-word cap (BP-07) and Bodhi prunes, entries that merit
  preservation migrate here rather than being deleted. The
  prune step IS the curation step.
- **Dated section headers.** Every entry starts with
  `## Round N — <short label> — YYYY-MM-DD` so grep
  anchors resolve cleanly.
- ASCII only (BP-09); Nadia lints for invisible-Unicode.
- Frontmatter wins on disagreement (BP-08).

## Why this exists

The first-60-minutes path has long-lived patterns. A friction
that surfaces in round 34, disappears in round 36 because
Samir fixed it, and reappears in round 41 because a new
section re-introduced the ambiguity — that recurrence is only
visible in long-term memory. The NOTEBOOK prune cadence can't
show it without a destination.

Candidate use cases:
- Recurring CONTRIBUTING.md friction across rounds.
- Install-script felt-friction patterns vs Dejan's mechanical
  parity tracking.
- Minutes-to-first-PR trend data across rounds.

---

## Round 34 — first audit findings preserved — 2026-04-19

First real audit ran this round. Eight path-level findings
landed as fixes same round via `sweep-refs`; preserving the
before-state here so next round's audit can measure
recurrence rate.

**Pre-fix state — README.md layout block (minute 4-6 of
cold-walk):**

- `README.md:151-166` Layout block pointed at `src/Dbsp.Core/`,
  `tests/Dbsp.Tests.FSharp/`, `tests/Dbsp.Tests.CSharp/`,
  `bench/Dbsp.Benchmarks/`, `samples/Dbsp.Demo/`. None existed.
  Root cause: the round-31/32 Dbsp→Zeta rename campaign
  landed code-layout but not the docs sweep.
- `README.md:173-174` build/run one-liners pointed at the same
  dead `samples/Dbsp.Demo` + `bench/Dbsp.Benchmarks` paths;
  `dotnet run --project samples/Dbsp.Demo -c Release` failed
  outright.
- `README.md:185` fsharp-analyzers invocation cited
  `src/Dbsp.Core/Dbsp.Core.fsproj`; actual path `src/Core/Core.fsproj`.

**Same drift cluster across:** `CLAUDE.md:45,58`,
`AGENTS.md:40`, `.github/PULL_REQUEST_TEMPLATE.md:12`,
`openspec/README.md:1,106` — all referenced `Dbsp.sln`;
actual file `Zeta.sln`.

**Fix:** single perl sweep across `.md` / `.yml` / `.yaml` /
`.sh` files under repo root:
- `src/Dbsp.Core/Dbsp.Core.fsproj` → `src/Core/Core.fsproj`
- `src/Dbsp.Core` → `src/Core`
- `tests/Dbsp.Tests.FSharp` → `tests/Tests.FSharp`
- `tests/Dbsp.Tests.CSharp` → `tests/Tests.CSharp`
- `bench/Dbsp.Benchmarks` → `bench/Benchmarks`
- `samples/Dbsp.Demo` → `samples/Demo`
- `Dbsp.sln` → `Zeta.sln`

**Landed outcome:** `Zeta.sln` + `src/Core/Core.fsproj` +
all referenced test/bench/sample paths now resolve across
every doc a first-PR contributor encounters. Minutes-to-
first-PR restored from "blocked by Layout confusion
between minute 4 and minute 10" to the estimated 58-60
baseline (install.sh budget still tight).

**Recurrence watch (for next audit):**

- Did any of these drift back in? Grep on `Dbsp\.sln|src/Dbsp\.Core|tests/Dbsp\.Tests|bench/Dbsp\.Benchmarks|samples/Dbsp\.Demo` — expect zero hits.
- Did a NEW rename campaign happen that wasn't swept? Check
  for rename commits between now and next audit.

**Systemic finding routed to BACKLOG:**

- Round-close checklist should require `sweep-refs` after any
  rename campaign. Under `P1 — Factory` as "Bodhi DX audit
  cleanup (round-34 first-PR walk) (c) codify sweep-refs
  invocation".

**Deferred to BACKLOG (from this audit, not fixed):**

- `CONTRIBUTING.md` — missing shellenv sentence + trivial-PR
  branch-model guidance + `tools/setup/doctor.sh` mention.
- `fsharp-analyzers` in `manifests/dotnet-tools` — install or
  remove README block. Tooling-gap, Dejan + Samir owned.

---

_(Seeded 2026-04-19 round 34. First migration on
next NOTEBOOK prune.)_

---
name: Bug report
about: Something in Zeta is broken, incorrect, or misleading
title: "[bug] "
labels: bug
assignees: ''

---

*Thanks for filing — first-time contributor (human or AI)?
Welcome. Fill what you know, skip what you don't. An agent
will pick this up and ask for more if needed.*

## What broke

One sentence.

## How to reproduce

Smallest snippet or steps that show the bug.

```fsharp
// repro (F# or C#)
```

## Expected vs actual

- **Expected:**
- **Actually:**

---

### Optional — helpful if you know it, skip if not

- **Zeta commit SHA** (`git rev-parse HEAD`):
- **`dotnet --version`:**
- **OS:**
- **Reproduces on a clean `dotnet build -c Release`?** (y/n)
- **Affected surface** (e.g. `Zeta.Core.ZSet`,
  `openspec/specs/append-zset`, the `D` / `I` operator):
- **Invariant / spec / BP-NN rule broken** (cite the clause
  if one applies):
- **Stack trace** (paste the whole thing if there is one):
- **Extra context** (logs, benchmark deltas, related PRs,
  `docs/research/` note):

---

*Don't worry about dual-track bookkeeping. If the bug
sticks, an agent will mirror it to `docs/BUGS.md` and link
the in-repo row back here. Full protocol:
[`docs/AGENT-ISSUE-WORKFLOW.md`](../../docs/AGENT-ISSUE-WORKFLOW.md).*

*AI agents: claim by commenting*
`claimed by session <id> <UTC-ts> — ETA <hours|rounds>`
*and add the `in-progress` label. Release when landed or
abandoned. 24-hour stale-claim window.*

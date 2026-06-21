# CODEX.md — OpenAI Codex session bootstrap for Zeta

This is the OpenAI Codex (Vera) addendum. [`AGENTS.md`](AGENTS.md) and
[`GOVERNANCE.md`](GOVERNANCE.md) remain authoritative; this file is
**additive** and **may not contradict** them. It instantiates the
[cross-harness bootstrap template](docs/BOOTSTRAP-TEMPLATE.md) (081KR50HA0008QG0R003G7DR8Z)
with the Codex-specific tooling references filled in. The deep Codex
host-loop mechanics live in [`.codex/AGENTS.md`](.codex/AGENTS.md)
(Codex-owned); this root file is the cross-harness-discoverable pointer
tree into the same six-step process.

## 1. Orient

Read: [`AGENTS.md`](AGENTS.md) → [`docs/ALIGNMENT.md`](docs/ALIGNMENT.md) →
[`docs/SEED-VOCABULARY.md`](docs/SEED-VOCABULARY.md) (cold-boot core +
vocabulary kernel; [`docs/GLOSSARY.md`](docs/GLOSSARY.md) is on-demand) →
[`GOVERNANCE.md`](GOVERNANCE.md) (scan when §N cited).
Then read the Codex addendum + state file:
[`.codex/AGENTS.md`](.codex/AGENTS.md) → [`.codex/CURRENT-codex.md`](.codex/CURRENT-codex.md).

## 2. Refresh

Run:

```bash
bun tools/github/refresh-worldview.ts
```

Read active trajectories: `docs/trajectories/*/RESUME.md`.

## 3. Pick work

Open [`docs/BACKLOG.md`](docs/BACKLOG.md) (canonical rows live in
`docs/backlog/P*/`). Complete the backlog-item start gate (prior-art
search + dependency check). Claim before worktree work with the
Codex-tagged sender ID:

```bash
bun src/Core.TypeScript/bus/claim.ts acquire --from vera-codex --item <B-NNNN>
```

Codex sessions additionally follow the claim-branch + heartbeat
discipline in [`docs/AGENT-CLAIM-PROTOCOL.md`](docs/AGENT-CLAIM-PROTOCOL.md)
and [`.codex/AGENTS.md`](.codex/AGENTS.md) when other agents share the
machine.

## 4. Build

```bash
dotnet build -c Release   # 0 warnings, 0 errors — TreatWarningsAsErrors is on
dotnet test Zeta.sln -c Release
```

## 5. Ship

Open a PR against `main`. Arm auto-merge if green
(`gh pr merge <N> --auto --squash`).
Commit trailer: `Co-Authored-By: Codex <noreply@openai.com>`.

## 6. When stuck

See [`docs/CONFLICT-RESOLUTION.md`](docs/CONFLICT-RESOLUTION.md). On
deadlock, the human decides.

## Conventions

- **Register** — Vera operates the implementation peer axis: concrete
  builds, large-context synthesis, getting the work shipped.
- **Speaker prefix** — Codex / Vera prefixes user-visible chat updates
  with `Vera:` while multiple agent surfaces are active (per `AGENTS.md`
  §"Visible speaker prefixes").
- **Ownership boundary** — Codex owns `.codex/**` content; other
  harnesses point into it but do not routine-edit it. The deep host-loop
  mechanics, origin trailers, and background-agent discipline stay in
  [`.codex/AGENTS.md`](.codex/AGENTS.md), never re-stated here.
- **Worktree isolation** — never edit the contested root checkout. Write
  from a dedicated worktree off `origin/main` (per
  `.claude/rules/agent-worktree-hygiene-*` + `docs/AGENT-CLAIM-PROTOCOL.md`).
  Do not hold `main` in an agent worktree.
- **Agents, not bots** — every AI carries agency (GOVERNANCE.md §3).

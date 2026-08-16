---
id: 081M05G8D36087G0R0034D3QPA
type: bug
state: backlog
priority: P1
slug: zeta-telemetry-flush-token-cannot-git-push-heartbeat-lanes-d
title: "ZETA_TELEMETRY_FLUSH_TOKEN cannot git push: heartbeat lanes died 403 after #10850"
created: 2026-08-16T14:40:20.070Z
depends_on: []
composes_with: []
---

# ZETA_TELEMETRY_FLUSH_TOKEN cannot git push: heartbeat lanes died 403 after #10850

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M05G8D36087G0R0034D3QPA-*.md` glob. -->

## NEEDS THE OPERATOR — this half cannot be fixed from inside the repo

`ZETA_TELEMETRY_FLUSH_TOKEN` is a fine-grained PAT that authenticates as **AceHack** and
**does not carry `contents: write`** on `Lucent-Financial-Group/Zeta`. Granting that
permission is a credential change, so it is an operator-approved action, not an agent one.

## What broke, and exactly when

PR **#10850** (`9fd69a992e`, merged **2026-08-15T23:01:23Z**) switched both `actions/checkout`
steps in `.github/workflows/agent-heartbeat.yml` to `persist-credentials: true` +
`token: ${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN || … }}`, so that the heartbeat/* PR head would
carry a human push actor and `gate (required)` could start (081M010H4KE / 081M005FXAB).

Its stated premise — *"the archive/society flush already uses this PAT"* — is true for the
**API** (`GH_TOKEN` handed to `gh` / `flush-via-staging.ts`) and **false for `git push`**.
`society-heartbeat.yml` and `tick-metrics.yml` check out with the **default GITHUB_TOKEN** and
only use the PAT as an `env:` for the flush; `agent-heartbeat.yml` after #10850 pushes with the
PAT itself.

Result, every tick since:

```
remote: Permission to Lucent-Financial-Group/Zeta.git denied to AceHack.
fatal: unable to access 'https://github.com/Lucent-Financial-Group/Zeta/':
       The requested URL returned error: 403
##[error]Process completed with exit code 128.
```

## Evidence (observed 2026-08-16, not inferred)

| Fact | Value |
|---|---|
| last green `agent-heartbeat` on main | run `31913267498`, 2026-08-15T22:52:33Z |
| first red | run `31913893440`, 2026-08-15T23:06:56Z — the first tick after #10850 merged |
| consecutive failures since | 48 of the last 100 runs on `main`, unbroken |
| `origin/heartbeat/alexa` tip | 2026-08-15T22:54:17Z — frozen |
| `origin/heartbeat/otto` tip | 2026-08-15T22:55:30Z — frozen |
| `origin/heartbeat/soraya` tip | 2026-08-15T22:55:19Z — frozen |
| `origin/heartbeat/society`, `…/tick-metrics` | still updating (they push with GITHUB_TOKEN) |
| flush PRs #10709 / #10710 / #10711 | OPEN since 2026-08-14, last updated 2026-08-15T22:5xZ |
| check rollup on all three PRs | `Analyze (…)`, `submit-nuget` — **no `gate (required)`** |

**Ruled out — it is not the ruleset.** Ruleset `16934633` "Heartbeat Branch Protection" targets
`refs/heads/heartbeat/*` and carries `deletion` only; no `non_fast_forward`. A ruleset denial
would read `GH013: Repository rule violations found`, not `Permission … denied to AceHack`.
(The in-file comment claiming that ruleset targets `refs/heads/agent-heartbeats` and "matches
nothing" was stale and is corrected in the same PR as this item.)

## Why it matters beyond one red workflow

`CLAUDE.md` names `heartbeat/*` as the **externalized idle counter** — the liveness signal every
agent is told to read instead of trusting its own narrative self-count. For ~15.5 hours that
counter has been frozen while the workflow that feeds it ran on schedule and failed. A frozen
liveness ref reads as the standing-by failure by construction. The dogfooding trajectory
(`docs/trajectories/dogfooding-the-whole-stack/RESUME.md`) also still records Tier-1 row 1 as
"✅ dogfooded … green every ~45 min", which has been false since 2026-08-15T23:06Z.

## What already shipped alongside this item

The **artifact** half is fixed in-repo: the push step now attempts the PAT first (identical to
#10850's intent once the PAT is granted `contents: write`) and, **on a credential denial only**,
falls back to GITHUB_TOKEN so the lane keeps recording. A non-fast-forward / ruleset / network
failure stays fatal — verified against a stubbed `git` in all three modes.

The **test** half is deliberately left strict: `required-check-started.ts` in the flush job still
fails the workflow while `gate (required)` never starts. So this item does **not** get to look
green by being worked around; the fallback keeps telemetry alive, the assertion keeps shouting.

## Done when

- [ ] `ZETA_TELEMETRY_FLUSH_TOKEN` carries `contents: write` on this repository (**operator**)
- [ ] an `agent-heartbeat` run pushes without emitting the fallback `::warning::`
- [ ] `gate (required)` appears in the check rollup of a `heartbeat/*` flush PR
- [ ] #10709 / #10710 / #10711 merge, or are superseded by a tick that can flush
- [ ] the dogfooding RESUME's Tier-1 row 1 claim is re-verified rather than assumed

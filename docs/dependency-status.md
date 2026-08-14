# Dependency status — what the factory runs on

> **First-class factory surface** (081KQDTYV0008QG0R002H74QXZ): per the human maintainer
> 2026-04-30, *"looking at github status should be first class for us we
> live on git and github for now until we get a 2nd host in the future."*
> The factory's hot path runs through GitHub today; any GitHub
> degradation IS a factory degradation, with this page as the
> visibility layer.

## Answer-now (under 30 seconds)

If you're a cold-start agent or new contributor and want the
fastest possible "is GitHub healthy?" check, run:

```bash
curl -sf https://www.githubstatus.com/api/v2/summary.json | \
  jq -r '.status.indicator + " — " + .status.description' && \
curl -sf https://www.githubstatus.com/api/v2/summary.json | \
  jq -r '.components[] | select(.name == "Pull Requests" or .name == "Actions" or .name == "API Requests" or .name == "Webhooks") | "\(.name): \(.status)"'
```

If `Pull Requests` reports anything other than `operational`, the
required-conversation-resolution gate that auto-merge depends on
may return wrong-state data — see § Known concern classes for
the failure modes this surface flags. Composes with the
*BLOCKED-with-green-CI means investigate review threads first*
rule in `CLAUDE.md` — that rule says investigate; this surface
says verify the API is reporting truth before believing the
investigation result.

## What this page answers

This page answers three questions in under 30 seconds:

1. **What does the factory depend on?** (watched list — § Watched dependencies)
2. **Are any of those dependencies currently flagged or degraded?** (current state — § Live status sources, or the answer-now snippet above)
3. **Is there a known issue affecting our merge / CI / review pipeline right now?** (active incidents — § Known concern classes)

This is the static-markdown first iteration of 081KQDTYV0008QG0R002H74QXZ. Future iterations may add a cron-driven scraper writing to a sibling `docs/dependency-status-current.json`, per-incident issues, or hybrid coverage. The watched-list + status-source registry has independent value and lands first.

## Watched dependencies

Grouped by operational role. Each row names the dependency, what the factory uses it for, the canonical status source, and the factory-relevant components (so unrelated minor incidents don't generate noise).

### Hosting + version control

| Dependency | Used for | Status source | Factory-relevant components |
|---|---|---|---|
| GitHub (LFG repo) | canonical development; PRs; auto-merge; required checks; merge target | <https://www.githubstatus.com/> + <https://www.githubstatus.com/api/v2/summary.json> | Pull Requests, Actions, API Requests, Webhooks |
| GitHub (AceHack mirror) | backup mirror; receives daily fast-forward sync from LFG/main | (same as above — same host) | (same components) |

### CI + automation

| Dependency | Used for | Status source | Factory-relevant components |
|---|---|---|---|
| GitHub Actions | every required check (build-and-test, lint, semgrep, shellcheck, actionlint, markdownlint); the every-minute autonomous-loop cron | <https://www.githubstatus.com/> | Actions |
| GitHub Copilot review | inline PR review comments; first-pass gate-finding | <https://www.githubstatus.com/> | Copilot |
| Codex (OpenAI) | additional PR review surface | <https://status.openai.com/> | API |

### AI runtimes (agent harnesses)

| Dependency | Used for | Status source | Factory-relevant components |
|---|---|---|---|
| Anthropic API (Claude Code harness) | autonomous-loop sessions; substrate authoring | <https://status.anthropic.com/> | API, Claude Code |
| OpenAI API (ChatGPT) | the human-maintainer ferry channels with external AI co-originators; Codex review | <https://status.openai.com/> | API, ChatGPT |
| Google Gemini | additional substrate ferry channel | <https://status.cloud.google.com/> | Gemini API |

### Language runtimes

| Dependency | Used for | Status source | Factory-relevant components |
|---|---|---|---|
| .NET SDK (mise-pinned `10.0.203`) | F# build; tests; analyzers | <https://github.com/dotnet/core/issues> (no formal status page) | (release health) |
| Bun (mise-pinned) | TS scripts under `tools/`; `bun tools/github/poll-pr-gate*.ts` | <https://bun.sh/blog> + <https://github.com/oven-sh/bun/issues> | (no formal status page) |
| Python 3.14 (mise-pinned) | helper scripts; `uv tool install` flow | (none — release-health only) | (release health) |
| Java 26 (mise-pinned) | TLA+ + Alloy verifier jars | (none — release-health only) | (release health) |
| Lean (elan-managed, outside mise) | formal-verification proofs | <https://github.com/leanprover/lean4/issues> | Mathlib |
| mise | language-runtime version manager | <https://github.com/jdx/mise/issues> | (release health) |

### Package registries

Independent outage sources from the runtimes; build/install/restore breaks when these degrade even when the runtime itself is healthy.

| Dependency | Used for | Status source | Factory-relevant components |
|---|---|---|---|
| NuGet (`api.nuget.org`) | .NET package fetch (`dotnet restore`, `dotnet tool install`, Stryker, Semgrep) | <https://status.nuget.org/> | API |
| PyPI (`pypi.org`) | `uv tool install` (ruff today; expanding) | <https://status.python.org/> | PyPI |
| npm registry | bun-resolved package fetch when bun falls back to npm | <https://status.npmjs.org/> | Registry |
| Homebrew (`formulae.brew.sh`) | system-level macOS packages (mise itself + curl bootstrap) | <https://status.brew.sh/> | (formula fetch) |
| apt (Debian/Ubuntu) | system-level Linux packages | (no canonical status; per-mirror) | (none) |

### Verifiers + analyzers (jars are committed; the rest are fetched)

| Dependency | Used for | Status source | Factory-relevant components |
|---|---|---|---|
| TLA+ (`tla2tools.jar`, `TLC2 Version 2026.05.18.174321 (rev: 8ba1027)`) | safety/liveness specs | committed to git -- upstream release health does not gate our runs | (none: no fetch at install time) |
| Alloy (`alloy.jar`, `6.2.0.202501090817 (rev: 794226d)`) | structural model checking | committed to git -- upstream release health does not gate our runs | (none: no fetch at install time) |
| Stryker (.NET tool) | mutation testing | <https://stryker-mutator.io/blog/> | (NuGet feed) |
| Semgrep | static analysis | <https://semgrep.dev/blog> | (CLI registry) |

## Live status sources

Bookmark these for quick lookup. Order matches operational urgency for this factory (GitHub first because everything else is downstream of it).

- **GitHub** — <https://www.githubstatus.com/> (browser) + <https://www.githubstatus.com/api/v2/summary.json> (programmatic)
- **Anthropic** — <https://status.anthropic.com/>
- **OpenAI** — <https://status.openai.com/>
- **Google Cloud** — <https://status.cloud.google.com/>
- **NuGet** — <https://status.nuget.org/>
- **PyPI** — <https://status.python.org/>
- **npm registry** — <https://status.npmjs.org/>
- **Homebrew** — <https://status.brew.sh/>

The programmatic poll snippet above is the fastest answer-now path for the GitHub-component urgency case.

## Known concern classes

These are the failure modes the factory should watch for; the surface flags them, it does not mitigate them.

### GitHub merge-queue / auto-merge wrong-commit class

The maintainer 2026-04-30 surfaced this concern citing Trunk.io's [merge-queue-builds-on-wrong-commit post](https://trunk.io/blog/what-happens-if-a-merge-queue-builds-on-the-wrong-commit). Verified at write-time:

- The factory does **not** use GitHub's merge-queue feature (`merge_queue: None` in branches/main/protection). The specific Trunk.io bug class doesn't apply directly.
- The factory **does** use auto-merge with squash + `allow_update_branch: true` (auto-rebases stale branches before merging).
- The **broader concern** (GitHub backend producing wrong-state results that auto-merge fires against) absolutely applies. Specific failure modes:
  - **Auto-merge against stale base** during rebase-window-API-degradation
  - **`allow_update_branch` auto-rebase producing unexpected merge content** when the rebase fires during incomplete-API-state
  - **Force-push race with auto-merge** firing near-simultaneously
  - **Incomplete API results during merge decision** — a 0-unresolved-threads count from a degraded API can satisfy auto-merge's `required_conversation_resolution` gate while threads exist unseen

When the GitHub Pull Requests component is flagged `degraded_performance` or worse: pause auto-merge arming until restored. (Mitigation rule lives in follow-up rows; this surface flags the condition.)

This composes with `CLAUDE.md`'s *BLOCKED-with-green-CI means investigate review threads first* rule. That rule assumes the API is reporting truth; this surface is the prerequisite check that the assumption holds. If `Pull Requests` is degraded, an apparent 0-unresolved-threads count is unreliable.

### GitHub Actions runner queue degradation

When Actions is flagged degraded:

- "in-progress" check states mean something different than usual (slow ≠ failing)
- The polling loop watching CI looks indistinguishable from a real wait
- Without surface awareness, future-Otto can't disambiguate honest-wait from external-incident

### AI-runtime availability

When Anthropic / OpenAI / Google APIs degrade:

- Sessions may stall on tool-call timeouts
- The maintainer's ferry channels (Claude.ai, ChatGPT, Gemini) become unreliable
- Distinguish API-down from prompt-injection-defense (the latter is normal protective behavior)

### Package-registry availability

When NuGet / npm / PyPI / Homebrew degrade:

- `tools/setup/install.sh` may fail with cryptic timeouts
- CI jobs that hit the registries (build, test, `dotnet restore`, `uv tool install`) may report failure when the underlying issue is registry-side
- Rule of thumb: if a build step that worked yesterday fails today with a network/timeout error, check the relevant registry's status page before debugging the build

## Discovery hooks

This page is referenced from:

- `CLAUDE.md` — under the wake-time discipline bullets (pointer lands in this same PR via `tools/cold-start-check` and bullet update)
- `AGENTS.md` — under "Operational practices" (pointer lands in this same PR)
- `docs/AUTONOMOUS-LOOP.md` — tick rituals can cross-reference this surface when external incidents shape the tick

## Iteration plan (post-static-markdown)

Recommended sequencing (each becomes its own backlog row when promoted):

1. **Cron-driven scraper** writing `docs/dependency-status-current.json` (sibling file, not a directory; avoids the file-vs-directory naming conflict) from the GitHub status API — most operationally-load-bearing source; other sources added incrementally
2. **Incident log** at `docs/dependency-status-incidents.jsonl` for retrospective correlation between session-time anomalies and external-incident windows
3. **Tick-shard cross-reference** — when shard rows mention CI behaviour, allow a soft pointer to the incident-log row covering that timeframe
4. **Mitigation rules** — the conditional "when GitHub Pull Requests is degraded, do not arm auto-merge" rules belong in distinct backlog rows once the visibility surface is operational

## Out of scope (per 081KQDTYV0008QG0R002H74QXZ)

- Building a full incident-management system. The factory needs visibility, not Pagerduty.
- Real-time alerting / paging / on-call rotation. If dependencies fail, the factory pauses, files an incident note, waits for restoration. No auto-paging.
- Per-dependency mitigation plans. Those belong in separate rows when concrete.
- Replacing or vendoring degraded dependencies preemptively. (Vendoring discussions belong in 081KQ8P5D0008QG0R003BFZPRC TS+Bun migration for the deps that ARE in-scope.)

## Composes with

- **081KQDTYV0008QG0R002H74QXZ** (this row) — design + implementation row tracking this surface
- **081KQ8P5D0008QG0R003BFZPRC** (TS+Bun migration) — dependency reduction is itself a status-mitigation strategy
- **081KQB8J40008QG0R000A61G4T** (Forbidden Pattern Quarantine) — patterns flagged by external sources compose naturally with this surface's vocabulary
- `memory/feedback_all_cryptography_quantum_resistant_even_one_gap_is_attack_vector_2026_04_23.md` — quantum-resistant policy presumes known crypto-primitive state
- `memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md` — absorb-and-contribute presumes the dependency list is legible
- `docs/AUTONOMOUS-LOOP.md` — autonomous loop runs on GitHub-mediated state; tick rituals consume this surface
- `CLAUDE.md` *BLOCKED-with-green-CI* rule — that rule's reliability presupposes the API is reporting truth; this surface verifies the precondition

## Last refreshed

2026-05-02 (initial landing). Watched-list + status-source review cadence is once per round when this row is touched, plus any time a new dependency lands in `tools/setup/manifests/`, `.mise.toml`, or `tools/setup/common/*.sh`.

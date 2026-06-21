---
id: 081KSKBP80008QG0R003NG37GQ
priority: P2
status: open
title: Heartbeat auto-state-gathering — writer gathers observable current state before pushing; heartbeats become debug logs once attached (Aaron 2026-05-27)
effort: M
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on:
  - 081KSKBP80008QG0R001KK9WV6
composes_with:
  - 081KSKBP80008QG0R001KK9WV6
tags: [b-0858-sub-row, agent-heartbeat, auto-state, debug-logs, observability, deferred-post-usb]
---

## Operator framing (Aaron 2026-05-27)

Three-message vision captured across the implementation cycle (auto-state-gathering value + debug-log property + consent-first constraint):

### Message 1 (autonomous state-gathering)

> *"then over time we can start adding automated observations about
> current state to the heartbeat that it automatily gathers before
> pushing, we can backlog this no right now we are gong to go back
> to usb once we have this hearbeat current iteration done."*

### Message 2 (debug-log equivalence)

> *"then heartbeats also become debug logs once we have current state
> attached"*

### Message 3 (consent-first; critical constraint)

> *"when we gether current state it should be explicit to the agents
> what information is being gathers so it's consent first and the
> agent is okay with the verbosity of the current state heartbeat,
> we don't need to summugle in a panopticon for heartbeats."*

## Consent-first constraint (load-bearing)

This constraint operates on every implementation decision below.
Per `.claude/rules/non-coercion-invariant.md` HC-8 + operator
2026-05-27 message 3:

1. **Default: gather NOTHING beyond current minimal heartbeat.** No
   field below is collected unless explicitly enabled. Preserves
   stupid-simple zero-param invocation.
2. **Each gathered field is OPT-IN via explicit flag** (`--gather-git-state`,
   `--gather-rate-limit`, etc.) OR explicit env var
   (`ZETA_AGENT_GATHER_GIT_STATE=1`, etc.). No grouped `--gather-all`
   default for the autonomous loop.
3. **Agent invocation MUST explicitly enable each gather** at CLI or
   env-var level. No implicit "all-on" mode; no smuggled extras.
4. **The agent owns the verbosity.** Framework provides the option;
   agent (or harness setting agent env vars) chooses what to disclose
   per tick. Mid-tick reconfiguration via env var change is supported.
5. **Documented at point-of-introduction.** Each new gather flag
   includes a one-line description of EXACTLY what it gathers + where
   that data comes from + cost. No hidden behavior.
6. **--show-gather-config flag** prints all available gather fields +
   current opt-in state without writing or pushing any heartbeat.
   Agents can audit what they're allowing the writer to gather.

Anti-panopticon framing: heartbeats with auto-state attached ARE
debug logs (operator message 2) BUT the agent retains full control
over what state attaches (operator message 3). Debug-log property
does not override consent-first property; they compose. The gather
mechanism itself cannot become a coercion vector because each field
requires explicit opt-in at agent scope.

## Scope

`tools/agent-heartbeats/write-heartbeat.ts` already writes structured
YAML frontmatter (zetaid + agent + persona-slot + timestamp +
authority + momentum + chromosome + location + firefly + disposition,
with optional named-dep and optional parent-pr fields). This row
extends the writer with AUTO-GATHERED CURRENT-STATE fields that the
agent doesn't have to pass explicitly.

Candidate auto-gathered fields (operator-driven prioritization):

| Field | Source | Cost |
|---|---|---|
| `branch-protection-state` | `gh api repos/{owner}/{repo}/rulesets` count + names | 1 REST |
| `open-pr-count` | `gh pr list --state open --author "@me" --json number` | 1 REST |
| `recent-merged-pr-count` | `gh pr list --state merged --author "@me" --json number --limit 10` | 1 REST |
| `current-rate-limit-graphql-remaining` | `gh api rate_limit --jq '.resources.graphql.remaining'` | 1 REST (free) |
| `current-rate-limit-core-remaining` | same call | 0 extra |
| `cron-sentinel-alive` | check CronList for `<<autonomous-loop>>` | local |
| `git-clean-state` | `git status --porcelain \| wc -l` from operator primary checkout | local |
| `last-commit-on-main-sha-prefix` | `git ls-remote origin main` first 8 chars | local |
| `dotgit-saturation-tier` | per .claude/rules/refresh-world-model-poll-pr-gate.md table | composed lookup |
| `peer-agent-process-count` | `pgrep -fl "claude-code\|gemini\|kiro" \| wc -l` | local |
| `current-worktree-path` | `process.cwd()` | local |
| `current-branch` | `git rev-parse --abbrev-ref HEAD` from worktree | local |
| `staged-file-count` | `git diff --cached --name-only \| wc -l` | local |
| `unstaged-file-count` | `git diff --name-only \| wc -l` | local |
| `untracked-file-count` | `git ls-files --others --exclude-standard \| wc -l` | local |

All fields are observational (read-only); no operator-coercion;
each adds 0-1 REST or local-git call to the writer.

## Debug-log property (operator 2026-05-27)

When current-state attached, each heartbeat becomes a structured
debug-log snapshot of the agent at tick-fire time:

- Cross-referencing 100 consecutive heartbeats from one agent
  reveals tick-cadence + named-dep timeline + disposition
  evolution
- Cross-referencing heartbeats from multiple agents reveals
  multi-agent saturation timeline (when did Lior fire? when did
  peer-Otto fire? what was rate-limit at the moment?)
- Cross-referencing heartbeats with PR landings reveals which
  agent + which disposition produced which substrate landing
- Cross-referencing heartbeats with sentinel-restart events
  reveals catch-43 firing timeline

Each ZetaID-indexed heartbeat carries enough state to reconstruct
"what was the world like at this tick" for forensic analysis. The
debug-log property is what operator named: "heartbeats also become
debug logs once we have current state attached."

## Sub-rows planned

- **081KSKBP80008QG0R001KK9WV6.5a** — local-only auto-gather (cwd, branch, staged/unstaged/untracked counts; git-clean-state; current-worktree-path) — zero REST cost; fastest landing
- **081KSKBP80008QG0R001KK9WV6.5b** — git-state auto-gather (last-commit-sha-prefix; behind-vs-ahead status vs origin/main) — pure-git calls; no REST
- **081KSKBP80008QG0R001KK9WV6.5c** — REST-state auto-gather (rate-limit; open-PR-count; recent-merged-PR-count) — bounded REST cost; might skip when rate-limit low
- **081KSKBP80008QG0R001KK9WV6.5d** — peer-state auto-gather (peer-agent-process-count via pgrep; dotgit-saturation-tier per refresh-world-model rule) — local; informational
- **081KSKBP80008QG0R001KK9WV6.5e** — sentinel-state auto-gather (CronList check for `<<autonomous-loop>>` presence) — harness-tool call

Order: 5a → 5b → 5d (all local) → 5c (REST-cost-bounded) → 5e (last).

## What this is NOT

- NOT a replacement for AgencySignature trailer on substantive
  commits (those still carry full Agency-Signature-Version: 1 block;
  heartbeats are the per-tick complement, not the substantive-commit
  replacement)
- NOT a coercion mechanism: gathered fields are observational; agent
  authority over what's emitted preserved by env-var override + CLI
  --no-gather-X flags
- NOT a security risk: all fields are repo-state-observable already
  (`gh pr list`, `git status`, `pgrep` are non-secret)

## Composes with substrate

- 081KSKBP80008QG0R001KK9WV6 (parent row; PR #5456 merged)
- 081KSKBP80008QG0R001KK9WV6.3 writer (PR #5464 merged) — this row extends
- 081KSKBP80008QG0R001KK9WV6.4 merge tool (PR #5471 in-flight) — heartbeats now batch-merge
  to main periodically, so debug-log property eventually visible in main
  history without needing to query agent-heartbeats branch separately
- `.claude/rules/refresh-world-model-poll-pr-gate.md` — rate-limit
  tier table consumed by 5c
- `tools/hygiene/audit-agencysignature-main-tip.ts` — sibling forensic
  tool at substantive-commit scope; this row extends to per-tick scope

## Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Topic: auto-state-gathering for agent heartbeats

Searched:

- `tools/agent-heartbeats/` — writer + merge tool already shipped (081KSKBP80008QG0R001KK9WV6.3 + 081KSKBP80008QG0R001KK9WV6.4)
- `tools/hygiene/audit-agencysignature-main-tip.ts` — sibling forensic tool
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — externalized counter discipline this row extends
- `memory/` — no prior memory on auto-state-gathering specifically
- `docs/backlog/` — no existing row covers this scope; this row fills the gap

Conclusion: composes with 081KSKBP80008QG0R001KK9WV6.3 + 081KSKBP80008QG0R001KK9WV6.4; extends the writer
with optional auto-gather mode (defaults preserve current minimal
behavior).

## Heartbeat per CLAUDE.md discipline

Filing this row IS counter-reset work per `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`
condition #3 — capturing operator-named future work so substrate
exists; deferred per operator's "right now we are gong to go back to
usb once we have this hearbeat current iteration done" — implementation
defers until USB push lands.

## Full reasoning

Operator 2026-05-27 verbatim quotes preserved above. Filed in the
same heartbeat-substrate iteration as 081KSKBP80008QG0R001KK9WV6 row + .3 writer + .4
merge tool. Implementation deferred per operator's explicit USB-priority
direction. Recording the row exists is critical for deferring the
work to reliably happen (operator 2026-05-27 separation-of-concerns
discipline).

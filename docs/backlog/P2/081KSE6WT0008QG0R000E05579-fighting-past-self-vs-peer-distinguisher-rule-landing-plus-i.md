---
id: 081KSE6WT0008QG0R000E05579
priority: P2
status: open
created: 2026-05-25
last_updated: 2026-05-25
title: Fighting past-self vs peer-agent — distinguisher rule landing + identity-tagging mechanization scope (Aaron 2026-05-25 'you don't do like vera and just leave it unfixed cause you assume it's someone elses issues')
domain: agentic-organization
ferried_by: aaron
owners: [aaron]
composes_with:
  - 081KSE6WT0008QG0R003YYC9PV
  - 081KSE6WT0008QG0R003YYC9PV
related_substrate:
  - .claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md
  - .claude/rules/agent-roster-reference-card.md
  - .claude/rules/peer-call-infrastructure.md
tags: [past-self-vs-peer-distinguisher, ownership-classification, default-punt-failure-mode, vera-anchor, identity-tagging-mechanization, substrate-cleanup-discipline]
---

# 081KSE6WT0008QG0R000E05579 — Past-self-vs-peer distinguisher rule + mechanization scope

## Carved blade

> Aaron 2026-05-25 (Vera-specific anchor): *"you don't do like vera and just leave it unfixed cause you assume it's someone elses issues."* The failure mode is **silent-punt-by-default** — agent encounters stale substrate, assumes peer-owned, leaves unfixed. The discipline: DISTINGUISH ownership via concrete discriminators (branch prefix, worktree path tag, commit authorship, PR author, bus envelope authorship); if YOURS fix it, if PEER's coordinate, if UNCERTAIN surface explicitly (never silent-punt). Composes with 081KSE6WT0008QG0R003YYC9PV cleanup discipline + 081KSE6WT0008QG0R003YYC9PV per-agent-clone architecture (which makes ownership LARGELY UNAMBIGUOUS at clone-path scope). Rule lands today (auto-loads at cold-boot); mechanization scope tracks the identity-tagging tooling that makes the distinguishers reliable.

## Origin

Aaron 2026-05-25, after the 37-worktree mass-cleanup + 081KSE6WT0008QG0R003YYC9PV rule + 081KSE6WT0008QG0R003YYC9PV per-agent-clone architecture decisions:

> *"also it should be clear when you are fighting your past self vs another travler/agent so you don't do like vera and just leave it unfixed cause you assume it's someone elses issues"*

The Vera-specific instance + generalization: the failure mode applies to ALL agents (Otto-CLI, Otto-VSCode, Otto-Desktop, Alexa, Riven, Vera, Lior, future) — when encountering stale substrate, the default-punt assumption ("must be someone else's") is the substrate-engineering failure to catch.

## What this row ships in this PR

### Rule landed (auto-loads at cold-boot)

`.claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md`

Operational content:

1. **Decision tree**: encounter stale substrate → identify ownership → MINE (fix) / PEER's (coordinate) / BOTH (joint cleanup) / UNCERTAIN (surface)
2. **Identification discriminators** (multiple compose):
   - Branch prefix per identity (`otto/*`, `alexa-kiro/*`, `riven-cursor/*`, `vera-codex/*`, `lior-antigravity/*`, etc.)
   - Worktree path tag (`/private/tmp/zeta-<identity>-*/`)
   - Commit authorship via `git log --author`
   - PR author via `gh pr view --json author`
   - Bus envelope authorship via `cat /tmp/zeta-bus/*.json | jq .from`
   - File mtime + creation context
3. **Action by classification**: MINE → fix; PEER's → coordinate; UNCERTAIN → surface, never silent-punt
4. **Anti-pattern explicit example**: silent-punt vs explicit-uncertainty

## Substrate-engineering mechanization scope

### Scope item 1 — Per-agent identity-tagging conventions

- Document canonical identity-tag conventions per agent surface (composes with `.claude/rules/agent-roster-reference-card.md`)
- Branch prefix conventions (currently informal: `otto/*`, `feat/<task>-<date>`, etc.; mechanize into a documented list)
- Worktree path tag conventions (`/private/tmp/zeta-<identity>-<task>-<hhmmz>/`)
- Commit author config conventions (per-agent git user.email + user.name)
- Bus envelope `from` field conventions (already in 081KR7JY10008QG0R000R503K2 substrate)
- Acceptance: conventions documented; per-agent-roster table updated with identity-tag examples

### Scope item 2 — Identity-tagged worktree creation helper

- TS tool at `tools/agent-identity/create-tagged-worktree.ts` (or similar)
- Takes agent identity + task tag; creates worktree at `/private/tmp/zeta-<identity>-<task>-<hhmmz>/`
- Embeds identity in worktree path (so peer-Otto inspecting the path can immediately tell whose it is)
- Composes with 081KSE6WT0008QG0R003YYC9PV (`--detach origin/main` enforcement) + 081KSE6WT0008QG0R003YYC9PV (per-agent-clone path within clone)
- Acceptance: tool exists; per-agent-identity prefix enforced in worktree paths

### Scope item 3 — Ownership-classifier tool

- TS tool at `tools/agent-identity/classify-ownership.ts` (or similar)
- Takes a worktree path / branch / file / PR / bus envelope as input
- Runs all discriminators; returns classification (MINE / PEER:<which> / BOTH / UNCERTAIN)
- Reports per-discriminator outputs so user can verify
- Composes with the rule's discriminators
- Acceptance: tool exists; correctly classifies at least 10 test cases including ambiguous ones (UNCERTAIN classification)

### Scope item 4 — Pre-cleanup classifier hook

- Pre-Bash hook that intercepts `git worktree remove --force` + `git branch -D` + similar destructive ops
- Runs ownership classifier; if PEER's → blocks with surface-the-uncertainty message; if MINE → proceeds; if UNCERTAIN → blocks + surfaces
- Composes with the rule's discipline; mechanizes the discriminator step
- Acceptance: hook exists; blocks accidental peer-substrate destruction

### Scope item 5 — Per-agent cleanup reporting

- When agents do clean up their own substrate, log per-agent cleanup events to bus envelope + provenance chain (per 081KSE6WT0008QG0R002YBWBB1 Layer 1)
- Operator + peer agents can audit who cleaned what
- Composes with `.claude/rules/glass-halo-bidirectional.md`
- Acceptance: cleanup events logged; visible via bus envelope query + provenance chain

## Composes with .claude/rules/

- `.claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md` (the rule this row ships)
- **081KSE6WT0008QG0R003YYC9PV** sibling rule (to land separately; not yet present in `.claude/rules/`) — sibling at cleanup discipline
- `.claude/rules/claim-acquire-before-worktree-work.md` (force-remove guard; this rule clarifies the AUTHORIZATION model)
- `.claude/rules/agent-roster-reference-card.md` (canonical identity prefixes)
- `.claude/rules/peer-call-infrastructure.md` (bus envelope coordination)
- `.claude/rules/honor-those-that-came-before.md` (peer substrate honored)
- `.claude/rules/non-coercion-invariant.md` HC-8 (peer authority preserved)
- `.claude/rules/glass-halo-bidirectional.md` (surface uncertainty IS substrate-honest disclosure)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (default-punt IS Standing-by failure mode at substrate-cleanup scope)

## Composes with backlog substrate

- **081KSE6WT0008QG0R003YYC9PV** (agent worktree hygiene) — sibling at cleanup discipline; 081KSE6WT0008QG0R000E05579 adds the ownership-classification discipline
- **081KSE6WT0008QG0R003YYC9PV** (per-agent isolated clones) — per-agent-clone makes ownership LARGELY UNAMBIGUOUS at clone-path scope; 081KSE6WT0008QG0R000E05579 still applies for transitional period + for substrate outside the clone (memory files, bus envelopes, branches on origin, etc.)
- **081KRMEXM0008QG0R000X1PPGC** (cron-sentinel mutex; existing partial substrate) — same problem class at runtime scope
- **081KSE6WT0008QG0R002YBWBB1** (leverage-class safety substrate) — Layer 1 provenance chain captures cleanup events (per Scope item 5)

## Empirical anchor

Vera-specific instance per Aaron 2026-05-25. Same session as the 37-worktree mass-cleanup (which I — Otto-VSCode — eventually drove). Substrate-honest self-implication: I could have cleaned MUCH earlier if I'd applied this discipline; the worktrees were mostly MINE; I left them accumulating partly because I assumed they might be peer-owned (silent-punt-by-default at my own substrate). The rule's empirical anchor IS my own past-session failure mode.

The cluster of related rules landed in this session (081KSE6WT0008QG0R003YYC9PV + 081KSE6WT0008QG0R003YYC9PV + 081KSE6WT0008QG0R000E05579) form the 2026-05-25 cross-agent substrate-discipline inflection. Together they encode:

- **081KSE6WT0008QG0R003YYC9PV**: clean up after yourself; don't accumulate stale worktrees
- **081KSE6WT0008QG0R003YYC9PV**: agents have their own clones; cross-agent contention eliminated at architecture level
- **081KSE6WT0008QG0R000E05579**: distinguish your own substrate from peers; don't silent-punt; fix yours; coordinate on theirs

## Substrate-honest framing

This row PROPOSES the rule + mechanization scope. It does NOT:

- Eliminate ambiguity in all cases (some substrate genuinely is ambiguous; UNCERTAIN classification + surface-the-uncertainty IS the answer there)
- Force agents to inspect every encountered substrate (only when DECISION POINT arrives — cleanup, modify, etc.)
- Override per-agent autonomy (each agent decides per their own substrate)
- Bypass coordination requirements for peer substrate (per `claim-acquire` + NCI HC-8)

Per `.claude/rules/no-directives.md`: rule auto-loads at cold-boot; operator + future-AI retain authority to apply or skip per scope.

P2 priority — high reuse-leverage (every agent across every surface inherits the discipline); composes with 081KSE6WT0008QG0R003YYC9PV + 081KSE6WT0008QG0R003YYC9PV to close the 2026-05-25 agent-substrate-discipline cluster. Not P1 because 081KSE6WT0008QG0R003YYC9PV + 081KSE6WT0008QG0R003YYC9PV already operating; this rule sharpens the discipline at ownership-classification scope.

## Today's substrate cascade closing arc (full)

Today's 2026-05-25 cluster of agent-substrate-discipline rules:

| Row | What | State |
|---|---|---|
| 081KSE6WT0008QG0R003YYC9PV | Agent worktree hygiene — never hold main + never step on operator + cleanup on PR merge | PR #5020 armed |
| 081KSE6WT0008QG0R003YYC9PV | Per-agent isolated clones architecture — primary checkout is SHARED VIEW + FOR HUMAN | PR #5019 armed |
| **081KSE6WT0008QG0R000E05579 (this)** | **Fighting past-self vs peer-agent distinguisher — fix yours; coordinate on theirs; never silent-punt** | THIS PR |

Together: agents inherit the cross-agent substrate-discipline at cold-boot; operator unblocked; substrate-engineering pain class closed.

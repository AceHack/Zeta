# Codex Addendum

This is the OpenAI Codex harness addendum for Zeta. It is
additive only: [`../AGENTS.md`](../AGENTS.md) and
[`../GOVERNANCE.md`](../GOVERNANCE.md) remain authoritative
for repo-wide rules.

## Read Order

At session start:

1. Read `AGENTS.md`.
2. Read `docs/ALIGNMENT.md`.
3. Read `docs/SEED-VOCABULARY.md` for the cold-boot core and carved
   Zeta-specific vocabulary; use `docs/GLOSSARY.md` only on demand.
4. Read `.codex/README.md`.
5. Read `.codex/CURRENT-codex.md`.
6. For Codex host-loop mechanics, read
   `docs/CODEX-HARNESS-NOTES.md`.
7. For autonomous-loop work, read `docs/CODEX-LOOP-HANDOFF.md`
   and `docs/AUTONOMOUS-LOOP.md`.
8. For write work, read `docs/AGENT-CLAIM-PROTOCOL.md` and
   follow its shared-machine / shared-folder mode when other
   agents are active on the same machine.

## Codex Worktree Discipline

Codex sessions write from dedicated worktrees. The repository
root checkout is treated as contested shared state unless the
human maintainer explicitly assigns it to this session.

Before editing:

- Push a `claim/<slug>` branch with `docs/claims/<slug>.md`.
- Create a local heartbeat at
  `$(git rev-parse --git-common-dir)/agent-heartbeats/<session>.json`.
- Name intended path prefixes in the heartbeat.
- Do not commit heartbeat files.

## Commit Attribution

Every Codex commit **must** include:

```
Co-Authored-By: Codex <noreply@openai.com>
```

This trailer is how parallel loops (Otto on Claude
Code, Riven on Cursor/Grok, Vera on Codex) tell
each other's commits apart. Without it, all commits
look identical to the git user — breaking multi-loop
coordination and audit. See `AGENTS.md` §"Commit
attribution — harness-specific trailers" for the
full convention.

Headless Codex host-loop commits add machine-readable
origin trailers so future deployments can distinguish
background work from foreground Vera / Codex chat work:

```
Codex-Origin: codex-launchd-loop
Codex-Surface: codex-background-service
Codex-Loop-Run-Id: <run id from ZETA_CODEX_LOOP_RUN_ID>
```

Foreground Codex chat commits do not use these extra
trailers. The difference is intentional: the shared
`Co-Authored-By` trailer identifies the harness, while
the `Codex-*` trailers identify the headless launchd
surface that created the work.

## Visible Speaker Prefix

While multiple agent chat surfaces are active, Codex / Vera
starts user-visible chat updates with `Vera:` so copied
transcripts keep their speaker attribution. This follows
`AGENTS.md` §"Visible speaker prefixes".

## Ownership Boundary

Codex owns `.codex/**` content and Codex-authored skills.
Claude Code and other harnesses may review these files, but
routine edits should come from a Codex session or be explicitly
delegated by the human maintainer.

Codex may read `.claude/**` skill bodies as data when needed,
but does not treat Claude-specific files as Codex instructions
unless the same rule is promoted into `AGENTS.md`,
`GOVERNANCE.md`, or another harness-agnostic surface.

## Background Agents

Codex-spawned subagents are part of the Codex execution lane.
They inherit the same scope and worktree discipline as the
parent session. A subagent may inspect broadly, but write work
needs a bounded file set and must not overlap another active
writer's heartbeat path unless explicitly coordinated.

## Current State

Use `.codex/CURRENT-codex.md` for the compact state handoff
for future Codex sessions. Keep it factual and operational:
active PRs, active worktrees, current hazards, and next safe
actions. Do not store doctrine there unless the doctrine is
also promoted to a canonical repo surface.

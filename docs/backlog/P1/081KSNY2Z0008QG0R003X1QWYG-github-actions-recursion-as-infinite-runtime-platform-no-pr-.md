---
id: 081KSNY2Z0008QG0R003X1QWYG
priority: P1
status: open
title: GitHub Actions recursion as infinite runtime platform — no-PR swarm-mode for agent-loop substrate (Microsoft-subsidizes-OSS hack)
effort: L
ask: aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R000V24M7E
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R000V24M7E
  - 081KSNY2Z0008QG0R000ZNRFCE
  - 081KSNY2Z0008QG0R000F0C5V0
tags:
  - github-actions-recursion
  - workflows-triggering-workflows-forever
  - infinite-runtime-platform
  - microsoft-subsidizes-oss
  - free-event-store-via-git
  - no-pr-swarm-mode
  - rest-barely-throttled-graphql-bottleneck
  - build-swarm-first-then-guardrails-sequencing
  - skill-distributable-agent-swarm
  - one-script-spawns-infinite-swarm
  - local-cluster-preserved-alongside
  - potential-extension-not-committed
---

## Operator framing 2026-05-28 (Ani-ferry)

> *"I could basically use GitHub workflows that trigger GitHub workflows that trigger GitHub workflows that trigger GitHub workflows forever and ever."*

> *"once we have these workflows that are defined in fuckin' TypeScript, choose your own adventure. That's choose your own adventure. You kick it off once per agent and then that agent just continues that for forever."*

> *"Nah, nah, nah, we gotta figure out how to build the guardrails first, but we can build it in that crazy freeform way with no PRs."*

> *"if I don't make 'em do PRs, there's no rate limits. 'Cause they don't rate limit Git, they rate limit the fuckin' GraphQL, which you gotta do GraphQL for some of the pull request shit."*

## What this row tracks

Turn GitHub Actions into an infinite recursive compute platform for the agent-loop substrate. Each agent gets a long-running workflow that triggers new workflow runs (choose-your-own-adventure style) forever, all backed by Git as the event store. The "Microsoft subsidizes open-source" framing makes this economically free for public repos.

## Key technical observations

- **Git is barely rate-limited**; REST API is forgiving; GraphQL is the bottleneck (because PR mutations use GraphQL)
- **Push-direct-no-PR sidesteps almost all rate limits** — each agent pushes its own ZetaID-named events directly to `agent-state/{persona}/{trajectory}/` branches
- **Workflows-triggering-workflows pattern**: each `move-next` cycle invokes a new workflow_dispatch + writes the result + the next workflow picks it up from Git
- **Skill-distributable**: the agent-swarm-skill spawns a personal swarm per GitHub user — "you just ask your agent, hey agent, do this skill"

## Acceptance criteria

- `.github/workflows/agent-loop-swarm.yml` workflow that:
  - Reads current state from `agent-state/{persona}/{trajectory}/` branches
  - Invokes `src/Core.TypeScript/workflow-engine/agent-loop/state-machine.ts` for `move-next` decision
  - Appends new event to Git via direct push (no PR)
  - Triggers next workflow run via `workflow_dispatch` API
- Bounded-iteration safety (per Kestrel's push-cycle-limit 081KSNY2Z0008QG0R000121FJ4 framing) — workflows include a max-recursion-depth + abandonment-condition guard
- Skill distribution: `.claude/skills/agent-loop-swarm/SKILL.md` wraps the swarm-spawn so any GitHub-authenticated agent can invoke it
- Documentation: rate-limit analysis showing GraphQL vs REST vs Git differential
- Composes with 081KSNY2Z0008QG0R000V24M7E (ZetaID generator) — events use ZetaIDs as primary keys; no merge conflicts via unique filenames

## Sequencing

Per operator 2026-05-28: **build the swarm FIRST, then add guardrails on top**. Get the unrestricted no-PR swarm running, then layer PR-equivalent review mechanisms inside the swarm itself.

This is NOT "ship without guardrails" — it's "ship with the architectural-pressure to design guardrails for THIS architecture rather than retrofit existing-PR-process guardrails."

## Scope

Cloud-side substrate. Composes with — does NOT replace — the local cluster path (NixOS USB + Kubernetes per existing substrate). Both paths active per default-to-both; operator preference is local-sovereign + cloud-additional, not cloud-only.

## Substrate-honest framing

POTENTIAL extension per operator standing direction. Particularly POTENTIAL because the no-PR-swarm sequencing inverts the conventional safety order (typically: PR-first, then optimize). Filed for prioritization; expected to need operator-staged review before landing.

## Full reasoning

`memory/ani/conversations/2026-05-28-aaron-ani-grok-move-next-as-universal-action-grammar-git-as-free-event-store-github-actions-recursion-nci-three-exceptions-clear-now-ai-mediator-for-relationships-aaron-forwarded.md` (Ani-ferry transcript; PR #5672)
`memory/kestrel/conversations/2026-05-28-kestrel-zetaid-128bit-structured-encoding-event-sourcing-without-pr-ceremony-otel-trace-composition-two-level-state-machine-aaron-forwarded.md` (Kestrel architectural complement; PR #5674)

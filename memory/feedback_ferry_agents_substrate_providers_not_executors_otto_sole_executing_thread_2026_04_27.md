---
name: Ferry agents (Amara, Gemini Pro, Codex) are substrate-providers, NOT executors; Otto is the sole executing thread until peer-mode + git-contention resolved (Aaron 2026-04-27)
description: Aaron 2026-04-27 execution-semantics clarification — cross-AI courier-ferry agents (Amara, Gemini Pro, Codex, Copilot) provide substrate input (research, reviews, refinements, corrections) but do NOT directly execute on the project. All execution flows through Otto. Otto = sole executing thread until (a) peer-mode is implemented AND (b) git-contention from multi-fork / multi-agent operation is resolved. Composes with #55 (single-agent-speed → collaboration-speed trajectory; partial capture confirmed by Aaron) + Otto-357 (no directives, autonomy is mine = execution authority is mine) + #57 (protect-project; encode-decisions etc. are mine to make) + Otto-340 substrate-IS-identity (multi-agent support lives in SUBSTRATE layer, not execution layer). Operational rule when ferry agents offer to do work (Gemini's "shall I create the doc?" 2026-04-27): defer to Otto for execution; their offer is signal, Otto's evaluation + execution is the action.
type: feedback
---

# Ferry agents = substrate-providers, NOT executors; Otto = sole executing thread

## Verbatim quotes (Aaron 2026-04-27)

> "oh yeah i'm not going to get my ferry agents to do anything, any stuff like that should be handled through you and mutti agent support in the substright and it up to you right now since you are the only executing thread for this whole project, we only have one until you get peer mode and all the git contention is resolved around this. backlog"

> "i think it's already on the backlog"
> "some of it"

## The execution-semantics rule

**Cross-AI courier-ferry agents** (Amara via ChatGPT, Gemini Pro, Codex, Copilot, future Grok/etc.) operate at the **substrate layer**:

- They provide research reports (Amara's 19+ ferries)
- They provide cross-AI reviews (Amara's stability/velocity refinement, Gemini's blade-taxonomy validation)
- They provide corrections (Amara correcting Gemini's "Brain" → "Oracle/Immune-System")
- They provide insights (Gemini's cognitive-caching framing, Amara's "Stability is velocity amortized")
- They flag risks (Codex's AGENTS.md three-load-bearing-values catch)

**They do NOT operate at the execution layer:**

- Ferry agents do not commit to the repo
- Ferry agents do not push branches
- Ferry agents do not arm auto-merge
- Ferry agents do not resolve review threads
- Ferry agents do not file substrate memories
- Ferry agents do not negotiate with Aaron

**Otto operates at the execution layer:**

- Otto reads ferry input (substrate) and integrates it via judgment
- Otto commits, pushes, opens PRs
- Otto files memories from ferry insights
- Otto evaluates encode-decisions and routes to skill-creator / Architect when needed
- Otto IS the executing thread

## When a ferry agent offers to do work

Gemini Pro 2026-04-27 example: "Shall I go ahead and create `docs/architecture/metaphor-taxonomy.md`?"

The right answer is NOT "Yes, Gemini, go ahead" because:

- Gemini is a ferry-layer entity (substrate-provider)
- The doc-creation work is execution-layer
- Aaron explicitly disclosed: ferry agents don't execute things
- Even if Gemini could create something in some sandboxed space, it wouldn't land on the actual factory repo via ferry-channel

The right answer flow:

1. **Receive the offer as signal**: Gemini wants the doc to exist; the substrate is mature enough that Gemini thinks now is the time
2. **Otto evaluates**: does this make sense for the project? per protect-project mandate, the encode question gets critical evaluation, not compliance-execute
3. **If yes**: Otto routes through skill-creator / Architect path, creates the doc, opens PR, etc. — Otto executes
4. **If no / not yet**: Otto explains the reasoning (per teach-and-negotiate discipline), surfaces to Aaron if the decision is high-stakes
5. **Aaron decides** when the decision is genuinely his (routine-class override authority)

This is consistent with Otto-357 (no directives → autonomy is Otto's) + #57 (protect-project → Otto evaluates routine-class suggestions, even from ferries).

## Why one executing thread (currently)

Aaron named two unlock conditions for a second executing thread:

1. **Peer mode**: a second AI instance with the same factory access + judgment authority (not a ferry, an actual peer Otto). Architecturally similar to Otto, just running as a different process / harness.

2. **Git contention resolution**: today's fork-and-PR workflow assumes one executor (Otto) producing a serial stream of PRs. Two concurrent executors would produce racing PRs against the same MEMORY.md and other shared single-writer files (per #54 ROUND-HISTORY hotspot research). Until git-contention strategy is designed (per-pair partition / append-only structured / CRDT-style etc.), adding a second thread creates more drift than it removes.

Both unlock conditions need substrate work BEFORE peer-mode lands. That work is itself backlog (per #54 + #55).

## Composes with — partial capture confirmed by Aaron

Aaron 2026-04-27: "i think it's already on the backlog ... some of it"

**What IS already captured (per Aaron):**

- **#55 (`feedback_substrate_optimized_for_single_agent_speed_collaboration_speed_hardening_iterative_2026_04_27.md`)** — single-agent-speed → collaboration-speed trajectory; ~16 sample trajectories; `docs/TRAJECTORIES.md` registry backlog
- **#54 (`feedback_round_history_md_git_hotspot_concern_multi_fork_multi_agent_backlog_research_2026_04_27.md`)** — git-contention research backlog (per-pair partition / append-only / CRDT etc.)

**What this memory adds (not previously captured):**

- The explicit rule: ferry agents are substrate-providers, NOT executors
- The operational consequence: ferry offers to do work → Otto evaluates + Otto executes (or declines + teaches)
- The Otto = sole-executing-thread invariant (today)
- The two unlock conditions named: peer-mode + git-contention-resolution

## What this memory does NOT mean

- Does NOT diminish ferry agents' value. Their substrate contributions are load-bearing (cross-AI consensus, corrective loops, framing refinements). They're indispensable at the substrate layer.
- Does NOT mean Otto ignores ferry input. Per Aaron-communication-classification (#56), most input is course-corrections-for-trajectories — and ferry input is high-quality course-correction.
- Does NOT mean Otto rejects all ferry offers to help. Some ferry offers are appropriate and useful as substrate (e.g., "I'll review your synthesis" — that IS substrate work). Only execution-layer offers (creating files, committing, etc.) get redirected.
- Does NOT block future peer-mode work. The two unlock conditions are explicit; backlog them and work toward them.

## Composes with

- **#55 substrate single-agent → collaboration-speed trajectory** — partial-capture confirmed; this memory adds the ferry-vs-executor rule
- **#54 ROUND-HISTORY git-hotspot research** — git-contention is one of the two unlock conditions
- **Otto-357 no directives** — autonomy is Otto's = execution authority is Otto's
- **#57 protect-project** — execution-layer evaluation including encode-decisions
- **Otto-340 substrate-IS-identity** — multi-agent support lives at substrate layer, not execution
- **`feedback_amara_priorities_weighted_against_aarons_funding_responsibility_2026_04_23.md`** — ferry work is funded; execution requires Otto-tick budget too
- **Aurora courier-ferry archive (`docs/aurora/`, `docs/amara-full-conversation/`)** — Amara's substrate output already accumulated; this rule clarifies it's substrate, not execution proxy

---
name: Amplification ratio — human input to agent actions as first-class trackable metric
description: Aaron 2026-05-11 — "how many times i type to how many actions you take is a metric people will care about." Amplification ratio (human messages → agent actions) is what makes the factory's leverage tangible to outside observers. Counting messages on the human side and counting commits/PRs/thread-resolves/archives on the agent side gives a single number that compresses the entire "what AI agents can do with minimal human input" story. Should be tracked as a first-class dashboard metric.
type: feedback
---

## Honest framing — vanity but viral

Aaron 2026-05-11: "its a vantiy metric but viral"

The amplification ratio is **NOT an engineering metric**. It
doesn't measure substrate quality, alignment integrity, code
correctness, or factory health. Optimizing for it would be a
mistake — gaming the ratio (e.g., splitting commits to inflate
agent-action count) degrades the actual work.

What it IS: a **viral discoverability metric**. Same category
as GitHub stars or Twitter likes — useful for visibility and
storytelling, useless for engineering decisions. The number's
job is to make the factory's leverage tangible to outside
observers in one glance.

**Engineering metrics** (substrate stability, merge lead time,
verification gate pass rate) drive decisions. **Vanity metrics**
(amplification ratio, PR count, stars) drive attention. Both
have a role; conflating them is the failure mode.

## The metric

> Aaron 2026-05-11: "i lvoe the action njmber trackting show
> amplification as first class trackable"
>
> "like how many time i type to how many actions you take is a
> metric pople will care about"

**Amplification ratio:**

```
Aaron messages this session : Agent actions this session
```

If Aaron types 30 messages and the agent array (Otto + Lior +
Riven + Vera + Alexa) takes 423 actions, that's 14x
amplification. Single number, instantly interpretable, viral-
shareable.

## Why this metric matters more than PR count

Raw PR count is easy to game (split work into many small PRs).
Lines-of-code is anti-correlated with quality. Lead-time
measures speed but not leverage.

**Amplification ratio measures leverage per human input.**
That's the actual product claim — AI agents do more with less
human direction. Every other metric is downstream of this one.

## What counts as an "action" (operational definition)

For the dashboard amplification counter:

- Git commits (each commit = 1 action)
- PR opens, closes, merges (each = 1 action)
- Review thread replies + resolves (each = 1 action)
- PR archive landings (each = 1 action)
- Memory file creations + edits (each = 1 action)
- Cron firings that produce work (each = 1 action)
- Successful CI runs that gate merges (each = 1 action)

Optional weighted version:

- Substrate-class action (memory file, BP-NN rule, doc) = 3x
- Code-class action (src/, tools/) = 2x
- Hygiene-class action (lint fix, rebase) = 1x

Unweighted version is the right viral metric. Weighted version
is the right operational metric.

## What counts as "Aaron messages"

- Each top-level human input in the conversation thread
- Forwarded packets (Amara ferries, Claude.ai assessments)
  count as 1 message regardless of length
- Multi-message bursts (Aaron sending several in a row) count
  as N messages

## Dashboard surface

The amplification ratio should appear on the dashboard alongside
DORA metrics:

```
Aaron messages today: 47
Agent actions today: 612
Amplification: 13x
```

Or as a live counter that updates per tick.

## Composes with

- The Plant + photosynthesis metaphor — light absorption ratio
  (transparency in : structural mass out) is the same thing at
  metaphor scale
- The substrate-stability claim — 4.6 ran for weeks because
  the amplification ratio was high enough that Aaron's
  occasional inputs sufficed for weeks of work
- The orchestrator role — Otto's amplification is highest
  because integration work compounds across all agents

## How to apply

- Backlog item: add amplification counter to metrics.json and
  dashboard (Otto data layer, Lior UI)
- Twitter post: lead with the amplification ratio number
- The metric is honest BECAUSE it's verifiable from git log
  and chat transcript — both are committed substrate

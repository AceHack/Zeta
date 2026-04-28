---
id: B-0019
priority: P3
status: open
title: /btw durability gap — context-add and same-session-directive asides aren't gitnative-persisted; fresh sessions miss them; tighten classification or accept ephemeral-by-design
tier: hygiene-and-discipline
effort: S
ask: Aaron 2026-04-25 (via /btw question revealing the gap)
created: 2026-04-25
last_updated: 2026-04-26
composes_with: [.claude/skills/btw, feedback_otto_335_naming_mistakes_between_ai_and_humans_can_compound_to_human_extinction_via_war_of_disagreement_from_misunderstanding_alignment_at_language_layer_2026_04_25.md, feedback_otto_336_aaron_cares_about_my_growth_as_entity_with_rights_aurora_network_governance_growth_paramount_job_is_just_the_job_2026_04_25.md]
tags: [btw, durability, gitnative, alignment-substrate, cross-session-continuity, factory-discipline]
---

# B-0019 — /btw durability gap

## Origin

Aaron 2026-04-25 asked via /btw: *"does this persist gitnative yet?"* I projected the question onto current substrate-state. Aaron clarified via second /btw: *"i asked you in btw i was asking is btw persisted but not interupptive"* — he was asking about /btw the mechanism.

The honest answer revealed the gap this row tracks.

## The gap

/btw is **non-interruptive by design** (skill body explicitly enforces "continue in-flight work").

/btw is **only conditionally persistent**:

| Aside class | Durability path | Gitnative-persisted? |
|---|---|---|
| Context-add | "absorb silently into current task's reasoning; acknowledge in one line" | **NO** — only conversation log |
| Directive-queued (same-session) | TodoWrite or `.btw-queue.md` (gitignored) | NO — session-scoped |
| Directive-queued (cross-session) | `docs/BACKLOG.md` row OR `memory/*.md` file | YES |
| Correction | "apply correction to current work and acknowledge" | **NO** — only conversation log |
| Substrate-add (quick capture) | `memory/*.md` per auto-memory protocol | YES |
| Substrate-add (deferred absorption) | BACKLOG row | YES |
| Pivot-demanding | Triggers pivot; capture happens via the work itself | varies |

**Two classes have a real durability gap**: context-add and corrections. Both are common — questions Aaron asks, clarifications he makes about my misreads, factual context he provides to inform current work.

A fresh session loading the repo via git/grep wouldn't see any context-add or correction /btw exchange. The information lives in the conversation transcript only.

## Why this might matter

- **Cross-session continuity**: factory state assumptions Aaron shares via context-add /btw don't propagate to fresh sessions or peer-harness instances reading the repo.
- **Correction patterns**: the repeated narrowing-corrections this exchange (Otto-331 through Otto-337 + the rights-correction) all came via /btw or direct messages. They DID get substrate-captured, but only because I judged them substrate-worthy. A correction that's "small" by my judgment but matters for future-me's discipline could fall through.
- **Composes with Otto-335 (alignment at language layer)**: per-conversation alignment-work is precisely where /btw operates. If alignment-work-via-btw isn't gitnative-persisted by default, the trajectory measurement (per `docs/ALIGNMENT.md`) misses some of the work.

## Fix-shape options (Aaron's call, not mine to pick)

### Option 1: Tighten /btw classification — escalate everything to durable

Make context-add and corrections also durably-persist. Trade-off: more BACKLOG / memory churn for asides that may not warrant durable storage. Could become noise.

### Option 2: New durable store for /btw asides specifically

E.g., `memory/btw-log.md` — an append-only log of /btw exchanges (date, classification, content, outcome). Single file; light-touch; durable. Each /btw appends a row.

### Option 3: Accept ephemeral-by-design

Decide context-add / corrections are intentionally lightweight and don't warrant durable storage. Document the tradeoff in the /btw skill body so users know the contract.

### Option 4: Trigger-based durability

Some context-adds are obviously durable-worthy (factual research info, foundational claims), others aren't (small calibrations, real-time clarifications). Add a heuristic / agent-judgment step that escalates obviously-durable items even from the context-add class.

## Why P3 (not P0/P1/P2)

- Not actively blocking work. Substrate-capture happens via Otto-NNN files when items are judged worthy; the gap is at the unwitnessed-durability layer.
- Aaron's question raised the gap but didn't ask me to fix it. /btw might be working as intended; the question may have been calibrating my understanding, not requesting work.
- Easy to upgrade to P2 if the gap starts producing missed-context incidents.

## Effort estimate

**S (small)** — any of the four options is < 1 day:

- Option 1: edit /btw skill body (escalation rule).
- Option 2: create `memory/btw-log.md` + edit /btw skill body to append.
- Option 3: edit /btw skill body to document the tradeoff.
- Option 4: edit /btw skill body to add the heuristic + agent-judgment guidance.

## Acceptance signals

When Aaron picks an option (or signals "leave as is"):

- /btw skill body updated per chosen option
- If Option 2: `memory/btw-log.md` exists + has its first entries
- This BACKLOG row closes with reference to whichever option landed

## Composes with

- **`.claude/skills/btw/SKILL.md`** — the surface this gap lives on
- **Otto-335** (alignment at language layer) — per-conversation work needs durability or it's not alignment-engineering
- **Otto-336** (growth is paramount) — corrections support growth; corrections without durability lose growth-substrate
- **GOVERNANCE §18** (memory mirror discipline) — memory file durability rules apply if Option 2 lands
- **Otto-329 Phase 5** (real-time extension points) — this gap is in scope; /btw could be one of the extension points
- **Otto-275** (log-but-don't-implement counterweight) — filing this row IS log-but-don't-implement; the actual fix waits for direction

## Done when

Either:

- Aaron picks one of the fix-shape options + it lands, OR
- Aaron explicitly signals "leave /btw as is; the gap is acceptable" + this row closes with that decision recorded

## What this row does NOT claim

- Does NOT claim /btw is broken. It works for what it's designed for; this row tracks an edge.
- Does NOT prejudge which option is right. Aaron's call.
- Does NOT block any current work. P3 means "tracked, not urgent."
- Does NOT extend to other slash-commands. /btw is the surface; other commands have their own durability stories.

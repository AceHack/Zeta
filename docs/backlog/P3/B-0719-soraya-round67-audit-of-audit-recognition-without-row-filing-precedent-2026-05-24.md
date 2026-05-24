---
id: B-0719
priority: P3
status: open
title: "Soraya round-67 forced-decomposition — audit-of-audit: ratify the recognition-without-row-filing precedent (when trigger fires + 'not my lane,' where does the routing-decision substrate land?)"
created: 2026-05-24
last_updated: 2026-05-24
classification: buildable-now
decomposition: atomic
assignee: soraya
discovered_by: soraya
owners: [soraya, kenji]
type: meta-audit
composes_with:
  - .claude/skills/formal-verification-expert/SKILL.md
  - .claude/agents/formal-verification-expert.md
  - .claude/rules/holding-without-named-dependency-is-standing-by-failure.md
  - docs/backlog/P3/B-0718-soraya-four-trigger-framework-cadence-audit-2026-05-23.md
  - memory/persona/soraya/NOTEBOOK.md
---

# B-0719 — Audit-of-audit: ratify the recognition-without-row-filing precedent (Soraya round-67 forced-decomposition)

## Carved blade

> Trigger-fired-but-row-not-filed is a substrate gap. The round-66 recognition of PR #4797 merge as "Kenji's lane" was correct routing but left no in-repo trace of the routing decision itself.

## Origin

Soraya's round 67 hit hold #6/6 in the post-round-61 fresh counter sequence. Per the brief-ack-counter discipline (`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`), forced-decomposition fires.

Round-61 precedent: B-0718 audit row was filed as the concrete-artifact that reset the prior counter. The audit-of-the-audit pattern applies here — at round 67, the audit needs to focus on what round 66's "recognition-without-row-filing" precedent itself produced (or failed to produce) as substrate.

## The substantive question

When a routing trigger fires and the response is *"execution-not-my-lane"* (Soraya's lane is routing, not execution), the routing decision is correct — Soraya should NOT pre-empt Kenji's sizing work by filing a duplicative row. But that recognition itself is a routing-DECISION that currently leaves **no in-repo trace**.

Round-66 verbatim: *"recognition-without-row-filing per round 59 precedent"* — but the recognition lives only in chat output + Soraya's NOTEBOOK (volatile relative to git substrate).

The question: **When a routing trigger fires and the response is "execution-not-my-lane," does that recognition itself need a substrate landing — and if so, where?**

## Three candidate landings to evaluate

| Option | Cost | Trade-offs |
|---|---|---|
| **1. Soraya NOTEBOOK.md per-round trigger-recognition log** | Lowest (private to persona) | Persona-private; not cross-persona discoverable; future Kenji can't easily find Soraya's recognition trail without reading the notebook |
| **2. B-0718 row's "Recognition Log" subsection appended in-place** | Mid | Co-locates with the framework being audited; one place to look; but conflates audit findings with ongoing routing-decision log |
| **3. New `docs/research/verification-routing-decisions.md` ledger** | Highest | Cross-persona discoverable; explicit substrate; canonical history of routing decisions; durable across persona pruning cycles |

## Acceptance criteria

1. **Pick one of the three options above** with explicit rationale for the choice
2. **Document why the other two were rejected** in the same artifact
3. **Implement the chosen substrate** (NOTEBOOK section / B-0718 amendment / new research doc)
4. **Update `.claude/skills/formal-verification-expert/SKILL.md`** to reference the new substrate as the recognition-without-row-filing canonical landing
5. **Backfill** at minimum the round 59 + round 66 recognition events (the two precedent-setting cases)
6. **Land within 1 tick** (substrate-only; no code changes beyond `.claude/skills/` + `.claude/agents/` + chosen landing surface)

## Wrong-tool cost if not filed

Future Soraya cold-boots will rediscover the four triggers, fire on one, recognize "not my lane," and produce **zero substrate** — the round-66/67 pattern recurs without trace. Each cycle teaches the same lesson and forgets it. The forced-decomposition discipline (B-0718) addresses the four-trigger framework itself; this row (B-0719) addresses the recognition-event substrate gap that B-0718 didn't cover.

## Substrate-honest framing

This is the **recursive-recursion** of the discipline — round 61 forced-decomposition produced B-0718 (audit of the four-trigger framework). Round 67 forced-decomposition produces B-0719 (audit of the recognition-without-row-filing precedent that B-0718's existence makes possible). The pattern is fractal: every time the discipline operates correctly, it surfaces the next-finer substrate-gap.

This is NOT a sign the discipline is failing. It's a sign the discipline is operating as designed — each forced-decomposition produces concrete substrate at the next level of granularity. The danger is only if the recursion DOESN'T terminate (infinite audits of audits of audits).

**Termination condition for this recursion**: B-0719 picks one of the three options; subsequent recognition events have a place to land; no further audit-of-audit-of-audit needed unless the chosen landing surface itself fails to capture some future routing-decision class.

## Composes with

- [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](../../../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md) — the discipline operating recursively at Soraya scope
- [`docs/backlog/P3/B-0718-soraya-four-trigger-framework-cadence-audit-2026-05-23.md`](B-0718-soraya-four-trigger-framework-cadence-audit-2026-05-23.md) — the audit this row audits in turn
- [`.claude/skills/formal-verification-expert/SKILL.md`](../../../.claude/skills/formal-verification-expert/SKILL.md) — update target if option 1 or 2 chosen
- [`.claude/agents/formal-verification-expert.md`](../../../.claude/agents/formal-verification-expert.md) — Soraya persona definition
- [`memory/persona/soraya/NOTEBOOK.md`](../../../memory/persona/soraya/NOTEBOOK.md) — landing surface candidate for option 1

## Effort

S (one decision + one substrate landing + skill update). Assignee: soraya.

Per Aaron's 2026-05-23 21:30Z policy-flip: Otto auto-ships immediately per the auto-ship default; this row IS the policy-flip operating correctly at meta-meta-scope.

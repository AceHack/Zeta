---
pr_number: 6189
title: "rules(always-active): add idempotency as the 6th always-active discipline (scale/lock/weight-free + DST + DV2.0 + idempotency)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-31T02:55:50Z"
merged_at: "2026-05-31T03:06:42Z"
closed_at: "2026-05-31T03:06:42Z"
head_ref: "otto-cli/idempotency-sixth-always-active-discipline-2026-05-30"
base_ref: "main"
archived_at: "2026-05-31T03:35:16Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #6189: rules(always-active): add idempotency as the 6th always-active discipline (scale/lock/weight-free + DST + DV2.0 + idempotency)

## PR description

## Add idempotency as the 6th always-active discipline

Per operator 2026-05-30:
> *"we have the weight free scale free lock(wait) free deterministic simulation data vault 2.0 stuff. we should add idempotency."*

Extends the **always-active substrate-engineering discipline set** in its canonical home (`.claude/rules/dv2-data-split-discipline-activated.md`):

| Discipline | Scope | Produces |
|---|---|---|
| Scale-free | Design layers | Multi-scale composability |
| Lock-free / wait-free | Concurrency | No-lock primitives |
| Weight-free | Type theory | No implicit weighting |
| DST | Verification | Deterministic replay |
| DV2.0 | Partition | Change-rate-based partition |
| **Idempotency** *(new)* | **Effects / replay / merge** | **apply-N == apply-once: retry/replay/merge-safe** |

### Why it's load-bearing *with* the existing five

- **DST sibling** — DST *requires* replay; idempotency makes replay *safe* (re-applying an event = no-op).
- **lock-free** — CAS retry loops require idempotent ops.
- **git-as-db** — the G-Set CRDT event-fold is idempotent by construction (the whole rebuild-the-index model).
- **tri-boolean (081KSV2WD0008QG0R00051XS0N)** — `cooperate` = idempotent; `measure` = the deliberate non-idempotent collapse. The split *is* the cooperate/measure split.
- **observe→act / move-next** — re-fired actions must be no-ops = crash-resume safety (this session crashed mid-arc and resumed via idempotent PR-create + git-event append).
- **retraction-native Z-sets** restore replay-safety at the algebra level for genuinely accumulating ops.

Adds the 6th operational question ("is this op safe to apply more than once? make it so via natural key / CAS / set-union / content-address / upsert, or name the non-idempotence"). Substrate-checked: idempotency appears in CRDT/install-state docs but wasn't in the discipline set — genuine addition.

Auto-loaded rule; future cold-boots inherit it. 🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-31T02:57:17Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `a3ae0871a0`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-31T02:58:01Z)

## Pull request overview

This PR updates the canonical always-active discipline set documentation to include **idempotency** as the sixth discipline, extending the existing DV2.0/DST/lock-free/weight-free/scale-free substrate-engineering checklist and adding explanatory guidance on retry/replay/merge safety.

**Changes:**

- Updates the “always-active disciplines” table and wording from five → six, adding an explicit Idempotency row.
- Adds a new “Idempotency” section describing the concept, examples, and how it composes with DST / lock-free / git-as-db / tri-boolean / observe→act.
- Extends the operational checklist with a new sixth question focused on idempotency and lists the failure modes it catches.

### COMMENTED — @chatgpt-codex-connector (2026-05-31T03:07:14Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `b08904221d`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: .claude/rules/dv2-data-split-discipline-activated.md:121 (resolved)

**@chatgpt-codex-connector** (2026-05-31T02:57:17Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Soften the DST/idempotency equivalence**

In deterministic-simulation contexts that replay the same ordered event stream exactly once, replay remains sound for non-idempotent events such as counter increments or audit appends as long as the sequence is identical. This new always-active rule says replay is "only sound" when a duplicate event is a no-op, which can push future agents to incorrectly deduplicate or redesign valid accumulating/Z-set delta operations; please narrow this to duplicate redelivery or retry-after-uncertain-commit cases rather than DST replay itself.

Useful? React with 👍 / 👎.

### Thread 2: .claude/rules/dv2-data-split-discipline-activated.md:29 (resolved)

**@copilot-pull-request-reviewer** (2026-05-31T02:58:00Z):

P1: The table row conflates idempotency with “exactly-once” semantics. Idempotency enables exactly-once *effects* under at-least-once delivery (typically via idempotency keys / dedup), but doesn’t imply exactly-once delivery by itself—worth clarifying to avoid overpromising.

### Thread 3: .claude/rules/dv2-data-split-discipline-activated.md:114 (resolved)

**@copilot-pull-request-reviewer** (2026-05-31T02:58:00Z):

P1: “exactly-once-effect wrapper” is ambiguous; idempotency typically comes from an idempotency key + dedup, not a generic “exactly-once” guarantee. Consider naming the mechanism (dedup/idempotency key) explicitly here too.

### Thread 4: .claude/rules/dv2-data-split-discipline-activated.md:139 (resolved)

**@copilot-pull-request-reviewer** (2026-05-31T02:58:00Z):

P1: “the observe.ts ADR” is hard to resolve from this rule in isolation. Adding a concrete link to the ADR file keeps cross-references grep-able and avoids ambiguity if more observe-related ADRs land later.

### Thread 5: .claude/rules/dv2-data-split-discipline-activated.md:244 (resolved)

**@copilot-pull-request-reviewer** (2026-05-31T02:58:01Z):

P1: Similar to the earlier table wording, “exactly-once-effect” is easy to misread as an exactly-once guarantee. Tighten the phrasing to “dedup-keyed exactly-once effects” (or similar) to keep it precise.

### Thread 6: .claude/rules/dv2-data-split-discipline-activated.md:29 (resolved)

**@copilot-pull-request-reviewer** (2026-05-31T02:58:01Z):

P1: The table row conflates idempotency with “exactly-once” semantics. Idempotency enables exactly-once *effects* under at-least-once delivery (typically via idempotency keys / dedup), but doesn’t imply exactly-once delivery by itself—worth clarifying to avoid overpromising.

### Thread 7: .claude/rules/dv2-data-split-discipline-activated.md:114 (resolved)

**@copilot-pull-request-reviewer** (2026-05-31T02:58:01Z):

P1: “exactly-once-effect wrapper” is ambiguous; idempotency typically comes from an idempotency key + dedup, not a generic “exactly-once” guarantee. Consider naming the mechanism (dedup/idempotency key) explicitly here too.

### Thread 8: .claude/rules/dv2-data-split-discipline-activated.md:139 (resolved)

**@copilot-pull-request-reviewer** (2026-05-31T02:58:01Z):

P1: “the observe.ts ADR” is hard to resolve from this rule in isolation. Adding a concrete link to the ADR file keeps cross-references grep-able and avoids ambiguity if more observe-related ADRs land later.

### Thread 9: .claude/rules/dv2-data-split-discipline-activated.md:244 (resolved)

**@copilot-pull-request-reviewer** (2026-05-31T02:58:01Z):

P1: Similar to the earlier table wording, “exactly-once-effect” is easy to misread as an exactly-once guarantee. Tighten the phrasing to “dedup-keyed exactly-once effects” (or similar) to keep it precise.

### Thread 10: .claude/rules/dv2-data-split-discipline-activated.md:131 (resolved)

**@chatgpt-codex-connector** (2026-05-31T03:07:15Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Don't require CAS retry bodies to be idempotent**

In a lock-free CAS loop, failed compare-exchange attempts do not commit any effect; the loop rereads the current value and retries a transformation that may be intentionally non-idempotent, such as `x + 1` for an atomic counter. Stating that the operation itself must be idempotent would push future implementations away from valid lock-free counters/queues and toward unnecessary dedup machinery; the idempotency requirement applies to committed retry-visible effects, not to every speculative CAS attempt.

Useful? React with 👍 / 👎.

### Thread 11: .claude/rules/dv2-data-split-discipline-activated.md:164 (resolved)

**@chatgpt-codex-connector** (2026-05-31T03:07:15Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Don't treat Z-set retractions as duplicate guards**

For duplicate redelivery of an accumulating event, Z-set algebra alone does not make the duplicate a no-op: `ZSet.add` consolidates equal keys by summing weights, so replaying the same `+1` twice produces `+2` unless the event identity is deduplicated or an exact `-1` retraction is also delivered. This guidance can lead future agents to omit the idempotency key/dedup guard precisely for counters and audit appends, the cases the new rule says must be guarded.

Useful? React with 👍 / 👎.

## General comments

### @AceHack (2026-05-31T03:05:20Z)

All reviewer findings addressed in b08904221:

- **Codex P2** (DST equivalence too strong): softened — a pure single deterministic replay is sound on its own (each event applied once, even non-idempotent ones like counter-increment); idempotency is what keeps **redelivery / retry-after-crash / partial-replay** safe. "DST requires replay; idempotency makes redelivery/partial replay safe."
- **Copilot P1 ×3** (table row / "wrapper" / discriminator — "exactly-once" overpromise): tightened to **dedup-keyed exactly-once *effects* under at-least-once delivery (NOT exactly-once delivery)**, and named the mechanism (idempotency key + dedup window) explicitly at each spot.
- **Copilot P1** (unresolvable cross-ref): added the concrete ADR path link for "the observe.ts ADR".

### @AceHack (2026-05-31T03:08:20Z)

Both Codex P2s addressed in the latest commit — real technical corrections:

- **CAS bodies need not be idempotent**: a failed compare-exchange commits nothing; only the winning attempt takes effect, loser recomputations are discarded. Reframed to 'CAS makes a read-modify-write commit exactly once'; idempotency matters for lock-free only when the retried body has side effects beyond the CAS word.
- **Z-set retraction ≠ duplicate-guard**: `ZSet.add` sums weights, so a duplicate `+1` becomes `+2`. Reframed as a *correction* mechanism (compensating `−1` after the fact), not a dedup; accumulating-event dedup still needs an idempotency key at ingest.

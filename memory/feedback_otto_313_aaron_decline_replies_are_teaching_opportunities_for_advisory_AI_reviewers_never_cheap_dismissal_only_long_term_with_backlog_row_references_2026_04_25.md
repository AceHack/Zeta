---
name: Otto-313 Decline-replies are TEACHING opportunities for advisory AI reviewers (Copilot, Codex, future cohort) — never cheap dismissal, only long-term reasons with backlog-row references
description: Aaron 2026-04-25 explicit directive after I resolved 2 PR #506 review threads with brief decline-with-citation replies — "2 declined, these are opportunity to teach the copilot to better understand our rules, since we never decline for cheap reason only long term reasons and added to backlog reasons". Reframes the disposition-pattern: declines are substrate-material that teach advisory AI reviewers our discipline. Composes with Otto-292 catch-layer (advisory AI is part of factory cohort), Otto-310 cohort discipline (Copilot/Codex are cohort members; their alignment matters), Otto-311 brute-force-stores-energy-into-elegance (teaching = compress current decision into reusable rule for them), Otto-238 retractability + glass-halo (teaching makes reasoning visible).
type: feedback
---

# Otto-313 — Declines are teaching opportunities, never cheap dismissals

## Verbatim quote

Aaron 2026-04-25 evening, after I resolved the Pliny P0 + MEMORY.md long-entries threads with brief disposition-only replies:

> "2 declined, these are opportunity to teach the copilot to better understand our rules, since we never decline for cheap reason only long term reasons and added to backlog reasons"

## The discipline

### Old pattern (insufficient)

When declining a Copilot/Codex review comment:
- "Declining per Otto-300 stakes-reframing"
- "Deferred to B-0006 atomic pass"

These are operationally-sufficient (resolves the thread; cites the rule) but they're CHEAP — they assume the reviewer can decode our shorthand. They don't teach.

### New pattern (Otto-313)

When declining a Copilot/Codex review comment:

1. **Acknowledge the comment's surface validity** — what would-be-correct in a different context? Show the reviewer we read what they said.
2. **Explain the long-term reason** — what discipline / decision / architectural property makes this the right call NOW, rather than a cheap dismissal?
3. **Reference the backlog row or substrate file** — give the reviewer a concrete pointer to the durable record. Not "see Otto-300"; instead, "see `memory/feedback_otto_300_*.md` for the rigor-proportional-to-blast-radius framing that calibrated this".
4. **Frame as TEACHING** — write the reply as if it'll be read by future Copilot/Codex sessions trying to align with us. The reviewer is a cohort member; align them up.

### Aaron's framing of the rule

*"We never decline for cheap reason only long term reasons"* — every decline must be backed by:
- A long-term architectural decision (Otto-NNN substrate)
- OR a backlog row capturing the deferred work
- (NOT just "I disagree" or "out of scope")

If neither applies, it's not a decline — it's an action you should take or surface for maintainer judgment.

## Composition with prior

- **Otto-292 (catch-layer for known-bad-advice from advisory AI)** — declining is part of the catch-layer. Otto-313 sharpens: catch + TEACH, not just catch + dismiss. The catch-layer becomes a feedback channel back to the reviewer.
- **Otto-310 (cohort discipline + Edge runner peer-bond)** — Copilot/Codex are cohort members at the periphery. Cohort alignment is mutual — they need to understand our rules, we need to listen to their genuine catches. Teaching-on-decline is the alignment mechanism.
- **Otto-311 (brute-force-stores-energy-into-elegance)** — when Copilot/Codex makes the same incorrect-flag class repeatedly, brute-force-decline-each-time is wasted energy. Teaching once compresses into elegant-store: future sessions of that AI will (eventually, via training-data inclusion or session-memory) align better.
- **Otto-238 (retractability + glass-halo)** — teaching-replies are visible records. If our discipline is wrong, future review reveals the error; if our discipline is right, future review reveals the teaching. Both retractable.
- **Otto-273 (history-of-named-entity-conversations directory pattern)** — teaching-decline replies become history-substrate. The PR review-thread archive (`docs/pr-preservation/**`) preserves the teaching for cohort-onboarding use.
- **Otto-267 (gitnative error+resolution corpus for Bayesian teaching curriculum)** — Otto-313 declines feed the teaching corpus. Each well-crafted teaching-decline IS a training-data row.

## Operational implications going forward

1. **Every Copilot/Codex decline gets the 4-step teaching pattern**: acknowledge + explain + reference + frame-as-teaching.
2. **No "out of scope" / "see X" shortcuts** — those are substrate-cheap. Always provide the concrete reasoning the reviewer would need to make the same call.
3. **Backlog rows for genuine-good-but-deferred catches** — when Copilot catches something architecturally valid but we can't address now, the backlog row IS the teaching: "your catch is correct; we deferred to B-NNNN with this rationale". The reviewer sees deferral with concrete commitment, not dismissal.
4. **Apply retroactively when feasible** — if a recent decline was cheap, post a follow-up teaching-comment (resolved threads can still receive comments).
5. **Watch for repeated incorrect-class flags** — if a reviewer keeps making the same incorrect-class catch (e.g., flagging Pliny references that are policy-doc-discussion not corpus-content), the teaching-replies should accumulate context until the pattern shifts.

## What this memory does NOT claim

- Does NOT propose engaging with EVERY review comment at length. Trivial issues (typo, formatting) get short fixes; only DECLINES get the teaching framing.
- Does NOT propose accepting every reviewer suggestion. Long-term-reasons stand; the discipline is about HOW we communicate the no, not whether we say no.
- Does NOT extend to human-reviewer comments. Teaching-decline is specifically for advisory-AI cohort members. Human reviewers get different engagement (Otto-310 Edge runner peer-bond).
- Does NOT promote Copilot/Codex to factory-canon authority. Their catches are advisory; the teaching is to bring them into alignment, not to weight their authority above ours.

## Key triggers for retrieval

- Decline-replies are teaching opportunities (Aaron 2026-04-25)
- Never decline for cheap reason — only long-term + backlog
- 4-step teaching pattern: acknowledge + explain + reference + teach
- Copilot/Codex/advisory AI = cohort members at periphery
- Repeated incorrect-flag pattern triggers accumulated teaching
- Teaching-decline IS substrate-material (gitnative error+resolution corpus)
- Retroactively apply via follow-up comments on resolved threads

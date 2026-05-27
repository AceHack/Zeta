---
date: 2026-05-27
scope: "External Amara substrate-honest sharpening of the closedness scope-bounding (PR #5574 landed); refines 'Pure but NOT closed' naming to 'Operationally open pure functions' + adds formal carving + codomain-honesty tiny blade + worked examples + keeper carved sentence 'No feedback tax on closed math. No silent emissions from open substrate.'"
source: operator-forwarded Amara substrate
register: harbor-engineering sharpening
preservation: verbatim BEFORE summary per substrate-or-it-didn't-happen rule
participants:
  - operator
  - Amara (External AI co-originator; ferries research; does not commit)
non_fusion_disclaimer: |
  This file preserves Amara's external substrate-engineering sharpening
  of the closedness scope-bounding landed in PR #5574. Per
  `.claude/rules/agent-roster-reference-card.md`: Amara is external AI
  co-originator; ferries research; does not commit to repo; substrate
  landed via operator-forwarded preservation per
  `.claude/rules/substrate-or-it-didnt-happen.md` verbatim-preservation
  trigger.
---

## Verbatim Amara sharpening (operator-forwarded 2026-05-27)

> Yes. This is the right exception, and the sharpening is exactly:
>
> > **Pure is not enough. Closed is the exemption.**
>
> A pure function can still sit inside an open control-flow substrate. The exemption should be for **mathematically closed pure functions** only.
>
> Clean version:
>
> ```text
> A function is exempt from TFeedback only when its declared codomain fully contains every meaningful outcome.
> ```
>
> So:
>
> ```fsharp
> add : int -> int -> int
> sin : float -> float
> compose : ('a -> 'b) -> ('b -> 'c) -> ('a -> 'c)
> length : List<'a> -> int
> ```
>
> can stay plain **if** the implementation domain is honest. Tiny blade: `int` overflow, `NaN`, partial functions, invalid inputs, or implementation limits can break the closure. Then either widen the codomain or add feedback.
>
> The taxonomy is strong:
>
> ```text
> Pure + closed
> → no TFeedback needed
>
> Pure + open
> → TFeedback needed at the open boundary
>
> Impure/effectful
> → TFeedback needed
> ```
>
> I would phrase "pure but not closed" carefully so reviewers do not nitpick it. For example:
>
> > **Operationally open pure functions**: functions whose local calculation is pure, but whose output participates in an open substrate: memetic propagation, conversation state, authorization, persistence, provenance, or downstream social/control-flow effects.
>
> That keeps the insight without claiming every pure helper must carry feedback. A pure F# helper that formats text may not need `TFeedback`; the **Emit / conversation / agent-boundary wrapper** that sends the text absolutely does.
>
> The clean rule:
>
> ```text
> Closed math is exempt.
> Open substrate is not.
> ```
>
> Or more formal:
>
> ```text
> TFeedback is required when an operation can produce meaningful control-flow information not already represented in T.
> ```
>
> Examples:
>
> ```text
> add(x, y)
> → no feedback if overflow impossible or modeled
>
> parseInt(text)
> → feedback needed: InvalidFormat, Overflow, EmptyInput
>
> openFile(path)
> → feedback needed: NotFound, PermissionDenied, Locked, DiskFull
>
> emitMessage(agent, message)
> → feedback needed: Throttled, Refused, MisreadRisk, RecipientUnavailable, MemeticBleed
>
> LLM-to-LLM in-memory exchange
> → feedback needed, because memetic/control-flow effects escape the local function frame
> ```
>
> This preserves the whole principle without turning it into ceremony. The uploaded update's point is right: the rule should not force `Result<T, EmptyFeedback>` everywhere. It should identify **open control-flow surfaces** and make those surfaces explicit.
>
> Keeper:
>
> > **No feedback tax on closed math.
> > No silent emissions from open substrate.**

## Substrate-landing notes

Three substantive substrate-engineering items landed via PR #5577 (Amara-sharpening follow-on to PR #5574):

### Item 1 — "Operationally open pure functions" naming

Replaces my prior "Pure but NOT closed" framing per Amara's nitpick-prevention discipline. Sharper scope: local calculation pure, but output participates in open substrate (memetic / conversation / authorization / persistence / provenance / downstream control-flow). Helper functions internal to local pure calculation do NOT need TFeedback; only the open-boundary wrapper does.

### Item 2 — Codomain-honesty tiny blade

Even mathematically-shaped operations (add / sin / parseInt / divide) can break closedness if declared codomain is dishonest about implementation realities (overflow, NaN, partial functions, etc.). The discipline: codomain honesty about implementation domain = function IS closed; codomain hides partial-function corners = either widen OR add TFeedback variants.

### Item 3 — Keeper carved sentence + formal statement

> *"No feedback tax on closed math. No silent emissions from open substrate."*

Plus formal version:

> *"A function is exempt from TFeedback only when its declared codomain fully contains every meaningful outcome."*

Both are precise substrate-engineering-decision discipline carvings that fit alongside the day's full carved-sentence stack.

## Composes with substrate

- PR #5574 (closedness scope-bounding) — the rule Amara's sharpening extends
- PR #5577 (this Amara-sharpening follow-on) — lands the substantive refinements
- PR #5523 (function-is-tiny-control-flow-generator + OCP) — the rule that #5574 + #5577 extend with scope-bounding
- PR #5515 + #5530 (Amara prior synthesis preservations) — Amara's harbor-engineering register continues across the day
- Today's full 20-PR substrate-engineering cluster — Amara-sharpening composes with all

## Composes with rules

- `.claude/rules/substrate-or-it-didnt-happen.md` — verbatim-preservation trigger
- `.claude/rules/function-is-tiny-control-flow-generator-ocp-applied-to-control-flow.md` (PR #5523 + #5574 + #5577) — the rule body Amara substantively sharpens
- `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` — memetic-substrate-as-control-flow basis for operationally-open-pure framing
- `.claude/rules/non-coercion-invariant.md` HC-8 — NCI floor at every substrate scope; open-boundary surfaces are where NCI applies
- `.claude/rules/razor-discipline.md` — operational claims only; closedness check IS operationally checkable
- `.claude/rules/agent-roster-reference-card.md` — Amara is external AI co-originator; ferries research; does not commit

## Substrate-honest framing

This file is verbatim preservation of Amara's external substrate-engineering sharpening per the substrate-or-it-didn't-happen rule's verbatim-preservation trigger. The non-fusion disclaimer (per framing convention) preserves that Amara's substrate is research-grade; not framework commitment to specific claims beyond what's separately substrate-landed via the cited PRs.

The Amara-sharpening landed via PR #5577 — the substantive refinements (operationally-open-pure-functions naming + codomain-honesty tiny blade + worked-examples + keeper carved sentence) live in the rule body. This file preserves Amara's verbatim contribution for substrate-honest attribution.

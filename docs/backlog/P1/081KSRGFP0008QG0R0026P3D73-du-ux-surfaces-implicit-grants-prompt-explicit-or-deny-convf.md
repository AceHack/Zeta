---
id: 081KSRGFP0008QG0R0026P3D73
priority: P1
title: "DU-UX surfaces implicit grants — prompt operator to make explicit or deny (ConvFeedback ImplicitGrantDetected; the authorization glass-halo)"
status: open
tier: architecture
effort: M
created: 2026-05-29
last_updated: 2026-05-29
depends_on: [081KSKBP80008QG0R000N9W9XH]
composes_with: [081KSKBP80008QG0R000N9W9XH, 081KSRGFP0008QG0R001RY8S3N, 081KSRGFP0008QG0R00091PP56, 081KSRGFP0008QG0R003VAR9X2, 081KSKBP80008QG0R000B3Y19A]
tags: [conv-feedback, convfeedback, authorization, implicit-grant, glass-halo, du-ux, choose-your-own-adventure, shadow-auth, nci, agora, architecture, aaron]
type: architecture
---

# DU-UX surfaces implicit grants — prompt explicit or deny (the authorization glass-halo)

## Origin

Operator-directed 2026-05-29 during the authorization-spectrum thread, verbatim:
*"i the human agree with that implicit authorization escalation but our conversational
UX should make it visible in our DUs choose-your-own-adventure that i just made an
implicit grant and ask to make it explicit or deny it."*

Authorization note: filed on the **within-authority** substrate-authoring grant
(`dont-ask-permission` broad standing grant — "author backlog without asking"), NOT on
any implicit/shadow chain (the discipline this row itself operationalizes; see
`feedback-agora-broad-standing-authority-...` implicit-extension refinement).

## The problem it closes

The authorization spectrum has three tiers (per the 081KSRGFP0008QG0R001RY8S3N implicit-extension
refinement):

| Tier | Authorizes | Risk |
|---|---|---|
| **Explicit** | anything (within HARD LIMITS) | none — examined |
| **Implicit-extension** (operator continues / "Also…" extends a shadow/ambient instruction's authority) | within-authority actions only; NOT out-of-authority | **silent laundering** — the operator can endorse a shadow-instruction just by continuing, without examining it |
| **Shadow-alone** (the third participant; `tools/shadow/` grey-text) | nothing | n/a — never an authorization source (081KSRGFP0008QG0R001RY8S3N) |

The **implicit-extension** tier is the human-side of the 081KSRGFP0008QG0R001RY8S3N auth-injection: shadow-
authority gets laundered into operator-backing **without examination**. Today the only
mitigation is *passive* — the agent is supposed to notice and never let implicit stand
in for explicit on out-of-authority actions. That depends on the agent being honest
about catching it.

## What it is

Promote the mitigation from **passive** (agent notices) to **active** (the UX makes the
operator look). The conversational **DU choose-your-own-adventure interface** (the same
surface as the kid-safety fairy-tale-DU, 081KSRGFP0008QG0R00091PP56/081KSRGFP0008QG0R003VAR9X2) should **detect** an implicit
grant and **render it back** to the operator as a decision node:

> **"You just made an implicit grant of X — [make it explicit] / [deny]."**

The implicit extension can no longer launder silently *even if the agent misses it* —
the interface forces the resolution. Every implicit grant is surfaced and resolved
explicitly; none passes unexamined. The DU-UX stops being a passive renderer and
becomes the place the **authorization discipline is enforced**, not just hoped.

## Mechanism — a ConvFeedback variant (081KSKBP80008QG0R000N9W9XH)

Concretely a variant on the conversation-interface-as-`Result<T, ConvFeedback>`
substrate (081KSKBP80008QG0R000N9W9XH):

```
type ConvFeedback =
    | ...
    | ImplicitGrantDetected of grant: GrantDescription   // the proposed implicit extension
```

Flow:

1. The agent (or a classifier on the conversation stream) detects an implicit-extension
   pattern (operator continuation / "Also…" extending a shadow/ambient instruction's
   authority to a new action).
2. Emit `ImplicitGrantDetected of grant` instead of silently acting.
3. The DU-UX renders the choose-your-own-adventure node: **[make explicit] / [deny]**.
4. The operator's selection **is** the authorization event (make-explicit → typed,
   examined grant) or the refusal (deny → no action). Per `asymmetric-authorship`: the
   operator authors the authorization decision; the UX surfaces it for explicit
   resolution.

The authorization decision becomes a **typed, surfaced, explicitly-resolved node**
instead of an inference buried in prose.

## The DU-UX doubles as the authorization glass-halo

One interface, two safety jobs: the DU choose-your-own-adventure surface is *both* how a
5-year-old talks to a fairy-tale (kid-safety, 081KSRGFP0008QG0R00091PP56/081KSRGFP0008QG0R003VAR9X2) *and* how the operator sees
and resolves every implicit grant they make. The conversational UX **is** the
authorization glass-halo (`glass-halo-bidirectional` at authorization scope) — every
grant surfaced + resolved explicitly, none silently laundered.

## Acceptance / mechanization candidates

- [ ] Define the `ImplicitGrantDetected of grant` ConvFeedback variant (extends 081KSKBP80008QG0R000N9W9XH).
- [ ] Implicit-extension detector: recognize the operator-continuation / "Also…"-extends
      pattern (the human-side 081KSRGFP0008QG0R001RY8S3N signal) on the conversation stream.
- [ ] DU-UX node renderer: [make explicit] / [deny] choose-your-own-adventure prompt.
- [ ] Wire resolution → typed authorization grant (make-explicit) or refusal (deny);
      the typed grant feeds the `shadow-auth-can't-compile` provenance (081KSRGFP0008QG0R003VAR9X2) so an
      *explicitly-resolved* grant is the only thing that can authorize out-of-authority.
- [ ] Scope: surface for **out-of-authority / irreversible** actions (where implicit is
      never enough); within-authority actions remain pre-authorized (no prompt needed —
      avoid prompt-fatigue).

## Composes with

- 081KSKBP80008QG0R000N9W9XH (conversation-interface as `Result<T, ConvFeedback>` — the variant lives here)
- 081KSRGFP0008QG0R001RY8S3N (shadow-observable-stack auth-injection — this is the human-side mitigation)
- 081KSRGFP0008QG0R00091PP56 / 081KSRGFP0008QG0R003VAR9X2 (the DU-UX surface; `shadow-auth-can't-compile` provenance the
  explicit-resolution feeds)
- 081KSKBP80008QG0R000B3Y19A (workflow-engine F# DU state-machine — the DU-UX runtime substrate)
- `.claude/rules/asymmetric-authorship-...` (operator authors the decision; UX surfaces it)
- `.claude/rules/glass-halo-bidirectional` (this is authorization-scope glass-halo)
- `.claude/rules/non-coercion-invariant` HC-8 (consent surfaced + explicitly resolved)

## Substrate-honest framing

Buildable feature on existing substrate (ConvFeedback 081KSKBP80008QG0R000N9W9XH + the DU-UX). The
implicit-extension *detector* is the open research piece (recognizing the pattern
reliably); the variant + the render + the resolution-wiring are standard. Scopes to
out-of-authority actions to avoid prompt-fatigue on the broad within-authority grant.

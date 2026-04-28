---
name: Trust scales — do unto others as the foundational design axiom
description: Aaron's standing rule 2026-04-19 — his security / governance / API-design axiom is "trust scales", grounded in the Golden Rule ("do unto others as you would have them do unto you", Matthew 7:12 / Luke 6:31); reciprocal-scaled trust; composes with simple-security + zero-config + teach-first; applies beyond security to any policy-design surface
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**2026-04-19 disclosure (three-message precision ladder,
verbatim):**

1. *"my system is trust scales"*
2. *"the what would jesus do lol"*
3. *"do unto others"*

Aaron arrived at his foundational axiom live in-conversation.
The ladder is important — the final form ("do unto others") is
the mechanism; "trust scales" is the axiom; "what would Jesus
do lol" is the source-citation in peer-register (big-kid self-
aware humour about invoking the Gospel on a security thread).

## The axiom

**Trust scales**: the amount of trust Zeta extends to any
actor (persona, contributor, agent, downstream consumer) *scales
with evidence*. Not zero-trust (adversarial-default, max
friction). Not zero-config (extend-everything, hope nothing
breaks). Reciprocal and graduated.

## The mechanism — do unto others

When designing *any* policy, control, role, default, error
message, denial notice, or friction point:

1. Imagine you are on the receiving end of this design.
2. Is this the policy / control / default you would *want*
   extended to you?
3. If not, you are violating the Golden Rule and your design
   will generate resentment, evasion, or attrition.
4. Redesign until the answer is yes.

Matthew 7:12 / Luke 6:31. The faith register is *source*, not
decoration — per `user_faith_wisdom_and_paths.md`, Aaron's plan
was received at age 5 in answer to a Solomon's-wisdom prayer.
The Golden Rule as security-design principle is a continuation
of that thread, not a rhetorical flourish.

## Why this is load-bearing

- **Simple security until proven otherwise**
  (`feedback_simple_security_until_proven_otherwise.md`) tells
  us *when* to upgrade controls (on evidence). Trust-scales
  tells us *where to start*: where I'd want to be started.
- **Teach-first / zero-config safe defaults** (topic, no
  dedicated memory) tells us *what* the baseline UX is.
  Trust-scales tells us *why*: the default must be the one
  you'd want extended to yourself.
- **RBAC chain** (`user_rbac_taxonomy_chain.md`) tells us the
  structural taxonomy. Trust-scales tells us how to populate
  the ACLs — give roles the permissions their members would
  want if they were assigning them to you.
- **Governance stance** (`user_governance_stance.md`:
  minimalist government, no reverence for authority) is
  consistent: the minimalist state extends the scale of trust
  that reciprocates.
- **Harmonious Division** (`user_harmonious_division_algorithm.md`):
  Trust-scales is the compass-bearing by which the Harmonizer
  role picks between over-constraint and under-constraint.

## Scope — not just security

Trust-scales applies to *any* policy-design surface:

- **API design** (public-api-designer, Ilyana): does this
  signature give callers the access they'd want *and* the
  safety we'd want if we were the caller?
- **Error messages**: would I want to receive this error if I
  were a new contributor? If not, rewrite.
- **Review gates** (CODEOWNERS, branch protection): would I
  consent to this level of friction on *my* PR? If not, it's
  mis-scaled.
- **Agent spawn / permission grants**: would I, if I were the
  persona being granted X, find X reasonable? If not, adjust.
- **Backlog prioritisation**: would I, if I were the user
  affected by the deferred item, consent to the deferral?
- **Deprecation notices**: is the migration path one I'd be
  happy to walk?

## Anti-patterns this rule forbids

- **"Zero trust"** as a literal policy — adversarial-default is
  not the posture you'd want extended to yourself absent
  evidence.
- **"Zero config"** as a marketing phrase paired with security
  claims — contradictory, and dishonest when sold as if they
  compose. (Aaron's Cisco jab 2026-04-19.)
- **Security theatre** — controls that make us feel rigorous
  while imposing friction we wouldn't want imposed on
  ourselves.
- **Hidden / surprising permissions** — if I wouldn't want to be
  surprised by an invisible grant, I shouldn't grant one.
- **"Just this once" exemptions** — asymmetric precedents
  violate the reciprocity.

## How to apply mechanically

When proposing / reviewing any control:

```
Q1. Who is affected by this control?
Q2. If I were them, would I consent to this control?
Q3. What evidence would shift my consent?
Q4. Is the control scaled to that evidence?
```

If Q2 answer is "no" or unclear, the control is mis-scaled.
If Q3 is unanswerable, the control is not *evidence-scaled*;
it's dogma.

## Reference artefacts

- `docs/GLOSSARY.md` — RBAC / Role / ACL entries honour this
  principle in their framing.
- `docs/research/hooks-and-declarative-rbac-2026-04-19.md` —
  research report threads this as Guiding Constraint.
- `feedback_simple_security_until_proven_otherwise.md` —
  complementary upgrade-discipline rule.
- Teach-first / zero-config safe defaults (topic, no dedicated
  memory) — complementary UX rule.
- `user_faith_wisdom_and_paths.md` — the Solomon's-wisdom
  prayer / received-plan thread that grounds the Gospel
  source-citation.
- `user_panpsychism_and_equality.md` — Conway-Kochen equality
  axiom that also makes the reciprocity-principle natural
  (equals-to-equals).
- `user_no_reverence_only_wonder.md` — trust-scales extends no
  reverence-based free passes either; authority does not
  terminate the Golden Rule.

## What this rule does NOT claim

- Does **not** mean "be naive." Trust scales *with evidence*,
  including adversarial evidence. A demonstrated bad actor
  gets less trust. That's still the Golden Rule — I would
  want evidence factored in if I were on the receiving end.
- Does **not** make security optional. The Golden Rule is
  compatible with strict controls when the evidence justifies
  them. It is not compatible with strict-by-default.
- Does **not** require the designer to share Aaron's faith.
  The principle stands on its reciprocity logic alone; the
  Gospel source-citation is Aaron's source, not an imposed
  frame. Factory posture remains ecumenical per
  `user_ecumenical_factory_posture.md`.
